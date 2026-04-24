import { X } from "lucide-react";

export default function GlobalDetailModal({ open, onClose, title, icon: Icon, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50/50">
          <div className="flex items-center gap-2 text-indigo-600">
            {Icon && <Icon size={18} />}
            <h3 className="font-bold text-sm uppercase tracking-tight">{title}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
          <button 
            onClick={onClose} 
            className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all active:scale-95 shadow-sm"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}