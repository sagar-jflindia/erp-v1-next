"use client";

import React, { useState, useEffect } from "react";
import { Check, Loader2, ShieldCheck, Package, Trash2, Plus, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

import { forwardingNoteService } from "@/services/forwardingNote";
import { masterService }         from "@/services/master";
import Drawer                    from "@/components/ui/Drawer";
import SearchableSelect          from "../common/SearchableSelect";
import { OK_INPUT }              from "../common/Constants";
import { selectHasPermission }   from "@/features/authSlice";

const INITIAL_FORM = {
  acc_code:         "",
  po_number:        "",
  transporter_name: "",
  vehicle_number:   "",
  cartage:          "",
  bill_no:          "",
  customer_qty:     "",
  remarks:          "",
  approved:         false,
  items:            [], // multiple rows
};

const INITIAL_ITEM_ROW = {
  item_dcode:      "",
  item_code:       "",
  itemdesc:        "",
  available_boxes: [], // full stock from API
  selected_boxes:  [], // FIFO se selected boxes
  fg_qty:          0,  // total available
  dispatch_qty:    "", // user input
  dispatch_std:    "", // dispatch according to standard
  fetching:        false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Total qty of a box array
const sumQty = (boxes) => boxes.reduce((s, b) => s + Number(b.qty), 0);

const selectBoxesByQty = (boxes, targetQty) => {
  if (!targetQty) return [];
  const selected = [];
  let acc = 0;
  for (const box of boxes) {
    selected.push(box);
    acc += Number(box.qty);
    if (acc >= targetQty) break;
  }
  return selected;
};

export default function ForwardingModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const [loading, setLoading]         = useState(false);
  const [form, setForm]               = useState(INITIAL_FORM);
  const [errors, setErrors]           = useState({});
  const [expandedItems, setExpandedItems] = useState({});

  const canAuthorize = useSelector(selectHasPermission("forwarding_note_master", "authorize"));
  
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";

  const showApproval = canAuthorize && (mode === "add" || mode === "approve");

  // ── Reset ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const initData = async () => {
      if (open) {
        if (editData) {
          setLoading(true);
          try {
            // Fetch full data including items from backend to ensure real-time accuracy
            const res = await forwardingNoteService.getById(editData.fuid);
            if (res.success && res.data) {
              const fullData = res.data;
              
              // Map items and fetch stock for each in parallel
              const itemsWithStock = await Promise.all((fullData.items || []).map(async (i) => {
                let available_boxes = [];
                let fg_qty = i.total_qty || 0;
                
                try {
                  const stockRes = await forwardingNoteService.getAvailableBoxes({ item_dcode: i.item_dcode });
                  if (stockRes.success) {
                    available_boxes = stockRes.data;
                    fg_qty = sumQty(stockRes.data);
                  }
                } catch (e) {
                  console.error("Stock fetch error", e);
                }

                // Auto-select boxes based on saved qty to restore the "selected" state
                const selected_boxes = selectBoxesByQty(available_boxes, i.total_qty);

                return {
                  ...i,
                  item_dcode:      i.item_dcode,
                  item_code:       i.item_code,
                  itemdesc:        i.itemdesc,
                  available_boxes,
                  selected_boxes, 
                  fg_qty,
                  dispatch_qty:    i.total_qty || "",
                  dispatch_std:    i.total_qty || "",
                  fetching:        false,
                  original_breakdowns: i.breakdowns || []
                };
              }));

              setForm({
                acc_code:         fullData.acc_code           || "",
                po_number:        fullData.po_number          || "",
                transporter_name: fullData.transporter_name   || "",
                vehicle_number:   fullData.vehicle_number     || "",
                cartage:          fullData.cartage            || "",
                bill_no:          fullData.bill_no            || "",
                customer_qty:     fullData.customer_qty       || "",
                remarks:          fullData.remarks            || "",
                approved:         isApprove ? (fullData?.approved ?? false) : false,
                items:            itemsWithStock,
              });
            }
          } catch (err) {
            toast.error("Failed to load forwarding note details.");
          } finally {
            setLoading(false);
          }
        } else {
          setForm({ ...INITIAL_FORM, items: [{ ...INITIAL_ITEM_ROW }] });
        }
        setErrors({});
      }
    };

    initData();
  }, [open, editData, isApprove]);

  // ── Form helpers ───────────────────────────────────────────────────────────
  const handleInputChange = (k, value) => {
    setForm((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  // ── Item Row Helpers ───────────────────────────────────────────────────────
  const updateItemRow = (idx, updates) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === idx ? { ...item, ...updates } : item)
    }));
  };

  const addRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { ...INITIAL_ITEM_ROW }]
    }));
  };

  const removeRow = (idx) => {
    if (form.items.length === 1) {
      updateItemRow(0, INITIAL_ITEM_ROW);
      return;
    }
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  // ── Item select — fetch boxes from API ────────────────────────────────────
  const handleItemChange = async (idx, id, rawData) => {
    if (!id) {
      updateItemRow(idx, INITIAL_ITEM_ROW);
      return;
    }

    updateItemRow(idx, {
      item_dcode:      id,
      item_code:       rawData?.item_code || "",
      itemdesc:        rawData?.itemdesc  || "",
      available_boxes: [],
      selected_boxes:  [],
      fg_qty:          0,
      dispatch_qty:    "",
      dispatch_std:    "",
      fetching:        true,
    });

    try {
      const res = await forwardingNoteService.getAvailableBoxes({ item_dcode: id });
      if (res.success) {
        const fg_qty = sumQty(res.data);
        updateItemRow(idx, {
          available_boxes: res.data,
          fg_qty,
          fetching: false,
        });
        if (res.count === 0) toast.info("No stock available in the warehouse for this item.");
      }
    } catch (err) {
      updateItemRow(idx, { fetching: false });
      toast.error("Failed to fetch available stock for this item.");
    }
  };

  const handleDispatchQtyChange = (idx, val) => {
    const item = form.items[idx];
    const qty = Math.min(Math.max(0, Number(val)), item.fg_qty);
    const selected = selectBoxesByQty(item.available_boxes, qty);
    updateItemRow(idx, {
      dispatch_qty: qty || "",
      selected_boxes: selected,
    });
  };

  const handleBoxChange = (idx, type) => {
    const item = form.items[idx];
    
    // If we are in edit mode and haven't selected any boxes yet, 
    // we should initialize selected_boxes from available_boxes based on current dispatch_qty
    let currentSelected = [...item.selected_boxes];
    if (isEdit && currentSelected.length === 0 && item.dispatch_qty > 0 && item.available_boxes.length > 0) {
      // Strictly maintain FIFO by selecting from the start of available_boxes
      currentSelected = selectBoxesByQty(item.available_boxes, Number(item.dispatch_qty));
    }

    if (type === 'add') {
      if (currentSelected.length >= item.available_boxes.length) return toast.info("All available boxes are already selected.");
      // FIFO: Add the next available box in sequence
      const nextBox = item.available_boxes[currentSelected.length];
      const newSelected = [...currentSelected, nextBox];
      updateItemRow(idx, {
        selected_boxes: newSelected,
        dispatch_qty: sumQty(newSelected),
      });
    } else {
      if (!currentSelected.length) return;
      // FIFO: Remove the last selected box
      const newSelected = currentSelected.slice(0, -1);
      updateItemRow(idx, {
        selected_boxes: newSelected,
        dispatch_qty: sumQty(newSelected),
      });
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (statusOverride = null) => {
    const newErrors = {};
    if (!form.po_number?.trim()) newErrors.po_number = "PO Number required";
    if (!form.bill_no?.trim())   newErrors.bill_no   = "Bill Number required";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      toast.error("Please fill all required fields before saving.");
      return;
    }

    const validItems = form.items.filter(i => i.item_dcode && (i.selected_boxes.length > 0 || i.original_breakdowns?.length > 0));
    if (!validItems.length) return toast.error("Please add at least one item with boxes to proceed.");

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
        acc_code:    parseInt(form.acc_code)      || null,
        cartage:     parseFloat(form.cartage)     || 0,
        customer_qty: parseInt(form.customer_qty) || 0,
        approved:    finalApproved,
        total_items: validItems.reduce((s, i) => {
          const rowTotal = i.selected_boxes.length > 0 
            ? sumQty(i.selected_boxes) 
            : (i.total_qty || 0);
          return s + rowTotal;
        }, 0),
        items:       validItems.flatMap(i => {
          if (i.selected_boxes.length > 0) {
            return [{
              item_dcode: i.item_dcode,
              item_code:  i.item_code,
              itemdesc:   i.itemdesc,
              qty:        sumQty(i.selected_boxes),
              selected_boxes: i.selected_boxes,
            }];
          } else if (isEdit && i.original_breakdowns?.length > 0) {
            return i.original_breakdowns.map(bd => ({
              item_dcode: i.item_dcode,
              item_code:  i.item_code,
              itemdesc:   i.itemdesc,
              qty:        bd.total_qty,
              packing_number: bd.packing_number,
              box:        bd.box,
              box_qty:    bd.box_qty,
              loose_box:  bd.loose_box,
              loose_box_qty: bd.loose_box_qty,
              total_qty:  bd.total_qty,
              is_pre_calculated: true
            }));
          }
          return [];
        }),
      };

      if (isEdit || isApprove) {
        await forwardingNoteService.update(editData.fuid, payload);
        toast.success("Forwarding note updated successfully.");
      } else {
        await forwardingNoteService.create(payload);
        toast.success("Forwarding note created successfully.");
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const confirmedTotal = form.items.reduce((s, i) => {
    const rowTotal = i.selected_boxes.length > 0 
      ? sumQty(i.selected_boxes) 
      : (i.total_qty || 0);
    return s + rowTotal;
  }, 0);
  const customerQty    = parseInt(form.customer_qty) || 0;
  const isQtyExceeded  = customerQty > 0 && confirmedTotal > customerQty;

  // ── Footer ─────────────────────────────────────────────────────────────────
  const footer = (
    <div className="flex items-center justify-between gap-3 w-full">
      
      {/* Left — warning ya empty */}
      {isQtyExceeded ? (
        <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          <AlertCircle size={14} />
          <span className="text-[11px] font-bold">
            Dispatched quantity ({confirmedTotal.toLocaleString()}) exceeds customer order quantity ({customerQty.toLocaleString()})
          </span>
        </div>
      ) : <div />}

      {/* Right — buttons */}
      <div className="flex items-center gap-3">
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
            disabled={loading || isQtyExceeded}
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-indigo-400 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Processing</>
            ) : (
              <><Check size={18} /> {isEdit ? "Update & Reset Status" : "Save Standard"}</>
            )}
          </button>
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isApprove ? "Authorization Check" : isEdit ? "Edit Forwarding Note" : "New Forwarding Note"}
      description="Enter logistics details and item breakdown"
      footer={footer}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 pb-4">

        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized forwarding note will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {/* ── Header fields ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
          <div className="md:col-span-4">
            <SearchableSelect
              label="Customer / Account (Optional)"
              value={form.acc_code}
              onChange={(id) => handleInputChange("acc_code", id)}
              fetchService={masterService.getLedgers}
              getByIdService={masterService.getLedgerById}
              dataKey="acc_code"
              labelKey="acc_name"
            />
          </div>

          {/* PO Number */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">PO Number *</label>
            <input
              value={form.po_number}
              onChange={(e) => handleInputChange("po_number", e.target.value)}
              placeholder="PO-XXXX"
              className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg ${errors.po_number ? "border-rose-500 bg-rose-50" : "border-slate-200"}`}
            />
            {errors.po_number && (
              <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                <AlertCircle size={10} /> {errors.po_number}
              </p>
            )}
          </div>

          {/* Bill Number */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Bill Number *</label>
            <input
              value={form.bill_no}
              onChange={(e) => handleInputChange("bill_no", e.target.value)}
              placeholder="INV-XXXX"
              className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg ${errors.bill_no ? "border-rose-500 bg-rose-50" : "border-slate-200"}`}
            />
            {errors.bill_no && (
              <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                <AlertCircle size={10} /> {errors.bill_no}
              </p>
            )}
          </div>

          {/* Transporter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Transporter</label>
            <input
              value={form.transporter_name}
              onChange={(e) => handleInputChange("transporter_name", e.target.value)}
              placeholder="Transporter Name"
              className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`}
            />
          </div>

          {/* Vehicle No */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Vehicle No</label>
            <input
              value={form.vehicle_number}
              onChange={(e) => handleInputChange("vehicle_number", e.target.value)}
              placeholder="XX-00-XX-0000"
              className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`}
            />
          </div>
        </div>

        {/* ── Item Section ── */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 shadow-inner">
          <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                  <Package size={14} className="text-indigo-600" />
                  <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Item Breakdown</h3>
              </div>
              <div className="flex items-center gap-2">
                  {customerQty > 0 && (
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold ${
                          isQtyExceeded
                          ? "bg-rose-50 border-rose-200 text-rose-600"
                          : confirmedTotal === customerQty
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                          : "bg-indigo-50 border-indigo-200 text-indigo-600"
                      }`}>
                          <span>{confirmedTotal.toLocaleString()} / {customerQty.toLocaleString()}</span>
                      </div>
                  )}
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md transition-all shadow-sm"
                  >
                    <Plus size={12} /> Add Row
                  </button>
              </div>
          </div>

          {/* ── Item Rows ── */}
          <div className="space-y-3">
            {form.items.map((item, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-slate-200 p-2.5 space-y-2.5 relative group/row shadow-sm">
                
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Row #{idx + 1}</span>
                  {form.items.length > 1 && (
                    <button 
                      onClick={() => removeRow(idx)}
                      className="p-1 text-rose-400 hover:bg-rose-50 rounded-md transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                  {/* Search Item */}
                  <div className="lg:col-span-4 text-[11px]">
                    <SearchableSelect
                      label="Search Item"
                      value={item.item_dcode}
                      onChange={(id, raw) => handleItemChange(idx, id, raw)}
                      fetchService={masterService.getItems}
                      getByIdService={masterService.getItemById}
                      dataKey="itemdcode"
                      labelKey="item_code"
                      subLabelKey="itemdesc"
                    />
                  </div>

                  {/* FG Stock */}
                  <div className="lg:col-span-2 space-y-0.5">
                    <label className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest block ml-1">FG Stock</label>
                    <div className="bg-emerald-600 text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs">
                      {item.fg_qty.toLocaleString()}
                    </div>
                  </div>

                  {/* Dispatch Qty */}
                  <div className="lg:col-span-2 space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Dispatch Qty</label>
                    <input
                      type="number"
                      value={item.dispatch_qty}
                      onChange={(e) => handleDispatchQtyChange(idx, e.target.value)}
                      className={`${OK_INPUT} text-center font-bold text-slate-700 h-[38px] text-[11px] rounded-lg border-slate-200`}
                      placeholder="0"
                    />
                  </div>

                  {/* Boxes (FIFO) */}
                  <div className="lg:col-span-2 space-y-0.5">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Boxes</label>
                    <div className="flex items-center justify-between gap-1 h-[38px] px-1.5 border border-slate-200 rounded-lg bg-white shadow-sm">
                      <button
                        onClick={() => handleBoxChange(idx, 'remove')}
                        disabled={!item.selected_boxes.length}
                        className="w-7 h-7 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-md transition-all disabled:opacity-30 font-black text-lg border border-rose-50"
                      >-</button>
                      <div className="flex flex-col items-center justify-center min-w-[40px]">
                        <span className="text-[11px] font-black text-slate-700 leading-none">
                          {item.selected_boxes.length > 0 ? item.selected_boxes.length : (item.original_breakdowns?.reduce((acc, bd) => acc + (bd.box || 0) + (bd.loose_box || 0), 0) || 0)}
                        </span>
                        <div className="h-[1px] w-3 bg-slate-200 my-0.5" />
                        <span className="text-[8px] font-bold text-slate-400 leading-none">{item.available_boxes.length}</span>
                      </div>
                      <button
                        onClick={() => handleBoxChange(idx, 'add')}
                        disabled={item.selected_boxes.length >= item.available_boxes.length}
                        className="w-7 h-7 flex items-center justify-center text-indigo-500 hover:bg-indigo-50 rounded-md transition-all disabled:opacity-30 font-black text-lg border border-indigo-50"
                      >+</button>
                    </div>
                  </div>

                  {/* Dispatch Std QTY */}
                  <div className="lg:col-span-2 space-y-0.5">
                    <label className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest block ml-1">Std QTY</label>
                    <div className="bg-indigo-600 text-white text-center font-black h-[38px] flex items-center justify-center rounded-lg shadow-sm text-xs">
                      {(item.selected_boxes.length > 0 ? sumQty(item.selected_boxes) : item.total_qty || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Table Breakdown */}
                {item.item_dcode && (item.selected_boxes.length > 0 || (isEdit && item.original_breakdowns?.length > 0)) && (
                  <div className="mt-1.5 border border-slate-100 rounded-md overflow-hidden">
                    <table className="w-full text-[9px]">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-2 py-1 text-left font-black text-slate-400 uppercase">Packing #</th>
                          <th className="px-2 py-1 text-center font-black text-slate-400 uppercase">Open Boxes</th>
                          <th className="px-2 py-1 text-center font-black text-slate-400 uppercase">Loose Boxes</th>
                          <th className="px-2 py-1 text-right font-black text-slate-400 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {item.selected_boxes.length > 0 ? (
                          (() => {
                            const groups = [];
                            const groupMap = new Map();
                            item.selected_boxes.forEach(box => {
                              const pNo = box.packing_number || "N/A";
                              if (!groupMap.has(pNo)) {
                                const newGroup = { packingNo: pNo, boxes: [] };
                                groupMap.set(pNo, newGroup);
                                groups.push(newGroup);
                              }
                              groupMap.get(pNo).boxes.push(box);
                            });
                            return groups.map(({ packingNo, boxes }) => {
                              const openBoxes = boxes.filter(b => !b.is_loose);
                              const looseBoxes = boxes.filter(b => b.is_loose);
                              const openQty = sumQty(openBoxes);
                              const looseQty = sumQty(looseBoxes);
                              return (
                                <tr key={packingNo} className="hover:bg-slate-50/30 transition-colors">
                                  <td className="px-2 py-1 font-bold text-slate-600">#{packingNo}</td>
                                  <td className="px-2 py-1 text-center">
                                    {openBoxes.length > 0 ? <span className="text-indigo-600 font-bold">{openBoxes.length} x {Math.round(openQty / openBoxes.length)}</span> : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-center">
                                    {looseBoxes.length > 0 ? <span className="text-amber-600 font-bold">{looseBoxes.length} x {Math.round(looseQty / looseBoxes.length)}</span> : "—"}
                                  </td>
                                  <td className="px-2 py-1 text-right font-black text-slate-700">{(openQty + looseQty).toLocaleString()}</td>
                                </tr>
                              );
                            });
                          })()
                        ) : (
                          item.original_breakdowns.map((bd, bidx) => (
                            <tr key={bidx} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-2 py-1 font-bold text-slate-600">#{bd.packing_number}</td>
                              <td className="px-2 py-1 text-center">{bd.box > 0 ? <span className="text-indigo-600 font-bold">{bd.box} x {Math.round(bd.box_qty / bd.box)}</span> : "—"}</td>
                              <td className="px-2 py-1 text-center">{bd.loose_box > 0 ? <span className="text-amber-600 font-bold">{bd.loose_box} x {Math.round(bd.loose_box_qty / bd.loose_box)}</span> : "—"}</td>
                              <td className="px-2 py-1 text-right font-black text-slate-700">{bd.total_qty.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Cartage & Remarks ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Cartage</label>
            <input
              type="number"
              value={form.cartage}
              onChange={(e) => handleInputChange("cartage", e.target.value)}
              placeholder="0"
              className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Remarks</label>
            <input
              value={form.remarks}
              onChange={(e) => handleInputChange("remarks", e.target.value)}
              placeholder="Notes..."
              className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`}
            />
          </div>
        </div>

        {/* ── Approval Toggle ── */}
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
            <p className="text-[10px] text-slate-500 italic">Forwarding note will be marked as 'Pending' until authorized.</p>
          </div>
        )}

      </div>
    </Drawer>
  );
}
