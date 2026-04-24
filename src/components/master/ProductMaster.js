"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Package, RefreshCcw, Eye, X } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import { masterService } from "@/services/master";

import { useViewMode } from "@/hooks/useViewMode";
import DataTable from "../ui/DataTable";
import ViewToggle from "../ui/ViewToggle";
import ActionButton from "../ui/ActionButton";
import GlobalDetailModal from "../common/GlobalDetailModal";
import DateRangeFilter from "../common/DateRangeFilter";

export default function ProductMasterPage() {
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
    sortKey: "item_code",
    sortDir: "desc"
  });

  // Selection
  const [selected, setSelected] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchItems = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      const currentPage = isLoadMore ? params.page + 1 : 1;
      const apiParams = {
        page: currentPage,
        limit: params.pageSize,
        search: params.search || undefined,
        sortBy: params.sortKey,
        order: params.sortDir
      };
      const body = await masterService.getItems(apiParams);
      const list = body.data ?? [];
      const newItems = Array.isArray(list) ? list : [];

      if (isLoadMore) {
        setItems(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setItems(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }
      setTotalItems(body.total ?? list.length);
    } catch (err) {
      toast.error("Failed to load items");
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

  const selectedRecord = items.find(u => u.itemdcode === selected);

  // ── Headers Configuration ─────────────────────────────────────
  const HEADERS = [
    ["Item Code", "item_code", (v) => (
      <span className="font-mono text-[10px] font-bold tracking-tighter">
        {v}
      </span>
    )],
    ["Description", "itemdesc", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>],
    ["Group", "grpname", (v) => (
      <span className="px-2 py-0.5 rounded-none text-[9px] font-bold border bg-slate-50 text-slate-600 border-slate-200 uppercase tracking-tighter">
        {v}
      </span>
    )],
    ["Min/Max", "minqty", (v, row) => (
        <span className="text-slate-500 font-medium text-[10px]">{v} / {row.maxqty}</span>
    )],
    ["Reorder", "reorderqty", (v) => <span className="font-bold text-amber-600 text-[11px]">{v}</span>],
    ["Status", "apvitem", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "Active" : "Inactive"}
      </span>
    ), { width: "110px" }],
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
                variant="outline" label="View Details" icon={Eye} 
                disabled={!selected} onClick={() => setIsModalOpen(true)}
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
                Selected Product: {selectedRecord?.item_code} | {selectedRecord?.itemdesc}
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
            searchPlaceholder="Search products by code or name..."
            searchLabel="Product Search"
          />
        </div>

        {/* --- DATA AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} data={items} loading={loading} viewMode={viewMode}
            showSelection={false} allowCopy={true} sortKey={params.sortKey} sortDir={params.sortDir} onSort={toggleSort}
            selectedId={selected} onSelect={setSelected} getRowId={(r) => r.itemdcode}
            emptyIcon={Package}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ 
              titleKey: "item_code", 
              tagsKeys: ["grpname"], 
              detailKeys: ["itemdesc", "reorderqty"], 
              footerKey: "item_code",
              className: "rounded-none border border-slate-200 shadow-none"
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Products
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {/* Product Detail Modal */}
      <GlobalDetailModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Product Master Details"
        icon={Package}
      >
        <div className="space-y-4">
            <div className="bg-slate-50 p-4 border border-slate-200 rounded-none shadow-inner">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 italic">Full Description</p>
                <p className="text-sm font-bold text-slate-700 uppercase leading-tight">{selectedRecord?.itemdesc}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 border border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 italic">Group Name</p>
                  <p className="text-xs font-bold text-indigo-600 uppercase">{selectedRecord?.grpname || "N/A"}</p>
              </div>
              <div className="p-3 border border-slate-200">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 italic">Primary Item</p>
                  <p className="text-xs font-bold text-slate-600 uppercase">{selectedRecord?.primitemdesc || "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-0 border border-slate-200">
                <div className="bg-white p-3 text-center border-r border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Min Qty</p>
                    <p className="text-sm font-bold text-slate-700">{selectedRecord?.minqty ?? 0}</p>
                </div>
                <div className="bg-white p-3 text-center border-r border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Max Qty</p>
                    <p className="text-sm font-bold text-slate-700">{selectedRecord?.maxqty ?? 0}</p>
                </div>
                <div className="bg-amber-50 p-3 text-center">
                    <p className="text-[9px] font-bold text-amber-500 uppercase mb-1">Reorder</p>
                    <p className="text-sm font-bold text-amber-600">{selectedRecord?.reorderqty ?? 0}</p>
                </div>
            </div>
        </div>
      </GlobalDetailModal>
    </div>
  );
}