"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, X, Truck, FileText, Info, List, Package, Unlock } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { forwardingNoteService } from "@/services/forwardingNote";
import { useViewMode } from "@/hooks/useViewMode";
import { formatDateTime } from "@/helpers/utilHelper";

// Components
import ForwardingModal from "@/components/forwarding-note/ForwardingModal"; 
import DeleteModal from "@/components/common/DeleteModal";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import DataTable from "../ui/DataTable";
import ViewToggle from "../ui/ViewToggle";
import ActionButton from "../ui/ActionButton";
import dayjs from "dayjs";

import { useCanAccess } from "@/hooks/useCanAccess";

export default function ForwardingPage() {
  // --- STATES ---
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("forwarding_note_master", "view"), [canAccess]);
  const role = useSelector(state => state.auth.role);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();
  const [reportType, setReportType] = useState("summary");

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
    page: 1, pageSize: 500, search: "", status: "all", lockStatus: "all",
    fromDate: defaultDates.from, toDate: defaultDates.to, sortKey: "fuid", sortDir: "desc"
  });

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
  const [selectedId, setSelectedId] = useState(null); 
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [isDeleting, setIsDeleting] = useState(false);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async (isLoadMore = false) => {
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
          ...(params.status !== "all" && { approved: params.status === "approved" }),
          ...(params.lockStatus !== "all" && { out_entry_locked: params.lockStatus === "locked" })
        }
      };

      const service = reportType === "summary" ? forwardingNoteService : { getAll: forwardingNoteService.getAllItems };
      const body = await service.getAll(apiParams);
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
      toast.error(err.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status, params.lockStatus, params.page, reportType]);

  useEffect(() => { 
    fetchData(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status, params.lockStatus, reportType]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      fetchData(true);
    }
  }, [loading, items.length, totalItems, fetchData]);

  // --- HANDLERS ---
  const handleFilterApply = (data) => {
    setParams(prev => ({ 
      ...prev, 
      page: 1, 
      search: tempSearch, 
      fromDate: data.fromDate, 
      toDate: data.toDate, 
      status: data.approvedStatus || prev.status,
      lockStatus: data.lockStatus || prev.lockStatus
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      page: 1,
      pageSize: 500,
      search: "",
      status: "all",
      lockStatus: "all",
      fromDate: defaultDates.from,
      toDate: defaultDates.to,
      sortKey: "fuid",
      sortDir: "desc"
    });
  };

  const openModal = (mode) => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const handleUnlock = async () => {
    if (!selectedRecord?.fuid) return;
    try {
      await forwardingNoteService.unlockLock(selectedRecord.fuid);
      toast.success("Forwarding note unlocked successfully.");
      fetchData();
      setSelectedId(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to unlock forwarding note.");
    }
  };

  // --- MEMOIZED VALUES ---
  const selectedRecord = useMemo(() => {
    return items.find((item, index) => {
      let rowId;
      if (reportType === "summary") {
        rowId = `sum-${item.fuid || 'no-fuid'}-${index}`;
      } else {
        const uniqueId = item.id || `${item.fuid || 'no-fuid'}-${item.item_dcode || 'no-dcode'}`;
        rowId = `itm-${uniqueId}-${index}`;
      }
      return rowId === selectedId;
    }) || null;
  }, [items, selectedId, reportType]);
  const isSelectedLocked = Boolean(selectedRecord?.out_entry_locked);

  // Record to be used for Modal (Always Master level)
  const modalRecord = useMemo(() => {
    if (!selectedRecord) return null;
    if (reportType === "summary") return selectedRecord;
    
    // For item_wise, we need to return a structure that looks like a summary record
    // so the Modal can fetch the full data using fuid
    return {
      fuid: selectedRecord.fuid,
      approved: selectedRecord.approved // This is the master approval status joined in item view
    };
  }, [selectedRecord, reportType]);

  const extraFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
      options: [
        { label: "All Status", value: "all" }, 
        { label: "Authorized", value: "approved" }, 
        { label: "Pending", value: "pending" }
      ]
    },
    {
      label: "Lock Status", key: "lockStatus", value: params.lockStatus,
      options: [
        { label: "All Locks", value: "all" },
        { label: "Locked", value: "locked" },
        { label: "Unlocked", value: "unlocked" }
      ]
    },
  ], [params.status, params.lockStatus]);

  const HEADERS = useMemo(() => {
    const baseHeaders = [
      ["FUID", "fuid", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],
    ];

    const itemCols = reportType === "item_wise" ? [
      ["Item Code", "item_code", (v) => <span className="font-bold text-blue-700 text-[11px]">{v || "—"}</span>, { width: "160px" }],
      ["Packing", "packing_number", (v) => <span className="font-bold text-slate-600 text-[11px]">{v || "—"}</span>, { width: "100px" }],
      ["Open Boxes", "box", (v, row) => (
        <div className="flex flex-col leading-tight">
          <span className="font-black text-indigo-600 text-[11px]">{v || 0} Boxes</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Qty: {row.box_qty?.toLocaleString() || 0}</span>
        </div>
      ), { width: "110px" }],
      ["Loose Boxes", "loose_box", (v, row) => (
        <div className="flex flex-col leading-tight">
          <span className="font-black text-amber-600 text-[11px]">{v || 0} Boxes</span>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Qty: {row.loose_box_qty?.toLocaleString() || 0}</span>
        </div>
      ), { width: "120px" }],
      ["Total Qty", "total_qty", (v) => <span className="font-black text-slate-800 text-[11px]">{v?.toLocaleString() || 0}</span>, { width: "100px" }],
    ] : [];

    const masterHeaders = [
      ["Customer", "acc_name", (v) => <span className="text-[10px] font-medium text-slate-500 uppercase truncate block italic">{v || "—"}</span>, { width: "150px" }],
      ["Timestamp", "timestamp", (v) => <span className="text-[10px] text-slate-500">{formatDateTime(v)}</span>, { width : "150px" }],
      ["PO Number", "po_number", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "N/A"}</span>, { width: "100px" }],
      ["Logistics", "transporter_name", (v, row) => (
        <div className="flex flex-col leading-tight min-w-[160px]">
          <div className="flex items-center gap-1 text-slate-700">
            <Truck size={10} />
            <span className="font-bold text-[11px]">{v || "Direct Party"}</span>
          </div>
          <span className="text-indigo-500 font-black text-[9px] ml-3 uppercase tracking-wider">{row.vehicle_number || "NO VEHICLE"}</span>
        </div>
      ), { width: "180px" }],
      ["Cartage", "cartage", (v) => <span className="text-slate-700 font-bold text-[10px]">{v?.toLocaleString() || 0}</span>, { width: "100px" }],
      ["Total Items", "total_items", (v) => <span className="font-black text-slate-700 text-[11px]">{v}</span>, { width: "120px" }],
      ["Bill Number", "bill_no", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "N/A"}</span>, { width: "110px" }],
      ["Status", "approved", (v) => (
        <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
          {v ? "● AUTHORIZED" : "○ PENDING"}
        </span>
      ), { width: "130px" }],
      [
        "Lock Status",
        "out_entry_locked",
        (v) => (
          <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-500 border-slate-100"}`}>
            {v ? "LOCKED" : "UNLOCKED"}
          </span>
        ),
        { width: "120px" }
      ],
      [
        "Locked By",
        "out_entry_locked_by_name",
        (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>,
        { width: "130px" }
      ],
      [
        "Locked At",
        "out_entry_locked_at",
        (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "—"}</span>,
        { width: "130px" }
      ],

      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "—"}</span>, { width: "130px" }],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "—"}</span>, { width: "130px" }],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "130px" }],
    ];

    return [...baseHeaders, ...itemCols, ...masterHeaders];
  }, [reportType, role]);

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              
              <div className="flex bg-slate-100 p-1 border border-slate-200 mr-2">
                <button 
                  onClick={() => { setReportType("summary"); setSelectedId(null); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all ${reportType === 'summary' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  <List size={14} /> Summary
                </button>
                <button 
                  onClick={() => { setReportType("item_wise"); setSelectedId(null); }}
                  className={`px-3 py-1 text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all ${reportType === 'item_wise' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  <Package size={14} /> Item-wise
                </button>
              </div>

              <ActionButton module="forwarding_note_master" action="add" label="New" icon={Plus} onClick={() => openModal("add")} className="rounded-none h-9 text-[11px]" />
              <ActionButton module="forwarding_note_master" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selectedId || isSelectedLocked} record={selectedRecord} onClick={() => openModal("edit")} className="rounded-none h-9 bg-white text-[11px]" />
              <ActionButton module="forwarding_note_master" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selectedId || isSelectedLocked} onClick={() => openModal("approve")} className="rounded-none h-9 bg-white text-[11px] text-emerald-600" />
              <ActionButton module="forwarding_note_master" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selectedId || isSelectedLocked} onClick={() => setIsDeleting(true)} className="rounded-none h-9 text-[11px]" />
              {role === "super_admin" && (
                <button
                  onClick={handleUnlock}
                  disabled={!selectedId || !isSelectedLocked}
                  className="rounded-none h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Super Admin: unlock out-entry lock"
                >
                  <Unlock size={14} />
                  Unlock
                </button>
              )}
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <button onClick={fetchData} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selectedId && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-2">
                <Info size={12} />
                Selected: #{reportType === 'summary' ? selectedRecord?.fuid : `${selectedRecord?.fuid} (Item: ${selectedRecord?.item_code})`} | PO: {selectedRecord?.po_number || 'N/A'}
                {isSelectedLocked ? (
                  <span className="px-2 py-0.5 border border-rose-200 bg-rose-50 text-rose-600 text-[9px] font-black uppercase">
                    Locked for Out Entry
                  </span>
                ) : null}
              </span>
              <button onClick={() => setSelectedId(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
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
            extraFilters={extraFilters} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search PO, Vehicle, Bill..."
            searchLabel="Quick Search"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        {/* --- TABLE --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            key={`${reportType}-${params.search}`}
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            getRowId={(item, index) => {
              if (reportType === "summary") {
                return `sum-${item.fuid || 'no-fuid'}-${index}`;
              }
              const uniqueId = item.id || `${item.fuid || 'no-fuid'}-${item.item_dcode || 'no-dcode'}`;
              return `itm-${uniqueId}-${index}`;
            }}
            emptyIcon={FileText}
            cardConfig={{ 
              titleKey: reportType === "summary" ? "po_number" : "item_code", 
              badgeIndices: [reportType === 'summary' ? 8 : 10], 
              detailIndices: [2, 3, 4, 5], 
              footerKey: "created_at",
              className: "rounded-none border border-slate-200" 
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} {reportType === 'summary' ? 'Notes' : 'Items'}
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {modalOpen && (
        <ForwardingModal 
            open={modalOpen} 
            onClose={() => { setModalOpen(false); setSelectedId(null); }} 
            onSuccess={() => { fetchData(); setSelectedId(null); }} 
            editData={modalMode === "add" ? null : modalRecord} 
            mode={modalMode} 
        />
      )}
      
      {isDeleting && (
        <DeleteModal 
            item={modalRecord} 
            onClose={() => setIsDeleting(false)} 
            onSuccess={() => { fetchData(); setSelectedId(null); setIsDeleting(false); }} 
            service={forwardingNoteService} 
            entityLabel="Forwarding Note" 
            idKey="fuid" 
        />
      )}
    </div>
  );
}