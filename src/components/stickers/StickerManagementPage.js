"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Box, RefreshCcw, Search, Filter, X, Sticker } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime } from "@/helpers/utilHelper";
import { boxService } from "@/services/box";
import { useViewMode } from "@/hooks/useViewMode";
import dayjs from "dayjs";

// Components
import ViewToggle from "@/components/ui/ViewToggle";
import DataTable from "@/components/ui/DataTable";
import DateRangeFilter from "../common/DateRangeFilter";

import { useCanAccess } from "@/hooks/useCanAccess";

export default function StickerManagementPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("box_table", "view"), [canAccess]);

  const [rows, setRows] = useState([]);
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

  // Unified Params State (Modern Approach)
  const [params, setParams] = useState({
    page: 1, pageSize: 500, search: "",
    fromDate: defaultDates.from, toDate: defaultDates.to, sortKey: "box_uid", sortDir: "desc"
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

  const fetchStickers = useCallback(async (isLoadMore = false) => {
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
        },
      };

      const res = await boxService.getStickerManagementList(apiParams);
      const list = res?.data ?? [];
      const newItems = Array.isArray(list) ? list : [];

      if (isLoadMore) {
        setRows(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setRows(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }
      setTotalItems(res?.total ?? (Array.isArray(list) ? list.length : 0));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load sticker data");
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate, params.page]);

  useEffect(() => { 
    fetchStickers(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.fromDate, params.toDate]);

  const handleLoadMore = useCallback(() => {
    if (!loading && rows.length < totalItems) {
      fetchStickers(true);
    }
  }, [loading, rows.length, totalItems, fetchStickers]);

  const handleFilterApply = (data) => {
    setParams(prev => ({ 
      ...prev, 
      page: 1, 
      search: tempSearch, 
      fromDate: data.fromDate, 
      toDate: data.toDate 
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams(prev => ({ ...prev, page: 1, search: "", fromDate: defaultDates.from, toDate: defaultDates.to }));
  };

  const onSort = (key) => {
    setParams(p => ({
      ...p,
      sortKey: key,
      sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
      page: 1
    }));
  };

  const HEADERS = [
    ["Sticker UID", "box_no_uid", (v) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
          <Sticker size={14} />
        </div>
        <span className="font-bold text-slate-900 uppercase text-[11px]">{v}</span>
      </div>
    ), { fixed: true, width: "160px" }],

    ["Packing No", "packing_number", (v) => <span className="text-[11px] font-semibold text-slate-700">{v}</span>, { width: "140px" }],

    ["Customer", "override_cust", (v) => <span className="text-[10px] font-bold text-slate-500 uppercase truncate block">{v || "—"}</span>, { width: "180px" }],

    ["Qty", "qty", (v) => (
      <span className="font-mono font-bold text-indigo-600 text-[11px]">{Number(v || 0).toLocaleString()}</span>
    ), { align: "right", width: "100px" }],

    ["Downloads", "download_count", (v) => (
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border w-fit font-bold text-[9px] ${
        v > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"
      }`}>
        <Download size={10} /> {v || 0}
      </div>
    ), { align: "center", width: "110px" }],

    ["Downloaded By", "last_downloaded_by", (v) => <span className="text-[10px] font-medium text-slate-600 uppercase">{v || "—"}</span>, { width: "140px" }],

    ["Last Downloaded", "last_downloaded_at", (v) => (
      <span className="text-[10px] text-slate-400 font-medium italic">{v ? formatDateTime(v) : "Never"}</span>
    ), { width: "160px" }],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- TOP ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            <div className="flex items-center gap-2 flex-wrap">
              
              <div className="w-px h-6 bg-slate-300 mx-1" />
              
              <button 
                onClick={fetchStickers} 
                className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all"
              >
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh Data</span>
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>
        </div>

        {/* --- FILTER BAR (Matching Users Design) --- */}
        <div className="px-3 md:px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Quick search logs..."
            searchLabel="Search (Box, Packing, Customer)"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        {/* --- DATA TABLE AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
              <DataTable
                headers={HEADERS} 
                data={rows} 
                loading={loading}
                viewMode={viewMode} 
                allowCopy={true} 
                showSelection={false} 
                skeletonCount={params.pageSize}
                emptyIcon={Box} 
                emptyMessage="No sticker logs found"
                sortKey={params.sortKey} 
                sortDir={params.sortDir}
                onSort={onSort}
                onLoadMore={handleLoadMore}
                hasMore={rows.length < totalItems}
                totalItems={totalItems}
                cardConfig={{
                  titleKey: "box_no_uid",
                  tagsKeys: ["download_count"],
                  detailKeys: ["packing_number", "override_cust", "last_downloaded_by"],
                  footerKey: "last_downloaded_at",
                  className: "rounded-none border border-slate-200" 
                }}
              />
          </div>
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {rows.length} of {totalItems} Sticker Logs
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>
    </div>
  );
}