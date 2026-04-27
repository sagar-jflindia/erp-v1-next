"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Locate, Box, Edit3, Trash2, CheckCircle, X } from "lucide-react";
import { toast } from "react-toastify";
import { inventoryInwardService } from "@/services/inventoryInward";
import dayjs from "dayjs";

// Components
import InwardModal from "@/components/inventory-inward/InwardModal"; 
import DeleteModal from "@/components/common/DeleteModal";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import { useViewMode } from "@/hooks/useViewMode";
import DataTable from "../ui/DataTable";
import ViewToggle from "../ui/ViewToggle";
import ActionButton from "../ui/ActionButton";
import LocationFinderDrawer from "../location/LocationFinderDrawer";

import { useCanAccess } from "@/hooks/useCanAccess";

export default function InwardPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("inventory_inwards", "view"), [canAccess]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  // Calculate default dates based on permission days
  const defaultDates = useMemo(() => {
    console.log(viewAccess);  
    const days = viewAccess?.days;
    console.log(days);  
    if (days > 0) {
      const to = dayjs().format("YYYY-MM-DD");
      const from = dayjs().subtract(days - 1, "day").format("YYYY-MM-DD");
      return { from, to };
    }
    return { from: "", to: "" };
  }, [viewAccess?.days]);

  // --- Unified Params State ---
  const [params, setParams] = useState({
    page: 1, pageSize: 500, search: "", status: "all",
    fromDate: defaultDates.from, toDate: defaultDates.to, sortKey: "in_uid", sortDir: "desc"
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
  const [finderOpen, setFinderOpen] = useState(false);

  // --- Fetch Data ---
  const fetchInwards = useCallback(async (isLoadMore = false) => {
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
          ...(params.status !== "all" && { approved: params.status === "approved" })
        }
      };
      const body = await inventoryInwardService.getAll(apiParams);
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
      toast.error(err?.message || "Failed to load inwards");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status, params.page]);

  useEffect(() => { 
    fetchInwards(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      fetchInwards(true);
    }
  }, [loading, items.length, totalItems, fetchInwards]);

  // --- Filter Handlers ---
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
    setParams(prev => ({ 
      ...prev, 
      page: 1, 
      search: "", 
      status: "all", 
      fromDate: defaultDates.from, 
      toDate: defaultDates.to 
    }));
  };

  const extraFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
      options: [
        { label: "All Status", value: "all" }, 
        { label: "Approved", value: "approved" }, 
        { label: "Pending", value: "pending" }
      ] 
    },
  ], [params.status]);

  const selectedRecord = items.find(i => i.in_uid === selected);

  // --- Table Headers (Full Columns Added) ---
  const HEADERS = [
    ["Inward UID", "in_uid", (v) => <span className="font-bold text-indigo-600 text-[10px]">{v}</span>, { fixed: true, width: "120px" }],
    ["Packing No", "packing_number", (v) => <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || "—"}</span>, { fixed: true, width: "120px" }],
    ["Remarks", "remarks", (v) => <span className="text-slate-500 text-[10px] truncate block">{v || "—"}</span>, { width: "200px" }],
    ["Status", "approved", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "● Approved" : "○ Pending"}
      </span>
    ), { width: "120px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] font-bold text-slate-500 uppercase">{v || "-"}</span>, { width: "120px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "-"}</span>, { width: "130px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "-"}</span>, { width: "120px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400">{v ? dayjs(v).format("DD/MM/YY hh:mm A") : "-"}</span>, { width: "130px" }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "-"}</span>, { width: "120px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{dayjs(v).format("DD/MM/YY hh:mm A")}</span>, { width: "130px" }],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- TOP ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButton module="location_master" action="view" label="Finder" icon={Locate} onClick={() => setFinderOpen(true)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              <ActionButton module="inventory_inwards" action="add" label="New" icon={Plus} onClick={() => { setEditItem(null); setModalMode("add"); setModalOpen(true); }} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              <ActionButton module="inventory_inwards" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={() => { setEditItem(selectedRecord); setModalMode("edit"); setModalOpen(true); }} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none" />
              <ActionButton module="inventory_inwards" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selected || selectedRecord?.approved} onClick={() => { setEditItem(selectedRecord); setModalMode("approve"); setModalOpen(true); }} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none" />
              <ActionButton module="inventory_inwards" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              
              <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1" />
              
              <button onClick={fetchInwards} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Selected: {selectedRecord?.packing_number}</span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
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
            searchPlaceholder="Search packing..."
            searchLabel="Search Packing No"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        {/* --- DATA TABLE AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              headers={HEADERS}
              data={items}
              loading={loading}
              viewMode={viewMode}
              onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
              sortKey={params.sortKey}
              sortDir={params.sortDir}
              selectedId={selected}
              onSelect={setSelected}
              getRowId={(item) => item.in_uid}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{ 
                titleKey: "packing_number", 
                badgeIndices: [4], 
                detailIndices: [1, 3, 5], 
                footerKey: "created_at" 
              }}
            />
          </div>
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Inward Entries
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <InwardModal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} onSuccess={() => { fetchInwards(); setSelected(null); }} editData={editItem} mode={modalMode} />
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchInwards(); setSelected(null); }} service={inventoryInwardService} entityLabel="Inward Entry" idKey="in_uid" />
      {finderOpen && <LocationFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}
    </div>
  );
}