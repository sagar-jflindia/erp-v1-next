"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, ScanLine, CameraOff, MapPin, Info, ShieldCheck, User, Package, Fingerprint } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/components/ui/Drawer";
import { locationService } from "@/services/location";
import SearchableSelect from "../common/SearchableSelect";
import { Html5Qrcode } from "html5-qrcode"; // Library Import

export default function LocationFinderDrawer({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  const scannerRef = useRef(null);

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent;
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(ua));
    };
    checkDevice();
  }, []);

  const fetchLocation = async (idOrCode) => {
    alert(idOrCode);  
    if (!idOrCode) return;
    setLoading(true);
    setLocationData(null);
    try {
      const res = await locationService.getById(idOrCode);
      if (res.data) {
        setLocationData(res.data);
        setSelectedLocationId(res.data.location_id);
      } else {
        toast.error("Location not found in Master");
      }
    } catch (err) {
      toast.error(err?.message || "Error fetching location details");
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = useCallback(async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Stop error", err);
      }
    }
    setCameraOn(false);
  }, []);

  const startCamera = async () => {
    setCameraOn(true);
    setLocationData(null);

    // Timeout is needed to ensure the 'reader' div is rendered
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0 
        };

        await html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            // Success: Sound alert (optional) and fetch data
            stopCamera();
            fetchLocation(decodedText);
          },
          (errorMessage) => { /* Scanning... */ }
        );
      } catch (err) {
        console.error("Start Error:", err);
        toast.error("Camera access denied or not available (Ensure HTTPS)");
        setCameraOn(false);
      }
    }, 300);
  };

  const handleClose = () => {
    stopCamera();
    setLocationData(null);
    setSelectedLocationId(null);
    onClose();
  };

  return (
    <Drawer
      isOpen={open}
      onClose={handleClose}
      title="Location Finder"
      description="Identify warehouse racks by ID or QR Scan"
      maxWidth="max-w-md"
    >
      <div className="space-y-5 pb-6">
        
        {/* Search & Scan Header */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SearchableSelect
              label="Search by ID, Rack or Row"
              placeholder="Enter ID (e.g. 10) or Rack..."
              value={selectedLocationId}
              onChange={(id) => {
                if (id) fetchLocation(id);
                else { setLocationData(null); setSelectedLocationId(null); }
              }}
              fetchService={locationService.getAll}
              getByIdService={locationService.getById}
              dataKey="location_id"
              labelKey="rack_no"
              subLabelKey="row_no"
            />
          </div>
          
          {/* Laptop par Scan button disable/hide ho jayega */}
          {isMobile && (
            <button
              onClick={() => (cameraOn ? stopCamera() : startCamera())}
              className={`w-12 h-11 flex items-center justify-center rounded-xl border transition-all shadow-sm ${
                cameraOn ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-indigo-600 border-indigo-700 text-white"
              }`}
            >
              {cameraOn ? <CameraOff size={20} /> : <ScanLine size={20} />}
            </button>
          )}
        </div>

        {/* Camera Viewport (Using html5-qrcode) */}
        {cameraOn && (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square border-4 border-slate-100 shadow-xl animate-in zoom-in-95 duration-300">
            <div id="reader" className="w-full h-full"></div>
            {/* Overlay UI */}
            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40"></div>
          </div>
        )}

        {/* Content Section (Loading / Location Data) */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="animate-spin text-indigo-500 mx-auto mb-3" size={32} />
            <p className="text-xs font-bold text-slate-400 uppercase">Searching Master...</p>
          </div>
        ) : locationData ? (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            
            {/* Status & ID Badge */}
            <div className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
              locationData.approved ? "bg-emerald-50/50 border-emerald-100" : "bg-amber-50/50 border-amber-100"
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${locationData.approved ? "bg-emerald-500" : "bg-amber-500"}`}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Status</p>
                  <p className={`text-xs font-bold ${locationData.approved ? "text-emerald-700" : "text-amber-700"}`}>
                    {locationData.approved ? "AUTHORIZED" : "PENDING"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-100">
                <Fingerprint size={14} className="text-slate-400" />
                <span className="text-xs font-mono font-bold text-slate-600">ID: {locationData.location_id}</span>
              </div>
            </div>

            {/* Core Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Rack / Row</p>
                <p className="text-lg font-black text-slate-800 uppercase leading-none">
                  {locationData.rack_no} <span className="text-slate-300 mx-1">/</span> {locationData.row_no}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total Capacity</p>
                <p className="text-lg font-black text-indigo-600 leading-none">{locationData.total_capacity}</p>
              </div>
            </div>

            {/* Bindings */}
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <User size={16} className="text-indigo-400" />
                <div className="flex-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Customer Binding</p>
                  <p className="text-xs font-bold text-slate-700">{locationData.acc_name || "General / Open Storage"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                <Package size={16} className="text-indigo-400" />
                <div className="flex-1">
                  <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Item Allocation</p>
                  <p className="text-xs font-bold text-slate-700">
                    {locationData.item_code ? `${locationData.item_code} - ${locationData.item_desc}` : "Fixed Item Not Assigned"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          !cameraOn && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <MapPin size={24} className="text-slate-200" />
              </div>
              <p className="text-sm font-medium text-slate-400">
                {isMobile ? "Search by ID or Scan QR Code" : "Search by ID or Rack Number"}
              </p>
            </div>
          )
        )}
      </div>
    </Drawer>
  );
}