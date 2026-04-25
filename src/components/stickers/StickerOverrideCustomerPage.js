"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, ScanLine, RefreshCcw, ShieldCheck, X, Search, FileText } from "lucide-react";
import { toast } from "react-toastify";
import { boxService } from "@/services/box";
import { useViewMode } from "@/hooks/useViewMode";

// Components
import ActionButton from "@/components/ui/ActionButton";
import ViewToggle from "@/components/ui/ViewToggle";
import DataTable from "@/components/ui/DataTable";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import StickerOverrideModal from "@/components/stickers/StickerOverrideModal";

import { formatDateTime } from "@/helpers/utilHelper";
import dayjs from "dayjs";

import { useCanAccess } from "@/hooks/useCanAccess";

export default function StickerOverrideCustomerPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("box_table", "view"), [canAccess]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  // Calculate default dates based on permission days
  const defaultDates = useMemo(() => {
    const days = viewAccess?.days;
    if (days > 0) {
      const to = dayjs().format("YYYY-MM-DD");
      const from = dayjs().subtract(days - 1, "day").format("YYYY-MM-DD");
      return { from, to };
    }
    return { from: "", to: "" };
  }, [viewAccess?.days]);

  // Unified Params State (Modern Standard)
  const [params, setParams] = useState({
    page: 1, pageSize: 500, search: "", status: "all",
    fromDate: defaultDates.from, toDate: defaultDates.to, sortKey: "request_id", sortDir: "desc"
  });

  // Update params if defaultDates change
  useEffect(() => {
    if (defaultDates.from || defaultDates.to) {
      setParams(prev => ({
        ...prev,
        fromDate: defaultDates.from,
        toDate: defaultDates.to
      }));
    }
  }, [defaultDates.from, defaultDates.to]);

  const [tempSearch, setTempSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [editItem, setEditItem] = useState(null);

  const fetchRequests = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      const currentPage = isLoadMore ? params.page + 1 : 1;
      const apiParams = {
        page: currentPage,
        limit: params.pageSize,
        sortBy: params.sortKey,
        order: params.sortDir.toUpperCase(),
        search: params.search || undefined,
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { status: params.status }),
        },
      };
      
      const body = await boxService.getOverrideRequests(apiParams);
      const list = body.data ?? [];
      const newItems = Array.isArray(list) ? list : [];

      if (isLoadMore) {
        setItems(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setItems(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }
      setTotalItems(body.total ?? 0);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load override requests");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status, params.page]);

  useEffect(() => { 
    fetchRequests(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      fetchRequests(true);
    }
  }, [loading, items.length, totalItems, fetchRequests]);

  const handleFilterApply = (data) => {
    setParams(prev => ({ 
      ...prev, 
      page: 1, 
      search: tempSearch, 
      fromDate: data.fromDate, 
      toDate: data.toDate, 
      status: data.approvedStatus || prev.status 
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams(prev => ({ ...prev, page: 1, search: "", status: "all", fromDate: defaultDates.from, toDate: defaultDates.to }));
  };

  const statusFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
      options: [
        { label: "All Status", value: "all" },
        { label: "Pending", value: "pending" },
        { label: "Approved", value: "approved" },
        { label: "Rejected", value: "rejected" },
      ] 
    },
  ], [params.status]);

  const selectedRecord = items.find((u) => u.request_id === selected);

  const HEADERS = [
    // ["#", "request_id", (v, row, i) => (params.page - 1) * params.pageSize + i + 1, { fixed: true, width: "50px", align: "center" }],
    ["Packing No", "packing_number", (v) => (
      <div className="flex items-center gap-2">
        <ScanLine size={12} className="text-indigo-500" />
        <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v}</span>
      </div>
    ), { fixed: true, width: "140px" }],

    ["Item Code", "itemdcode", (v, row) => <span className="text-[10px] font-bold text-slate-600 uppercase max-w-[150px]">{row.item_name || "—"}</span>, { width: "120px" }],

    [ "Box No UIDs", "box_no_uids", (v) => (
        <div className="flex flex-wrap gap-1 max-w-[300px]">
          {v && Array.isArray(v) ? (
            v.map((code, idx) => (
              <span key={idx} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 text-[9px] font-mono">
                {code}
              </span>
            ))
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ), 
      { width: "250px", sortable: false }
    ],

    ["Transfer Flow", "from_customer", (v, row) => (
      <div className="flex items-center gap-2 text-[10px] py-1">
        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-medium">{row.from_customer_name || "—"}</span>
        <span className="text-indigo-400 font-bold">→</span>
        <span className="px-1.5 py-0.5 bg-indigo-50 rounded text-indigo-700 font-bold">{row.to_customer_name || "—"}</span>
      </div>
    ), { width: "340px" }],

    ["Status", "status", (v, row) => {
        const status =
          row?.status === "rejected" || row?.status === "approved" || row?.status === "pending"
            ? row.status
            : row?.approved === true
              ? "approved"
              : "pending";

        const colors = {
            approved: "bg-emerald-50 text-emerald-600 border-emerald-100",
            rejected: "bg-rose-50 text-rose-600 border-rose-100",
            pending: "bg-amber-50 text-amber-600 border-amber-100"
        };

        const labels = {
            approved: "Approved",
            pending: "Pending",
            rejected: "Rejected",
        };

        return (
            <span className={`px-2 py-0.5 rounded-full text-[9px] border font-black uppercase flex items-center gap-1 w-fit ${colors[status] || colors.pending}`}>
                <span className="text-[12px]">●</span> {labels[status] || labels.pending}
            </span>
        );
      }, { width: "160px" }
    ],

    ["Requested By", "requested_by_name", (v) => <span className="text-[10px] font-bold text-slate-500 uppercase">{v || "—"}</span>, { width: "130px" }],
    ["Requested At", "requested_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "140px" }],
    
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "—"}</span>, { width: "130px" }],
    
    [
      "Remarks",
      "remarks",
      (v) => (
        <span
          className="block text-[10px] text-slate-500 line-clamp-4 whitespace-pre-wrap break-words min-w-0 max-w-full"
          title={v ? String(v) : ""}
        >
          {v || "—"}
        </span>
      ),
      { width: "220px", wrap: true },
    ],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- TOP ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            <div className="flex items-center gap-2 flex-wrap">
              
              <ActionButton 
                module="box_table" action="add" label="New Request" icon={Plus} 
                onClick={() => { setEditItem(null); setModalMode("add"); setModalOpen(true); }} 
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" 
              />
              
              <ActionButton 
                module="box_table" action="authorize" variant="outline" label="Approve / Reject" icon={ShieldCheck} 
                // disabled={!selected || selectedRecord?.status !== "pending"} 
                onClick={() => { setEditItem(selectedRecord); setModalMode("approve"); setModalOpen(true); }} 
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none text-indigo-600" 
              />

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <button onClick={fetchRequests} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                Selected Request: #{selectedRecord?.request_id} ({selectedRecord?.packing_number})
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* --- FILTER BAR --- */}
        <div className="px-3 md:px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            extraFilters={statusFilters} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Packing no, item code..."
            searchLabel="Search Packing/Item"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        {/* --- DATA TABLE AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              headers={HEADERS} data={items} loading={loading}
              getRowId={(item) => item.request_id}
              viewMode={viewMode} allowCopy={true} showSelection={true} skeletonCount={params.pageSize}
              emptyIcon={FileText} sortKey={params.sortKey} sortDir={params.sortDir}
              onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
              selectedId={selected} onSelect={setSelected}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{
                titleKey: "packing_number", badgeIndices: [4], detailIndices: [1, 2, 3], footerKey: "created_at",
                className: "rounded-none border border-slate-200 shadow-none" 
              }}
            />
          </div>
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Override Requests
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <StickerOverrideModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditItem(null); }}
          onSuccess={() => { fetchRequests(); setSelected(null); }}
          editData={editItem}
          mode={modalMode}
        />
      )}
    </div>
  );
}