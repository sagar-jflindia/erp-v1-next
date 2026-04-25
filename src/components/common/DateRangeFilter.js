"use client";
import { useState, useEffect, useRef } from "react";
import { RotateCcw, Send } from "lucide-react";

const formatDisplayDate = (value) => {
  if (!value) return "DD/MM/YYYY";
  const [yyyy, mm, dd] = String(value).split("-");
  if (!yyyy || !mm || !dd) return "DD/MM/YYYY";
  return `${dd}/${mm}/${yyyy}`;
};

export default function DateRangeFilter({
  fromDate: externalFromDate,
  toDate: externalToDate,
  onApply,
  onReset,
  showDate = true,
  extraFilters = [],
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchLabel = "Search",
  minDate,
  maxDate
}) {
  const [localFrom, setLocalFrom] = useState(externalFromDate || "");
  const [localTo, setLocalTo] = useState(externalToDate || "");
  const [localExtras, setLocalExtras] = useState({});
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);

  useEffect(() => {
    setLocalFrom(externalFromDate || "");
    setLocalTo(externalToDate || "");
  }, [externalFromDate, externalToDate]);

  const handleApply = () => {
    onApply?.({ fromDate: localFrom, toDate: localTo, ...localExtras });
  };

  const handleInternalReset = () => {
    setLocalFrom(externalFromDate || "");
    setLocalTo(externalToDate || "");
    setLocalExtras({});
    onReset?.();
  };

  const openDatePicker = (inputRef) => {
    const el = inputRef?.current;
    if (!el) return;
    el.focus();
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        // ignore if browser blocks programmatic picker open
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-3 w-full">
      {/* Search Section */}
      {onSearchChange !== undefined && (
        <div className="w-full lg:w-64 space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic">{searchLabel}</label>
          <div className="relative group">
            <input 
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-3 pr-4 h-9 bg-white border border-slate-300 text-[12px] focus:outline-none focus:border-slate-500 transition-all rounded-none font-medium"
            />
          </div>
        </div>
      )}

      {/* Date Inputs Section */}
      {showDate && (
        <div className="grid grid-cols-2 lg:flex lg:items-end gap-2 flex-1 lg:flex-none">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic">From Date</label>
            <div
              className="relative flex items-center gap-2 px-2 md:px-3 h-9 rounded-none border border-slate-300 bg-white focus-within:border-slate-500 transition-all cursor-pointer"
              onClick={() => openDatePicker(fromInputRef)}
            >
              <span className={`pointer-events-none text-[12px] font-medium md:hidden ${localFrom ? "text-slate-700" : "text-slate-400"}`}>
                {formatDisplayDate(localFrom)}
              </span>
              <input 
                ref={fromInputRef}
                type="date" 
                value={localFrom} 
                min={minDate}
                max={localTo || maxDate || undefined} 
                onChange={(e) => setLocalFrom(e.target.value)}
                className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer md:static md:inset-auto md:z-auto md:h-auto md:w-full md:opacity-100 md:bg-transparent md:outline-none md:text-[12px] md:font-medium md:text-slate-700" 
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic">To Date</label>
            <div
              className="relative flex items-center gap-2 px-2 md:px-3 h-9 rounded-none border border-slate-300 bg-white focus-within:border-slate-500 transition-all cursor-pointer"
              onClick={() => openDatePicker(toInputRef)}
            >
              <span className={`pointer-events-none text-[12px] font-medium md:hidden ${localTo ? "text-slate-700" : "text-slate-400"}`}>
                {formatDisplayDate(localTo)}
              </span>
              <input 
                ref={toInputRef}
                type="date" 
                value={localTo} 
                min={localFrom || minDate || undefined} 
                max={maxDate}
                onChange={(e) => setLocalTo(e.target.value)}
                className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer md:static md:inset-auto md:z-auto md:h-auto md:w-full md:opacity-100 md:bg-transparent md:outline-none md:text-[12px] md:font-medium md:text-slate-700" 
              />
            </div>
          </div>
        </div>
      )}

      {/* Extra Filters Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end gap-2">
        {extraFilters.map((filter, index) => (
          <div key={index} className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic">{filter.label}</label>
            <select
              value={localExtras[filter.key] || filter.value}
              onChange={(e) => setLocalExtras(prev => ({ ...prev, [filter.key]: e.target.value }))}
              className="h-9 px-3 text-xs border border-slate-300 rounded-none bg-white outline-none focus:border-slate-500 cursor-pointer min-w-full lg:min-w-[140px] font-medium appearance-none"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
            >
              {filter.options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>
        ))}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-2 lg:mt-0">
          <button 
            type="button" 
            onClick={handleInternalReset} 
            className="flex-1 lg:flex-none h-9 px-4 text-[11px] font-bold uppercase tracking-wider border border-slate-300 rounded-none bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 transition-all active:scale-95"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button 
            type="button" 
            onClick={handleApply} 
            className="flex-1 lg:flex-none h-9 px-5 text-[11px] font-bold uppercase tracking-wider rounded-none bg-slate-800 text-white hover:bg-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
          >
            <Send size={14} /> Submit
          </button>
        </div>
      </div>
    </div>
  );
}