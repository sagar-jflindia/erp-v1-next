"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle, Loader2, ShieldCheck, Layers, MessageSquareQuote } from "lucide-react";
import { toast } from "react-toastify";

// Services & Components
import { stockAdjustmentService } from "@/services/stockAdjustment";
import { masterService } from "@/services/master";
import SearchableSelect from "../common/SearchableSelect";
import RemarksTextarea from "../common/RemarksTextarea";
import Drawer from "@/components/ui/Drawer";
import { useCanAccess } from "@/hooks/useCanAccess";
import { ERR_INPUT, OK_INPUT } from "@/components/common/Constants";

const INITIAL_FORM = {
  item_dcode: "",
  qty: "",
  unit: "PCS",
  remarks: "",
  approved: false,
};

export default function StockAdjustmentModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess("stock_adjustment", "authorize");

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";

  // Approval toggle tabhi dikhega jab user ke paas permission ho 
  // aur wo ya to Add kar raha ho ya explicit Approve mode mein ho
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});

  /**
   * Effect: Reset or Sync Form Data
   */
  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        setForm({
          item_dcode: editData.item_dcode || "",
          qty: editData.qty || "",
          unit: editData.unit || "PCS",
          remarks: editData.remarks || "",
          // Approve mode mein purana status rakhte hain, Edit mein reset karte hain
          approved: isApprove ? (editData.approved ?? false) : false,
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

  /**
   * Input Change Handler
   */
  const handleInputChange = (k, value) => {
    let finalValue = value;
    if (k === "qty" && value !== "") {
      const num = parseFloat(value);
      if (num < 0) finalValue = "0";
    }
    setForm(prev => ({ ...prev, [k]: finalValue }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: "" }));
  };

  /**
   * Validation Logic
   */
  const validate = () => {
    const e = {};
    if (!form.item_dcode) e.item_dcode = "Please select an item";
    if (!form.qty || isNaN(form.qty) || parseFloat(form.qty) <= 0) {
      e.qty = "Enter a valid quantity (must be greater than 0)";
    }
    if (!form.remarks?.trim() || form.remarks.length < 5) {
      e.remarks = "Reason must be at least 5 characters long";
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /**
   * Save Handler
   */
  const handleSave = async (statusOverride = null) => {
    if (!validate()) return;

    setLoading(true);
    try {
      let finalApproved = form.approved;
      
      // logic override for buttons
      if (statusOverride !== null) {
        finalApproved = statusOverride;
      } else if (isEdit && editData?.approved) {
        // Agar pehle se approved tha aur edit kiya gaya, to status reset hoga
        finalApproved = false;
      }

      const payload = {
        ...form,
        qty: parseInt(form.qty),
        item_dcode: parseInt(form.item_dcode),
        approved: finalApproved,
      };

      const isUpdate = isEdit || isApprove;
      if (isUpdate) {
        await stockAdjustmentService.update(editData.adjustment_id, payload);
        toast.success("Stock adjustment updated");
      } else {
        await stockAdjustmentService.create(payload);
        toast.success("Stock adjusted successfully");
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  // Drawer Footer
  const footer = (
    <div className="flex items-center justify-end gap-3 w-full">
      <button 
        onClick={onClose} 
        disabled={loading}
        className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors"
      >
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
          className="min-w-[160px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-indigo-400 active:scale-95"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Committing...</>
          ) : (
            <><Check size={18} /> {isEdit ? "Update & Reset" : "Confirm Adjustment"}</>
          )}
        </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isApprove ? "Authorization Check" : isEdit ? "Update Stock Adjustment" : "New Stock Adjustment"}
      description="Manually override inventory levels with documented reasons"
      footer={footer}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pb-6">
        
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized adjustment will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {/* Item Selection */}
        <div className="space-y-1">
          <SearchableSelect
            label="Target Item (D-Code)"
            value={form.item_dcode}
            onChange={(id) => handleInputChange("item_dcode", id)}
            fetchService={masterService.getItems}
            getByIdService={masterService.getItemById}
            dataKey="itemdcode"
            labelKey="item_code"
            subLabelKey="itemdesc"
            error={errors.item_dcode}
            required
          />
        </div>

        {/* Qty & Unit Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Adjustment Qty <span className="text-rose-500">*</span>
            </label>
            <input 
              type="number"
              value={form.qty} 
              onChange={(e) => handleInputChange("qty", e.target.value)} 
              placeholder="e.g. 10 or 25" 
              className={errors.qty ? ERR_INPUT : OK_INPUT} 
            />
            <div className="flex justify-between items-center px-1">
              <p className="text-[10px] text-slate-400 italic">Enter quantity to adjust</p>
              {errors.qty && (
                <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                  <AlertCircle size={10}/> {errors.qty}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">Unit</label>
            <select 
              value={form.unit} 
              onChange={(e) => handleInputChange("unit", e.target.value)}
              className={OK_INPUT}
            >
              <option value="PCS">PCS (Pieces)</option>
              <option value="KG">KG (Kilograms)</option>
            </select>
          </div>
        </div>

        <RemarksTextarea
          label="Adjustment Reason"
          labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
          value={form.remarks}
          onChange={(e) => handleInputChange("remarks", e.target.value)}
          placeholder="Explain why this adjustment is required (e.g., Damage, Audit Correction)..."
          error={errors.remarks}
          required
          rows={4}
        />

        <div className="h-px bg-slate-100" />

        {/* Admin/Approval Section */}
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