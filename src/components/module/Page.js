"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Box, RefreshCcw, Edit3, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";

import { moduleService } from "@/services/module";
import { useViewMode } from "@/hooks/useViewMode";
import { formatDateTime } from "@/helpers/utilHelper";

import dayjs from "dayjs";

import ActionButton from "../ui/ActionButton";
import ViewToggle from "../ui/ViewToggle";
import DataTable from "../ui/DataTable";
import ModuleModal from "./ModuleModal";
import DeleteModal from "../common/DeleteModal";
import DateRangeFilter from "../common/DateRangeFilter";

import { useCanAccess } from "@/hooks/useCanAccess";

export default function ModulesPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("modules", "view"), [canAccess]);

  const [modules, setModules] = useState([]);
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
    page: 1, pageSize: 50, search: "", status: "all", sortKey: "id", sortDir: "desc",
    fromDate: defaultDates.from, toDate: defaultDates.to
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
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModule, setEditModule] = useState(null);
  const [deleteModule, setDeleteModule] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState("");

  const fetchModules = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      setBlockedMessage("");
      const currentPage = isLoadMore ? params.page + 1 : 1;
      const apiParams = {
        page: currentPage,
        limit: params.pageSize,
        sortBy: params.sortKey,
        order: params.sortDir.toUpperCase(),
        search: params.search || undefined,
        filters: {
          ...(params.status !== "all" && { is_active: params.status === "active" ? 1 : 0 }),
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
        },
      };
      const body = await moduleService.getAll(apiParams);
      const list = body?.data ?? [];
      const newItems = Array.isArray(list) ? list : [];

      if (isLoadMore) {
        setModules(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setModules(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }
      setTotalItems(body?.total ?? (Array.isArray(list) ? list.length : 0));
    } catch (err) {
      const msg = err?.message || "";
      const denied = err?.status === 403 && (
        msg.includes("Access Denied — module") ||
        msg.toLowerCase().includes("deactivated")
      );
      if (denied) {
        setModules([]);
        setTotalItems(0);
        setBlockedMessage(msg);
      } else {
        toast.error(err?.message || "Failed to load modules");
      }
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.status, params.page]);

  useEffect(() => { 
    fetchModules(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.status, params.fromDate, params.toDate]);

  const handleLoadMore = useCallback(() => {
    if (!loading && modules.length < totalItems) {
      fetchModules(true);
    }
  }, [loading, modules.length, totalItems, fetchModules]);

  const handleToggle = async (id) => {
    try {
      const response = await moduleService.toggleStatus(id);
      setModules((prev) => prev.map((m) => m.id === id ? { ...m, is_active: response.data.is_active } : m));
      toast.success("Status updated");
    } catch (err) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  const handleFilterApply = (data) => {
    setParams(prev => ({ ...prev, page: 1, search: tempSearch, status: data.status || "all", fromDate: data.fromDate, toDate: data.toDate }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams(prev => ({ ...prev, page: 1, search: "", status: "all", fromDate: defaultDates.from, toDate: defaultDates.to }));
  };

  const extraFilters = useMemo(() => [
    { label: "Status", key: "status", value: params.status, options: [{ label: "All Status", value: "all" }, { label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }] }
  ], [params.status]);

  const HEADERS = [
    ["Module Name", "name", (v) => (
      <div className="flex flex-col py-1">
        <span className="font-bold text-slate-800 text-[11px] md:text-xs uppercase tracking-tight">{v}</span>
      </div>
    )],
    ["Module Label", "label", (v) => <span className="text-slate-600 text-[11px] md:text-xs font-medium">{v}</span>],
    ["Status", "is_active", (v, row) => (
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => handleToggle(row.id)} className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-200 ${v ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300"}`}>
          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ${v ? "translate-x-4" : "translate-x-1"}`} />
        </button>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${v ? "text-emerald-600" : "text-slate-400"}`}>{v ? "Active" : "Inactive"}</span>
      </div>
    )],
    ["Created At", "created_at", (v) => (
      <div className="flex flex-col">
        <span className="text-slate-700 text-[11px] md:text-xs font-semibold">{formatDateTime(v).split(',')[0]}</span>
        <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v).split(',')[1]}</span>
      </div>
    )],
  ];

  const selectedRecord = modules.find((m) => m.id === selected);

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- TOP ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Action Group */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 
              <ActionButton module="modules" action="add" label="New" icon={Plus} onClick={() => { setEditModule(null); setModalOpen(true); }} className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none border-slate-300" />
              <ActionButton module="modules" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selectedRecord} onClick={() => { setEditModule(selectedRecord); setModalOpen(true); }} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none" />
              <ActionButton module="modules" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selectedRecord} onClick={() => setDeleteModule(selectedRecord)} className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none" />

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              */}
              

              <button onClick={fetchModules} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            {/* ViewToggle Alignment Match */}
            <div className="flex items-center">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>
          </div>

          {/* Selection Indicator (Consistency with Users Page) */}
          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic">Selected Module: {selectedRecord?.name}</span>
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
            searchPlaceholder="Name or Label..."
            searchLabel="Search Module"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        {/* --- DATA AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} getRowId={(row) => row.id} data={modules} loading={loading}
            viewMode={viewMode} allowCopy={true} showSelection={true} skeletonCount={params.pageSize}
            emptyIcon={Box}
            emptyMessage={blockedMessage || "No modules found"}
            emptySubMessage={blockedMessage ? "No records are available for the current selection." : undefined}
            sortKey={params.sortKey} sortDir={params.sortDir}
            onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
            selectedId={selected} onSelect={setSelected}
            onLoadMore={handleLoadMore}
            hasMore={modules.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ 
              titleKey: "name", tagsKeys: ["is_active"], detailKeys: ["label"], footerKey: "created_at",
              className: "rounded-none shadow-sm border border-slate-200 overflow-hidden"
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {modules.length} of {totalItems} Modules
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && <ModuleModal open={modalOpen} onClose={() => { setModalOpen(false); setEditModule(null); }} onSuccess={() => { fetchModules(); setSelected(null); }} editData={editModule} />}
      {deleteModule && <DeleteModal item={deleteModule} onClose={() => setDeleteModule(null)} onSuccess={() => { fetchModules(); setSelected(null); }} service={moduleService} entityLabel="Module" />}
    </div>
  );
}