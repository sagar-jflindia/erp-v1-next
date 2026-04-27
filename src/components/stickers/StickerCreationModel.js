"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Printer, Loader2, CheckCircle2, ChevronDown, Download, User, Layers, ClipboardList, RefreshCw, Box } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/components/ui/Drawer";
import { boxService } from "@/services/box";

function printFromBackendHtml(html) {
  const win = window.open("", "_blank", "width=420,height=620");
  if (!win) return;
  win.document.write(html || "");
  win.document.close(); win.focus();
  setTimeout(() => { win.print(); win.close(); }, 600);
}

function getDeviceType() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  return isMobile ? "mobile" : "desktop";
}

export default function StickerCreationModel({ open, onClose, data, onSuccess, companyInfo }) {
  const [fetching, setFetching] = useState(false);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stickers, setStickers] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [generated, setGenerated] = useState([]);
  const [dlTracking, setDlTracking] = useState({});
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const hasFetched = useRef(false);

  const packing = useMemo(() => selectedRow?.packing_details || {}, [selectedRow]);

  const previewRows = useMemo(() => {
    if (!packing.qty_per_box) return [];
    const { total_stickers, full_boxes_count, qty_per_box, loose_box_qty } = packing;
    const pNo = selectedRow?.doc_no || data?.doc_no || "0000";
    return Array.from({ length: total_stickers }, (_, i) => {
      const n = i + 1;
      const isLoose = n > full_boxes_count;
      const previewUid = `${pNo}_${total_stickers}_${n}`;
      return { box_no: n, box_no_uid: previewUid, package_no: pNo, total_boxes: total_stickers, qty: isLoose ? loose_box_qty : qty_per_box, type: isLoose ? "LOOSE" : "FULL" };
    });
  }, [packing, selectedRow, data]);

  const hydrateGeneratedFromSummary = useCallback((summaryRows, sourceRow) => {
    if (!summaryRows?.length || !sourceRow) {
      setGenerated([]);
      setDlTracking({});
      return;
    }

    const enriched = summaryRows.map((row, idx) => {
      const uid = String(row.box_no_uid || "");
      const parts = uid.split("_");
      
      const boxNoFromUid = parts.length >= 3 ? Number(parts[parts.length - 1]) : null;
      const boxNo = Number.isFinite(boxNoFromUid) ? boxNoFromUid : idx + 1;

      const totalBoxesFromUid = parts.length >= 3 ? Number(parts[parts.length - 2]) : summaryRows.length;

      const isLoose = row.is_loose !== undefined ? row.is_loose : (packing.loose_box_qty > 0 && boxNo > packing.full_boxes_count);

      return {
        ...row,
        box_no: boxNo,
        total_boxes: totalBoxesFromUid,
        type: isLoose ? "LOOSE" : "FULL",
        itemdcode: sourceRow.itemdcode,
        acc_code: sourceRow.acc_code,
        acc_name: row.override_cust || sourceRow.acc_name,
        description: sourceRow.description || "",
        job_card_no: sourceRow.job_card_no,
        doc_dt: sourceRow.doc_dt,
        package_no: sourceRow.doc_no,
        fg_location: sourceRow.fg_location || "",
      };
    });

    const tracked = {};
    enriched.forEach((row) => {
      tracked[row.box_uid] = Number(row.download_count || 0) > 0;
    });

    setGenerated(enriched);
    setDlTracking(tracked);
  }, [packing]);

  const fetchGeneratedSummary = useCallback(async (row) => {
    if (!row?.doc_no) return;
    setLoadingGenerated(true);
    try {
      const res = await boxService.getDownloadSummary({ packing_number: String(row.doc_no) });
      hydrateGeneratedFromSummary(res.data || [], row);
    } catch {
      setGenerated([]);
      setDlTracking({});
    } finally {
      setLoadingGenerated(false);
    }
  }, [hydrateGeneratedFromSummary]);

  const fetchStickerHistory = useCallback(async () => {
    if (!data?.itemdcode) return;
    setFetching(true);
    try {
      const r = await boxService.getStickers({ itemdcode: data.itemdcode, doc_no: data.doc_no });
      const raw = r.data || [];
      const list = raw.filter((row, idx, arr) => {
        const key = `${row.doc_no}_${row.acc_code || ""}`;
        return idx === arr.findIndex((x) => `${x.doc_no}_${x.acc_code || ""}` === key);
      });
      setStickers(list);
      if (list.length > 0) setSelectedRow(list[0]);
    } catch { toast.error("Error loading history"); }
    finally { setFetching(false); }
  }, [data?.itemdcode]);

  useEffect(() => {
    if (open && !hasFetched.current) { fetchStickerHistory(); hasFetched.current = true; }
    if (!open) { hasFetched.current = false; setStickers([]); setSelectedRow(null); setGenerated([]); setDlTracking({}); }
  }, [open, fetchStickerHistory]);

  useEffect(() => {
    if (open && selectedRow?.doc_no) {
      fetchGeneratedSummary(selectedRow);
    }
  }, [open, selectedRow, fetchGeneratedSummary]);

  const handleGenerate = async () => {
    if (!packing.total_stickers) return toast.error("Invalid Configuration");
    setSubmitting(true);
    try {
      const res = await boxService.generateStickers({
        doc_no: selectedRow.doc_no, itemdcode: selectedRow.itemdcode,
        acc_name: selectedRow.acc_name, acc_code: selectedRow.acc_code, packing_config: packing
      });
      const enriched = (res.data || []).map(row => ({
        ...row, itemdcode: selectedRow.itemdcode, acc_code: selectedRow.acc_code,
        acc_name: selectedRow.acc_name, description: selectedRow.description || "",
        job_card_no: selectedRow.job_card_no, doc_dt: selectedRow.doc_dt, fg_location: selectedRow.fg_location || ""
      }));
      setGenerated(enriched);
      setDlTracking({});
      await fetchGeneratedSummary(selectedRow);
      toast.success("Stickers Generated!");
    } catch (err) { 
      toast.error(err.message || "Generation failed");
    }
    finally { setSubmitting(false); }
  };

  const handlePrintOne = async (sticker) => {
    try {
      const res = await boxService.renderSingleSticker({
        box_uid: sticker.box_uid,
        device_type: getDeviceType(),
        company_info: companyInfo || {},
        sticker_meta: {
          itemdcode: selectedRow.itemdcode,
          description: selectedRow.description || "",
          job_card_no: selectedRow.job_card_no || "",
          fg_location: selectedRow.fg_location || "",
          box_no: sticker.box_no,
          total_boxes: sticker.total_boxes,
        },
      });
      printFromBackendHtml(res.html);
      setDlTracking(prev => ({ ...prev, [sticker.box_uid]: true }));
    } catch {
      toast.error("Sticker download failed");
    }
  };

  const handlePrintAll = async () => {
    try {
      const res = await boxService.renderBulkStickers({
        packing_number: String(selectedRow.doc_no),
        box_uids: generated.map(s => s.box_uid),
        device_type: getDeviceType(),
        company_info: companyInfo || {},
        sticker_meta: {
          itemdcode: selectedRow.itemdcode,
          description: selectedRow.description || "",
          job_card_no: selectedRow.job_card_no || "",
          fg_location: selectedRow.fg_location || "",
        },
      });
      printFromBackendHtml(res.html);
      const all = {}; generated.forEach(s => { all[s.box_uid] = true; }); setDlTracking(all);
    } catch {
      toast.error("Bulk sticker download failed");
    }
  };

  return (
    <Drawer isOpen={open} onClose={onClose} title="Production Sticker Control" maxWidth="max-w-7xl" >
      <div className="h-[85vh] flex flex-col bg-slate-50 overflow-y-auto lg:overflow-hidden antialiased">
        {fetching ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>
        ) : !selectedRow ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">No Production Records Found</div>
        ) : (
          <>
            <div className="bg-white border-b px-3 md:px-4 py-3 flex flex-col md:flex-row items-center gap-3 shadow-sm z-10 w-full">
              
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:flex-1">
                {stickers.map(s => (
                  <button 
                    key={`${s.doc_no}_${s.acc_code || ""}`}
                    onClick={() => { setSelectedRow(s); }}
                    className={`px-4 py-2 rounded-lg text-[11px] md:text-xs font-bold transition-all border shrink-0 text-left min-w-[140px] md:min-w-[180px] ${selectedRow.doc_no === s.doc_no ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    <span className="block text-[10px] md:text-[11px] font-black tracking-wide">#{s.doc_no}</span>
                    <span className="block text-[10px] md:text-[11px] leading-tight mt-0.5 truncate" title={s.acc_name}>{s.acc_name || "—"}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
                <button 
                  onClick={fetchStickerHistory} 
                  className="p-2.5 text-slate-400 hover:text-blue-600 transition-colors border border-slate-200 rounded-lg shrink-0"
                >
                  <RefreshCw size={18} />
                </button>
                
                {generated.length > 0 ? (
                  <button 
                    onClick={handlePrintAll} 
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 md:px-5 py-2.5 rounded-lg text-[11px] md:text-xs font-black flex items-center justify-center gap-2 shadow-lg whitespace-nowrap"
                  >
                    <Download size={14} />
                    <span>DOWNLOAD ALL</span>
                    <span className="text-[10px]">({Object.keys(dlTracking).length}/{generated.length})</span>
                  </button>
                ) : (
                  <button 
                    onClick={handleGenerate} 
                    disabled={submitting || !packing.qty_per_box}
                    className="flex-1 md:flex-none bg-slate-900 hover:bg-black text-white px-4 md:px-6 py-2.5 rounded-lg text-[11px] md:text-xs font-black flex items-center justify-center gap-2 disabled:bg-slate-300 shadow-lg whitespace-nowrap"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                    <span>GENERATE ({packing.total_stickers || 0})</span>
                  </button>
                )}
              </div>
            </div>

            {/* --- MAIN CONTENT LAYOUT --- */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-visible lg:overflow-hidden">
              
              <div className="w-full lg:w-80 shrink-0 bg-white lg:border-r border-b lg:border-b-0 overflow-visible lg:overflow-y-auto no-scrollbar">
                <button
                  onClick={() => setShowLeftPanel((v) => !v)}
                  className="w-full lg:hidden px-4 py-2 border-b border-slate-100 flex items-center justify-between text-[11px] font-black uppercase tracking-wide text-slate-600"
                >
                  Production Details
                  <ChevronDown size={14} className={`transition-transform ${showLeftPanel ? "rotate-180" : ""}`} />
                </button>

                <div className={`${showLeftPanel ? "block" : "hidden"} lg:block p-3 space-y-3`}>
                {/* 1. Customer Card */}
                <div className="border border-slate-100 bg-slate-50/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-slate-400 mb-2 pb-2 border-b border-slate-200/50">
                    <User size={13} /> <span className="text-[9px] font-black uppercase tracking-widest">Customer Details</span>
                  </div>
                  <DetailItem label="A/C Name" value={selectedRow.acc_name} bold />
                  <DetailItem label="A/C Code" value={selectedRow.acc_code} />
                  <DetailItem label="Category" value={selectedRow.category || "OEM"} />
                </div>

                {/* 2. Production Card */}
                <div className="border border-slate-100 bg-slate-50/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-slate-400 mb-2 pb-2 border-b border-slate-200/50">
                    <ClipboardList size={13} /> <span className="text-[9px] font-black uppercase tracking-widest">Production Info</span>
                  </div>
                  <DetailItem label="Job Card" value={selectedRow.job_card_no} bold color="text-blue-600" />
                  <DetailItem label="Doc Date" value={selectedRow.doc_dt ? new Date(selectedRow.doc_dt).toLocaleDateString("en-GB") : "--"} />
                  <DetailItem label="Total Quantity" value={`${Number(selectedRow.total_qty).toLocaleString()} ${selectedRow.unit || 'PCS'}`} />
                  <DetailItem label="FG Location" value={selectedRow.fg_location || "N/A"} />
                </div>

                {/* 3. Packing Standard Card */}
                <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-500 mb-2 pb-2 border-b border-blue-100/50">
                    <Layers size={13} /> <span className="text-[9px] font-black uppercase tracking-widest">Packing Standard</span>
                  </div>
                  <DetailItem label="Standard ID" value={selectedRow.standard_id || "--"} />
                  <DetailItem label="Quantity / Box" value={`${packing.qty_per_box} ${selectedRow.unit || 'PCS'}`} bold />
                  
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-white border border-blue-100 p-2 rounded-lg text-center">
                      <p className="text-lg font-black text-blue-600 leading-none">{packing.full_boxes_count}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Full Boxes</p>
                    </div>
                    <div className="bg-white border border-orange-100 p-2 rounded-lg text-center">
                      <p className="text-lg font-black text-orange-600 leading-none">{packing.loose_box_qty > 0 ? 1 : 0}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Loose Box</p>
                    </div>
                  </div>
                </div>
                </div>
              </div>

              {/* RIGHT CONTENT: Sticker Grid or Table Preview */}
              <div className="flex-1 min-h-[320px] lg:min-h-0 flex flex-col overflow-hidden">
                <div className="px-4 md:px-6 py-3 bg-white border-b flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Box size={16} className="text-slate-400" />
                    <span className="text-xs font-black uppercase tracking-tight text-slate-600">Breakdown Preview</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">ITEM: {selectedRow.itemdcode}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 md:p-6">
                  {loadingGenerated ? (
                    <div className="h-full w-full flex items-center justify-center text-slate-500 gap-2">
                      <Loader2 className="animate-spin" size={16} />
                      <span className="text-xs font-bold uppercase">Loading generated stickers...</span>
                    </div>
                  ) : (
                    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                      <table className="w-full min-w-[770px] text-left">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">S.No.</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Box No</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Packing No</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Box Qty</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Type</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(generated.length === 0 && previewRows.length === 0) ? (
                            <tr>
                              <td colSpan="7" className="px-6 py-10 text-center">
                                <div className="flex flex-col items-center gap-2 text-slate-400">
                                  <Layers size={24} className="opacity-20" />
                                  <span className="text-xs font-bold uppercase tracking-widest">
                                    No Packing Standard Found / Data Not Available
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            (generated.length > 0 ? generated : previewRows).map((row, idx) => {
                              const isGenerated = generated.length > 0;
                              const rowKey = row.box_uid || `${row.box_no}_${idx}`;
                              const isPrinted = row.box_uid ? dlTracking[row.box_uid] : false;
                              return (
                                <tr key={rowKey} className="hover:bg-slate-50/50">
                                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{idx + 1}</td>
                                  <td className="px-6 py-4 text-sm font-black text-slate-600">
                                    <div className="flex flex-col leading-tight">
                                      <span className={`${isGenerated ? "text-blue-600" : "text-black-500"} font-black`}>{row.box_no_uid}</span>
                                      <span className="text-[9px] text-slate-400 uppercase font-bold">Box {row.box_no} / {row.total_boxes}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{row.package_no}</td>
                                  <td className="px-6 py-4 text-sm font-black text-slate-600">{Number(row.qty).toLocaleString()} PCS</td>
                                  <td className="px-6 py-4">
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-md border ${row.box_no <= packing.full_boxes_count ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                      {row.box_no <= packing.full_boxes_count ? "FULL" : "LOOSE"}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    {isGenerated ? (
                                      <span className={`text-[10px] font-bold uppercase ${isPrinted ? "text-emerald-600" : "text-blue-600"}`}>
                                        {isPrinted ? "Downloaded" : "Generated"}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-300 italic uppercase">Ready to generate</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {isGenerated ? (
                                      <button
                                        onClick={() => handlePrintOne(row)}
                                        className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-[10px] font-black uppercase transition-colors ${
                                          isPrinted
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                            : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                        }`}
                                      >
                                        {isPrinted ? <CheckCircle2 size={12} /> : <Printer size={12} />}
                                        {isPrinted ? "Re-Download" : "Download"}
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-slate-300 font-bold uppercase">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

// ─── REFINED COMPONENTS ───
function DetailItem({ label, value, bold, color = "text-slate-700" }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">{label}</p>
      <p className={`text-xs truncate ${bold ? 'font-black' : 'font-medium'} ${color}`}>{value || "—"}</p>
    </div>
  );
}
