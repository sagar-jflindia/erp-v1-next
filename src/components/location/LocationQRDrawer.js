"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";
import { Printer, Download, Package, User, Hash, MapPin } from "lucide-react";
import Drawer from "@/components/ui/Drawer";

export default function LocationQRDrawer({ isOpen, onClose, data }) {
  const qrRef = useRef();

  if (!data) return null;

  const qrValue = String(data.location_id);
  
  // const qrValue = [
  //   `Location ID: ${data.location_id}`,
  //   `Rack: ${data.rack_no}`,
  //   `Row: ${data.row_no}`,
  //   `Capacity: ${data.total_capacity} Units`,
  //   `Item Code: ${data.item_code || "Open Allocation"}`,
  //   `Item: ${data.item_desc || ""}`,
  //   `Customer: ${data.acc_name || "General Inventory"}`,
  // ].join("\n");

  const handleExport = (type = "download") => {
    const svg = qrRef.current.querySelector("svg");
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Sirf QR + LOC-ID - clean layout
      const scale = 4;
      const qrSize = 300;
      const padding = 40;
      const textHeight = 60;
      const baseWidth = qrSize + padding * 2;
      const baseHeight = qrSize + padding * 2 + textHeight;

      canvas.width = baseWidth * scale;
      canvas.height = baseHeight * scale;
      ctx.scale(scale, scale);

      ctx.imageSmoothingEnabled = false;

      // White background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, baseWidth, baseHeight);

      // QR code - centered
      ctx.drawImage(img, padding, padding, qrSize, qrSize);

      // Sirf LOC-ID neeche
      ctx.fillStyle = "#000000";
      ctx.font = "bold 22px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`LOC-ID: ${data.location_id}`, baseWidth / 2, padding + qrSize + 38);

      const dataUrl = canvas.toDataURL("image/png", 1.0);

      if (type === "download") {
        const link = document.createElement("a");
        link.download = `LOC_${data.location_id}.png`;
        link.href = dataUrl;
        link.click();
      } else {
        const printWin = window.open("", "", "width=500,height=600");
        printWin.document.write(`
          <html>
            <head>
              <style>
                @page { size: auto; margin: 0mm; }
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: #fff; }
                img { width: 320px; height: auto; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }
              </style>
            </head>
            <body onload="setTimeout(() => { window.print(); window.close(); }, 200)">
              <img src="${dataUrl}">
            </body>
          </html>
        `);
        printWin.document.close();
      }
    };

    img.src = url;
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Location Details" maxWidth="max-w-md ">
      <div className="flex flex-col p-2 space-y-6 bg-white h-full font-sans">

        <div className="flex flex-col items-center justify-center py-10 bg-slate-50 border border-slate-100 rounded-3xl shadow-inner">
          <div ref={qrRef} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <QRCode
              value={qrValue}
              size={160}
              level="H"
            />
          </div>
          <div className="mt-4 text-center">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              LOC-ID: {data.location_id}
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">
              Scan for full details
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <MapPin size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Position</span>
            </div>
            <p className="text-sm font-bold text-slate-800">{data.rack_no} - {data.row_no}</p>
          </div>
          <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
              <Hash size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">Capacity</span>
            </div>
            <p className="text-sm font-bold text-slate-800">{data.total_capacity} Units</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Linked Item</p>
              <p className="text-sm font-bold text-slate-800 truncate">{data.item_code || "Open Allocation"}</p>
              {data.item_desc && <p className="text-[11px] text-slate-500 truncate mt-0.5">{data.item_desc}</p>}
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 bg-slate-50/50 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Customer Name</p>
              <p className="text-sm font-bold text-slate-800 truncate">{data.acc_name || "General Inventory"}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto flex items-center gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={() => handleExport("print")}
            className="flex-1 h-12 flex items-center justify-center gap-2 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-95 transition-all"
          >
            <Printer size={18} /> Print Label
          </button>
          <button
            onClick={() => handleExport("download")}
            className="w-12 h-12 flex items-center justify-center border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 active:scale-95 transition-all"
          >
            <Download size={20} />
          </button>
        </div>
      </div>
    </Drawer>
  );
}