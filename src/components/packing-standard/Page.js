"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Package, RefreshCcw, Edit3, Trash2, CheckCircle, X, Info } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import { formatDateTime } from "@/helpers/utilHelper";
import { packingStandardService } from "@/services/packingStandard";
import { useViewMode } from "@/hooks/useViewMode";

// Components
import ActionButton from "@/components/ui/ActionButton";
import ViewToggle from "@/components/ui/ViewToggle";
import DeleteModal from "@/components/common/DeleteModal";
import DataTable from "@/components/ui/DataTable";
import PackingStandardModal from "@/components/packing-standard/PackingModal";
import DateRangeFilter from "@/components/common/DateRangeFilter";

import { useCanAccess } from "@/hooks/useCanAccess";

export default function PackingStandardPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("packing_standard", "view"), [canAccess]);

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

  const [params, setParams] = useState({
    page: 1, pageSize: 500, search: "", status: "all",
    fromDate: defaultDates.from, toDate: defaultDates.to, sortKey: "standard_id", sortDir: "desc"
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
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchPackingStandards = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      const currentPage = isLoadMore ? params.page + 1 : 1;
      const apiParams = {
        page: currentPage, limit: params.pageSize,
        sortBy: params.sortKey, order: params.sortDir.toUpperCase(),
        search: params.search || undefined,
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
        },
      };
      const body = await packingStandardService.getAll(apiParams);
      const newItems = body.data ?? [];

      if (isLoadMore) {
        setItems(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setItems(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }
      setTotalItems(body.total ?? 0);
    } catch (err) {
      toast.error(err?.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status, params.page]);

  useEffect(() => { 
    fetchPackingStandards(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      fetchPackingStandards(true);
    }
  }, [loading, items.length, totalItems, fetchPackingStandards]);

  const handleFilterApply = (data) => {
    setParams(prev => ({ 
      ...prev, page: 1, search: tempSearch, fromDate: data.fromDate, 
      toDate: data.toDate, status: data.approvedStatus || prev.status 
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams(prev => ({ ...prev, page: 1, search: "", status: "all", fromDate: defaultDates.from, toDate: defaultDates.to }));
  };

  const extraFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
      options: [
        { label: "All Status", value: "all" }, 
        { label: "Authorized", value: "approved" }, 
        { label: "Pending", value: "pending" }
      ] 
    },
  ], [params.status]);

  const selectedRecord = useMemo(() => items.find((u) => u.standard_id === selected), [items, selected]);

  const HEADERS = [
    ["Standard ID", "standard_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "120px" }],
    ["Item Code", "item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v}</span>, { fixed: true, width: "150px" }],
    ["Description", "item_desc", (v) => <span className="text-[10px] text-slate-500 truncate block italic">{v || "—"}</span>, { width: "180px" }],
    ["Qty", "qty", (v, row) => (
      <div className="flex items-baseline gap-1 py-1">
        <span className="font-black text-slate-700 text-[11px]">{v}</span>
        <span className="text-[9px] text-slate-400 font-bold uppercase italic">{row.unit}</span>
      </div>
    ), { width: "80px", align: "center" }],
    ["Category", "category_name", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-bold text-slate-600 uppercase">{v || "N/A"}</span>
      </div>
    ), { width: "130px" }],
    ["Customer", "acc_name", (v) => <span className="text-[10px] font-medium text-slate-500 uppercase truncate block italic">{v || "—"}</span>, { width: "150px" }],
    ["Status", "approved", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "● AUTHORIZED" : "○ PENDING"}
      </span>
    ), { width: "110px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "—"}</span>, { width: "130px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "—"}</span>, { width: "130px" }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "130px" }],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButton module="packing_standard" action="add" label="New" icon={Plus} onClick={() => { setEditItem(null); setModalMode("add"); setModalOpen(true); }} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              <ActionButton module="packing_standard" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={() => { setEditItem(selectedRecord); setModalMode("edit"); setModalOpen(true); }} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none" />
              <ActionButton module="packing_standard" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selected} onClick={() => { setEditItem(selectedRecord); setModalMode("approve"); setModalOpen(true); }} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none" />
              <ActionButton module="packing_standard" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              <button onClick={fetchPackingStandards} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Selected: {selectedRecord?.item_code}</span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        <div className="px-3 md:px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            extraFilters={extraFilters} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search item..."
            searchLabel="Search Standard"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} data={items} loading={loading}
            viewMode={viewMode} allowCopy={true} showSelection={true} skeletonCount={params.pageSize}
            emptyIcon={Package} sortKey={params.sortKey} sortDir={params.sortDir}
            onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
            selectedId={selected} onSelect={setSelected}
            getRowId={(item) => item.standard_id}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ titleKey: "item_code", badgeIndices: [7], detailIndices: [3, 4, 6], footerKey: "created_at" }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Packing Standards
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <PackingStandardModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => { fetchPackingStandards(); setSelected(null); }} editData={editItem} mode={modalMode} />
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchPackingStandards(); setSelected(null); }} service={packingStandardService} entityLabel="Packing Standard" idKey="standard_id" />
    </div>
  );
}