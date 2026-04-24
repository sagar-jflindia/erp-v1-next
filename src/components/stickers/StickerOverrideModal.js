"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ScanLine, Camera, CameraOff, Trash2, Info, ShieldCheck, Check, AlertCircle, Plus } from "lucide-react";
import { toast } from "react-toastify";

import { boxService } from "@/services/box";
import { masterService } from "@/services/master";
import SearchableSelect from "../common/SearchableSelect";
import Drawer from "@/components/ui/Drawer";
import { OK_INPUT } from "@/components/common/Constants";
import { useCanAccess } from "@/hooks/useCanAccess";

const INITIAL_FORM = {
  to_customer_code: "",
  to_customer_name: "",
  remarks: "",
  approved: false,
};

const getItemCodeFromBoxNoUid = (boxNoUid = "") => String(boxNoUid).split("_")[0] || "";
const normalizeCode = (value = "") => String(value).trim().toUpperCase();

export default function OverrideRequestDrawer({ open, onClose, onSuccess, editData, mode = "add" }) {
  // Authorization & Mode Hooks
  const canAccess = useCanAccess();
  const canApprove = canAccess("box_table", "authorize");

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  // States
  const [loading, setLoading] = useState(false);
  const [scanValue, setScanValue] = useState("");
  const [scanRows, setScanRows] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  // Camera Refs
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const lastScannedRef = useRef({ value: "", at: 0 });

  // Lifecycle: Sync Data on Open/Edit
  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        // 1. Sync Form States
        setForm({
          to_customer_code: editData.to_customer || "",
          to_customer_name: editData.to_customer_name || "",
          remarks: editData.remarks || "",
          approved: editData.status === "approved" || (editData.approved ?? false),
        });

        // 2. Sync Table Rows (The Fix)
        if (editData.details && editData.details.length > 0) {
          // Agar API se full details array aa raha hai
          setScanRows(editData.details);
        } else if (editData.box_uids && Array.isArray(editData.box_uids)) {
          const mappedRows = editData.box_uids.map((id, index) => ({
              box_uid: id, // Numeric ID
              box_no_uid: editData.box_no_uids ? editData.box_no_uids[index] : id, // Readable UID
              acc_name: editData.from_customer_name || "Stock",
              packing_number: editData.packing_number
          }));
          setScanRows(mappedRows);
        } else if (editData.box_no_uid) {
          // Single box case
          setScanRows([editData]);
        }
      } else {
        setForm(INITIAL_FORM);
        setScanRows([]);
      }
      setErrors({});
    } else {
      timeoutId = setTimeout(() => {
        setForm(INITIAL_FORM);
        setScanRows([]);
        setErrors({});
        stopCamera();
      }, 300);
    }
    return () => {
      clearTimeout(timeoutId);
      stopCamera();
    };
  }, [open, editData, isApprove]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
  };

  // Scanning Logic
  const parseScannedValue = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return "";

    const uidMatch = text.match(/\b(?:uid|box(?:\s*id)?|box_no_uid)\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i);
    if (uidMatch?.[1]) return uidMatch[1].trim();

    const idMatch = text.match(/\bid\s*[:=-]?\s*([A-Za-z0-9_-]+)\b/i);
    if (idMatch?.[1]) return idMatch[1].trim();

    return text.split(/\r?\n/)[0].trim();
  };

  const onScanByCode = async (rawCode) => {
    const code = parseScannedValue(rawCode);
    if (!code) return;

    if (scanRows.some((r) => String(r.box_no_uid) === code)) {
      setScanValue("");
      return toast.info("Box already in list");
    }

    setLoading(true);
    try {
      // Fetch exact box directly from DB (not paginated sticker management list)
      // so scanning works even when total records are much larger than page limit.
      const exactRes = await boxService.getAll({
        page: 1,
        limit: 1,
        filters: { box_no_uid: code },
      });

      let found = (exactRes.data || [])[0];

      // Fallback for QR text variants/prefixes.
      if (!found) {
        const searchRes = await boxService.getStickerManagementList({
          page: 1,
          limit: 20,
          search: code,
        });
        found = (searchRes.data || []).find((r) => String(r.box_no_uid) === code);
      }
      
      if (!found) {
        toast.error("Box record not found in database");
        return;
      }

      const itemCode = normalizeCode(getItemCodeFromBoxNoUid(found.box_no_uid));
      if (scanRows.length > 0) {
        const first = scanRows[0];
        if (String(found.packing_number) !== String(first.packing_number)) {
          return toast.warn("Warning: All boxes must have same Packing Number");
        }
        if (itemCode !== normalizeCode(getItemCodeFromBoxNoUid(first.box_no_uid))) {
          return toast.warn("Warning: Item Code mismatch");
        }
      }

      setScanRows((prev) => [...prev, found]);
      setScanValue("");
    } catch (err) {
      toast.error("Box lookup failed");
    } finally {
      setLoading(false);
    }
  };

  // Camera Management
  const stopCamera = useCallback(() => {
    if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setCameraOn(false);
  }, []);

  const startCamera = async () => {
    if (!("BarcodeDetector" in window)) return toast.error("Scanning not supported on this browser");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);

      const detector = new window.BarcodeDetector({ formats: ["qr_code", "code_128"] });
      scanTimerRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState !== 4) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            const raw = codes[0].rawValue;
            const now = Date.now();
            if (lastScannedRef.current.value === raw && now - lastScannedRef.current.at < 2000) return;
            lastScannedRef.current = { value: raw, at: now };
            onScanByCode(raw);
          }
        } catch (e) {}
      }, 500);
    } catch { toast.error("Camera access denied"); }
  };

  const handleSave = async (statusOverride = null) => {
    if (!scanRows.length) return toast.error("Please add at least one box");
    if (!form.to_customer_code) return toast.error("Target customer is required");

    setLoading(true);
    try {
      let finalApproved = form.approved;

      if (statusOverride !== null) {
        finalApproved = statusOverride;
      } 
      else if (isEdit && !canApprove) {
        finalApproved = false; 
      }

      const payload = {
        request_id: editData?.request_id,
        box_uids: scanRows.map((r) => r.box_uid || r.id), 
        from_customer: scanRows[0].override_cust || scanRows[0].acc_code || editData?.from_customer,
        to_customer: form.to_customer_code,
        packing_number: scanRows[0].packing_number,
        remarks: form.remarks,
        approved: finalApproved,
      };

      const request = (isEdit || isApprove) 
        ? boxService.updateOverrideRequest(editData?.request_id, payload) 
        : boxService.createOverrideRequest(payload);
      
      const res = await request;
      toast.success(res?.message || "Successfully processed");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const footerContent = (
    <div className="flex items-center justify-end gap-3 w-full">
      <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-500">
        Cancel
      </button>

      {isApprove ? (
        <>
          <button
            onClick={() => handleSave(false)}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Keep Pending
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Approve
          </button>
        </>
      ) : (
        <button
          onClick={() => handleSave()}
          disabled={loading}
          className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Processing</>
          ) : (
            <><Check size={18} /> {isEdit ? "Update & Reset Status" : "Save Request"}</>
          )}
        </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isApprove ? "Authorization Check" : isEdit ? "Edit Override Request" : "Customer Override"}
      description="Update ledger ownership for scanned boxes"
      footer={footerContent}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pb-6">
        
        {/* Warning Alert */}
        {isEdit && editData?.status === "approved" && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 font-medium">
              Editing this authorized request will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {/* Input & Scan Section */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex justify-between">
            <span>Sticker Input</span>
            <span className={scanRows.length > 0 ? "text-indigo-600 font-bold" : ""}>
              Packing No: {scanRows[0]?.packing_number || "---"}
            </span>
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={scanValue}
                onChange={(e) => setScanValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onScanByCode(scanValue)}
                placeholder="Scan QR or Enter Box UID..."
                className={`${OK_INPUT} pl-10 h-12 bg-white`}
              />
            </div>
            
            <button
              onClick={() => (cameraOn ? stopCamera() : startCamera())}
              className={`w-12 h-12 flex items-center justify-center rounded-xl border transition-all shadow-sm ${
                cameraOn ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-200 text-slate-600"
              }`}
            >
              {cameraOn ? <CameraOff size={20} /> : <Camera size={20} />}
            </button>

            <button 
              onClick={() => onScanByCode(scanValue)}
              disabled={!scanValue || loading}
              className="px-5 h-12 bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-black transition-all disabled:bg-slate-300"
            >
              <Plus size={16} /> ADD
            </button>
          </div>
        </div>

        {/* Camera Visual */}
        {cameraOn && (
          <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-200 shadow-2xl aspect-video max-h-52">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            <div className="absolute inset-0 border-[20px] border-black/40 pointer-events-none" />
            <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.8)] animate-pulse" />
          </div>
        )}

        {/* Selected Rows Table */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
              Selected Boxes ({scanRows.length})
            </h4>
            {scanRows.length > 0 && (
              <button 
                onClick={() => setScanRows([])} 
                className="text-[10px] text-rose-500 font-bold hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors"
              >
                REMOVE ALL
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto overflow-x-hidden">
            {scanRows.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Info size={20} className="text-slate-300" />
                </div>
                <p className="text-xs text-slate-400 font-medium">Ready for scan. Please add stickers.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-400 z-10 shadow-sm">
                  <tr className="border-b border-slate-100">
                    <th className="text-left p-3 font-semibold">Box UID</th>
                    <th className="text-left p-3 font-semibold">Current Customer</th>
                    <th className="text-right p-3 pr-5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {scanRows.map((row, idx) => (
                    <tr key={row.box_uid || idx} className="group hover:bg-indigo-50/30 transition-colors">
                      <td className="p-3">
                        <span className="font-bold text-slate-700 uppercase">{row.box_no_uid}</span>
                      </td>
                      <td className="p-3 text-slate-500 truncate max-w-[150px]">
                        {row.acc_name || "Stock"}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <button 
                          type="button"
                          onClick={() => setScanRows(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Destination Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6">
          <SearchableSelect
            label="Target Customer (To)"
            value={form.to_customer_code}
            onChange={(id, obj) => {
              handleChange("to_customer_code", id);
              handleChange("to_customer_name", obj?.acc_name || "");
            }}
            fetchService={masterService.getLedgers}
            getByIdService={masterService.getLedgerById}
            dataKey="acc_code"
            labelKey="acc_name"
            placeholder="Search Ledger..."
            required
          />

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Internal Remarks
            </label>
            <textarea
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              placeholder="E.g. Customer changed..."
              className={`${OK_INPUT} min-h-[45px] py-2 resize-none h-[45px]`}
            />
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        {showApproval ? (
          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${form.approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p className={`text-[9px] uppercase font-bold tracking-tight ${form.approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {form.approved ? "Authorized" : "Pending Approval"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.approved}
                onChange={(e) => handleChange("approved", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">Override will be marked as 'Pending' until authorized by an admin.</p>
          </div>
        )}
      </div>
    </Drawer>
  );
}