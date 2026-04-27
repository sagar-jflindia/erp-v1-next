"use client";
import React, { useState, useRef, useCallback } from "react";
import { Inbox, Loader2 } from "lucide-react";
import TableSkeleton from "@/components/common-table/TableSkeleton";
import CardSkeleton from "@/components/common-table/CardSkeleton";
import EmptyState from "@/components/common-table/EmptyState";

/** Pixels: checkbox column — colgroup + sticky offsets (`table-fixed` otherwise stretches the first col). */
const DATA_TABLE_SELECTION_COL_PX = 36;

export default function DataTable({ 
  headers = [], 
  data = [], 
  loading = false, 
  getRowId, 
  viewMode = "table", 
  onSort, 
  sortKey, 
  sortDir, 
  showSelection = true, 
  allowCopy = false, 
  selectedId = null, 
  onSelect,
  skeletonCount = 10, 
  emptyMessage = "No records found", 
  emptySubMessage,
  emptyIcon: EmptyIcon = Inbox, 
  cardConfig = { titleIdx: 1, badgeIndices: [5, 4], detailIndices: [2, 3], footerIdx: 6 },
  onLoadMore,
  hasMore = false,
  totalItems = 0
}) {
  const selW = DATA_TABLE_SELECTION_COL_PX;
  const lastApiError = typeof window !== "undefined" ? window.__LAST_API_ERROR__ : null;
  const isModuleDeactivated =
    lastApiError?.status === 403 &&
    lastApiError?.message === "This module has been deactivated by authorized personnel.";
  const resolvedEmptyMessage = isModuleDeactivated
    ? "This module has been deactivated by authorized personnel."
    : emptyMessage;
  const resolvedEmptySubMessage = isModuleDeactivated
    ? "No records are available for the current selection."
    : emptySubMessage;
  
  // --- 0. INFINITE SCROLL LOGIC ---
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && onLoadMore) {
        onLoadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, onLoadMore]);

  // --- 1. COLUMN RESIZE LOGIC ---
  const [columnWidths, setColumnWidths] = useState({});
  const resizingRef = useRef(null);

  const startResizing = useCallback((headerKey, e) => {
    e.preventDefault();
    e.stopPropagation();
    const startWidth = columnWidths[headerKey] || 150;
    const startX = e.clientX;
    const onMouseMove = (moveEvent) => {
      if (!resizingRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [headerKey]: Math.max(80, startWidth + deltaX), 
      }));
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    };
    resizingRef.current = headerKey;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
  }, [columnWidths]);

  // --- 2. COPY TO EXCEL LOGIC ---
  /*
  const copyRowToClipboard = useCallback((item) => {
    if (!allowCopy) return;
    const rowData = headers.map(([, key]) => {
      const val = item[key];
      return val !== undefined && val !== null ? val : "";
    }).join("\t");

    navigator.clipboard.writeText(rowData).then(() => {
      console.log("Row copied to clipboard");
    }).catch(err => {
      console.error("Failed to copy: ", err);
    });
  }, [allowCopy, headers]);

  */
 
 const copyRowToClipboard = useCallback((item) => {
   if (!allowCopy) return;
   
   const rowData = headers.map(([, key]) => {
     const val = item[key];
     return val !== undefined && val !== null ? val : "";
    }).join("\t");
    
    // 1. Check if the Clipboard API is available (Secure Context check)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(rowData)
      .then(() => console.log("Row copied to clipboard"))
      .catch(err => console.error("Failed to copy: ", err));
    } else {
      // 2. Fallback for insecure contexts (HTTP) or older browsers
      try {
        const textArea = document.createElement("textarea");
        textArea.value = rowData;
        
        // Ensure the textarea isn't visible but is part of the DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          console.log("Row copied via fallback");
        } else {
          throw new Error("Copy command unsuccessful");
        }
      } catch (err) {
        console.error("Fallback copy failed: ", err);
      }
    }
  }, [allowCopy, headers]);
  
  const handleRowClick = (item, id) => {
    if (showSelection) {
      onSelect?.(id);
    }
    if (allowCopy) {
      copyRowToClipboard(item);
    }
  };

  /** Row is only interactive for selection when the checkbox column is shown, or for copy when enabled. */
  const rowClickable = showSelection || allowCopy;
  
  // --- 3. HELPERS ---
  const getId = (item, index) => {
    if (getRowId) return getRowId(item, index);
    const firstHeaderKey = headers[0]?.[1];
    return firstHeaderKey ? item[firstHeaderKey] : (item.id || index);
  };

  const getHeader = (identifier) => {
    if (typeof identifier === 'number') return headers[identifier];
    return headers.find(h => h[1] === identifier);
  };

  const renderCell = (item, header, index, mode = "table") => {
    if (!header) return null;
    const [label, key, renderFn, config] = header;
    const value = item[key];
    if (mode === "card" && config?.cardRender) {
      return config.cardRender(value, item, index);
    }
    return renderFn ? renderFn(value, item, index) : (value || "—");
  };

  const SortIcon = ({ k }) => (
    <span className={`ml-1 text-[10px] ${sortKey === k ? "text-indigo-500" : "text-slate-300"}`}>
      {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const isInitialLoad = loading && data.length === 0;
  const isRefreshing = loading && data.length > 0;

  // --- 4. TABLE VIEW ---
  if (viewMode === "table") { 
    return (
      <div className="relative flex flex-col flex-1 min-h-0 w-full bg-white">
        {isRefreshing && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-100 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Updating...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 border-t border-slate-200">
          <table className="w-full text-sm border-separate border-spacing-0 table-fixed min-w-full">
            <colgroup>
              {showSelection && (
                <col style={{ width: selW, minWidth: selW, maxWidth: selW }} />
              )}
              {headers.map((h, i) => {
                const [, key, , config = {}] = h;
                const cw = columnWidths[key || i] ?? config.width ?? 150;
                const w = typeof cw === "number" ? `${cw}px` : cw;
                return <col key={key || i} style={{ width: w }} />;
              })}
            </colgroup>
            <thead className="sticky top-0 z-[60]">
              <tr className="bg-slate-50">
                {showSelection && (
                  <th
                    className="sticky left-0 top-0 z-[70] bg-slate-50 py-3 px-0 border-b border-r border-slate-200 text-center box-border"
                    style={{ width: selW, minWidth: selW, maxWidth: selW }}
                  />
                )}
                {headers.map(([label, key, renderFn, config = {}], i) => {
                  const isSticky = config?.fixed;
                  const isSortable = key && config.sortable !== false;
                  const stickyLeft = isSticky ? (config.offset || 0) + (showSelection ? selW : 0) : 0;
                  const currentWidth = columnWidths[key || i] || config.width || 150;

                  return (
                    <th
                      key={key || i}
                      style={{
                        width: currentWidth,
                        textAlign: config.align || 'left',
                        ...(isSticky ? { left: `${stickyLeft}px` } : {})
                      }}
                      className={`relative px-3 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-tight select-none bg-slate-50 border-b border-r border-slate-200 sticky top-0
                      ${isSticky ? "z-[65]" : "z-[55]"}`}
                    >
                      <div 
                        className={`flex items-center ${isSortable ? "cursor-pointer hover:text-slate-700 transition-colors" : ""}`}
                        onClick={() => {
                          if (isSortable && onSort) {
                            onSort(key);
                          }
                        }}
                      >
                        {label} {isSortable && <SortIcon k={key} />}
                      </div>
                      <div
                        onMouseDown={(e) => startResizing(key || i, e)}
                        className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/50 transition-colors z-[100]
                        ${resizingRef.current === (key || i) ? "bg-indigo-500 w-[2px]" : "bg-transparent"}`}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={`bg-white transition-opacity duration-200 ${isRefreshing ? "opacity-40" : "opacity-100"}`}>
              {isInitialLoad ? (
                <TableSkeleton rows={skeletonCount} cols={headers.length} showSelection={showSelection} selectionColPx={selW} />
              ) : data.length === 0 ? (
                <EmptyState
                  isTable={true}
                  colSpan={headers.length + (showSelection ? 1 : 0)}
                  message={resolvedEmptyMessage}
                  subMessage={resolvedEmptySubMessage}
                  icon={EmptyIcon}
                />
              ) : (
                <>
                  {data.map((item, rowIndex) => {
                    const currentId = getId(item, rowIndex); 
                    const isSelected = selectedId === currentId;
                    const cellBg = isSelected ? "bg-indigo-50/70" : "bg-white group-hover:bg-slate-50/80";
                    const isLastElement = data.length === rowIndex + 1;
                    
                    return (
                      <tr 
                        key={currentId} 
                        ref={isLastElement ? lastElementRef : null}
                        onClick={rowClickable ? () => handleRowClick(item, currentId) : undefined}
                        className={`group${rowClickable ? " cursor-pointer" : ""}`}
                      >
                        {showSelection && (
                          <td
                            className={`sticky left-0 z-30 py-2 px-0 border-b border-r border-slate-200 transition-colors ${cellBg} text-center align-middle box-border`}
                            style={{ width: selW, minWidth: selW, maxWidth: selW }}
                          >
                            <span className="inline-flex items-center justify-center w-full">
                              <input type="checkbox" checked={isSelected} readOnly className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600 cursor-pointer" />
                            </span>
                          </td>
                        )}
                        {headers.map((h, i) => {
                          const config = h[3] || {};
                          const isSticky = config?.fixed;
                          const stickyLeft = isSticky ? (config.offset || 0) + (showSelection ? selW : 0) : 0;
                          const currentWidth = columnWidths[h[1] || i] || config.width || 150;
                          const allowWrap = config.wrap === true;

                          return (
                            <td
                              key={i}
                              style={{ 
                                  width: currentWidth,
                                  ...(isSticky ? { left: `${stickyLeft}px` } : {}), 
                                  textAlign: config.align || 'left' 
                              }}
                              className={`px-3 py-2 text-[13px] border-b border-r border-slate-200 transition-colors align-top
                              ${allowWrap ? "whitespace-normal break-words min-w-0 overflow-hidden" : "whitespace-nowrap overflow-hidden text-ellipsis"}
                              ${isSticky ? "sticky z-20" : "text-slate-600"} ${cellBg}`}
                            >
                              {renderCell(item, h, rowIndex, "table")}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {loading && data.length > 0 && (
                    <tr>
                      <td colSpan={headers.length + (showSelection ? 1 : 0)} className="py-4 text-center bg-slate-50/50">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Loading more...</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // --- 5. CARD VIEW ---
  return (
    <div className="flex-1 min-h-0 bg-slate-50/50 relative overflow-hidden flex flex-col">
      {isRefreshing && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50/40 backdrop-blur-[1px]">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
        </div>
      )}

      <div className="overflow-y-auto flex-1 p-4">
        {isInitialLoad ? (
          <CardSkeleton count={skeletonCount} />
        ) : data.length === 0 ? (
          <EmptyState isTable={false} message={resolvedEmptyMessage} subMessage={resolvedEmptySubMessage} icon={EmptyIcon} />
        ) : (
          <>
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-200 ${isRefreshing ? "opacity-30" : "opacity-100"}`}>
              {data.map((item, rowIndex) => {
                const currentId = getId(item, rowIndex); 
                const isSelected = selectedId === currentId;
                const titleH = getHeader(cardConfig.titleKey || cardConfig.titleIdx);
                const footerH = getHeader(cardConfig.footerKey || cardConfig.footerIdx);
                const badgeItems = (cardConfig.tagsKeys || cardConfig.badgeIndices || []).map(k => getHeader(k)).filter(Boolean);
                const detailItems = (cardConfig.detailKeys || cardConfig.detailIndices || []).map(k => getHeader(k)).filter(Boolean);
                const isLastElement = data.length === rowIndex + 1;

                return (
                  <div
                    key={currentId}
                    ref={isLastElement ? lastElementRef : null}
                    onClick={rowClickable ? () => handleRowClick(item, currentId) : undefined}
                    className={`relative bg-white rounded-xl border transition-all duration-200 overflow-hidden ${rowClickable ? "cursor-pointer" : ""} ${isSelected ? "border-indigo-600 shadow-lg shadow-indigo-100 ring-[0.5px] ring-indigo-600" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
                  >
                    {isSelected && <div className="absolute top-0 left-0 right-0 h-[3px] bg-indigo-600" />}
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="text-sm font-black text-slate-800 uppercase truncate">
                          {renderCell(item, titleH, rowIndex, "card")}
                        </h3>
                        {showSelection && (
                          <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 rounded border-slate-300 accent-indigo-600" />
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {badgeItems.map((h, idx) => (
                          <div key={idx} className="inline-block">{renderCell(item, h, rowIndex, "card")}</div>
                        ))}
                      </div>
                      <div className="space-y-2 mb-3">
                        {detailItems.map((h, idx) => (
                          <div key={idx} className="flex justify-between items-baseline group/row">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{h[0]}</span>
                            <div className="flex-1 mx-2 border-b border-dotted border-slate-100" />
                            <span className="text-[11px] font-bold text-slate-600">{renderCell(item, h, rowIndex, "card")}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-1">
                        <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-1.5 py-0.5 rounded italic">ID: {currentId}</span>
                        <div className="text-[10px] text-slate-400 font-medium">{renderCell(item, footerH, rowIndex, "card")}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {loading && data.length > 0 && (
              <div className="py-8 flex flex-col items-center justify-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Loading more results...</span>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                  Showing {data.length} of {totalItems} total items
                </div>
              </div>
            )}
            {!hasMore && data.length > 0 && (
              <div className="py-8 flex flex-col items-center justify-center gap-2">
                <div className="h-px w-12 bg-slate-200 mb-2" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">End of results</span>
                <div className="text-[11px] font-bold text-slate-500">
                  Total {totalItems} items loaded
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}