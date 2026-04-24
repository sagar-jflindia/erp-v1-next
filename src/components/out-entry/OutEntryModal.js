"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Check, AlertCircle, Loader2, ShieldCheck, Hash, Truck, User, Package, ChevronRight, CheckCircle2, QrCode, ScanLine, Camera, X, MapPin, Info } from "lucide-react";
import { toast } from "react-toastify";
import { Html5Qrcode } from "html5-qrcode";
import { useSelector } from "react-redux";

// Services & Components
import { outEntryService } from "@/services/outEntry";
import { forwardingNoteService } from "@/services/forwardingNote";
import Drawer from "@/components/ui/Drawer";
import SearchableSelect from "../common/SearchableSelect";
import { useCanAccess } from "@/hooks/useCanAccess";
import { ERR_INPUT, OK_INPUT } from "@/components/common/Constants";
import { selectHasPermission } from "@/features/authSlice";

const INITIAL_FORM = {
  fuid: "",
  remarks: "",
  approved: false,
};

export default function OutEntryModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = useSelector(selectHasPermission("out_entry", "authorize"));

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [loading, setLoading] = useState(false);
  const [fetchingFuid, setFetchingFuid] = useState(false);
  const [fuidDetails, setFuidDetails] = useState(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [activePackingIdx, setActivePackingIdx] = useState(0);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors]           = useState({});

  // Scanning State
  const [scannedBoxIds, setScannedBoxIds] = useState(new Set());
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const scannerRef = useRef(null);
  const [manualBoxId, setManualBoxId] = useState("");
  const [expandedLocations, setExpandedLocations] = useState(new Set());

  const toggleLocation = (locId) => {
    const next = new Set(expandedLocations);
    if (next.has(locId)) next.delete(locId);
    else next.add(locId);
    setExpandedLocations(next);
  };

  // ── API Fetch Logic ────────────────────────────────────────────────────────
  const fetchFuidInfo = async (id) => {
    if (!id) return;
    setFetchingFuid(true);
    setFuidDetails(null);
    try {
      const res = await outEntryService.getFuidDetails(id);
      if (res.success && res.data) {
        setFuidDetails(res.data);
        if (isEdit || isApprove) {
          const alreadyOut = new Set();
          res.data.items?.forEach(item => {
            item.locations?.forEach(loc => {
              loc.boxes?.forEach(box => {
                if (box.is_out) alreadyOut.add(box.box_no_uid);
              });
            });
          });
          setScannedBoxIds(alreadyOut);
        }
      } else {
        toast.error("Forwarding Note not found");
      }
    } catch (err) {
      toast.error(err?.message || "Error fetching details");
    } finally {
      setFetchingFuid(false);
    }
  };

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        const initialFuid = editData.fuid || "";
        setForm({ fuid: initialFuid, remarks: editData.remarks || "", approved: editData?.approved ?? false });
        if (initialFuid) { fetchFuidInfo(initialFuid); setIsConfirmed(true); }
      } else {
        setForm(INITIAL_FORM); setFuidDetails(null); setIsConfirmed(false); setScannedBoxIds(new Set());
      }
    } else {
      timeoutId = setTimeout(() => {
        setForm(INITIAL_FORM); setFuidDetails(null); setIsConfirmed(false); setScannedBoxIds(new Set()); setErrors({});
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [open, editData]);

  const handleConfirm = () => {
    if (!form.fuid) { setErrors({ fuid: "Select FUID" }); return; }
    setIsConfirmed(true);
  };

  const handleChange = async (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
    if (key === "fuid") { setIsConfirmed(false); if (value) fetchFuidInfo(value); else setFuidDetails(null); }
  };

  const tryAddBox = (boxId) => {
    const bId = boxId.trim();
    if (!bId) return;

    // 1. Find box data and which packing it belongs to
    let boxData = null;
    let targetPacking = null;
    fuidDetails?.items?.forEach(item => {
      item.locations?.forEach(loc => {
        loc.boxes?.forEach(box => { 
          if (box.box_no_uid === bId) {
            boxData = box; 
            targetPacking = item;
          }
        });
      });
    });

    if (!boxData || !targetPacking) { 
      toast.error(`Box ${bId} not found in this Forwarding Note!`); 
      return; 
    }

    if (scannedBoxIds.has(bId)) { 
      toast.info(`Box already scanned.`); 
      return; 
    }

    // 2. Validation: Check if scanning this box exceeds the REQUIRED limit for its packing
    // Count how many boxes of this type (Loose vs Standard) are already scanned for this packing
    let alreadyScannedCount = 0;
    targetPacking.locations?.forEach(loc => {
      loc.boxes?.forEach(box => {
        if (scannedBoxIds.has(box.box_no_uid) && box.is_loose === boxData.is_loose) {
          alreadyScannedCount++;
        }
      });
    });

    const limit = boxData.is_loose ? targetPacking.loose_box : targetPacking.box;
    const typeLabel = boxData.is_loose ? "Loose Boxes" : "Standard Boxes";

    if (alreadyScannedCount >= limit) {
      toast.error(`Limit Reached! You only need ${limit} ${typeLabel} for Packing #${targetPacking.packing_number}.`);
      return;
    }

    // 3. Add to scanned list
    setScannedBoxIds(prev => new Set([...prev, bId]));
    toast.success(`Added: ${bId}`);
  };

  const handleInputChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (statusOverride = null) => {
    if (!form.fuid) return;
    setLoading(true);
    try {
      let finalApproved = form.approved;
      if (statusOverride !== null) finalApproved = statusOverride;
      else if (isEdit && editData?.approved) finalApproved = false;
      const payload = { ...form, fuid: Number(form.fuid), approved: finalApproved, scanned_boxes: Array.from(scannedBoxIds) };
      const request = isEdit || isApprove ? outEntryService.update(editData?.out_uid, payload) : outEntryService.create(payload);
      const res = await request;
      toast.success(res?.message || "Saved");
      onSuccess(); onClose();
    } catch (err) { toast.error(err?.response?.data?.message || "Failed"); } finally { setLoading(false); }
  };

  // ── UI Logic ───────────────────────────────────────────────────────────────
  const activeBD = fuidDetails?.items?.[activePackingIdx];
  
  // Scanned boxes for current packing
  const scannedInActive = useMemo(() => {
    if (!activeBD) return [];
    const list = [];
    activeBD.locations?.forEach(loc => {
      loc.boxes?.forEach(box => {
        if (scannedBoxIds.has(box.box_no_uid)) list.push({ ...box, location_name: loc.location_name });
      });
    });
    return list;
  }, [activeBD, scannedBoxIds]);

  const scannedStats = useMemo(() => {
    return scannedInActive.reduce((acc, b) => {
      if (b.is_loose) { acc.loose++; acc.lQty += b.qty; }
      else { acc.box++; acc.bQty += b.qty; }
      return acc;
    }, { box: 0, bQty: 0, loose: 0, lQty: 0 });
  }, [scannedInActive]);

  // Calculate available stock summary from locations
  const availableStats = useMemo(() => {
    if (!activeBD?.locations) return { box: 0, loose: 0 };
    return activeBD.locations.reduce((acc, loc) => {
      loc.boxes?.forEach(box => {
        if (box.is_loose) acc.loose++;
        else acc.box++;
      });
      return acc;
    }, { box: 0, loose: 0 });
  }, [activeBD]);

  return (
    <Drawer 
      isOpen={open} 
      onClose={onClose} 
      title={isApprove ? "Security Authorization" : isEdit ? "Edit Out Entry" : "New Out Entry"} 
      footer={(
        <div className="flex justify-end gap-3 w-full">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-500">Cancel</button>
          {isApprove ? (
            <>
              <button onClick={() => handleSave(false)} disabled={loading} className="px-5 py-2 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl">Hold</button>
              <button onClick={() => handleSave(true)} disabled={loading} className="min-w-[140px] px-6 py-2 text-sm font-bold text-white bg-emerald-600 rounded-xl shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Approve Exit
              </button>
            </>
          ) : (
            <button onClick={() => handleSave()} disabled={loading || !isConfirmed} className="min-w-[160px] px-6 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100 disabled:bg-slate-300 transition-all active:scale-95">
              {loading ? "Processing..." : isEdit ? "Update & Reset" : "Record Exit"}
            </button>
          )}
        </div>
      )} 
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4 pb-4">
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized entry will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {/* FUID Selection */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SearchableSelect label="Forwarding Note (FUID)" value={form.fuid} onChange={(id) => handleChange("fuid", id)} fetchService={forwardingNoteService.getAll} getByIdService={forwardingNoteService.getById} dataKey="fuid" labelKey="fuid" subLabelKey="acc_name" error={errors.fuid} required disabled={isConfirmed && !isEdit} />
          </div>
          {!isConfirmed && <button onClick={handleConfirm} className="h-[38px] px-4 bg-indigo-600 text-white font-bold text-[11px] rounded-lg">Confirm</button>}
        </div>

        {fuidDetails && isConfirmed && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* 1. VEHICLE INFO */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-[8px] font-bold text-slate-400 uppercase">Vehicle</p><p className="text-[11px] font-black">{fuidDetails.vehicle_number || "N/A"}</p></div>
              <div><p className="text-[8px] font-bold text-slate-400 uppercase">Transporter</p><p className="text-[11px] font-black">{fuidDetails.transporter_name || "DIRECT"}</p></div>
              <div><p className="text-[8px] font-bold text-slate-400 uppercase">Customer</p><p className="text-[11px] font-black truncate">{fuidDetails.acc_name}</p></div>
              <div><p className="text-[8px] font-bold text-slate-400 uppercase">PO/Bill</p><p className="text-[11px] font-black">{fuidDetails.po_number || "N/A"}</p></div>
            </div>

            {/* 2. PACKING TABS */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b">
              {fuidDetails.items?.map((bd, idx) => (
                <button key={idx} onClick={() => setActivePackingIdx(idx)} className={`px-4 py-2 rounded-t-lg text-[10px] font-black border-x border-t transition-all ${activePackingIdx === idx ? "bg-white border-slate-200 text-indigo-600 -mb-px" : "bg-slate-50 border-transparent text-slate-400"}`}>
                  #{bd.packing_number}
                </button>
              ))}
            </div>

            {activeBD && (
              <div className="space-y-4">
                {/* 1. WAREHOUSE STOCK (Knowledge) - Collapsible Section */}
                <div className="bg-slate-50/50 rounded-2xl border border-slate-200 overflow-hidden">
                  <button 
                    type="button"
                    onClick={() => setExpandedLocations(prev => prev.size === 0 ? new Set(activeBD.locations?.map(l => l.location_id)) : new Set())}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-slate-500">
                      <Info size={16} />
                      <div className="text-left">
                        <span className="text-[10px] font-black uppercase tracking-widest block">Warehouse Stock (Information)</span>
                        <p className="text-[8px] font-bold text-slate-400">View available boxes and their rack positions</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-500">Full: {availableStats.box}</span>
                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-500">Loose: {availableStats.loose}</span>
                      </div>
                      <ChevronRight size={16} className={`text-slate-400 transition-transform ${expandedLocations.size > 0 ? "rotate-90" : ""}`} />
                    </div>
                  </button>

                  {expandedLocations.size > 0 && (
                    <div className="p-3 border-t border-slate-200 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                      {activeBD.locations?.map((loc, lidx) => (
                        <div key={lidx} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                          <div className="px-3 py-1.5 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-indigo-600 flex items-center gap-1.5"><MapPin size={10}/> {loc.location_name}</span>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">{loc.box_count} Boxes Available</span>
                          </div>
                          <div className="p-2 flex flex-wrap gap-1.5">
                            {loc.boxes?.map((box, bidx) => (
                              <button 
                                key={bidx} 
                                onClick={() => tryAddBox(box.box_no_uid)} 
                                disabled={scannedBoxIds.has(box.box_no_uid)} 
                                className={`px-2 py-1 rounded text-[9px] font-mono font-bold border transition-all flex items-center gap-1 ${
                                  scannedBoxIds.has(box.box_no_uid) 
                                  ? "bg-slate-50 text-slate-200 border-slate-100 cursor-not-allowed" 
                                  : box.is_loose 
                                    ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
                                }`}
                              >
                                {box.box_no_uid}
                                {box.is_loose && <span className="text-[7px] bg-amber-200 px-1 rounded-sm">L</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. YOUR SCANNED (Current) - Main Focus Section */}
                <div className="space-y-3 bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100 flex flex-col min-h-[400px] shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600">
                      <CheckCircle2 size={16} />
                      <span className="text-[11px] font-black uppercase tracking-widest">Your Scanned Progress</span>
                    </div>
                    <div className="flex gap-2">
                      {/* Full Boxes Comparison */}
                      <div className={`px-3 py-1 rounded-lg text-center shadow-sm transition-all ${scannedStats.box === activeBD.box ? "bg-emerald-600 text-white" : "bg-white border border-emerald-100 text-emerald-700"}`}>
                        <p className="text-[7px] font-bold uppercase opacity-80">Full Boxes</p>
                        <p className="text-xs font-black">{scannedStats.box} / {activeBD.box}</p>
                      </div>
                      {/* Loose Boxes Comparison */}
                      <div className={`px-3 py-1 rounded-lg text-center shadow-sm transition-all ${scannedStats.loose === activeBD.loose_box ? "bg-amber-500 text-white" : "bg-white border border-amber-100 text-amber-700"}`}>
                        <p className="text-[7px] font-bold uppercase opacity-80">Loose Boxes</p>
                        <p className="text-xs font-black">{scannedStats.loose} / {activeBD.loose_box}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 animate-pulse" />
                      <input 
                        type="text" 
                        value={manualBoxId} 
                        onChange={(e) => setManualBoxId(e.target.value)} 
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') { 
                            e.preventDefault(); 
                            tryAddBox(manualBoxId); 
                            setManualBoxId(""); 
                          } 
                        }} 
                        placeholder="Scan or Type Box UID to Add..." 
                        className="w-full pl-10 pr-3 py-3 text-xs font-mono border-2 border-indigo-100 rounded-xl focus:border-indigo-500 outline-none shadow-inner bg-white" 
                        autoFocus
                      />
                    </div>
                    <button onClick={() => { tryAddBox(manualBoxId); setManualBoxId(""); }} className="px-6 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase shadow-md active:scale-95 transition-all">Add</button>
                  </div>

                  {/* SCANNED LIST - Optimized Grid */}
                  <div className="flex-1 min-h-0 bg-white/60 rounded-xl border border-indigo-50 overflow-hidden flex flex-col">
                    <div className="px-4 py-2 bg-indigo-100/50 border-b border-indigo-100 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase">Scanned Item List</span>
                      <span className="text-[9px] font-black text-indigo-600/50 uppercase tracking-tighter">Total: {scannedStats.box + scannedStats.loose}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                      {scannedInActive.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {scannedInActive.map((box, bidx) => (
                            <div key={bidx} className="bg-white p-2.5 rounded-xl border border-emerald-100 flex items-center justify-between shadow-sm hover:border-emerald-300 transition-all group">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${box.is_loose ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                                  {box.is_loose ? "L" : "B"}
                                </div>
                                <div className="flex flex-col leading-tight">
                                  <span className="text-[11px] font-mono font-black text-slate-700">{box.box_no_uid}</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase">{box.location_name} • Qty: {box.qty}</span>
                                </div>
                              </div>
                              <button 
                                onClick={() => { 
                                  const next = new Set(scannedBoxIds); 
                                  next.delete(box.box_no_uid); 
                                  setScannedBoxIds(next); 
                                }} 
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 py-12">
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border-2 border-dashed border-slate-200">
                            <ScanLine size={32} className="opacity-20" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-widest">Ready for Scanning</p>
                          <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Scan boxes for Packing #{activeBD.packing_number}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {isConfirmed && (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Security Remarks</label>
            <textarea rows={2} value={form.remarks} onChange={(e) => handleChange("remarks", e.target.value)} placeholder="Driver name, vehicle details..." className={`${OK_INPUT} resize-none text-[10px] py-1.5`} />
          </div>
        )}
        {/* ── Approval Status Toggle ── */}
        {showApproval ? (
          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${form.approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p className={`text-[9px] uppercase font-bold tracking-tight ${form.approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {form.approved ? "Final & Locked" : "Draft Mode"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={form.approved} onChange={(e) => handleInputChange("approved", e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">This entry will require authorization before becoming active.</p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
