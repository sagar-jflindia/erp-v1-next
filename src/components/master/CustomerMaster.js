"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { UserCheck, Eye, X, RefreshCcw } from "lucide-react";
import { toast } from "react-toastify";
import { masterService } from "@/services/master";

import { useViewMode } from "@/hooks/useViewMode";
import DataTable from "../ui/DataTable";
import ViewToggle from "../ui/ViewToggle";
import ActionButton from "../ui/ActionButton";
import GlobalDetailModal from "../common/GlobalDetailModal";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection } from "./MasterDetailLayout";
import DateRangeFilter from "../common/DateRangeFilter";

export default function CustomerLedgerPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  // -- Filters --
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState({
    page: 1,
    pageSize: 500, // Increased to 500 for massive data loading
    search: "",
    sortKey: "acc_name",
    sortDir: "desc"
  });

  // -- Selection + Modals --
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
      const body = await masterService.getLedgers(apiParams); 
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
      toast.error(err?.message || "Failed to load customers");
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

  const selectedRecord = items.find(u => u.acc_code === selected);

  // ── Headers Configuration ─────────────────────────────────────
  const HEADERS = [
    // ["A/C Code", "acc_code", (v) => (
    //     <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-none border border-indigo-100 uppercase tracking-tighter">
    //       {v}
    //     </span>
    //   ), { fixed: true, width: '10px' }
    // ],

    [ "Customer Name",  "acc_name", (v) => (
        <span className="font-bold text-slate-700 text-[11px] md:text-xs uppercase tracking-tight py-1 block">
          {v && v.trim() !== "" ? v : "—"}
        </span>
      )
    ],
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
                variant="outline" label="View Profile" icon={Eye}
                disabled={!selected}
                onClick={() => setIsModalOpen(true)}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none"
              />
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

              <button onClick={fetchItems} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
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
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic leading-none">
                Customer: {selectedRecord?.acc_name} ({selectedRecord?.acc_code}) selected
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
            placeholder="Search by name or code..."
            searchLabel="Customer Search"
          />
        </div>

        {/* --- DATA AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            onSort={toggleSort}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            showSelection={false}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={(row) => row.acc_code}
            emptyIcon={UserCheck}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ 
              titleKey: "acc_name", 
              tagsKeys: ["acc_code"],
              footerKey: "acc_code",
              className: "rounded-none border border-slate-200 shadow-none"
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Customers
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {/* Profile Detail Modal */}
      <GlobalDetailModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Customer Profile"
        icon={UserCheck}
      >
        {selectedRecord && (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow="Customer ledger"
              icon={UserCheck}
              title={selectedRecord.acc_name}
              badge={selectedRecord.acc_code != null ? `A/C code: ${selectedRecord.acc_code}` : null}
            />
            <MasterDetailSection label="Account type" tone="white">
              <span>Customer</span>
            </MasterDetailSection>
          </MasterDetailBody>
        )}
      </GlobalDetailModal>
    </div>
  );
}