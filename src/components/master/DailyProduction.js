"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Package, Eye, Plus, X } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs"; // Consistent with your reference

import { masterService } from "@/services/master";
import { useViewMode } from "@/hooks/useViewMode";

// Components
import DataTable from "../ui/DataTable";
import ViewToggle from "../ui/ViewToggle";
import ActionButton from "../ui/ActionButton";
import GlobalDetailModal from "../common/GlobalDetailModal";
import {
  MasterDetailBody,
  MasterDetailHero,
  MasterDetailSection,
  MasterDetailGrid,
  MasterDetailKV,
  MasterDetailProse,
} from "./MasterDetailLayout";
import StickerCreationModel from "../stickers/StickerCreationModel";
import DateRangeFilter from "../common/DateRangeFilter";

import { useCanAccess } from "@/hooks/useCanAccess";

export default function DailyProductionPage() {
  // 1. Core States
  const canAccess = useCanAccess();
  const viewAccess = useCanAccess("packing_entry", "view");

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
  
  // 2. Selection & Modal States
  const [selected, setSelected] = useState(null); 
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);

  // 3. Unified Params State
  const [params, setParams] = useState({
    page: 1, pageSize: 500, search: "", status: "all", stickerStatus: "all",
    fromDate: defaultDates.from, toDate: defaultDates.to, sortKey: "doc_no", sortDir: "desc"
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

  // 4. API Fetch Logic
  const fetchItems = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      const currentPage = isLoadMore ? params.page + 1 : 1;
      const apiParams = {
        page: currentPage,
        limit: params.pageSize,
        sortBy: params.sortKey,
        order: params.sortDir,
        search: params.search || undefined,
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
          ...(params.stickerStatus !== "all" && { sticker_generated: params.stickerStatus === "generated" }),
        },
      };

      const body = await masterService.getDailyProd(apiParams);
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
      toast.error(err?.message || "Failed to load production data");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status, params.stickerStatus, params.page]);

  useEffect(() => {
    fetchItems(false);
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.status, params.stickerStatus]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      fetchItems(true);
    }
  }, [loading, items.length, totalItems, fetchItems]);

  // 5. Handlers
  const handleFilterApply = (data) => {
    setParams(prev => ({
      ...prev,
      page: 1,
      search: tempSearch.trim(), // Map tempSearch to actual search param on apply
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus || prev.status,
      stickerStatus: data.stickerStatus || prev.stickerStatus
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      page: 1, pageSize: 500, search: "", status: "all", stickerStatus: "all",
      fromDate: defaultDates.from, toDate: defaultDates.to, sortKey: "doc_no", sortDir: "desc"
    });
    setSelected(null);
  };

  // 6. Memoized Values
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
      label: "Sticker", key: "stickerStatus", value: params.stickerStatus, 
      options: [
        { label: "All Stickers", value: "all" }, 
        { label: "Generated", value: "generated" }, 
        { label: "Not Generated", value: "pending" }
      ] 
    },
  ], [params.status, params.stickerStatus]);

  const selectedRecord = useMemo(() => 
    items.find((u) => `${u.doc_no}-${u.itemdcode}` === selected),
    [items, selected]
  );

  // 7. Table Configuration (Consistent with PackingStandard headers)
  const HEADERS = [
    ["Doc No", "doc_no", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v}</span>, { width: "100px", fixed: true }],
    ["Date", "doc_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{dayjs(v).format("DD/MM/YYYY")}</span>, { width: "100px" }],
    ["Sticker", "sticker_generated", (v) => (
        v ? (
          <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase rounded-sm">DONE</span>
        ) : (
          <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-[9px] font-black uppercase rounded-sm">PENDING</span>
        )
      ), { width: "80px" }
    ],
    ["Job Card", "job_card_no", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "120px" }],
    ["Customer", "acc_name", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-slate-800 font-bold text-[10px] uppercase truncate">{v || "Unknown"}</span>
      </div>
    ), { width: "180px" }],
    ["Item Details", "item_code", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
        <span className="text-indigo-400 font-bold text-[9px] uppercase italic">{row.item_desc}</span>
      </div>
    ), { width: "220px" }],
    ["Quantity", "total_qty", (v) => (
      <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px]">
        {parseFloat(v || 0).toLocaleString()}
      </span>
    ), { width: "100px",}],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* ACTION BAR */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ActionButton 
                module="packing_entry" action="add" label="New Sticker" icon={Plus} 
                disabled={!selected}
                onClick={() => setIsStickerModalOpen(true)}
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none"
              />
              <ActionButton
                variant="outline" label="View Profile" icon={Eye}
                disabled={!selected}
                onClick={() => setIsDetailModalOpen(true)}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none"
              />
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              <button 
                onClick={fetchItems} 
                disabled={loading}
                className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-all"
              >
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {/* SELECTION BANNER */}
          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic">
                Selected Document: {selectedRecord?.doc_no} | Job: {selectedRecord?.job_card_no}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        {/* FILTER BAR */}
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
            searchPlaceholder="Search Doc or Job Card..."
            searchLabel="Production Search"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        {/* DATA TABLE AREA */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} 
            data={items} 
            loading={loading} 
            viewMode={viewMode}
            showSelection={true} 
            allowCopy={true}
            onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
            sortKey={params.sortKey} 
            sortDir={params.sortDir}
            getRowId={(row) => `${row.doc_no}-${row.itemdcode}`}
            selectedId={selected} 
            onSelect={setSelected}
            emptyIcon={Package}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "job_card_no",
              badgeIndices: [0],
              detailIndices: [3, 4, 5],
              footerKey: "doc_dt",
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Entries
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      <GlobalDetailModal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Production Details" icon={Package}>
        {selectedRecord && (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow="Daily production"
              icon={Package}
              title={selectedRecord.acc_name}
              badge={`Doc ${selectedRecord.doc_no} · ${dayjs(selectedRecord.doc_dt).format("DD/MM/YYYY")}`}
            />
            <MasterDetailGrid columns={2}>
              <MasterDetailSection label="Document no." tone="indigo">
                <span>{selectedRecord.doc_no}</span>
              </MasterDetailSection>
              <MasterDetailSection label="Entry date" tone="white">
                <span>{dayjs(selectedRecord.doc_dt).format("DD/MM/YYYY")}</span>
              </MasterDetailSection>
            </MasterDetailGrid>
            <MasterDetailSection label="Customer code" tone="white">
              <span>{selectedRecord.acc_code}</span>
            </MasterDetailSection>
            <MasterDetailSection label="Item code" tone="white">
              <span>{selectedRecord.item_code}</span>
            </MasterDetailSection>
            {selectedRecord.item_desc ? (
              <MasterDetailProse label="Item description" tone="slate">
                {selectedRecord.item_desc}
              </MasterDetailProse>
            ) : null}
            <MasterDetailKV
              label="Total qty"
              value={parseFloat(selectedRecord.total_qty || 0).toLocaleString()}
              valueClassName="text-emerald-700 text-base tabular-nums"
            />
          </MasterDetailBody>
        )}
      </GlobalDetailModal>

      {/* STICKER MODAL */}
      {isStickerModalOpen && selectedRecord && (
        <StickerCreationModel
          open={isStickerModalOpen} 
          data={selectedRecord} 
          onClose={() => setIsStickerModalOpen(false)} 
          onSuccess={() => { 
            fetchItems(); 
            setSelected(null); 
            setIsStickerModalOpen(false);
            toast.success("Sticker created successfully!");
          }} 
        />
      )}
    </div>
  );
}