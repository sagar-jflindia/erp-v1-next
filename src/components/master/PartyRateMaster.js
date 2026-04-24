"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, IndianRupee, RefreshCcw, Eye, X } from "lucide-react";
import { toast } from "react-toastify";
import { masterService } from "@/services/master";

import { useViewMode } from "@/hooks/useViewMode";
import DataTable from "../ui/DataTable";
import ViewToggle from "../ui/ViewToggle";
import ActionButton from "../ui/ActionButton";
import GlobalDetailModal from "../common/GlobalDetailModal";
import DateRangeFilter from "../common/DateRangeFilter";

export default function PartyRateMasterPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  // Filters
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState({
    page: 1,
    pageSize: 500, // Increased to 500 for massive data loading
    search: "",
    sortKey: "acc_name",
    sortDir: "desc"
  });

  // Selection + Modals
  const [selected, setSelected] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Fetch Data ────────────────────────────────────────────────
  const fetchItems = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      const currentPage = isLoadMore ? params.page + 1 : 1;
      const apiParams = {
        page: currentPage,
        limit: params.pageSize,
        search: params.search || undefined,
        sortBy: params.sortKey,
        order: params.sortDir,
      };
      const body = await masterService.getPartyRates(apiParams);
      const list = body.data ?? [];
      const newItems = (Array.isArray(list) ? list : []).map((row, index) => ({ 
        ...row, 
        row_id: `${row.acc_code}-${row.itemdcode}-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 5)}`
      }));

      if (isLoadMore) {
        setItems(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setItems(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }
      setTotalItems(body.total ?? list.length);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load party rates");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.page]);

  useEffect(() => { 
    fetchItems(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search]);

  const handleSearch = () => {
    setParams(p => ({ ...p, search: tempSearch.trim(), page: 1 }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams(p => ({ ...p, search: "", page: 1 }));
  };

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      fetchItems(true);
    }
  }, [loading, items.length, totalItems, fetchItems]);

  const toggleSort = (key) => {
    setParams(p => ({
      ...p,
      sortKey: key,
      sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
      page: 1
    }));
  };

  const selectedRecord = items.find(u => u.row_id === selected);

  // ── Headers Configuration ─────────────────────────────────────
  const HEADERS = [
  // 1. Party Details (Name + Code)
  ["Party Name", "acc_name", (v, row) => (
    <div className="flex flex-col">
      <span className="font-semibold text-slate-800 text-[11px] uppercase leading-tight">
        {v || "N/A"}
      </span>
    </div>
  )],

  // 2. Item Details (Description + Item Code)
  ["Item Description", "itemdesc", (v, row) => (
    <div className="flex flex-col max-w-[250px]">
      <span className="font-medium text-slate-700 text-[11px] leading-tight break-words">
        {v}
      </span>
      <div className="flex gap-2 mt-1">
        <span className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded uppercase">
          {row.item_code}
        </span>
        <span className="text-[9px] text-slate-400 italic">
          {row.grpname}
        </span>
      </div>
    </div>
  )],

  // 3. Narration
  ["Narration", "narr1", (v) => (
    <span className="text-slate-500 italic text-[11px] block max-w-[180px] truncate leading-tight">
      {v || "—"}
    </span>
  )],

  // 4. Status
  ["Status", "itapv", (v) => (
    <span className={`px-2 py-0.5 rounded-none text-[9px] font-bold border uppercase tracking-widest ${
      v?.toUpperCase() === 'APPROVED' 
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
        : 'bg-amber-50 text-amber-600 border-amber-200'
    }`}>
      {v || 'PENDING'}
    </span>
  )]
];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- TOP ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Action Group */}
            <div className="flex items-center gap-2">
              <ActionButton 
                module="party_rate_master" action="add" label="Add Rate" icon={Plus} 
                onClick={() => toast.info("Add Modal coming soon")}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none"
              />

              <ActionButton 
                variant="outline" label="View Details" icon={Eye}
                disabled={!selected} 
                onClick={() => setIsModalOpen(true)}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none"
              />

              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

              <button onClick={fetchItems} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>
          </div>

          {/* Selection Banner */}
          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic">
                Selected: {selectedRecord?.acc_code} | Item: {selectedRecord?.itemdcode}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        {/* --- FILTER BAR --- */}
        <div className="px-3 md:px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <DateRangeFilter 
            showDate={false}
            onApply={handleSearch} 
            onReset={handleReset} 
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search party or item..."
            searchLabel="Search Rate Table"
          />
        </div>

        {/* --- DATA AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} data={items} loading={loading} viewMode={viewMode}
            onSort={toggleSort} sortKey={params.sortKey} sortDir={params.sortDir}
            showSelection={false} allowCopy={true} 
            getRowId={(row) => row.row_id}
            selectedId={selected} onSelect={setSelected}
            emptyIcon={IndianRupee}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ 
              titleKey: "acc_code", 
              tagsKeys: ["itapv"], 
              detailKeys: ["itemdcode"], 
              footerKey: "narr1",
              className: "rounded-none border border-slate-200 shadow-none"
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Party Rates
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {/* Rate Detail Modal */}
      <GlobalDetailModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Rate Master Details"
        icon={IndianRupee}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-indigo-50 p-3 border border-indigo-100">
              <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Customer Details</p>
              <p className="text-sm font-bold text-indigo-700 uppercase">{selectedRecord?.acc_name}</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Item Details</p>
            <p className="text-sm font-bold text-slate-700 uppercase">{selectedRecord?.item_code}</p>
            <p className="text-sm font-bold text-slate-500 uppercase">{selectedRecord?.itemdesc}</p>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center px-3 py-2 bg-white border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Approval Status</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-tighter ${
                selectedRecord?.itapv === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}>
                {selectedRecord?.itapv}
              </span>
            </div>
            
            <div className="p-3 bg-slate-50 border border-slate-200">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Narration / Remarks</p>
              <p className="text-xs text-slate-600 italic leading-relaxed uppercase">
                {selectedRecord?.narr1 || "No remarks available for this record."}
              </p>
            </div>
          </div>
        </div>
      </GlobalDetailModal>
    </div>
  );
}