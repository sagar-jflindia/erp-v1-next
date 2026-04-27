"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle, Loader2, ShieldCheck, Hash, ClipboardList, MapPin, Layers, UserCheck, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";

import { boxService } from "@/services/box";
import { masterService } from "@/services/master"; // Location aur Ledger ke liye
import Drawer from "@/components/ui/Drawer";
import SearchableSelect from "../common/SearchableSelect";
import { useCanAccess } from "@/hooks/useCanAccess";
import { ERR_INPUT, OK_INPUT } from "@/components/common/Constants";
import { locationService } from "@/services/location";

const INITIAL_FORM = {
  box_no_uid: "",
  packing_number: "",
  qty: 1,
  override_cust: "",
  location_id: "",
  in_uid: "",
  out_uid: "",
  approved: false,
};

export default function BoxModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess("box_table", "authorize"); 

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        setForm({
          box_no_uid: editData.box_no_uid || "",
          packing_number: editData.packing_number || "",
          qty: Number(editData.qty) || 1,
          override_cust: editData.override_cust || "",
          location_id: editData.location_id || "",
          in_uid: editData.in_uid || "",
          out_uid: editData.out_uid || "",
          approved: isApprove ? (editData?.approved ?? false) : false,
        });
      } else {
        setForm(INITIAL_FORM);
      }
      setErrors({});
    } else {
      timeoutId = setTimeout(() => {
        setForm(INITIAL_FORM);
        setErrors({});
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [open, editData, isApprove]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.box_no_uid?.trim()) newErrors.box_no_uid = "Box UID is required";
    if (!form.qty || Number(form.qty) < 1) newErrors.qty = "Valid quantity required";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (statusOverride = null) => {
    if (!validate()) return;
    setLoading(true);

    try {
      let finalApproved = form.approved;
      if (statusOverride !== null) {
        finalApproved = statusOverride;
      } else if (isEdit && editData?.approved) {
        finalApproved = false; // Reset on edit
      }

      const payload = {
        ...form,
        qty: Number(form.qty),
        // Empty strings handled as null for backend integer columns
        location_id: form.location_id || null,
        override_cust: form.override_cust || null,
        approved: finalApproved,
      };

      const request = (isEdit || isApprove) 
        ? boxService.update(editData?.box_uid, payload) 
        : boxService.create(payload);
        
      const response = await request;
      toast.success(response?.message || "Successfully saved");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
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
            <><Check size={18} /> {isEdit ? "Update & Reset Status" : "Save Box Entry"}</>
          )}
        </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isApprove ? "Authorization Check" : isEdit ? "Edit Box Details" : "New Box Entry"}
      description="Manage box UIDs, tracking numbers and warehouse placement"
      footer={footerContent}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 pb-4">

        {/* Status Warning (Same as PackingModal) */}
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized box will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}
        
        {/* Core ID Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Box UID / Serial <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                value={form.box_no_uid} 
                onChange={(e) => handleChange("box_no_uid", e.target.value.toUpperCase())} 
                placeholder="UID-100201" 
                className={`pl-8 text-[11px] h-[38px] rounded-lg border-slate-200 ${errors.box_no_uid ? ERR_INPUT : OK_INPUT}`} 
              />
            </div>
            {errors.box_no_uid && <p className="text-[9px] text-rose-500 font-bold ml-1">{errors.box_no_uid}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Packing Slip Number
            </label>
            <div className="relative">
              <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                value={form.packing_number} 
                onChange={(e) => handleChange("packing_number", e.target.value)} 
                placeholder="PK-XXXX" 
                className={`pl-8 text-[11px] h-[38px] rounded-lg border-slate-200 ${OK_INPUT}`} 
              />
            </div>
          </div>
        </div>

        {/* Quantity and Smart Location Select */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Unit Quantity <span className="text-rose-500">*</span>
            </label>
            <input 
              type="number" 
              min="1"
              value={form.qty} 
              onChange={(e) => handleChange("qty", e.target.value)} 
              className={`${errors.qty ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`} 
            />
          </div>

          <SearchableSelect
            label="Storage Location"
            value={form.location_id}
            onChange={(id) => handleChange("location_id", id)}
            fetchService={locationService.getAll} // Assuming you have this
            getByIdService={locationService.getById}
            dataKey="location_id"
            labelKey="rack_no"
            subLabelKey="row_no"
            placeholder="Select Rack/Row"
          />
        </div>

        {/* Tracking UIDs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Inbound Reference</label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                value={form.in_uid} 
                onChange={(e) => handleChange("in_uid", e.target.value)} 
                placeholder="IN-UID" 
                className={`pl-8 text-[11px] h-[38px] rounded-lg border-slate-200 ${OK_INPUT}`} 
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Outbound Reference</label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                value={form.out_uid} 
                onChange={(e) => handleChange("out_uid", e.target.value)} 
                placeholder="OUT-UID" 
                className={`pl-8 text-[11px] h-[38px] rounded-lg border-slate-200 ${OK_INPUT}`} 
              />
            </div>
          </div>
        </div>

        {/* Customer Select (Same as PackingModal) */}
        <SearchableSelect
          label="Assigned Customer / Account (Optional)"
          value={form.override_cust}
          onChange={(id) => handleChange("override_cust", id)}
          fetchService={masterService.getLedgers}
          getByIdService={masterService.getLedgerById}
          dataKey="acc_code"
          labelKey="acc_name"
        />

        <div className="h-px bg-slate-100" />

        {/* ── Approval Status ── */}
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
              <input type="checkbox" checked={form.approved} onChange={(e) => handleChange("approved", e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">Entry will be marked as 'Pending' until authorized by a supervisor.</p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
