"use client";

import { useState, useEffect, useRef } from "react";
import { Check, AlertCircle, Loader2, ShieldCheck, QrCode, MapPin, Package, Plus, X, Trash2, MessageSquare, CheckCircle2, XCircle, Search, ScanLine, Camera, Locate } from "lucide-react";
import { toast } from "react-toastify";
import { Html5Qrcode } from "html5-qrcode";
import { useSelector } from "react-redux";

import { inventoryInwardService } from "@/services/inventoryInward";
import { locationService }        from "@/services/location";
import { boxService }             from "@/services/box";
import { extractLocationId, detectQrType, extractBoxCode } from "@/helpers/qrScan";
import Drawer                     from "@/components/ui/Drawer";
import SearchableSelect           from "../common/SearchableSelect";
import { ERR_INPUT, OK_INPUT }    from "../common/Constants";
import { selectHasPermission } from "@/features/authSlice";

const MSG = {
  LOCATION_ALREADY_ADDED:          "This location has already been added.",
  LOCATION_NOT_FOUND:              "No location found. Please check the ID or scan again.",
  LOCATION_FETCH_FAILED:           "Failed to fetch location details. Please try again.",
  LOCATION_SEARCHING:              "Searching location...",
  LOCATION_AT_LEAST_ONE_BOX:       "Please add at least one box to this location.",
  LOCATION_EMPTY_STATE_TITLE:      "No locations added yet.",
  LOCATION_EMPTY_STATE_SUBTITLE:   "Search or scan a location to start adding boxes.",
  BOX_DUPLICATE_SAME:              "This box is already added to this location.",
  BOX_DUPLICATE_OTHER:             (locName) => `This box is already assigned to "${locName}".`,
  BOX_PLACEHOLDER:                 "Scan Box UID or type Box UID, then press Enter...",
  INWARD_CREATED:                  "Inward entry recorded successfully.",
  INWARD_UPDATED:                  "Inward entry updated successfully.",
  INWARD_FAILED:                   "Operation failed. Please try again.",
  REMARKS_PLACEHOLDER:             "Add any notes or remarks for this inward entry...",
  LOCATION_SEARCH_PLACEHOLDER:     "Search by rack or row...",
};

const INITIAL_FORM = {
  remarks:  "",
  approved: false,
};

export default function InwardModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState(INITIAL_FORM);
  const [errors, setErrors]   = useState({});
  
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";

  const [locations, setLocations]         = useState([]);
  const [locHasError, setLocHasError]     = useState([]);

  const [scanStatus, setScanStatus]       = useState(null);
  const [scanning, setScanning]           = useState(false);
  const [matchedLoc, setMatchedLoc]       = useState(null);
  const [selectedLocId, setSelectedLocId] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [activeLocIdxForScan, setActiveLocIdxForScan] = useState(null);
  const [validatingBox, setValidatingBox] = useState(false);
  
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ key: "", at: 0, mode: "" });
  const inFlightScanRef = useRef(new Set());

  // Permissions
  const canApprove = useSelector(selectHasPermission("inventory_inwards", "authorize"));
  const canEdit = useSelector(selectHasPermission("inventory_inwards", "edit"));
  const canAdd = useSelector(selectHasPermission("inventory_inwards", "add"));

  // Determine if we are in "Approve Mode" (Edit mode + user has approve permission + record is not yet approved)
  const isAddMode = !isEdit && canAdd;
  const isApproveMode = isEdit && canApprove && mode === "approve";
  const isEditMode = isEdit && canEdit;

  const showApproval = canApprove && (mode === "add" || mode === "approve");

  // Flat list of ALL boxes across ALL locations — global duplicate check
  const allBoxesFlat = locations.flatMap((loc, li) =>
    loc.boxes.map((box) => ({ locIndex: li, locName: loc.name, box }))
  );

  // ── Reset ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchFullData = async () => {
      if (open && editData?.in_uid) {
        setLoading(true);
        try {
          const res = await inventoryInwardService.getById(editData.in_uid);
          if (res?.success && res.data) {
            const d = res.data;
            setForm({
              remarks: d.remarks || "",
              approved: isApprove ? (d.approved ?? false) : false
            });
            setLocations(d.locations || []);
            setLocHasError((d.locations || []).map(() => false));
          }
        } catch (err) {
          toast.error("Failed to fetch inward details");
        } finally {
          setLoading(false);
        }
      } else if (open) {
        setForm(INITIAL_FORM);
        setLocations([]);
        setLocHasError([]);
      }
      setErrors({});
      clearLocSearch();
    };

    fetchFullData();

    return () => {
      if (scannerRef.current) {
        try {
          // Only call clear if it's an instance of Html5Qrcode
          if (typeof scannerRef.current.clear === 'function') {
            scannerRef.current.clear().catch(() => {});
          }
        } catch (e) {
          // silent error on cleanup
        }
      }
    }
  }, [open, editData, isApprove]);

  const clearLocSearch = () => {
    setScanStatus(null);
    setMatchedLoc(null);
    setSelectedLocId(null);
  };

  const handleInputChange = (k, value) => {
    setForm((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const resolveBoxNoUid = async (rawValue) => {
    const candidate = extractBoxCode(rawValue);
    if (!candidate) return null;

    // Primary path: QR carries box_uid/id.
    try {
      const byUid = await boxService.getById(candidate);
      if (byUid?.data?.box_no_uid) {
        return {
          boxUid: String(byUid.data.box_uid),
          boxNoUid: String(byUid.data.box_no_uid),
        };
      }
    } catch {
      // Ignore and try fallback paths.
    }

    // Fallback: candidate might already be box_no_uid.
    try {
      const byNoUid = await boxService.getAll({
        page: 1,
        limit: 1,
        filters: { box_no_uid: candidate },
      });
      const box = Array.isArray(byNoUid?.data) ? byNoUid.data[0] : null;
      if (box?.box_no_uid) {
        return {
          boxUid: String(box.box_uid),
          boxNoUid: String(box.box_no_uid),
        };
      }
    } catch {
      // Return null below.
    }

    return null;
  };

  const lookupLocation = async (id) => {
    if (!id) return;
    setScanStatus("checking");
    try {
      const res = await locationService.getById(id);
      if (res?.data?.location_id) {
        setMatchedLoc(res.data);
        setScanStatus("matched");
      } else {
        setMatchedLoc(null);
        setScanStatus("not_found");
      }
    } catch {
      setMatchedLoc(null);
      setScanStatus("not_found");
    }
  };

  const handleSelectChange = (id) => {
    const normalizedId = extractLocationId(id);
    setSelectedLocId(normalizedId);
    if (!normalizedId) {
      clearLocSearch();
      if (id) toast.error("Invalid Location QR. Please scan a Location label.");
      return;
    }
    lookupLocation(normalizedId);
  };

  const handleAddLocation = () => {
    if (!matchedLoc) return;
    if (locations.some((l) => l.location_id === matchedLoc.location_id)) {
      toast.warning(MSG.LOCATION_ALREADY_ADDED);
      return;
    }
    const locName = `${matchedLoc.rack_no}-${matchedLoc.row_no}`;
    setLocations((prev) => [
      ...prev,
      { location_id: matchedLoc.location_id, name: locName, boxes: [] },
    ]);
    setLocHasError((prev) => [...prev, false]);
    clearLocSearch();
  };

  const handleRemoveLoc = (li) => {
    setLocations((prev) => prev.filter((_, i) => i !== li));
    setLocHasError((prev) => prev.filter((_, i) => i !== li));
  };

  const tryAddBox = async (li, val, source = "manual") => {
    const detectedType = detectQrType(val);
    if (detectedType === "location") {
      toast.error("This is a Location QR. Please scan a Box QR in Step 2.");
      return;
    }

    const scanLockKey = `${li}:${String(val ?? "").trim().toLowerCase()}`;
    if (source === "scanner" && inFlightScanRef.current.has(scanLockKey)) {
      return;
    }
    if (source === "scanner") {
      inFlightScanRef.current.add(scanLockKey);
    }

    try {
    const resolvedBox = await resolveBoxNoUid(val);
    const v = resolvedBox?.boxNoUid || "";
    if (!v) {
      toast.error("Invalid box QR/UID. Please scan a valid sticker.");
      return;
    }

    // Duplicate within same location
    if (locations[li].boxes.some((b) => b.toLowerCase() === v.toLowerCase())) {
      toast.error(MSG.BOX_DUPLICATE_SAME);
      return;
    }

    // Duplicate in any OTHER location
    const existsInOther = allBoxesFlat.find(
      ({ locIndex: otherLi, box }) =>
        otherLi !== li && box.toLowerCase() === v.toLowerCase()
    );
    if (existsInOther) {
      toast.error(MSG.BOX_DUPLICATE_OTHER(existsInOther.locName));
      return;
    }

    setLocations((prev) => {
      if (!prev[li]) return prev;
      if (prev[li].boxes.some((b) => b.toLowerCase() === v.toLowerCase())) {
        return prev;
      }
      return prev.map((loc, i) =>
        i === li ? { ...loc, boxes: [...loc.boxes, v] } : loc
      );
    });
    setLocHasError((prev) => prev.map((e, i) => (i === li ? false : e)));
    toast.success(`Added: ${v}`);
    } finally {
      if (source === "scanner") {
        inFlightScanRef.current.delete(scanLockKey);
      }
    }
  };

  const handleRemoveBox = (li, bi) => {
    setLocations((prev) =>
      prev.map((loc, i) =>
        i === li ? { ...loc, boxes: loc.boxes.filter((_, j) => j !== bi) } : loc
      )
    );
  };

  const validate = () => {
    if (locations.length === 0) {
      toast.error("Please add at least one location");
      return false;
    }
    const errs = locations.map((loc) => loc.boxes.length === 0);
    setLocHasError(errs);
    const hasBoxErrors = errs.some((v) => v);
    if (hasBoxErrors) toast.error("Each location must have at least one box");
    return !hasBoxErrors;
  };

  const handleSave = async (statusOverride = null) => {
    if (!validate()) return;

    let finalApproved = form.approved;
    if (statusOverride !== null) {
      finalApproved = statusOverride;
    } else if (isEdit && editData?.approved) {
      finalApproved = false;
    }

    const payload = {
      ...form,
      approved: finalApproved,
      locations: locations.map((loc) => ({
        location_id: loc.location_id,
        boxes:       loc.boxes, 
      })),
    };

    setLoading(true);
    try {
      if (isEdit || isApprove) {
        await inventoryInwardService.update(editData.in_uid, payload);
        toast.success(MSG.INWARD_UPDATED);
      } else {
        await inventoryInwardService.create(payload);
        toast.success(MSG.INWARD_CREATED);
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || MSG.INWARD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  // ── Camera Scanner Logic ───────────────────────────────────────────────────
  const startCameraScanner = (locIdx = null) => {
    setActiveLocIdxForScan(locIdx);
    setIsScannerOpen(true);
    
    setTimeout(() => {
      // Use Html5Qrcode directly for more control over UI
      const html5QrCode = new Html5Qrcode("reader");
      const config = { 
        fps: 15, 
        qrbox: { width: 250, height: 250 },
      };

      html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => {
          if (locIdx === null) {
            const qrType = detectQrType(decodedText);
            if (qrType === "box") {
              toast.error("This is a Box QR. Please scan a Location QR in Step 1.");
              return;
            }
            const locationId = extractLocationId(decodedText);
            const now = Date.now();
            const scanKey = `loc:${locationId || ""}`;
            if (
              scanKey === lastScanRef.current.key &&
              lastScanRef.current.mode === "location" &&
              now - lastScanRef.current.at < 2000
            ) {
              return;
            }
            lastScanRef.current = { key: scanKey, at: now, mode: "location" };

            if (!locationId) {
              toast.error("Invalid Location QR. Please scan a Location label.");
              return;
            }
            if (locations.some((l) => String(l.location_id) === String(locationId))) {
              return;
            }
            handleSelectChange(locationId);
            html5QrCode.stop().then(() => setIsScannerOpen(false)).catch(console.error);
          } else {
            const rawBoxCode = extractBoxCode(decodedText);
            const now = Date.now();
            const scanKey = `box:${rawBoxCode || ""}`;
            if (
              scanKey === lastScanRef.current.key &&
              lastScanRef.current.mode === "box" &&
              now - lastScanRef.current.at < 2000
            ) {
              return;
            }
            lastScanRef.current = { key: scanKey, at: now, mode: "box" };

            if (!rawBoxCode) return;
            if (allBoxesFlat.some(({ box }) => String(box).toLowerCase() === String(rawBoxCode).toLowerCase())) {
              return;
            }
            const alreadyInCurrentLocation = locations[locIdx]?.boxes?.some(
              (box) => String(box).toLowerCase() === String(rawBoxCode).toLowerCase()
            );
            if (alreadyInCurrentLocation) {
              return;
            }

            setValidatingBox(true);
            tryAddBox(locIdx, decodedText, "scanner")
              .then(() => {})
              .finally(() => setValidatingBox(false));
          }
        },
        () => {} // silent on failure
      ).catch(err => {
        // Fallback to any available camera if environment-facing is not found
        Html5Qrcode.getCameras().then(cameras => {
          if (cameras && cameras.length > 0) {
            html5QrCode.start(
              cameras[0].id, // Use the first available camera ID
              config,
              (decodedText) => {
                if (locIdx === null) {
                  const qrType = detectQrType(decodedText);
                  if (qrType === "box") {
                    toast.error("This is a Box QR. Please scan a Location QR in Step 1.");
                    return;
                  }
                  const locationId = extractLocationId(decodedText);
                  const now = Date.now();
                  const scanKey = `loc:${locationId || ""}`;
                  if (
                    scanKey === lastScanRef.current.key &&
                    lastScanRef.current.mode === "location" &&
                    now - lastScanRef.current.at < 2000
                  ) {
                    return;
                  }
                  lastScanRef.current = { key: scanKey, at: now, mode: "location" };

                  if (!locationId) {
                    toast.error("Invalid Location QR. Please scan a Location label.");
                    return;
                  }
                  if (locations.some((l) => String(l.location_id) === String(locationId))) {
                    return;
                  }
                  handleSelectChange(locationId);
                  html5QrCode.stop().then(() => setIsScannerOpen(false)).catch(console.error);
                } else {
                  const rawBoxCode = extractBoxCode(decodedText);
                  const now = Date.now();
                  const scanKey = `box:${rawBoxCode || ""}`;
                  if (
                    scanKey === lastScanRef.current.key &&
                    lastScanRef.current.mode === "box" &&
                    now - lastScanRef.current.at < 2000
                  ) {
                    return;
                  }
                  lastScanRef.current = { key: scanKey, at: now, mode: "box" };

                  if (!rawBoxCode) return;
                  if (allBoxesFlat.some(({ box }) => String(box).toLowerCase() === String(rawBoxCode).toLowerCase())) {
                    return;
                  }
                  const alreadyInCurrentLocation = locations[locIdx]?.boxes?.some(
                    (box) => String(box).toLowerCase() === String(rawBoxCode).toLowerCase()
                  );
                  if (alreadyInCurrentLocation) {
                    return;
                  }

                  setValidatingBox(true);
                  tryAddBox(locIdx, decodedText, "scanner")
                    .then(() => {})
                    .finally(() => setValidatingBox(false));
                }
              },
              () => {}
            ).catch(err2 => {
              toast.error("Could not access camera. Please check permissions.");
              setIsScannerOpen(false);
            });
          } else {
            toast.error("No cameras found on this device.");
            setIsScannerOpen(false);
          }
        }).catch(err3 => {
          toast.error("Could not access camera list.");
          setIsScannerOpen(false);
        });
      });

      scannerRef.current = html5QrCode;
    }, 100);
  };

  const closeScanner = () => {
    if (scannerRef.current) {
      // Check if it's an instance of Html5Qrcode and is scanning
      if (scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          setIsScannerOpen(false);
          setActiveLocIdxForScan(null);
        }).catch(err => {
          console.error(err);
          setIsScannerOpen(false);
        });
      } else {
        setIsScannerOpen(false);
      }
    } else {
      setIsScannerOpen(false);
    }
  };

  return (
    <Drawer
      isOpen={open} onClose={onClose}
      title={isApprove ? "Authorization Check" : isEdit ? "Edit Inward Entry" : "New Inward Entry"}
      description={isApprove ? "Review and authorize inward entry" : "Scan locations and boxes to record inward inventory"}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-all">Cancel</button>
          
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
            <button onClick={() => handleSave()} disabled={loading} className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-indigo-400">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Processing...</> : <><Check size={18} /> {isEdit ? "Update & Reset Status" : "Save Inward"}</>}
            </button>
          )}
        </div>
      }
      maxWidth="max-w-4xl"
    >
      <div className="space-y-4 pb-4">
        
        {/* ── Camera Scanner Overlay ── */}
        {isScannerOpen && (
          <div className="fixed inset-0 z-[100] bg-slate-900/85 backdrop-blur-[1px] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md relative">
              <div className="absolute top-3 right-3 z-[110]">
                <button onClick={closeScanner} className="p-2 bg-black/35 hover:bg-black/50 rounded-full text-white transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square border-4 border-slate-100 shadow-xl animate-in zoom-in-95 duration-300">
                <div id="reader" className="w-full h-full [&_video]:h-full [&_video]:object-cover"></div>
                <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40"></div>
              </div>

              <div className="text-center mt-3 z-[110]">
                <p className="text-white/85 text-[10px] font-black uppercase tracking-widest bg-black/30 inline-block px-4 py-2 rounded-full">
                  {activeLocIdxForScan === null ? "Scanning Location" : "Scanning Boxes"}
                </p>
              </div>
            </div>
          </div>
        )}

        {isEdit && !isApprove && form.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized inward entry will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {/* ── Location Selection ── */}
        <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-3">
          <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={14} /> Step 1: Select Location
          </label>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <button
              onClick={() => startCameraScanner(null)}
              className="h-[40px] w-full sm:w-auto sm:shrink-0 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
              title="Scan Location QR"
            >
              <QrCode size={16} />
              <span className="text-[10px] font-black uppercase">Scan</span>
            </button>
            <div className="w-full sm:flex-1 text-[11px] min-w-0">
              <SearchableSelect
                placeholder={MSG.LOCATION_SEARCH_PLACEHOLDER}
                value={selectedLocId}
                onChange={handleSelectChange}
                fetchService={locationService.getAll}
                getByIdService={locationService.getById}
                dataKey="location_id"
                labelKey="rack_no"
                subLabelKey="row_no"
                icon={Search}
              />
            </div>
            <button
              onClick={handleAddLocation}
              disabled={scanStatus !== "matched"}
              className="h-[40px] w-full sm:w-auto sm:shrink-0 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase rounded-lg transition-all shadow-md flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {scanStatus === "checking" && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/60 rounded-lg border border-indigo-100 animate-pulse">
              <Loader2 size={12} className="text-indigo-400 animate-spin" />
              <p className="text-[9px] font-bold text-indigo-500 uppercase">{MSG.LOCATION_SEARCHING}</p>
            </div>
          )}
          {scanStatus === "matched" && matchedLoc && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg animate-in zoom-in-95">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <div className="flex-1">
                <p className="text-[10px] font-black text-emerald-800 uppercase leading-none">Location Found: {matchedLoc.rack_no}-{matchedLoc.row_no}</p>
                <p className="text-[8px] font-bold text-emerald-600/70 uppercase mt-0.5">Ready to add to list</p>
              </div>
            </div>
          )}
          {scanStatus === "not_found" && (
            <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg animate-in shake-1">
              <XCircle size={16} className="text-rose-500" />
              <p className="text-[10px] font-bold text-rose-600 uppercase leading-none">{MSG.LOCATION_NOT_FOUND}</p>
            </div>
          )}
        </div>

        {/* ── Active Locations & Box Scanning ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Package size={14} className="text-indigo-500" /> Step 2: Scan Boxes into Locations
            </label>
            {locations.length > 0 && (
              <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {locations.length} ACTIVE LOCATIONS
              </span>
            )}
          </div>

          {locations.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {locations.map((loc, li) => (
                <div key={li} className={`bg-white rounded-xl border transition-all overflow-hidden shadow-sm ${locHasError[li] ? "border-rose-200 shadow-rose-50" : "border-slate-200"}`}>
                  {/* Location Header */}
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                        <MapPin size={14} />
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Current Location</p>
                        <p className="text-xs font-black text-slate-800 uppercase leading-none">{loc.name}</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveLoc(li)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="p-3 space-y-3">
                    {/* Box Input Area */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startCameraScanner(li)}
                        className="h-[38px] shrink-0 px-3 bg-indigo-600 border border-indigo-700 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-sm flex items-center justify-center gap-2"
                        title="Scan Box QR"
                      >
                        <Camera size={16} />
                        <span className="text-[10px] font-black uppercase">Scan</span>
                      </button>
                      <div className="relative flex-1 min-w-0">
                        <ScanLine size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400" />
                        <input
                          placeholder={MSG.BOX_PLACEHOLDER}
                          className={`${OK_INPUT} pl-8 font-mono text-[10px] h-[38px] rounded-lg border-slate-200`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const inputValue = e.target.value;
                              setValidatingBox(true);
                              tryAddBox(li, inputValue)
                                .finally(() => setValidatingBox(false));
                              e.target.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                    {validatingBox && (
                      <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-lg">
                        <Loader2 size={12} className="animate-spin text-indigo-500" />
                        <p className="text-[9px] font-bold text-indigo-600 uppercase">Validating box...</p>
                      </div>
                    )}

                    {/* Scanned Boxes List */}
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        Scanned Boxes ({loc.boxes.length})
                      </p>
                      {loc.boxes.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                          {loc.boxes.map((box, bi) => (
                            <div key={bi} className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-white border border-slate-200 rounded-md shadow-sm animate-in zoom-in-95">
                              <span className="text-[10px] font-mono font-black text-slate-700">{box}</span>
                              <button onClick={() => handleRemoveBox(li, bi)} className="p-0.5 text-slate-300 hover:text-rose-500 transition-colors">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 flex flex-col items-center justify-center bg-slate-50/30 rounded-lg border border-dashed border-slate-200">
                          <Package size={16} className="text-slate-200 mb-1" />
                          <p className="text-[9px] font-bold text-slate-300 uppercase italic">No boxes scanned yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 bg-white border border-dashed border-slate-200 rounded-2xl text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <Locate size={24} className="text-slate-200" />
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{MSG.LOCATION_EMPTY_STATE_TITLE}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{MSG.LOCATION_EMPTY_STATE_SUBTITLE}</p>
            </div>
          )}
        </div>

        {/* ── Remarks ── */}
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare size={14} className="text-indigo-500" /> Remarks / Note
          </label>
          <textarea
            value={form.remarks}
            onChange={(e) => handleInputChange("remarks", e.target.value)}
            placeholder={MSG.REMARKS_PLACEHOLDER}
            className={`${OK_INPUT} min-h-[60px] py-2 text-[11px] resize-none rounded-lg border-slate-200`}
          />
        </div>

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
              <input type="checkbox" checked={form.approved} onChange={(e) => handleInputChange("approved", e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">Entry will be marked as 'Pending' until authorized.</p>
          </div>
        )}

        {isEditMode && !isApproveMode && form.approved && !canApprove && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] font-bold text-amber-700 uppercase leading-normal">
              This inward entry is already approved. Editing it will reset its status to "Pending" unless you have approval permissions.
            </p>
          </div>
        )}

      </div>
    </Drawer>
  );
}
