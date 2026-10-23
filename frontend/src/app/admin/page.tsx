"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Crown,
  Users,
  Search,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Lock,
  ArrowLeft,
  Activity,
  BarChart3,
  Database,
  ScanBarcode,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  UserX,
  Download,
  Filter,
  X,
  ChevronRight,
  Server,
  Clock,
  Sparkles,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ingrivo-3.onrender.com";

interface UserRecord {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  google_sub?: string;
  picture?: string;
  plain_password?: string;
  hashed_password?: string;
  role: "admin" | "user";
  status: "active" | "suspended" | "pending";
  dietary_preferences?: string[];
  allergens?: string[];
  health_goals?: string[];
  scans_count: number;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

interface AdminStats {
  total_users: number;
  admin_users: number;
  active_users: number;
  suspended_users: number;
  total_scans: number;
  grade_distribution: Record<string, number>;
  dietary_counts: Record<string, number>;
  allergen_counts: Record<string, number>;
  db_size_bytes: number;
  db_path: string;
  super_admin: string;
  system_status: string;
  recent_logs: any[];
}

interface ActivityLog {
  id: number;
  user_email: string;
  action: string;
  details: string;
  ip_address: string;
  timestamp: string;
}

interface ScanRecord {
  id: number;
  user_email: string;
  product_code: string;
  product_name: string;
  brand: string;
  grade: string;
  timestamp: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, token, isAdmin, isLoading: authLoading, logout } = useAuth();

  const [activeTab, setActiveTab] = useState<"overview" | "users" | "logs" | "scans" | "system">("overview");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Search & Filters for Users Tab
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Credential Visibility Toggles: userId -> boolean
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [inspectUser, setInspectUser] = useState<any | null>(null);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<UserRecord | null>(null);

  // Form states for Create User
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    phone: "",
    password: "",
    role: "user",
    status: "active",
  });

  // Form states for Edit User
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    password: "",
    role: "user",
    status: "active",
  });

  // Fetch admin stats and data
  const fetchData = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoadingData(true);
    setActionMessage(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Stats
      const statsRes = await fetch(`${API_BASE}/api/v1/admin/stats`, { headers });
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        setStats(statsJson.data);
      }

      // 2. Users
      const usersRes = await fetch(`${API_BASE}/api/v1/admin/users?limit=200`, { headers });
      if (usersRes.ok) {
        const usersJson = await usersRes.json();
        setUsers(usersJson.users || []);
      }

      // 3. Logs
      const logsRes = await fetch(`${API_BASE}/api/v1/admin/logs?limit=50`, { headers });
      if (logsRes.ok) {
        const logsJson = await logsRes.json();
        setLogs(logsJson.logs || []);
      }

      // 4. Scans
      const scansRes = await fetch(`${API_BASE}/api/v1/admin/scans?limit=50`, { headers });
      if (scansRes.ok) {
        const scansJson = await scansRes.json();
        setScans(scansJson.scans || []);
      }
    } catch (err: any) {
      console.error("Admin fetch error:", err);
      setActionMessage({ type: "error", text: "Failed to connect to Admin API. Check backend status." });
    } finally {
      setLoadingData(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    if (isAdmin && token) {
      fetchData();
    }
  }, [isAdmin, token, fetchData]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Toggle password visibility
  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  // Filtered Users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        u.id.toLowerCase().includes(q);

      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus = statusFilter === "all" || u.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchQuery, roleFilter, statusFilter]);

  // Toggle user status (active / suspended)
  const handleToggleStatus = async (userRecord: UserRecord) => {
    if (!token) return;
    const newStatus = userRecord.status === "active" ? "suspended" : "active";
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userRecord.id}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `User ${userRecord.email} status changed to ${newStatus}.`,
        });
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage({ type: "error", text: err.detail || "Failed to update status." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to update status." });
    }
  };

  // Create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setCreateForm({
          email: "",
          name: "",
          phone: "",
          password: "",
          role: "user",
          status: "active",
        });
        setActionMessage({ type: "success", text: `User ${createForm.email} created successfully!` });
        fetchData();
      } else {
        setActionMessage({ type: "error", text: data.detail || "Failed to create user." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Could not create user." });
    }
  };

  // Edit user
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editUser) return;
    try {
      const payload: any = {
        name: editForm.name,
        phone: editForm.phone,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const res = await fetch(`${API_BASE}/api/v1/admin/users/${editUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setEditUser(null);
        setActionMessage({ type: "success", text: `User ${editUser.email} updated successfully.` });
        fetchData();
      } else {
        setActionMessage({ type: "error", text: data.detail || "Failed to update user." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Could not update user." });
    }
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!token || !deleteCandidate) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${deleteCandidate.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActionMessage({
          type: "success",
          text: `User ${deleteCandidate.email} permanently deleted.`,
        });
        setDeleteCandidate(null);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage({ type: "error", text: err.detail || "Failed to delete user." });
      }
    } catch (e: any) {
      setActionMessage({ type: "error", text: e.message || "Failed to delete user." });
    }
  };

  // Export users to JSON
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ingrivo_users_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Open inspect drawer
  const handleInspectUser = async (userRecord: UserRecord) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/users/${userRecord.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setInspectUser(json.user);
      } else {
        setInspectUser(userRecord);
      }
    } catch {
      setInspectUser(userRecord);
    }
  };

  // 1. Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center p-6 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-stone-300 font-medium text-sm">Authenticating Master Administrator session...</p>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a100d] via-[#111827] to-[#0f172a] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#1e293b]/80 border border-emerald-500/30 rounded-3xl p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Super Admin Restricted Area</h1>
          <p className="text-sm text-stone-300 mt-2 leading-relaxed">
            This administrative control panel is restricted to the platform owner. Sign in with the Master Admin account to continue.
          </p>
          <div className="mt-5 p-3.5 rounded-xl bg-black/40 border border-stone-700/60 text-left text-xs text-stone-300">
            <div className="font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              Master Admin Identity:
            </div>
            <div className="font-mono text-stone-200">yaadvshubham01@gmail.com</div>
          </div>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/login?redirect=/admin"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#1E5B45] to-emerald-600 text-white font-bold text-sm hover:brightness-110 shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Sign In as Admin</span>
            </Link>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-stone-300 font-semibold text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Website</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Authenticated but NOT Admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a100d] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#18221b] border border-red-500/30 rounded-3xl p-8 backdrop-blur-xl shadow-2xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto mb-5">
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-black text-white">403 Forbidden — Access Denied</h1>
          <p className="text-sm text-stone-300 mt-2 leading-relaxed">
            Your account <span className="font-mono text-amber-300">{user.email}</span> does not have administrator privileges.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => logout()}
              className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-all"
            >
              Sign Out & Switch to Admin Account
            </button>
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-stone-300 font-semibold text-xs hover:bg-white/10 transition-all"
            >
              Return to Consumer Portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. SUPER ADMIN ACCESS GRANTED
  return (
    <div className="min-h-screen bg-[#0d1411] text-stone-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Banner & Header */}
      <header className="sticky top-0 z-40 bg-[#121c17]/95 border-b border-[#23352c] backdrop-blur-md px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#1E5B45] to-emerald-400 flex items-center justify-center shadow-md shadow-emerald-950">
                <Crown className="w-5 h-5 text-amber-300" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-base tracking-tight text-white flex items-center gap-1.5">
                  INGRIVO <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">SUPER ADMIN</span>
                </span>
                <span className="text-[10px] text-emerald-400/80 font-mono">Platform Master Command Center</span>
              </div>
            </Link>
          </div>

          {/* Admin Identity & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#192720] border border-[#2d4338] text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-stone-300 font-mono text-[11px]">{user.email}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500 text-stone-950">Master</span>
            </div>

            <button
              onClick={fetchData}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#192720] hover:bg-[#23352c] border border-[#2d4338] text-xs font-semibold text-stone-200 transition-all hover:text-white"
              title="Refresh platform data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? "animate-spin text-emerald-400" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-bold text-emerald-300 transition-all hover:scale-[1.02]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Consumer Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Feedback alert toast */}
        {actionMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold animate-in slide-in-from-top-2 duration-200 ${
              actionMessage.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : "bg-red-950/60 border-red-500/40 text-red-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-[#23352c] pb-3 overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5">
            {[
              { id: "overview", label: "Dashboard Overview", icon: BarChart3 },
              { id: "users", label: `User Management & Credentials (${users.length})`, icon: Users },
              { id: "logs", label: `Audit Trail (${logs.length})`, icon: Activity },
              { id: "scans", label: `Live Scans Feed (${scans.length})`, icon: ScanBarcode },
              { id: "system", label: "Database & System Diagnostics", icon: Server },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-[#1E5B45] to-emerald-600 text-white shadow-md shadow-emerald-950/40"
                      : "text-stone-400 hover:text-stone-200 hover:bg-[#16221c]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab === "users" && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportJSON}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#192720] hover:bg-[#23352c] border border-[#2d4338] text-xs font-semibold text-stone-200 transition-all"
                title="Export user registry to JSON"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Export JSON</span>
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950 transition-all hover:scale-[1.02]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create User</span>
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-[#141e19] border border-[#23352c] relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Users</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-white">{stats?.total_users ?? users.length}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400">
                  <span className="text-emerald-400 font-semibold">{stats?.admin_users ?? 1} Super Admin</span>
                  <span>•</span>
                  <span>{(stats?.total_users ?? users.length) - (stats?.admin_users ?? 1)} Consumer Accounts</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#141e19] border border-[#23352c] relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Active Status</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                    <UserCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-emerald-400">{stats?.active_users ?? users.filter(u => u.status === "active").length}</div>
                <div className="mt-1 text-[11px] text-stone-400">
                  {stats?.suspended_users ?? 0} suspended accounts
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-[#141e19] border border-[#23352c] relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Platform Scans</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <ScanBarcode className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-3xl font-black text-amber-300">{stats?.total_scans ?? 0}</div>
                <div className="mt-1 text-[11px] text-stone-400">Analyzed food & cosmetics barcodes</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#141e19] border border-[#23352c] relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Storage Engine</span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                    <Database className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 text-2xl font-black text-white">
                  {stats?.db_size_bytes ? `${(stats.db_size_bytes / 1024).toFixed(1)} KB` : "WAL Active"}
                </div>
                <div className="mt-1 text-[11px] text-emerald-400 font-mono">SQLite WAL Mode (Persistent)</div>
              </div>
            </div>

            {/* Middle Analytics Grid: Scans Grade distribution & Diet Preferences */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Product Nutri-score Grade Distribution */}
              <div className="p-6 rounded-2xl bg-[#141e19] border border-[#23352c] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>Scanned Products Grade Distribution (Nutri-Score)</span>
                  </h3>
                  <span className="text-[11px] font-mono text-stone-400">{stats?.total_scans ?? 0} total</span>
                </div>
                <div className="space-y-3 pt-2">
                  {[
                    { grade: "A", label: "Grade A — Clean / High Nutrition", color: "bg-emerald-500", text: "text-emerald-400" },
                    { grade: "B", label: "Grade B — Good Balance", color: "bg-lime-500", text: "text-lime-400" },
                    { grade: "C", label: "Grade C — Moderate / Processed", color: "bg-yellow-500", text: "text-yellow-400" },
                    { grade: "D", label: "Grade D — Ultra-Processed / High Sugar", color: "bg-orange-500", text: "text-orange-400" },
                    { grade: "E", label: "Grade E — Critical Health Warning", color: "bg-red-500", text: "text-red-400" },
                  ].map((g) => {
                    const count = stats?.grade_distribution?.[g.grade] ?? 0;
                    const total = stats?.total_scans || 0;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={g.grade} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-semibold ${g.text}`}>{g.label}</span>
                          <span className="font-mono text-stone-300">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                          <div className={`h-full ${g.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User Dietary Insights & Health Goals */}
              <div className="p-6 rounded-2xl bg-[#141e19] border border-[#23352c] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <span>User Dietary Filters & Allergen Alerts</span>
                  </h3>
                  <span className="text-[11px] font-mono text-stone-400">Live User Data</span>
                </div>
                <div className="space-y-3 pt-2">
                  {(() => {
                    const dietaryEntries = Object.entries(stats?.dietary_counts || {});
                    const allergenEntries = Object.entries(stats?.allergen_counts || {});
                    const allItems = [
                      ...dietaryEntries.map(([k, v]) => ({ label: k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), count: v, type: "Diet Preference" })),
                      ...allergenEntries.map(([k, v]) => ({ label: `${k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())} Alert`, count: v, type: "Allergen Alert" })),
                    ];

                    if (allItems.length === 0) {
                      return (
                        <div className="py-8 text-center text-stone-500 text-xs">
                          No dietary preferences or allergen alerts configured by registered users yet.
                        </div>
                      );
                    }

                    return allItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-black/25 border border-stone-800">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.type === "Allergen Alert" ? "bg-red-400" : "bg-amber-400"}`} />
                          <span className="text-xs font-semibold text-stone-200">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400">{item.type}</span>
                          <span className="text-xs font-bold text-emerald-400 font-mono">{item.count} user{item.count !== 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* Recent Audit Activities preview */}
            <div className="p-6 rounded-2xl bg-[#141e19] border border-[#23352c] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>Recent Security & Audit Events</span>
                </h3>
                <button
                  onClick={() => setActiveTab("logs")}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <span>View all {logs.length} logs</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-[#23352c] pt-1">
                {(stats?.recent_logs || logs.slice(0, 5)).length === 0 ? (
                  <div className="py-6 text-center text-stone-500 text-xs">
                    No activity logs recorded yet.
                  </div>
                ) : (
                  (stats?.recent_logs || logs.slice(0, 5)).map((log: any, i: number) => (
                    <div key={i} className="py-2.5 flex items-center justify-between text-xs gap-4">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-md font-mono text-[10px] bg-stone-800 text-emerald-300 font-bold">
                          {log.action}
                        </span>
                        <span className="text-stone-300 font-medium truncate">{log.user_email}</span>
                        <span className="text-stone-400 truncate hidden sm:inline">— {log.details}</span>
                      </div>
                      <span className="text-stone-400 font-mono text-[10px] shrink-0">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "Just now"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USERS & CREDENTIALS MANAGEMENT (THE CORE PROMPT REQUIREMENT) */}
        {activeTab === "users" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Control Bar: Search and Filters */}
            <div className="p-4 rounded-2xl bg-[#141e19] border border-[#23352c] flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by email, name, phone, or User ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-black/40 border border-stone-700/60 text-xs text-white placeholder-stone-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-stone-400">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Role:</span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="bg-black/40 border border-stone-700/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admins Only</option>
                    <option value="user">Users Only</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-stone-400">
                  <span>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-black/40 border border-stone-700/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl bg-[#141e19] border border-[#23352c] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#192720] border-b border-[#23352c] text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4">User Profile</th>
                      <th className="py-3.5 px-4">Contact</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Credentials (ID & Password)</th>
                      <th className="py-3.5 px-4 text-center">Scans</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23352c]">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-stone-400">
                          No users found matching your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isSuperAdmin = u.email.toLowerCase() === "yaadvshubham01@gmail.com";
                        const isPasswordVisible = visiblePasswords[u.id] || false;
                        const initial = (u.name || u.email)[0].toUpperCase();

                        return (
                          <tr key={u.id} className="hover:bg-[#1a2821] transition-colors">
                            {/* User Profile */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow">
                                  {initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    <span>{u.name || "Unnamed"}</span>
                                    {isSuperAdmin && (
                                      <span title="Super Admin">
                                        <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-stone-400 text-[11px] font-mono truncate">{u.email}</div>
                                  {u.google_sub && (
                                    <span className="inline-block mt-0.5 text-[9px] font-semibold text-blue-400">
                                      Google OAuth Connected
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Contact / Phone */}
                            <td className="py-3.5 px-4 font-mono text-stone-300">
                              {u.phone || <span className="text-stone-400">—</span>}
                            </td>

                            {/* Role Badge */}
                            <td className="py-3.5 px-4">
                              {u.role === "admin" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  <Crown className="w-3 h-3 text-amber-400" />
                                  <span>Admin</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-800 text-stone-300">
                                  User
                                </span>
                              )}
                            </td>

                            {/* Status Badge */}
                            <td className="py-3.5 px-4">
                              {u.status === "active" ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                  <span>Suspended</span>
                                </span>
                              )}
                            </td>

                            {/* Credentials Column: ID & Password Viewer */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                {/* User ID with Copy */}
                                <div className="flex items-center gap-1 text-[11px] font-mono text-stone-400">
                                  <span className="text-stone-400">ID:</span>
                                  <span className="text-stone-300">{u.id}</span>
                                  <button
                                    onClick={() => handleCopy(u.id, `id_${u.id}`)}
                                    className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-white"
                                    title="Copy User ID"
                                  >
                                    {copiedKey === `id_${u.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>

                                {/* Password Reveal & Copy */}
                                <div className="flex items-center gap-1.5">
                                  <div className="px-2 py-1 rounded bg-black/50 border border-stone-800 font-mono text-[11px] text-stone-200 min-w-[120px] flex items-center justify-between">
                                    {u.plain_password ? (
                                      isPasswordVisible ? (
                                        <span className="text-amber-300 font-bold">{u.plain_password}</span>
                                      ) : (
                                        <span className="tracking-widest text-stone-400">••••••••••</span>
                                      )
                                    ) : (
                                      <span className="text-[10px] text-blue-400 italic">Google SSO Account</span>
                                    )}

                                    {u.plain_password && (
                                      <button
                                        type="button"
                                        onClick={() => togglePasswordVisibility(u.id)}
                                        className="ml-2 text-stone-400 hover:text-white p-0.5"
                                        title={isPasswordVisible ? "Hide password" : "Show password"}
                                      >
                                        {isPasswordVisible ? (
                                          <EyeOff className="w-3 h-3" />
                                        ) : (
                                          <Eye className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {u.plain_password && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(u.plain_password!, `pw_${u.id}`)}
                                      className="p-1.5 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white transition-all"
                                      title="Copy Password"
                                    >
                                      {copiedKey === `pw_${u.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Scans Count */}
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-stone-300">
                              {u.scans_count || 0}
                            </td>

                            {/* Actions Dropdown / Buttons */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleInspectUser(u)}
                                  className="p-1.5 rounded-lg bg-[#192720] hover:bg-[#23352c] text-stone-300 hover:text-emerald-300 border border-[#2d4338] transition-all"
                                  title="Inspect full details, dietary goals, scan history"
                                >
                                  <Sliders className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setEditUser(u);
                                    setEditForm({
                                      name: u.name || "",
                                      phone: u.phone || "",
                                      password: "",
                                      role: u.role,
                                      status: u.status,
                                    });
                                  }}
                                  className="p-1.5 rounded-lg bg-[#192720] hover:bg-[#23352c] text-stone-300 hover:text-amber-300 border border-[#2d4338] transition-all"
                                  title="Edit user role, status, or credentials"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  disabled={isSuperAdmin}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    isSuperAdmin
                                      ? "opacity-30 cursor-not-allowed bg-stone-900 border-stone-800 text-stone-400"
                                      : u.status === "active"
                                      ? "bg-amber-950/30 hover:bg-amber-950/60 border-amber-500/30 text-amber-400"
                                      : "bg-emerald-950/30 hover:bg-emerald-950/60 border-emerald-500/30 text-emerald-400"
                                  }`}
                                  title={u.status === "active" ? "Suspend user" : "Activate user"}
                                >
                                  {u.status === "active" ? (
                                    <UserX className="w-3.5 h-3.5" />
                                  ) : (
                                    <UserCheck className="w-3.5 h-3.5" />
                                  )}
                                </button>

                                <button
                                  onClick={() => setDeleteCandidate(u)}
                                  disabled={isSuperAdmin}
                                  className={`p-1.5 rounded-lg border transition-all ${
                                    isSuperAdmin
                                      ? "opacity-30 cursor-not-allowed bg-stone-900 border-stone-800 text-stone-400"
                                      : "bg-red-950/30 hover:bg-red-900/50 border-red-500/30 text-red-400"
                                  }`}
                                  title={isSuperAdmin ? "Primary Super Admin cannot be deleted" : "Delete user"}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: AUDIT & ACTIVITY LOGS */}
        {activeTab === "logs" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-[#141e19] border border-[#23352c] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <span>System Activity & Security Audit Trail</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Chronological recording of all user authentications, admin edits, and platform interactions.
                </p>
              </div>
              <span className="text-xs font-mono text-stone-400 font-bold">{logs.length} logs recorded</span>
            </div>

            <div className="rounded-2xl bg-[#141e19] border border-[#23352c] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#192720] border-b border-[#23352c] text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">User Email</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23352c]">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#1a2821] transition-colors font-mono">
                        <td className="py-2.5 px-4 text-stone-400 text-[11px] whitespace-nowrap">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.action.includes("ADMIN")
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : log.action.includes("LOGIN")
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-stone-800 text-stone-300"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-sans font-semibold text-stone-200">{log.user_email}</td>
                        <td className="py-2.5 px-4 text-stone-300 font-sans">{log.details || "—"}</td>
                        <td className="py-2.5 px-4 text-stone-400">{log.ip_address || "127.0.0.1"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SCANS INTELLIGENCE FEED */}
        {activeTab === "scans" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-4 rounded-2xl bg-[#141e19] border border-[#23352c] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ScanBarcode className="w-4 h-4 text-amber-400" />
                  <span>Live Product Scans Feed</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Products analyzed and scanned by registered users across India and international barcodes.
                </p>
              </div>
              <span className="text-xs font-mono text-stone-400 font-bold">{scans.length} scans listed</span>
            </div>

            <div className="rounded-2xl bg-[#141e19] border border-[#23352c] overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#192720] border-b border-[#23352c] text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Barcode</th>
                      <th className="py-3 px-4">Product Name & Brand</th>
                      <th className="py-3 px-4 text-center">Grade</th>
                      <th className="py-3 px-4">Scanner Account</th>
                      <th className="py-3 px-4 text-right">Scanned At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23352c]">
                    {scans.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-stone-400">
                          No scan history recorded yet.
                        </td>
                      </tr>
                    ) : (
                      scans.map((s) => (
                        <tr key={s.id} className="hover:bg-[#1a2821] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">{s.product_code}</td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{s.product_name}</div>
                            {s.brand && <div className="text-stone-400 text-[11px]">{s.brand}</div>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full font-black text-xs ${
                                s.grade === "A"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                  : s.grade === "B"
                                  ? "bg-lime-500/20 text-lime-300 border border-lime-500/40"
                                  : s.grade === "C"
                                  ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/40"
                                  : s.grade === "D"
                                  ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                                  : "bg-red-500/20 text-red-300 border border-red-500/40"
                              }`}
                            >
                              Grade {s.grade || "A"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-stone-300 font-mono text-[11px]">{s.user_email}</td>
                          <td className="py-3 px-4 text-right font-mono text-stone-400 text-[11px]">
                            {s.timestamp ? new Date(s.timestamp).toLocaleDateString() : "Today"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SYSTEM & DATABASE DIAGNOSTICS */}
        {activeTab === "system" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="p-6 rounded-2xl bg-[#141e19] border border-[#23352c] space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" />
                <span>Backend Database & Server Architecture</span>
              </h3>
              <p className="text-xs text-stone-300 leading-relaxed">
                Ingrivo employs a high-performance, WAL-journaled SQLite persistent database layer designed for zero-latency lookups, atomic ACID transactions, and robust user credentials management.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                <div className="p-4 rounded-xl bg-black/40 border border-stone-800 space-y-2">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Database Location</div>
                  <div className="font-mono text-xs text-emerald-300 break-all">{stats?.db_path || "backend/data/ingrivo.db"}</div>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-stone-800 space-y-2">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Engine Status</div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Operational (WAL Mode Enabled)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-stone-800 space-y-2">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Master Administrator</div>
                  <div className="font-mono text-xs text-amber-300">{stats?.super_admin || "yaadvshubham01@gmail.com"}</div>
                </div>

                <div className="p-4 rounded-xl bg-black/40 border border-stone-800 space-y-2">
                  <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Access Token Protocol</div>
                  <div className="text-xs text-stone-200 font-mono">HMAC-SHA256 (HS256) JWT + Role Claims</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: INSPECT USER PROFILE & PREFERENCES */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-[#141e19] border border-[#2d4338] rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#23352c]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                  {(inspectUser.name || inspectUser.email)[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{inspectUser.name || "Member Profile"}</h3>
                  <p className="text-xs text-stone-400 font-mono">{inspectUser.email}</p>
                </div>
              </div>
              <button onClick={() => setInspectUser(null)} className="p-2 text-stone-400 hover:text-white rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-black/40 border border-stone-800">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block mb-1">User ID</span>
                  <span className="font-mono text-stone-200 break-all">{inspectUser.id}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-stone-800">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block mb-1">Phone Number</span>
                  <span className="font-mono text-stone-200">{inspectUser.phone || "Not provided"}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-stone-800">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block mb-1">Plain Password</span>
                  <span className="font-mono text-amber-300 font-bold">{inspectUser.plain_password || "Google SSO"}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-stone-800">
                  <span className="text-[10px] text-stone-400 uppercase font-bold block mb-1">Total Scans</span>
                  <span className="font-mono text-emerald-400 font-bold">{inspectUser.scans_count || 0}</span>
                </div>
              </div>

              {/* Dietary Preferences */}
              <div className="p-4 rounded-xl bg-black/30 border border-stone-800 space-y-2">
                <h4 className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dietary Preferences</span>
                </h4>
                {inspectUser.dietary_preferences && inspectUser.dietary_preferences.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {inspectUser.dietary_preferences.map((d: string) => (
                      <span key={d} className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-semibold">
                        {d.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-stone-400 text-xs italic">No dietary preferences set.</p>
                )}
              </div>

              {/* Allergen Alerts */}
              <div className="p-4 rounded-xl bg-black/30 border border-stone-800 space-y-2">
                <h4 className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Allergen Alert Filters</span>
                </h4>
                {inspectUser.allergens && inspectUser.allergens.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {inspectUser.allergens.map((a: string) => (
                      <span key={a} className="px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 text-[11px] font-semibold">
                        {a}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-stone-400 text-xs italic">No allergens configured.</p>
                )}
              </div>

              {/* Health Goals */}
              <div className="p-4 rounded-xl bg-black/30 border border-stone-800 space-y-2">
                <h4 className="font-bold text-stone-200 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  <span>Health & Lifestyle Goals</span>
                </h4>
                {inspectUser.health_goals && inspectUser.health_goals.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {inspectUser.health_goals.map((g: string) => (
                      <span key={g} className="px-2 py-0.5 rounded-lg bg-yellow-500/20 text-yellow-300 text-[11px] font-semibold">
                        {g}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-stone-400 text-xs italic">No specific goals set.</p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setInspectUser(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE USER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateUser}
            className="max-w-md w-full bg-[#141e19] border border-[#2d4338] rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#23352c]">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Create New User Account</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 font-bold mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-bold mb-1">Mobile Phone (optional)</label>
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-bold mb-1">Initial Password *</label>
                <input
                  type="text"
                  required
                  placeholder="Password@123"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-bold mb-1">Role</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-bold mb-1">Status</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#23352c]">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950"
              >
                Save User Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: EDIT USER */}
      {editUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateUser}
            className="max-w-md w-full bg-[#141e19] border border-[#2d4338] rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#23352c]">
              <div>
                <h3 className="font-bold text-white text-base">Edit User Details</h3>
                <p className="text-xs text-stone-400 font-mono">{editUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-300 font-bold mb-1">Display Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-stone-300 font-bold mb-1">
                  Change Password (leave blank to keep current)
                </label>
                <input
                  type="text"
                  placeholder="Enter new password to reset"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-300 font-bold mb-1">Role</label>
                  <select
                    value={editForm.role}
                    disabled={editUser.email.toLowerCase() === "yaadvshubham01@gmail.com"}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-300 font-bold mb-1">Status</label>
                  <select
                    value={editForm.status}
                    disabled={editUser.email.toLowerCase() === "yaadvshubham01@gmail.com"}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/40 border border-stone-700 text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#23352c]">
              <button
                type="button"
                onClick={() => setEditUser(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Update Account
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-sm w-full bg-[#18221b] border border-red-500/40 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-white text-base">Permanently Delete User?</h3>
            <p className="text-xs text-stone-300">
              Are you sure you want to delete <span className="font-mono text-white font-bold">{deleteCandidate.email}</span>? All scans, dietary preferences, and account history will be removed.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-white font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-950"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
