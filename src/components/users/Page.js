"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Users, RefreshCcw, Edit3, Trash2, CheckCircle, X } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime, getInitials } from "@/helpers/utilHelper";
import { userService } from "@/services/user";
import { useViewMode } from "@/hooks/useViewMode";
import dayjs from "dayjs";

import ActionButton from "@/components/ui/ActionButton";
import ViewToggle from "@/components/ui/ViewToggle";
import DeleteModal from "@/components/common/DeleteModal";
import DataTable from "@/components/ui/DataTable";
import UserModal from "@/components/users/UserModal";
import DateRangeFilter from "@/components/common/DateRangeFilter";

import { USER_STATUS_CONFIG, USER_TYPE_CONFIG, getAvatarColor } from "@/components/common/Constants";
import { useCanAccess } from "@/hooks/useCanAccess";

export default function UsersPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("users", "view"), [canAccess]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  // Calculate default dates based on permission days
  const defaultDates = useMemo(() => {
    const days = viewAccess?.days;
    if (days > 0) {
      const to = dayjs().format("YYYY-MM-DD");
      const from = dayjs().subtract(days - 1, "day").format("YYYY-MM-DD");
      return { from, to };
    }
    return { from: "", to: "" };
  }, [viewAccess?.days]);

  const [params, setParams] = useState({
    page: 1, pageSize: 50, search: "", status: "All", role: "All",
    fromDate: defaultDates.from, toDate: defaultDates.to, sortKey: "id", sortDir: "desc"
  });

  // Update params if defaultDates change
  useEffect(() => {
    if (defaultDates.from || defaultDates.to) {
      setParams(prev => ({
        ...prev,
        fromDate: defaultDates.from,
        toDate: defaultDates.to
      }));
    }
  }, [defaultDates.from, defaultDates.to]);

  const [tempSearch, setTempSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState("");

  const fetchUsers = useCallback(async (isLoadMore = false) => {
    if (!isLoadMore) setLoading(true);
    try {
      setBlockedMessage("");
      const currentPage = isLoadMore ? params.page + 1 : 1;
      const apiParams = {
        page: currentPage, limit: params.pageSize, sortBy: params.sortKey, order: params.sortDir,
        search: params.search || undefined,
        filters: {
          ...(params.status !== "All" && { status: params.status }),
          ...(params.role !== "All" && { type: params.role }),
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
        }
      };
      const body = await userService.getAll(apiParams);
      const list = body.data?.data ?? body.data?.users ?? body.data ?? [];
      const newItems = Array.isArray(list) ? list : [];

      if (isLoadMore) {
        setUsers(prev => [...prev, ...newItems]);
        setParams(prev => ({ ...prev, page: currentPage }));
      } else {
        setUsers(newItems);
        setParams(prev => ({ ...prev, page: 1 }));
      }
      setTotalItems(body.data?.total ?? (Array.isArray(list) ? list.length : 0));
    } catch (err) {
      const msg = err?.message || "";
      const denied = err?.status === 403 && (
        msg.includes("Access Denied — module") ||
        msg.toLowerCase().includes("deactivated")
      );
      if (denied) {
        setUsers([]);
        setTotalItems(0);
        setBlockedMessage(msg);
      } else {
        toast.error(err?.message || "Failed to load users");
      }
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.status, params.role, params.fromDate, params.toDate, params.page]);

  useEffect(() => { 
    fetchUsers(false); 
  }, [params.pageSize, params.sortKey, params.sortDir, params.search, params.status, params.role, params.fromDate, params.toDate]);

  const handleLoadMore = useCallback(() => {
    if (!loading && users.length < totalItems) {
      fetchUsers(true);
    }
  }, [loading, users.length, totalItems, fetchUsers]);

  const handleFilterApply = (data) => {
    setParams(prev => ({ ...prev, page: 1, search: tempSearch, fromDate: data.fromDate, toDate: data.toDate, status: data.status || prev.status, role: data.role || prev.role }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams(prev => ({ ...prev, page: 1, search: "", status: "All", role: "All", fromDate: defaultDates.from, toDate: defaultDates.to }));
  };

  const userExtraFilters = useMemo(() => [
    { label: "Status", key: "status", value: params.status, options: [{ label: "All Status", value: "All" }, { label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }, { label: "Training", value: "training" }] },
    { label: "Role", key: "role", value: params.role, options: [{ label: "All Roles", value: "All" }, { label: "Super Admin", value: "super_admin" }, { label: "Admin", value: "admin" }, { label: "User", value: "user" }] }
  ], [params.status, params.role]);

  const HEADERS = [
    ["Name", "name", (v, row) => (
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarColor(row.id)} flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm`}>
          {getInitials(v)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-xs truncate leading-tight uppercase">{v}</p>
          <p className="text-[10px] text-slate-400">@{row.username}</p>
        </div>
      </div>
    )],
    ["Email", "email", (v) => <span className="text-xs">{v}</span>],
    ["Role", "type", (v) => {
      const cfg = USER_TYPE_CONFIG[v] || { label: v, bg: "bg-slate-50", text: "text-slate-600" };
      return <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.text} border-current/10`}>{cfg.label}</span>;
    }],
    ["Status", "status", (v) => {
      const cfg = USER_STATUS_CONFIG[v] || USER_STATUS_CONFIG["inactive"];
      return <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${cfg.bg} ${cfg.text}`}><span className={`w-1 h-1 rounded-full ${cfg.dot}`} />{cfg.label}</span>;
    }],
    ["Created At", "created_at", (v) => <span className="text-xs text-slate-500">{formatDateTime(v)}</span>],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- TOP ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Action Group */}
            <div className="flex items-center gap-2 flex-wrap">
              <ActionButton module="users" action="add" label="New" icon={Plus} onClick={() => { setEditUser(null); setModalOpen(true); }} className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none border-slate-300" />
              <ActionButton module="users" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={selected === null} record={users.find(u => u.id === selected)} onClick={() => { setEditUser(users.find(u => u.id === selected)); setModalOpen(true); }} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none" />
              <ActionButton module="users" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={selected === null} onClick={() => { setDeleteUser(users.find(u => u.id === selected)); }} className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 shrink-0 shadow-none" />
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <button onClick={fetchUsers} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            {/* ViewToggle - Exact Same Height and Shape */}
            <div className="flex items-center">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>

          </div>

          {/* SELECTION INDICATOR */}
          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Selected: {users.find(u => u.id === selected)?.name}</span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        {/* --- REST OF THE UI (FILTER, DATA, PAGINATION) --- */}
        <div className="px-3 md:px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            extraFilters={userExtraFilters} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search name, email..."
            searchLabel="Search User"
            minDate={defaultDates.from}
            maxDate={defaultDates.to}
          />
        </div>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} getRowId={(row) => row.id} data={users} loading={loading}
            viewMode={viewMode} allowCopy={true} showSelection={true} skeletonCount={params.pageSize}
            emptyIcon={Users}
            emptyMessage={blockedMessage || "No users found"}
            emptySubMessage={blockedMessage ? "No records are available for the current selection." : undefined}
            sortKey={params.sortKey} sortDir={params.sortDir}
            onSort={(key) => setParams(p => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc", page: 1 }))}
            selectedId={selected} onSelect={setSelected}
            onLoadMore={handleLoadMore}
            hasMore={users.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "name", tagsKeys: ["type", "status"], detailKeys: ["email", "phone"], footerKey: "created_at",
              className: "rounded-2xl shadow-sm border border-slate-100 overflow-hidden" 
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {users.length} of {totalItems} Users
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && <UserModal open={modalOpen} onClose={() => { setModalOpen(false); setEditUser(null); }} onSuccess={fetchUsers} editUser={editUser} />}
      {deleteUser && <DeleteModal item={deleteUser} onClose={() => setDeleteUser(null)} onSuccess={fetchUsers} service={userService} entityLabel="User" />}
    </div>
  );
}