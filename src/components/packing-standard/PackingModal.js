"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle, Loader2, ShieldCheck, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";

import { packingStandardService } from "@/services/packingStandard";
import { masterService } from "@/services/master";
import { categoryService } from "@/services/category";
import SearchableSelect from "../common/SearchableSelect";
import Drawer from "@/components/ui/Drawer";
import { useCanAccess } from "@/hooks/useCanAccess";
import { ERR_INPUT, OK_INPUT, UNIT_OPTIONS } from "@/components/common/Constants";

const INITIAL_FORM = {
  item_dcode: "",
  qty: 1,
  unit: "PCS",
  type: "",
  acc_code: "",
  approved: false,
};

export default function PackingModal({ open, onClose, onSuccess, editData, mode = "add" }) {

  const canAccess = useCanAccess();
  const canApprove = canAccess("packing_standard", "authorize");

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
          item_dcode: editData.item_dcode || "",
          qty: Number(editData.qty) || 1,
          unit: editData.unit || "PCS",
          type: editData.type || "",
          acc_code: editData.acc_code || "",
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

    if (!form.item_dcode) newErrors.item_dcode = "Please select an item";
    if (!Number.isFinite(form.qty) || form.qty < 1) newErrors.qty = "Quantity must be at least 1";
    if (!form.type) newErrors.type = "Category type is mandatory";

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
        finalApproved = false;
      }

      const payload = {
        ...form,
        qty: Number(form.qty),
        acc_code: form.acc_code ? Number(form.acc_code) : null,
        item_dcode: Number(form.item_dcode),
        type: Number(form.type),
        approved: finalApproved,
      };

      const isUpdate = isEdit || isApprove;
      const request = isUpdate ? packingStandardService.update(editData?.standard_id, payload) : packingStandardService.create(payload);
      const response = await request;

      toast.success(response?.message || "Successfully saved");
      onSuccess();
      onClose();

    } catch (err) {
      toast.error( err?.response?.data?.message || err?.message || "Operation failed" );
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
            <><Check size={18} /> {isEdit ? "Update & Reset Status" : "Save Standard"}</>
          )}
        </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isApprove ? "Authorization Check" : isEdit ? "Edit Packing Standard" : "Create Packing Standard"}
      description="Manage packing rules and authorization status"
      footer={footerContent}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 pb-4">

        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized standard will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}
        
        <SearchableSelect
          label="Item Search (Code / Description)"
          value={form.item_dcode}
          onChange={(id) => handleChange("item_dcode", id)}
          fetchService={masterService.getItems}
          getByIdService={masterService.getItemById}
          dataKey="itemdcode"
          labelKey="item_code"
          subLabelKey="itemdesc"
          error={errors.item_dcode}
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Packing Qty <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={form.qty}
              onChange={(e) => handleChange("qty", Number(e.target.value))}
              className={`${errors.qty ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Unit of Measure
            </label>
            <div className="relative">
              <select
                value={form.unit}
                onChange={(e) => handleChange("unit", e.target.value)}
                className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg appearance-none pr-10`}
              >
                {UNIT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SearchableSelect
            label="Packing Category / Type"
            value={form.type} 
            onChange={(id) => handleChange("type", id)}
            fetchService={categoryService.getAll}
            getByIdService={categoryService.getById}
            dataKey="id"
            labelKey="name"
            placeholder="Search category..."
            error={errors.type}
            required
          />

          <SearchableSelect
            label="Customer / Account (Optional)"
            value={form.acc_code}
            onChange={(id) => handleChange("acc_code", id)}
            fetchService={masterService.getLedgers}
            getByIdService={masterService.getLedgerById}
            dataKey="acc_code"
            labelKey="acc_name"
          />
        </div>

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
            <p className="text-[10px] text-slate-500 italic">Standard will be marked as 'Pending' until authorized.</p>
          </div>
        )}
      </div>
    </Drawer>
  );
}