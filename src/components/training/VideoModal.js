"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Edit3, Trash2, AlertCircle, PlayCircle, Info } from "lucide-react";
import { toast } from "react-toastify";
import { trainingVideoService } from "@/services/training";
import RichTextEditor from "@/components/ui/RichTextEditor";
import Drawer from "@/components/ui/Drawer";

// YouTube helper function
function getYouTubeEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    } else if (u.hostname.includes("youtube.com")) {
      const id = new URLSearchParams(u.search).get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    return url;
  } catch {
    return url;
  }
}

export default function VideoModal({ slot, onClose, onSuccess }) {
  const [form, setForm] = useState({ title: "", description: "", video_url: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  console.log(slot);
  console.log(form.description);
  
  // Initialize form if editing
  useEffect(() => {
    if (slot?.existingData) {
      setForm({
        title: slot.existingData.title || "",
        description: slot.existingData.description || "",
        video_url: slot.existingData.video_url || "",
      });
    } else {
      setForm({ title: "", description: "", video_url: "" });
    }
    setErrors({});
  }, [slot]);

  const handleSave = async () => {
    if (slot.isEdit && !slot.canEdit) {
      toast.error("You do not have permission to edit training videos.");
      return;
    }
    if (!slot.isEdit && !slot.canAdd) {
      toast.error("You do not have permission to add training videos.");
      return;
    }

    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.video_url.trim()) e.video_url = "Video URL is required";

    if (Object.keys(e).length) {
      setErrors(e);
      toast.warning("Please fill required fields");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        module_id: slot.modId,
        permission_type: slot.perm,
        ...form,
      };

      if (slot.isEdit) {
        await trainingVideoService.update(slot.id, payload);
        toast.success("Video updated successfully");
      } else {
        await trainingVideoService.create(payload);
        toast.success("Video saved successfully");
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slot.canDelete) {
      toast.error("You do not have permission to remove training videos.");
      return;
    }
    if (!confirm("Are you sure you want to remove this video?")) return;
    setSaving(true);
    try {
      await trainingVideoService.delete(slot.id);
      toast.success("Video removed successfully");
      onSuccess();
    } catch (err) {
      toast.error(err?.message || "Failed to remove video");
    } finally {
      setSaving(false);
    }
  };

  const footerActions = (
    <div className="flex items-center justify-between w-full">
      {slot.isEdit && slot.canDelete && (
        <button
          onClick={handleDelete}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} />
          Remove
        </button>
      )}
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700">
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || (slot.isEdit ? !slot.canEdit : !slot.canAdd)}
          className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-60"
        >
          {saving ? "Processing..." : slot.isEdit ? "Update Changes" : "Save Video"}
        </button>
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={!!slot}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {slot.isEdit ? <Edit3 size={20} className="text-indigo-600" /> : <Plus size={20} className="text-indigo-600" />}
          <span className="font-bold">{slot.perm.toUpperCase()} Permission Video</span>
        </div>
      }
      description={slot.modLabel}
      footer={footerActions}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6 pb-24">
        
        {/* Title */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Video Title *</label>
          <input
            className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${errors.title ? "border-red-500" : "border-slate-200"}`}
            placeholder="e.g. How to manage inventory..."
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />
          {errors.title && <p className="text-red-500 text-[10px] font-medium ml-1">{errors.title}</p>}
        </div>

        {/* Description Editor */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1">
             <Info size={12} /> Description / Notes
          </label>
            <RichTextEditor
              value={form.description}
              onChange={(html) => setForm({ ...form, description: html })}
            />
        </div>

        {/* URL & Preview */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">Video URL *</label>
          <input
            className={`w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all ${errors.video_url ? "border-red-500" : "border-slate-200"}`}
            placeholder="YouTube or MP4 link..."
            value={form.video_url}
            onChange={e => setForm({ ...form, video_url: e.target.value })}
          />
          {errors.video_url && <p className="text-red-500 text-[10px] font-medium ml-1">{errors.video_url}</p>}
          
          {/* Preview only shows if URL is present */}
          {form.video_url && (
            <div className="mt-3 flex justify-center">
              <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-md">
                {(form.video_url.includes("youtube.com") || form.video_url.includes("youtu.be")) ? (
                  <iframe className="w-full h-full" src={getYouTubeEmbedUrl(form.video_url)} title="Preview" allowFullScreen />
                ) : form.video_url.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video className="w-full h-full" controls><source src={form.video_url} /></video>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                     <p className="text-white/50 text-xs italic">Preview not available</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
      </div>
    </Drawer>
  );
}