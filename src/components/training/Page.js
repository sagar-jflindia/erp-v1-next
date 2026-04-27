"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Video, Plus, Check, X } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";

import { moduleService } from "@/services/module";
import { trainingVideoService } from "@/services/training";
import { useViewMode } from "@/hooks/useViewMode";
import { useCanAccess } from "@/hooks/useCanAccess";
import { PERMS } from "@/components/common/Constants";

import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/common-table/EmptyState";
import DateRangeFilter from "../common/DateRangeFilter";
import ViewToggle from "@/components/ui/ViewToggle";
import VideoModal from "@/components/training/VideoModal";

// --- PERMISSION CELL (SHARP & MINIMAL) ---
function PermissionCell({ video, perm, onClick, disabled = false, isTable = false }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`
        flex flex-col items-center justify-center transition-all duration-200 border
        ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}
        ${isTable ? "h-10 w-16 rounded-none" : "h-12 w-full rounded-none"}
        ${video 
          ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:border-emerald-400" 
          : "bg-slate-50 border-dashed border-slate-300 text-slate-400 hover:border-slate-500 hover:text-slate-600 hover:bg-white"
        }
      `}
    >
      {video ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
      <span className="text-[9px] font-bold uppercase tracking-tighter mt-0.5">{perm}</span>
    </div>
  );
}

// --- MODULE CARD (SHARP THEME) ---
function ModuleCard({ mod, perms, getVideo, onClick, disabledActions }) {
  return (
    <div className="bg-white border border-slate-300 rounded-none p-4 hover:border-slate-400 transition-all flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-slate-800 text-[11px] md:text-xs uppercase tracking-tight truncate">{mod.name}</span>
          <span className="text-[10px] text-slate-400 font-medium truncate italic">{mod.label}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-none text-[9px] font-bold uppercase tracking-wider border shrink-0 ${
          mod.is_active ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"
        }`}>
          {mod.is_active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="mt-auto grid grid-cols-3 gap-2">
        {perms.map(p => (
          <PermissionCell
            key={p}
            perm={p}
            video={getVideo(mod.id, p)}
            disabled={disabledActions}
            onClick={() => onClick(mod, p)}
          />
        ))}
      </div>
    </div>
  );
}

export default function TrainingPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("training_videos", "view"), [canAccess]);
  const canAddTraining = useMemo(() => {
    const access = canAccess("training_videos", "add");
    return typeof access === "object" ? access.allowed : !!access;
  }, [canAccess]);
  const canEditTraining = useMemo(() => {
    const access = canAccess("training_videos", "edit");
    return typeof access === "object" ? access.allowed : !!access;
  }, [canAccess]);
  const canDeleteTraining = useMemo(() => {
    const access = canAccess("training_videos", "delete");
    return typeof access === "object" ? access.allowed : !!access;
  }, [canAccess]);

  const [modules, setModules] = useState([]);
  const [videos, setVideos] = useState([]);
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
    page: 1, pageSize: 50, search: "", sortKey: "id", sortDir: "desc",
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
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState("");

  const fetchData = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      setBlockedMessage("");
      const currentPage = isLoadMore ? params.page + 1 : 1;
      const apiParams = { 
        page: currentPage, 
        limit: params.pageSize, 
        sortBy: params.sortKey, 
        order: params.sortDir.toUpperCase(), 
        search: params.search || undefined 
      };
      const [modRes, vidRes] = await Promise.all([
        moduleService.getAll(apiParams),
        trainingVideoService.getAll({})
      ]);

      const list = modRes.data?.data ?? modRes.data ?? [];
      const newItems = Array.isArray(list) ? list : [];

      if (isLoadMore) {
        setModules(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setModules(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }

      setTotalItems(modRes.data?.total ?? modRes.total ?? (Array.isArray(list) ? list.length : 0));
      setVideos(vidRes.data || []);
    } catch (err) {
      const msg = err?.message || "";
      const denied = err?.status === 403 && (
        msg.includes("Access Denied — module") ||
        msg.toLowerCase().includes("deactivated")
      );
      if (denied) {
        setModules([]);
        setVideos([]);
        setTotalItems(0);
        setBlockedMessage(msg);
      } else {
        toast.error(err?.message || "Failed to load training data");
      }
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.page]);

  useEffect(() => { 
    fetchData(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search]);

  const handleLoadMore = useCallback(() => {
    if (!loading && modules.length < totalItems) {
      fetchData(true);
    }
  }, [loading, modules.length, totalItems, fetchData]);

  const getVideo = (modId, perm) => videos.find(v => v.module_id === modId && v.permission_type === perm);

  const handleBoxClick = (mod, perm) => {
    const existing = getVideo(mod.id, perm);
    if (existing && !canEditTraining) {
      toast.error("You do not have permission to edit training videos.");
      return;
    }
    if (!existing && !canAddTraining) {
      toast.error("You do not have permission to add training videos.");
      return;
    }
    setSelectedSlot({ 
      modId: mod.id, perm, modLabel: mod.label, 
      isEdit: !!existing, id: existing?.id, existingData: existing,
      canAdd: canAddTraining, canEdit: canEditTraining, canDelete: canDeleteTraining
    });
  };

  const handleFilterApply = (data) => setParams(prev => ({ ...prev, page: 1, search: tempSearch, fromDate: data.fromDate, toDate: data.toDate }));
  const handleReset = () => { setTempSearch(""); setParams(prev => ({ ...prev, page: 1, search: "", fromDate: defaultDates.from, toDate: defaultDates.to })); };

  const HEADERS = [
    ["Module Details", "label", (v, row) => (
      <div className="flex flex-col py-1">
        <span className="font-bold text-slate-800 text-[11px] md:text-xs uppercase tracking-tight">{row.name}</span>
        <span className="text-[10px] text-slate-400 font-medium italic">{v}</span>
      </div>
    )],
    ...PERMS.map(p => [
      p.toUpperCase(), null, 
      (v, row) => (
        <div className="flex justify-center py-1">
          <PermissionCell
            isTable={true}
            perm={p}
            video={getVideo(row.id, p)}
            disabled={!canAddTraining && !canEditTraining}
            onClick={() => handleBoxClick(row, p)}
          />
        </div>
      ),
      { align: 'center' }
    ])
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* TOP BAR */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={fetchData} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none">
              <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
        </div>

        {/* FILTER BAR */}
        <div className="px-3 md:px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Module name or label..."
            searchLabel="Search Module"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        {/* DATA AREA */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          {viewMode === "table" ? (
            <DataTable
              viewMode="table" headers={HEADERS} data={modules} loading={loading}
              sortKey={params.sortKey} sortDir={params.sortDir} showSelection={false}
              onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
              emptyIcon={Video}
              emptyMessage={blockedMessage || "No training data found"}
              emptySubMessage={blockedMessage ? "No records are available for the current selection." : undefined}
              onLoadMore={handleLoadMore}
              hasMore={modules.length < totalItems}
              totalItems={totalItems}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              {loading && modules.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {[...Array(8)].map((_, i) => <div key={i} className="h-44 bg-slate-50 animate-pulse rounded-none border border-slate-200" />)}
                </div>
              ) : modules.length === 0 ? (
                <EmptyState
                  isTable={false}
                  icon={Video}
                  message={blockedMessage || "No training data found"}
                  subMessage={blockedMessage ? "No records are available for the current selection." : undefined}
                />
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {modules.map((mod, index) => {
                      const isLast = index === modules.length - 1;
                      return (
                        <div key={mod.id} ref={isLast ? (node => {
                          if (loading) return;
                          const observer = new IntersectionObserver(entries => {
                            if (entries[0].isIntersecting && modules.length < totalItems) {
                              handleLoadMore();
                            }
                          });
                          if (node) observer.observe(node);
                        }) : null}>
                          <ModuleCard
                            mod={mod}
                            perms={PERMS}
                            getVideo={getVideo}
                            onClick={handleBoxClick}
                            disabledActions={!canAddTraining && !canEditTraining}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {loading && modules.length > 0 && (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
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

      {selectedSlot && (
        <VideoModal slot={selectedSlot} onClose={() => setSelectedSlot(null)} onSuccess={() => { fetchData(); setSelectedSlot(null); }} />
      )}
    </div>
  );
}