"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, Search, X, AlertCircle, CheckCircle2 } from "lucide-react";

const PAGE_SIZE = 50;

export default function SearchableSelect({ value, onChange, fetchService, getByIdService, dataKey = "id", labelKey = "name", subLabelKey = "", 
  error = "", required = false, disabled = false, placeholder = "Search...", label = "", className = "" 
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });

  const triggerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const debounceRef = useRef(null);

  // 1. Position Calculation
  const calcPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropPos({
      width: rect.width,
      left: rect.left + window.scrollX,
      top: spaceBelow >= 260 ? rect.bottom + window.scrollY + 4 : rect.top + window.scrollY - 264,
    });
  }, []);

  // 2. Fetch Data Logic
  const fetchData = useCallback(async (query, p = 1) => {
    if (p === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await fetchService({ search: query, page: p, limit: PAGE_SIZE });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      
      setItems(prev => p === 1 ? list : [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
      setPage(p);
    } catch (err) {
      if (p === 1) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fetchService]);

  // 3. FIXED: Single useEffect for Fetching (Removed the duplicate)
  useEffect(() => {
    if (!open) return;

    // Har baar open hote hi items reset mat karo, 
    // pehle debounce check karo ya immediate fetch
    if (search === "") {
      fetchData("", 1);
    } else {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchData(search, 1);
      }, 300);
    }

    return () => clearTimeout(debounceRef.current);
  }, [search, open, fetchData]);

  // 4. Pre-fill Logic (For Edit Mode)
  useEffect(() => {
    if (!value) { setSelected(null); setSearch(""); return; }
    if (selected?.[dataKey] == value) return;

    getByIdService(value).then((res) => {
      const item = res?.data || res;
      if (item?.[dataKey]) {
        setSelected(item);
        setSearch(item[labelKey]);
      }
    }).catch(() => {
      setSearch(String(value));
    });
  }, [value, dataKey, labelKey, getByIdService]);

  // 5. Click Outside logic
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && !document.getElementById("searchable-portal")?.contains(e.target)) {
        setOpen(false);
        setSearch(selected ? selected[labelKey] : "");
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, selected, labelKey]);

  const handleSelect = (item) => {
    setSelected(item);
    setSearch(item[labelKey]);
    onChange(item[dataKey], item);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelected(null);
    setSearch("");
    onChange(null, null);
  };

  const dropdown = open && createPortal(
    <div id="searchable-portal" style={{ ...dropPos, position: "absolute", zIndex: 99999 }} className="bg-white border border-slate-200  overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <ul ref={listRef} className="max-h-[220px] overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20 && hasMore && !loadingMore && !loading) {
            fetchData(search, page + 1);
          }
        }}>
        {loading ? (
          <div className="p-10 flex flex-col items-center gap-2">
            <Loader2 size={20} className="animate-spin text-indigo-500" />
            <span className="text-[10px] text-slate-400 font-medium">Fetching data...</span>
          </div>
        ) : items.length === 0 ? (
          <li className="p-8 text-center text-slate-400 text-xs">No results found</li>
        ) : (
          items.map((item) => (
            <li key={item[dataKey]} onClick={() => handleSelect(item)}
              className={`px-3 py-2 cursor-pointer border-b border-slate-50 last:border-0 hover:bg-indigo-50/50 transition-colors flex flex-col ${selected?.[dataKey] === item[dataKey] ? "bg-indigo-50/80" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 text-[11px]">{item[labelKey]}</span>
                {selected?.[dataKey] === item[dataKey] && <CheckCircle2 size={12} className="text-indigo-600" />}
              </div>
              {subLabelKey && <span className="text-[9px] text-slate-400 font-medium">{item[subLabelKey]}</span>}
            </li>
          ))
        )}
        {loadingMore && <li className="p-3 text-center border-t border-slate-50 bg-slate-50/30"><Loader2 size={16} className="animate-spin mx-auto text-indigo-400" /></li>}
      </ul>
    </div>,
    document.body
  );

  return (
    <div className={`space-y-1 ${className}`}>
      {label && <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">{label}{required && " *"}</label>}
      <div 
        ref={triggerRef} 
        className={`w-full bg-white border rounded-lg px-3 h-[38px] flex items-center gap-2 transition-all duration-200 cursor-text ${
          open ? 'border-indigo-400 ring-2 ring-indigo-50 shadow-sm' : error ? 'border-rose-400 ring-rose-50 ring-2' : 'border-slate-200 hover:border-slate-300'
        }`} 
        onClick={() => { 
          if(!disabled) { 
            calcPosition(); 
            setOpen(true); 
            setTimeout(() => inputRef.current?.focus(), 10); 
          } 
        }}
      >
        <Search size={14} className={open ? "text-indigo-500" : "text-slate-400"} />
        <input 
          ref={inputRef} type="text" value={search} 
          onChange={(e) => setSearch(e.target.value)} 
          placeholder={placeholder} disabled={disabled} autoComplete="off" 
          className="flex-1 bg-transparent outline-none text-slate-700 placeholder:text-slate-400 text-[11px] font-medium"
        />
        <div className="flex items-center gap-1.5 ml-auto pl-2 border-l border-slate-100">
          {search && !disabled && (
            <button type="button" onClick={handleClear} className="text-slate-300 hover:text-rose-500 transition-colors">
              <X size={14} />
            </button>
          )}
          <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {error && <p className="text-[9px] text-rose-500 flex items-center gap-1 ml-1"><AlertCircle size={10} /> {error}</p>}
      {dropdown}
    </div>
  );
}