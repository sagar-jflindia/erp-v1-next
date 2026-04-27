"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Eye, EyeOff, Loader2, Lock, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "react-toastify";
import { userService } from "@/services/user";
import { moduleService } from "@/services/module";
import SelectField from "@/components/common/SelectField";
import Drawer from "@/components/ui/Drawer";
import { errInput, FieldError, okInput, ROLE_LABELS, selectCls, TYPES, USER_STATUSES } from "@/components/common/Constants";

const emailToUsername = (email) =>
  email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").slice(0, 30);

const PHONE_RE = /^[+]?[\d\s\-().]{7,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  name: "",
  username: "",
  email: "",
  phone: "",
  password: "",
  status: "active",
  type: "user",
};

const buildInitialPerms = (modules, existingPermissions = []) => {
  const perms = {};
  modules.forEach((mod) => {
    const existing = existingPermissions.find(
      (p) => p.module_name?.toLowerCase() === mod.name.toLowerCase()
    );
    perms[mod.id] = {
      can_view:      existing?.can_view      ?? false,
      can_view_days: existing?.can_view_days ?? 0,
      can_add:       existing?.can_add       ?? false,
      can_edit:      existing?.can_edit      ?? false,
      can_edit_days: existing?.can_edit_days ?? 0,
      can_delete:    existing?.can_delete    ?? false,
      can_authorize: existing?.can_authorize ?? false,
    };
  });
  return perms;
};

// ─── Reusable debounced duplicate check hook ──────────────────────
// status: "idle" | "checking" | "taken" | "available"
function useDuplicateCheck(fetchFn, delay = 600) {
  const [status, setStatus]   = useState("idle");
  const timerRef              = useRef(null);
  const controllerRef         = useRef(null);

  const check = useCallback((value) => {
    // Cancel previous pending debounce + in-flight request
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();

    if (!value?.trim()) { setStatus("idle"); return; }

    setStatus("checking");

    timerRef.current = setTimeout(async () => {
      controllerRef.current = new AbortController();
      try {
        const taken = await fetchFn(value, controllerRef.current.signal);
        setStatus(taken ? "taken" : "available");
      } catch (err) {
        // AbortError means a newer check started — ignore silently
        if (err.name !== "AbortError") setStatus("idle");
      }
    }, delay);
  }, [fetchFn, delay]);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();
    setStatus("idle");
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();
  }, []);

  return { status, check, reset };
}

// ─── Inline status indicator shown below field ────────────────────
function FieldStatus({ status }) {
  if (status === "checking")  return <span className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5"><Loader2 size={10} className="animate-spin" />Checking…</span>;
  if (status === "taken")     return <span className="flex items-center gap-1 text-[11px] text-rose-500 mt-0.5"><XCircle size={10} />Already taken</span>;
  if (status === "available") return <span className="flex items-center gap-1 text-[11px] text-emerald-500 mt-0.5"><CheckCircle2 size={10} />Available</span>;
  return null;
}

export default function UserModal({ open, onClose, onSuccess, editUser }) {
  const isEdit = !!editUser;

  const [form, setForm]               = useState(EMPTY_FORM);
  const [errors, setErrors]           = useState({});
  const [loading, setLoading]         = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [usernameEdited, setUsernameEdited] = useState(false);
  const [modules, setModules]         = useState([]);
  const [permissions, setPermissions] = useState({});
  const [globalViewDays, setGlobalViewDays] = useState(0);
  const [globalEditDays, setGlobalEditDays] = useState(0);
  const [loadingUser, setLoadingUser] = useState(false);

  // ── Separate duplicate checkers (no shared state = no race condition) ─
  const checkUsernameFn = useCallback(async (value, signal) => {
    const res  = await userService.getAll({ filters: { username: value } }, { signal });
    const list = res.data?.data ?? res.data ?? [];
    if (!Array.isArray(list)) return false;
    return list.some((u) => (isEdit ? u.id !== editUser?.id : true));
  }, [isEdit, editUser?.id]);

  const checkPhoneFn = useCallback(async (value, signal) => {
    const res  = await userService.getAll({ filters: { phone: value } }, { signal });
    const list = res.data?.data ?? res.data ?? [];
    if (!Array.isArray(list)) return false;
    return list.some((u) => (isEdit ? u.id !== editUser?.id : true));
  }, [isEdit, editUser?.id]);

  const usernameCheck = useDuplicateCheck(checkUsernameFn);
  const phoneCheck    = useDuplicateCheck(checkPhoneFn);

  // ── Reset everything on open ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setShowPass(false);
    setGlobalViewDays(0);
    setGlobalEditDays(0);
    usernameCheck.reset();
    phoneCheck.reset();

    if (!editUser) {
      setForm(EMPTY_FORM);
      setUsernameEdited(false);
      setPermissions(buildInitialPerms(modules));
    }
  }, [open, editUser]);

  // ── Fetch modules on open ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const fetchModules = async () => {
      try {
        const res = await moduleService.getAll({ is_active: true });
        setModules(res.data || []);
      } catch (err) {
        toast.error(err?.message || "Failed to load modules");
      }
    };
    fetchModules();
  }, [open]);

  // ── Fetch fresh user (edit mode, after modules loaded) ────────────
  useEffect(() => {
    if (!open || !editUser?.id || modules.length === 0) return;

    const fetchEditUser = async () => {
      setLoadingUser(true);
      try {
        const res  = await userService.getById(editUser.id);
        const user = res.data?.data ?? res.data;
        setForm({
          name:     user.name     || "",
          username: user.username || "",
          email:    user.email    || "",
          phone:    user.phone    || "",
          status:   user.status   || "active",
          type:     user.type     || "user",
          password: "",
        });
        setUsernameEdited(true);
        setPermissions(buildInitialPerms(modules, user.permissions));
      } catch (err) {
        toast.error(err?.message || "Failed to load user data");
      } finally {
        setLoadingUser(false);
      }
    };

    fetchEditUser();
  }, [open, editUser?.id, modules]);

  // ── Generic field setter ──────────────────────────────────────────
  const set = (k) => (e) => {
    let val = e.target.value;
    if (k === "email") val = val.toLowerCase();

    setForm((prev) => {
      const next = { ...prev, [k]: val };
      if (k === "email" && !usernameEdited && !isEdit) {
        const autoUsername = emailToUsername(val);
        next.username = autoUsername;
        // Trigger check for auto-generated username too
        if (autoUsername) usernameCheck.check(autoUsername);
      }
      return next;
    });

    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));

    // Trigger duplicate checks — skip if value unchanged in edit mode
    if (k === "phone") {
      if (isEdit && val === editUser?.phone) { phoneCheck.reset(); return; }
      phoneCheck.check(val);
    }
    if (k === "username") {
      if (isEdit && val === editUser?.username) { usernameCheck.reset(); return; }
      usernameCheck.check(val);
    }
  };

  const handleUsernameChange = (e) => {
    setUsernameEdited(true);
    set("username")(e);
  };

  // ── Permission helpers ────────────────────────────────────────────
  
  /*
  const handlePermissionToggle = (moduleId, field) => {
    setPermissions((prev) => ({
      ...prev,
      [moduleId]: { ...prev[moduleId], [field]: !prev[moduleId][field] },
    }));
  };
  */

  const handlePermissionToggle = (moduleId, field) => {
    setPermissions((prev) => {
      const currentMod = prev[moduleId] || {};
      const newState = !currentMod[field];
      
      let updatedModule = { ...currentMod, [field]: newState };

      // Agar VIEW check kiya, toh baki sab bhi check kar do
      if (field === "can_view" && newState === true) {
        updatedModule.can_add = true;
        updatedModule.can_edit = true;
        updatedModule.can_delete = true;
        updatedModule.can_authorize = true;
      }
      
      // Agar VIEW uncheck kiya, toh baki sab bhi uncheck kar do
      if (field === "can_view" && newState === false) {
        updatedModule.can_add = false;
        updatedModule.can_edit = false;
        updatedModule.can_delete = false;
        updatedModule.can_authorize = false;
        updatedModule.can_view_days = 0;
        updatedModule.can_edit_days = 0;
      }

      return { ...prev, [moduleId]: updatedModule };
    });
  };
 
  /*
  const toggleAllForField = (field) => {
    const allOn = modules.every((m) => permissions[m.id]?.[field]);
    setPermissions((prev) => {
      const updated = { ...prev };
      modules.forEach((m) => { updated[m.id] = { ...updated[m.id], [field]: !allOn }; });
      return updated;
    });
  };
  */

  const toggleAllForField = (field) => {
    const allOn = modules.every((m) => permissions[m.id]?.[field]);
    const nextState = !allOn;

    setPermissions((prev) => {
      const updated = { ...prev };
      modules.forEach((m) => {
        updated[m.id] = { ...updated[m.id], [field]: nextState };
        
        // GLOBAL LOGIC: Agar top VIEW uncheck kiya, toh sab kuch band kar do
        if (field === "can_view" && nextState === false) {
          updated[m.id].can_add = false;
          updated[m.id].can_edit = false;
          updated[m.id].can_delete = false;
          updated[m.id].can_authorize = false;
        }
      });
      return updated;
    });
  };

  // ── Validate ──────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.name.trim())                 e.name     = "Full name is required";
    if (!form.username.trim())             e.username = "Username is required";
    if (form.email.trim() && !EMAIL_RE.test(form.email)) e.email = "Enter a valid email address";
    if (!form.phone.trim())                e.phone    = "Phone number is required";
    else if (!PHONE_RE.test(form.phone))   e.phone    = "Enter a valid phone number (7-15 digits)";
    if (!isEdit && !form.password.trim())  e.password = "Password is required";
    return e;
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSave = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the errors before saving");
      return;
    }

    // Block submit if check still in progress
    if (usernameCheck.status === "checking" || phoneCheck.status === "checking") {
      toast.warning("Please wait, checking for duplicates…");
      return;
    }
    // Block submit if duplicate found
    if (usernameCheck.status === "taken") {
      setErrors((p) => ({ ...p, username: "This username is already taken" }));
      toast.error("Please resolve duplicate username");
      return;
    }
    if (phoneCheck.status === "taken") {
      setErrors((p) => ({ ...p, phone: "This phone number is already in use" }));
      toast.error("Please resolve duplicate phone number");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form, permissions };
      if (isEdit && !payload.password?.trim()) delete payload.password;

      if (isEdit) {
        await userService.update(editUser.id, payload);
        toast.success("User updated successfully");
      } else {
        await userService.create(payload);
        toast.success("User created successfully");
      }
      onSuccess();
      onClose();
    } catch (err) {
      // Fallback: catch any server-side unique constraint errors
      const msg   = err.response?.data?.message || "";
      const lower = msg.toLowerCase();
      if      (lower.includes("phone"))    setErrors((p) => ({ ...p, phone:    msg }));
      else if (lower.includes("username")) setErrors((p) => ({ ...p, username: msg }));
      else if (lower.includes("email"))    setErrors((p) => ({ ...p, email:    msg }));
      else toast.error(msg || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // ── Header checkbox helper ────────────────────────────────────────
  const ColHeader = ({ label, field }) => (
    <th className="px-2 py-3 text-center">
      <div className="flex flex-col items-center gap-1">
        <span>{label}</span>
        <input
          type="checkbox"
          checked={modules.length > 0 && modules.every((m) => permissions[m.id]?.[field])}
          onChange={() => toggleAllForField(field)}
          className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer accent-green-600"
        />
      </div>
    </th>
  );

  const isBusy = loading || loadingUser
    || usernameCheck.status === "checking"
    || phoneCheck.status === "checking";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isEdit ? "Edit User" : "Add New User"}
      description={isEdit ? "Update user information" : "Fill in the details to create a new user"}
      maxWidth="max-w-6xl"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isBusy}
            className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Saving…
              </>
            ) : (
              <><Check size={15} />{isEdit ? "Save Changes" : "Add User"}</>
            )}
          </button>
        </div>
      }
    >
      <div className="overflow-y-auto flex-1 space-y-5">
        {loadingUser ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading user data…</span>
          </div>
        ) : (
          <>
            {/* Row 1: Name + Email + Phone + Username */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input value={form.name} onChange={set("name")} placeholder="John Doe" className={errors.name ? errInput : okInput} />
                <FieldError msg={errors.name} />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</label>
                <input type="email" value={form.email} onChange={set("email")} placeholder="john@example.com" className={errors.email ? errInput : okInput} autoComplete="off" />
                <FieldError msg={errors.email} />
              </div>

              {/* Phone — live duplicate indicator */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Phone <span className="text-rose-400">*</span>
                </label>
                <input
                  type="tel" value={form.phone} onChange={set("phone")}
                  placeholder="+91 98765 43210"
                  className={errors.phone || phoneCheck.status === "taken" ? errInput : okInput}
                />
                {errors.phone
                  ? <FieldError msg={errors.phone} />
                  : <FieldStatus status={phoneCheck.status} />
                }
              </div>

              {/* Username — live duplicate indicator */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Username <span className="text-rose-400">*</span>
                </label>
                <input
                  value={form.username} onChange={handleUsernameChange}
                  placeholder="auto_from_email"
                  className={errors.username || usernameCheck.status === "taken" ? errInput : okInput}
                />
                {errors.username
                  ? <FieldError msg={errors.username} />
                  : !usernameEdited && form.email
                    ? <p className="text-xs text-slate-400 mt-0.5">Auto-generated from email</p>
                    : <FieldStatus status={usernameCheck.status} />
                }
              </div>
            </div>

            {/* Row 2: Password + Type + Status */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5">
                  Password {!isEdit && <span className="text-rose-400">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.password} onChange={set("password")}
                    placeholder={isEdit ? "Leave blank to keep current password" : "Enter password"}
                    className={`${errors.password ? errInput : okInput} pr-11`}
                  />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <FieldError msg={errors.password} />
              </div>

              <SelectField label="Account Type" required value={form.type} onChange={set("type")} options={TYPES} labelMap={ROLE_LABELS} error={errors.type} selectCls={selectCls} />
              <SelectField label="Status" required options={USER_STATUSES} value={form.status} onChange={set("status")} error={errors.status} selectCls={selectCls} />
            </div>

            {/* Permissions Table */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-indigo-500" />
                <h4 className="text-[11px] font-bold text-slate-700 uppercase tracking-widest">Module Access Permissions</h4>
              </div>

              <div className="border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[500px] overflow-y-auto overflow-x-auto relative">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-20 shadow-sm">
                      <tr className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        <th className="px-4 py-3">Module</th>
                        <ColHeader label="View"     field="can_view" />
                        <ColHeader label="Add"      field="can_add" />
                        <ColHeader label="Edit"     field="can_edit" />
                        <ColHeader label="Delete"   field="can_delete" />
                        <ColHeader label="Approved" field="can_authorize" />

                        <th className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span>View Days</span>
                            <input type="number" min="0" value={globalViewDays || ""} placeholder="0"
                              onChange={(e) => {
                                const num = e.target.value === "" ? 0 : Number(e.target.value);
                                setGlobalViewDays(num);
                                setPermissions((prev) => {
                                  const updated = { ...prev };
                                  modules.forEach((m) => { if (updated[m.id]?.can_view) updated[m.id] = { ...updated[m.id], can_view_days: num }; });
                                  return updated;
                                });
                              }}
                              className="w-14 text-center border border-slate-200 rounded-md px-1 py-0.5 text-[10px]"
                            />
                            <span className="text-[9px] text-slate-400">0 = unlimited</span>
                          </div>
                        </th>

                        <th className="px-2 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span>Edit Days</span>
                            <input type="number" min="0" value={globalEditDays || ""} placeholder="0"
                              onChange={(e) => {
                                const num = e.target.value === "" ? 0 : Number(e.target.value);
                                setGlobalEditDays(num);
                                setPermissions((prev) => {
                                  const updated = { ...prev };
                                  modules.forEach((m) => { if (updated[m.id]?.can_edit) updated[m.id] = { ...updated[m.id], can_edit_days: num }; });
                                  return updated;
                                });
                              }}
                              className="w-14 text-center border border-slate-200 rounded-md px-1 py-0.5 text-[10px]"
                            />
                            <span className="text-[9px] text-slate-400">0 = unlimited</span>
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 bg-white">
                      {modules.map((mod) => (
                        <tr key={mod.id} className="hover:bg-indigo-50/30 transition-colors">
                          
                          {/* <td className="px-4 py-2.5 font-semibold text-slate-700 text-xs">{mod.label}</td> */}
                          <td className="px-4 py-2.5 font-semibold text-slate-700 text-xs sticky left-0 bg-white z-10 border-r border-slate-50">{mod.label}</td>
                          {["can_view", "can_add", "can_edit", "can_delete", "can_authorize"].map((field) => (
                            <td key={field} className="px-2 py-2.5 text-center">
                              <input type="checkbox"
                                checked={permissions[mod.id]?.[field] || false}
                                onChange={() => handlePermissionToggle(mod.id, field)}
                                className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-green-600"
                              />
                            </td>
                          ))}
                          <td className="px-2 py-2.5 text-center">
                            <input type="number" min="0" placeholder="0"
                              value={permissions[mod.id]?.can_view_days || ""}
                              disabled={!permissions[mod.id]?.can_view}
                              onChange={(e) => setPermissions((prev) => ({ ...prev, [mod.id]: { ...prev[mod.id], can_view_days: e.target.value === "" ? 0 : Number(e.target.value) } }))}
                              className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <input type="number" min="0" placeholder="0"
                              value={permissions[mod.id]?.can_edit_days || ""}
                              disabled={!permissions[mod.id]?.can_edit}
                              onChange={(e) => setPermissions((prev) => ({ ...prev, [mod.id]: { ...prev[mod.id], can_edit_days: e.target.value === "" ? 0 : Number(e.target.value) } }))}
                              className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {modules.length === 0 && (
                  <div className="p-10 text-center text-slate-400 text-xs italic">Loading modules…</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}