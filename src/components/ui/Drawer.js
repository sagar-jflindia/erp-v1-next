"use client";
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Drawer = ({ isOpen, onClose, title, description, children, footer, maxWidth = "max-w-2xl", closeOnOutside = false }) => {
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] overflow-hidden flex justify-end">
      <div 
        className="absolute inset-0 bg-slate-900/50 transition-opacity duration-200" 
        onClick={closeOnOutside ? onClose : undefined} 
      />

      <div className={`relative w-full ${maxWidth} bg-white flex flex-col h-full animate-in slide-in-from-right duration-200 border-l border-slate-300 shadow-2xl`}>
        
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <span className="w-1 h-4 bg-indigo-600 inline-block" />
              {title}
            </h3>
            {description && (
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight ml-3 leading-tight">
                {description}
              </p>
            )}
          </div >
          
          <button 
            onClick={onClose} 
            className="p-1.5 border border-transparent hover:border-slate-200 hover:bg-white text-slate-400 hover:text-rose-600 transition-all shadow-none"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
          {children}
        </div>

        {footer && (
          <div className="px-4 py-2 border-t border-slate-200 flex justify-end items-center bg-slate-50 sticky bottom-0 z-30">
            <div className="flex gap-2 items-center">
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Drawer;