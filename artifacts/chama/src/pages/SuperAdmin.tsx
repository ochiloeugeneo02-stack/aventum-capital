import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdminStats,
  useListUsers,
  useListAllContributions,
  useListAllPayouts,
  useListAuditLogs,
  useCompletePayout,
  getGetAdminStatsQueryKey,
  getListUsersQueryKey,
  getListAllContributionsQueryKey,
  getListAllPayoutsQueryKey,
  getListAuditLogsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRegion } from "@/contexts/RegionContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, FolderOpen, CreditCard, DollarSign, LogOut,
  ArrowLeftRight, FileText, Trash2, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, Loader2, ChevronRight, Search, Shield, Activity, TrendingUp,
  X, Zap,
} from "lucide-react";

type Section =
  | "overview"
  | "users"
  | "groups"
  | "contributions"
  | "payouts"
  | "delete-requests"
  | "exit-requests"
  | "swap-requests"
  | "audit-logs";

interface NavItem {
  id: Section;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface DeleteReq {
  id: number;
  groupId: number;
  group: { id: number; name: string; status: string; currency: string; contributionAmount: string } | null;
  requester: { name: string; email: string } | null;
  reason: string;
  status: string;
  reviewNote: string | null;
  disbursementNote: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  reviewer: { name: string } | null;
}

interface ExitReq {
  id: number;
  groupId: number;
  groupName: string | null;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  status: string;
  reason: string | null;
  reviewNote: string | null;
  autoApproveAfterCycle: number | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface SwapReq {
  id: number;
  groupId: number;
  groupName: string | null;
  requesterId: number;
  requesterName: string | null;
  targetMemberId: number;
  targetMemberName: string | null;
  reason: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-[#1F2937]">{value}</div>
      {sub && <div className="text-xs text-[#9CA3AF]">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, sub, onRefresh, loading, action }: { title: string; sub?: string; onRefresh?: () => void; loading?: boolean; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-lg font-bold text-[#1F2937]">{title}</h2>
        {sub && <p className="text-sm text-[#6B7280] mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">
        {action}
        {onRefresh && (
          <button onClick={onRefresh} className="p-2 rounded-lg hover:bg-[#F5F4F0] text-[#6B7280] transition-colors" disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#F5F4F0] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[#9CA3AF]" />
      </div>
      <p className="font-medium text-[#374151]">{title}</p>
      {sub && <p className="text-sm text-[#9CA3AF] mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

function DataTable({ headers, children, empty }: { headers: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DF] overflow-hidden">
      {empty ? (
        <div className="p-8">{children}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F0EDE8] bg-[#FAFAF9]">
                {headers.map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EDE8]">{children}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    approved: "bg-green-50 text-green-700 border border-green-200",
    auto_approved: "bg-green-50 text-green-700 border border-green-200",
    rejected: "bg-red-50 text-red-700 border border-red-200",
    denied: "bg-red-50 text-red-700 border border-red-200",
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    paused: "bg-amber-50 text-amber-700 border border-amber-200",
    completed: "bg-blue-50 text-blue-700 border border-blue-200",
    deleted: "bg-[#F5F4F0] text-[#9CA3AF] border border-[#E8E4DF]",
    cancelled: "bg-[#F5F4F0] text-[#9CA3AF] border border-[#E8E4DF]",
    confirmed: "bg-green-50 text-green-700 border border-green-200",
    failed: "bg-red-50 text-red-700 border border-red-200",
    super_admin: "bg-purple-50 text-purple-700 border border-purple-200",
    group_admin: "bg-blue-50 text-blue-700 border border-blue-200",
    member: "bg-[#F5F4F0] text-[#6B7280] border border-[#E8E4DF]",
    org_admin: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  };
  return (
    <span className={cn("inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", map[status] ?? "bg-[#F5F4F0] text-[#9CA3AF] border border-[#E8E4DF]")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function SuperAdmin() {
  const { formatCurrency, formatDate, formatDateTime } = useRegion();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");

  const [deleteRequests, setDeleteRequests] = useState<DeleteReq[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteActionLoading, setDeleteActionLoading] = useState<number | null>(null);
  const [deleteNotes, setDeleteNotes] = useState<Record<number, { review: string; disbursement: string }>>({});

  const [exitRequests, setExitRequests] = useState<ExitReq[]>([]);
  const [exitLoading, setExitLoading] = useState(false);
  const [exitActionLoading, setExitActionLoading] = useState<number | null>(null);
  const [exitNotes, setExitNotes] = useState<Record<number, string>>({});

  const [swapRequests, setSwapRequests] = useState<SwapReq[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapActionLoading, setSwapActionLoading] = useState<number | null>(null);

  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsFilter, setGroupsFilter] = useState<"all" | "active" | "paused" | "deleted">("all");

  const { data: stats, isLoading: statsLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: users, isLoading: usersLoading } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() }, enabled: section === "users" });
  const { data: contribs } = useListAllContributions({}, { query: { queryKey: getListAllContributionsQueryKey() }, enabled: section === "contributions" });
  const { data: payouts } = useListAllPayouts({}, { query: { queryKey: getListAllPayoutsQueryKey() }, enabled: section === "payouts" });
  const { data: auditLogs } = useListAuditLogs({}, { query: { queryKey: getListAuditLogsQueryKey() }, enabled: section === "audit-logs" });

  const completePayout = useCompletePayout({
    mutation: {
      onSuccess: () => {
        toast({ title: "Payout marked as completed!" });
        queryClient.invalidateQueries({ queryKey: getListAllPayoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
    },
  });

  const loadDeleteRequests = useCallback(async () => {
    setDeleteLoading(true);
    try { setDeleteRequests(await apiRequest<DeleteReq[]>("/api/admin/delete-requests")); } catch {}
    setDeleteLoading(false);
  }, []);

  const loadExitRequests = useCallback(async () => {
    setExitLoading(true);
    try { setExitRequests(await apiRequest<ExitReq[]>("/api/exit-requests/all")); } catch {}
    setExitLoading(false);
  }, []);

  const loadSwapRequests = useCallback(async () => {
    setSwapLoading(true);
    try { setSwapRequests(await apiRequest<SwapReq[]>("/api/admin/swap-requests")); } catch {}
    setSwapLoading(false);
  }, []);

  const loadAllGroups = useCallback(async () => {
    setGroupsLoading(true);
    try { setAllGroups(await apiRequest<any[]>("/api/admin/groups")); } catch {}
    setGroupsLoading(false);
  }, []);

  useEffect(() => {
    if (section === "delete-requests") loadDeleteRequests();
    if (section === "exit-requests") loadExitRequests();
    if (section === "swap-requests") loadSwapRequests();
    if (section === "groups") loadAllGroups();
  }, [section]);

  const handleDeleteAction = async (id: number, action: "approve" | "reject") => {
    setDeleteActionLoading(id);
    try {
      const notes = deleteNotes[id] ?? { review: "", disbursement: "" };
      const result = await apiRequest<{ message: string }>(`/api/admin/delete-requests/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({ reviewNote: notes.review, disbursementNote: notes.disbursement }),
        headers: { "Content-Type": "application/json" },
      });
      toast({ title: action === "approve" ? "Group closure approved" : "Request rejected", description: result.message });
      await loadDeleteRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Action failed", variant: "destructive" });
    } finally { setDeleteActionLoading(null); }
  };

  const handleExitAction = async (reqId: number, action: "approve" | "deny") => {
    setExitActionLoading(reqId);
    try {
      const res = await apiRequest<{ message: string }>(`/api/exit-requests/${reqId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ note: exitNotes[reqId] ?? "" }),
        headers: { "Content-Type": "application/json" },
      });
      toast({ title: action === "approve" ? "Exit approved" : "Exit denied", description: res.message });
      await loadExitRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Action failed", variant: "destructive" });
    } finally { setExitActionLoading(null); }
  };

  const handleSwapAction = async (id: number, action: "approve" | "deny") => {
    setSwapActionLoading(id);
    try {
      await apiRequest(`/api/swap-requests/${id}/${action}`, { method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" } });
      toast({ title: action === "approve" ? "Swap approved" : "Swap denied" });
      await loadSwapRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Action failed", variant: "destructive" });
    } finally { setSwapActionLoading(null); }
  };

  const s = stats as any;
  const pendingDelete = deleteRequests.filter(r => r.status === "pending").length;
  const pendingExit = exitRequests.filter(r => r.status === "pending").length;
  const pendingSwap = swapRequests.filter(r => r.status === "pending").length;

  const navItems: NavItem[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "users", label: "Users", icon: Users },
    { id: "groups", label: "Groups", icon: FolderOpen },
    { id: "contributions", label: "Contributions", icon: CreditCard },
    { id: "payouts", label: "Payouts", icon: DollarSign },
    { id: "delete-requests", label: "Delete Requests", icon: Trash2, badge: pendingDelete || undefined },
    { id: "exit-requests", label: "Exit Requests", icon: LogOut, badge: pendingExit || undefined },
    { id: "swap-requests", label: "Swap Requests", icon: ArrowLeftRight, badge: pendingSwap || undefined },
    { id: "audit-logs", label: "Audit Log", icon: FileText },
  ];

  const filteredUsers = ((users as any)?.users ?? []).filter((u: any) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = allGroups.filter(g =>
    (groupsFilter === "all" || g.status === groupsFilter) &&
    (!search || g.name?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen flex" style={{ background: "#F5F4F0" }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col" style={{ background: "linear-gradient(180deg, #1C3229 0%, #243D2F 100%)" }}>
        {/* Logo */}
        <div className="px-6 pt-7 pb-6 border-b border-white/10">
          <Logo variant="white" className="h-8 w-8" />
          <div className="mt-3">
            <div className="text-white font-semibold text-sm">Control Panel</div>
            <div className="text-white/40 text-xs mt-0.5 font-light tracking-wide">Aventum Capital</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setSearch(""); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                  isActive
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80 hover:bg-white/8"
                )}
              >
                <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-[#A3C4A8]" : "")} />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="bg-amber-400 text-[#1C3229] text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {item.badge}
                  </span>
                ) : null}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/30" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-5 border-t border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#3A5A40] flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0) ?? "A"}
            </div>
            <div className="overflow-hidden">
              <div className="text-white/80 text-xs font-medium truncate">{user?.name ?? "Admin"}</div>
              <div className="text-white/35 text-[10px] truncate">{user?.email ?? ""}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-[#E8E4DF] px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-[#1F2937] capitalize">
              {navItems.find(n => n.id === section)?.label}
            </h1>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Platform administration · Aventum Capital</p>
          </div>
          <div className="flex items-center gap-3">
            {(section === "users" || section === "groups") && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder={`Search ${section}…`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm bg-[#F5F4F0] border border-[#E8E4DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/20 w-52"
                />
              </div>
            )}
            <div className="w-8 h-8 rounded-xl bg-[#3A5A40]/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#3A5A40]" />
            </div>
          </div>
        </div>

        <div className="px-8 py-7">

          {/* ── OVERVIEW ──────────────────────────────────────────────── */}
          {section === "overview" && (
            <div className="space-y-7">
              {statsLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
              ) : (
                <>
                  {/* Welcome banner */}
                  <div className="rounded-2xl overflow-hidden relative" style={{ background: "linear-gradient(135deg, #1C3229 0%, #2B4A35 100%)" }}>
                    <div className="px-8 py-7 relative z-10">
                      <div className="inline-flex items-center gap-1.5 text-[#A3C4A8] text-xs font-semibold mb-3 bg-white/10 px-3 py-1 rounded-full">
                        <Zap className="w-3 h-3" /> Live Platform
                      </div>
                      <h2 className="text-white text-xl font-bold mb-1">Good day, {user?.name?.split(" ")[0] ?? "Admin"}</h2>
                      <p className="text-white/50 text-sm">Here's what's happening across Aventum Capital right now.</p>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-32 opacity-10" style={{ background: "radial-gradient(circle at 100% 50%, #A3C4A8 0%, transparent 70%)" }} />
                  </div>

                  {/* KPI grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total Users" value={s?.totalUsers ?? 0} icon={Users} accent="bg-blue-50 text-blue-500" sub="Registered members" />
                    <StatCard label="Active Groups" value={s?.activeGroups ?? 0} icon={Activity} accent="bg-emerald-50 text-emerald-600" sub={`of ${s?.totalGroups ?? 0} total groups`} />
                    <StatCard label="Total Contributed" value={formatCurrency(s?.totalContributed ?? 0)} icon={TrendingUp} accent="bg-[#F0F5F1] text-[#3A5A40]" sub="Lifetime platform" />
                    <StatCard label="Total Paid Out" value={formatCurrency(s?.totalPaidOut ?? 0)} icon={DollarSign} accent="bg-green-50 text-green-600" sub="Disbursed to members" />
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Organizations" value={s?.totalOrganizations ?? 0} icon={FolderOpen} accent="bg-purple-50 text-purple-500" />
                    <StatCard label="Pending Payouts" value={s?.pendingPayouts ?? 0} icon={Clock} accent="bg-amber-50 text-amber-500" />
                    <StatCard label="Failed Transactions" value={s?.failedTransactions ?? 0} icon={AlertTriangle} accent="bg-red-50 text-red-500" />
                    <StatCard label="Delete Requests" value={pendingDelete} icon={Trash2} accent="bg-red-50 text-red-500" sub="Awaiting review" />
                  </div>

                  {/* Quick action shortcuts */}
                  <div>
                    <h3 className="text-sm font-semibold text-[#374151] mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Review Delete Requests", icon: Trash2, count: pendingDelete, section: "delete-requests" as Section, color: "text-red-500 bg-red-50" },
                        { label: "Review Exit Requests", icon: LogOut, count: pendingExit, section: "exit-requests" as Section, color: "text-amber-600 bg-amber-50" },
                        { label: "Manage Swap Requests", icon: ArrowLeftRight, count: pendingSwap, section: "swap-requests" as Section, color: "text-blue-600 bg-blue-50" },
                        { label: "View All Users", icon: Users, count: s?.totalUsers, section: "users" as Section, color: "text-[#3A5A40] bg-[#F0F5F1]" },
                      ].map(item => (
                        <button
                          key={item.label}
                          onClick={() => setSection(item.section)}
                          className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#E8E4DF] hover:border-[#3A5A40]/30 hover:shadow-sm transition-all text-left group"
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                            <item.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-[#374151] group-hover:text-[#1F2937] transition-colors leading-snug">{item.label}</div>
                            {item.count != null && <div className="text-xs text-[#9CA3AF] mt-0.5">{item.count} item{item.count !== 1 ? "s" : ""}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── USERS ─────────────────────────────────────────────────── */}
          {section === "users" && (
            <div>
              <SectionHeader title="All Users" sub="Every registered account on the platform" />
              {usersLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
              ) : (
                <DataTable headers={["User", "Email", "Role", "Status", "2FA", "Joined"]}>
                  {filteredUsers.map((u: any) => (
                    <tr key={u.id} className="hover:bg-[#FAFAF9] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#3A5A40]/10 flex items-center justify-center text-xs font-bold text-[#3A5A40] shrink-0">
                            {u.name?.charAt(0)}
                          </div>
                          <span className="text-sm font-medium text-[#1F2937]">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#6B7280]">{u.email}</td>
                      <td className="px-5 py-3.5"><Badge status={u.role} /></td>
                      <td className="px-5 py-3.5"><Badge status={u.isActive ? "active" : "paused"} /></td>
                      <td className="px-5 py-3.5">
                        <span className={cn("text-[11px] font-medium", u.twoFactorEnabled ? "text-emerald-600" : "text-[#9CA3AF]")}>
                          {u.twoFactorEnabled ? "✓ On" : "Off"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#9CA3AF]">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          )}

          {/* ── GROUPS ────────────────────────────────────────────────── */}
          {section === "groups" && (
            <div>
              <SectionHeader
                title="All Groups"
                sub="Savings circles across the platform"
                onRefresh={loadAllGroups}
                loading={groupsLoading}
                action={
                  <div className="flex gap-1">
                    {(["all", "active", "paused", "deleted"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setGroupsFilter(f)}
                        className={cn("px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors",
                          groupsFilter === f ? "bg-[#3A5A40] text-white" : "bg-white border border-[#E8E4DF] text-[#6B7280] hover:border-[#3A5A40]/30"
                        )}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                }
              />
              {groupsLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
              ) : (
                <DataTable headers={["Group", "Admin", "Members", "Amount", "Schedule", "Status", "Created"]}>
                  {filteredGroups.length === 0 ? (
                    <tr><td colSpan={7}><EmptyState icon={FolderOpen} title="No groups found" /></td></tr>
                  ) : filteredGroups.map((g: any) => (
                    <tr key={g.id} className="hover:bg-[#FAFAF9] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-[#1F2937]">{g.name}</div>
                        <div className="text-xs text-[#9CA3AF]">{g.currency}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm text-[#374151]">{g.admin?.name ?? "—"}</div>
                        <div className="text-xs text-[#9CA3AF]">{g.admin?.email}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#F0EDE8] rounded-full h-1.5 w-16">
                            <div className="bg-[#3A5A40] h-1.5 rounded-full" style={{ width: `${Math.min(100, (g.totalMembers / g.maxMembers) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-[#6B7280] tabular-nums">{g.totalMembers}/{g.maxMembers}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[#3A5A40]">
                        {g.currency} {Number(g.contributionAmount).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#6B7280] capitalize">{g.schedule}</td>
                      <td className="px-5 py-3.5"><Badge status={g.status} /></td>
                      <td className="px-5 py-3.5 text-xs text-[#9CA3AF]">{formatDate(g.createdAt)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          )}

          {/* ── CONTRIBUTIONS ─────────────────────────────────────────── */}
          {section === "contributions" && (
            <div>
              <SectionHeader title="All Contributions" sub="Platform-wide payment history" />
              <DataTable headers={["Member", "Amount", "Group", "Date", "Status"]}>
                {((contribs as any)?.contributions ?? []).map((c: any) => (
                  <tr key={c.id} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-[#1F2937]">{c.user?.name ?? `User #${c.userId}`}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-[#3A5A40]">{formatCurrency(c.amount)}</td>
                    <td className="px-5 py-3.5 text-sm text-[#6B7280]">{c.group?.name ?? `Group #${c.groupId}`}</td>
                    <td className="px-5 py-3.5 text-sm text-[#9CA3AF]">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3.5"><Badge status={c.status} /></td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}

          {/* ── PAYOUTS ───────────────────────────────────────────────── */}
          {section === "payouts" && (
            <div>
              <SectionHeader title="All Payouts" sub="Disbursements to group members" />
              <DataTable headers={["Recipient", "Amount", "Group", "Date", "Status", "Action"]}>
                {((payouts as any)?.payouts ?? []).map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-5 py-3.5 text-sm font-medium text-[#1F2937]">{p.recipient?.name ?? `User #${p.recipientId}`}</td>
                    <td className="px-5 py-3.5 text-sm font-bold text-[#3A5A40]">{formatCurrency(p.amount)}</td>
                    <td className="px-5 py-3.5 text-sm text-[#6B7280]">{p.group?.name ?? `Group #${p.groupId}`}</td>
                    <td className="px-5 py-3.5 text-sm text-[#9CA3AF]">{formatDate(p.createdAt)}</td>
                    <td className="px-5 py-3.5"><Badge status={p.status} /></td>
                    <td className="px-5 py-3.5">
                      {p.status === "pending" && (
                        <button
                          onClick={() => completePayout.mutate({ payoutId: p.id })}
                          disabled={completePayout.isPending}
                          className="text-xs font-medium text-[#3A5A40] hover:underline disabled:opacity-50"
                        >
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}

          {/* ── DELETE REQUESTS ───────────────────────────────────────── */}
          {section === "delete-requests" && (
            <div>
              <SectionHeader
                title="Group Deletion Requests"
                sub="Review and action group closure requests submitted by group admins"
                onRefresh={loadDeleteRequests}
                loading={deleteLoading}
              />
              {deleteLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
              ) : deleteRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E4DF] p-8">
                  <EmptyState icon={Trash2} title="No delete requests" sub="Group admin requests to close savings groups will appear here for your review." />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending first */}
                  {deleteRequests.filter(r => r.status === "pending").map(req => (
                    <div key={req.id} className="bg-white rounded-2xl border border-red-200 overflow-hidden">
                      <div className="bg-red-50 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#1F2937]">{req.group?.name ?? `Group #${req.groupId}`}</div>
                            <div className="text-xs text-[#9CA3AF]">Requested by {req.requester?.name} · {formatDate(req.requestedAt)}</div>
                          </div>
                        </div>
                        <Badge status="pending" />
                      </div>
                      <div className="px-6 py-5 space-y-4">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div><span className="text-xs text-[#9CA3AF] block mb-0.5">Requester email</span>{req.requester?.email ?? "—"}</div>
                          <div><span className="text-xs text-[#9CA3AF] block mb-0.5">Group status</span><Badge status={req.group?.status ?? "—"} /></div>
                          <div><span className="text-xs text-[#9CA3AF] block mb-0.5">Contribution</span>{req.group?.currency} {Number(req.group?.contributionAmount ?? 0).toLocaleString()}</div>
                        </div>

                        <div className="bg-[#FAFAF9] rounded-xl px-4 py-3">
                          <span className="text-xs font-semibold text-[#9CA3AF] block mb-1">Reason given</span>
                          <p className="text-sm text-[#374151] italic">"{req.reason}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-[#9CA3AF] block mb-1.5">Review note (sent to requester)</label>
                            <input
                              type="text"
                              placeholder="Optional message to the group admin…"
                              className="w-full px-3 py-2 text-sm border border-[#E8E4DF] rounded-xl bg-[#FAFAF9] focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/20"
                              value={deleteNotes[req.id]?.review ?? ""}
                              onChange={e => setDeleteNotes(n => ({ ...n, [req.id]: { ...n[req.id], review: e.target.value } }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-[#9CA3AF] block mb-1.5">Disbursement note (internal)</label>
                            <input
                              type="text"
                              placeholder="e.g. Funds returned via M-Pesa…"
                              className="w-full px-3 py-2 text-sm border border-[#E8E4DF] rounded-xl bg-[#FAFAF9] focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/20"
                              value={deleteNotes[req.id]?.disbursement ?? ""}
                              onChange={e => setDeleteNotes(n => ({ ...n, [req.id]: { ...n[req.id], disbursement: e.target.value } }))}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleDeleteAction(req.id, "approve")}
                            disabled={deleteActionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#3A5A40] hover:bg-[#2D4A32] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            {deleteActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Approve & Close Group
                          </button>
                          <button
                            onClick={() => handleDeleteAction(req.id, "reject")}
                            disabled={deleteActionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            {deleteActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            Reject Request
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Resolved */}
                  {deleteRequests.filter(r => r.status !== "pending").length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3 mt-2">Resolved</h4>
                      <DataTable headers={["Group", "Requester", "Status", "Reviewed by", "Disbursement note", "Date"]}>
                        {deleteRequests.filter(r => r.status !== "pending").map(req => (
                          <tr key={req.id} className="hover:bg-[#FAFAF9] transition-colors">
                            <td className="px-5 py-3.5 text-sm font-medium">{req.group?.name ?? `#${req.groupId}`}</td>
                            <td className="px-5 py-3.5 text-sm text-[#6B7280]">{req.requester?.name ?? "—"}</td>
                            <td className="px-5 py-3.5"><Badge status={req.status} /></td>
                            <td className="px-5 py-3.5 text-sm text-[#6B7280]">{req.reviewer?.name ?? "—"}</td>
                            <td className="px-5 py-3.5 text-xs text-[#9CA3AF]">{req.disbursementNote ?? "—"}</td>
                            <td className="px-5 py-3.5 text-xs text-[#9CA3AF]">{req.reviewedAt ? formatDate(req.reviewedAt) : "—"}</td>
                          </tr>
                        ))}
                      </DataTable>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── EXIT REQUESTS ─────────────────────────────────────────── */}
          {section === "exit-requests" && (
            <div>
              <SectionHeader title="Member Exit Requests" sub="Review and action requests from members wanting to leave groups" onRefresh={loadExitRequests} loading={exitLoading} />
              {exitLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
              ) : exitRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E4DF] p-8">
                  <EmptyState icon={LogOut} title="No exit requests" sub="Member requests to leave groups will appear here." />
                </div>
              ) : (
                <div className="space-y-4">
                  {exitRequests.filter(r => r.status === "pending").map(req => (
                    <div key={req.id} className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
                      <div className="bg-amber-50 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#1F2937]">{req.userName ?? "Unknown"}</div>
                            <div className="text-xs text-[#9CA3AF]">{req.userEmail} · {req.groupName ?? `Group #${req.groupId}`}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          {req.autoApproveAfterCycle && (
                            <div className="text-xs text-blue-600 font-medium">Auto-eligible after cycle {req.autoApproveAfterCycle}</div>
                          )}
                          <div className="text-xs text-[#9CA3AF] mt-0.5">{formatDate(req.createdAt)}</div>
                        </div>
                      </div>
                      <div className="px-6 py-5 space-y-3">
                        {req.reason && (
                          <div className="bg-[#FAFAF9] rounded-xl px-4 py-3">
                            <p className="text-sm text-[#374151] italic">"{req.reason}"</p>
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder="Note to member (optional)…"
                          className="w-full px-3 py-2 text-sm border border-[#E8E4DF] rounded-xl bg-[#FAFAF9] focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/20"
                          value={exitNotes[req.id] ?? ""}
                          onChange={e => setExitNotes(n => ({ ...n, [req.id]: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleExitAction(req.id, "approve")}
                            disabled={exitActionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#3A5A40] hover:bg-[#2D4A32] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            {exitActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Approve & Remove Member
                          </button>
                          <button
                            onClick={() => handleExitAction(req.id, "deny")}
                            disabled={exitActionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            {exitActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            Deny Request
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {exitRequests.filter(r => r.status !== "pending").length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3 mt-2">Resolved</h4>
                      <DataTable headers={["Member", "Group", "Status", "Note", "Resolved"]}>
                        {exitRequests.filter(r => r.status !== "pending").map(req => (
                          <tr key={req.id} className="hover:bg-[#FAFAF9] transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="text-sm font-medium">{req.userName}</div>
                              <div className="text-xs text-[#9CA3AF]">{req.userEmail}</div>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-[#6B7280]">{req.groupName}</td>
                            <td className="px-5 py-3.5"><Badge status={req.status} /></td>
                            <td className="px-5 py-3.5 text-xs text-[#9CA3AF]">{req.reviewNote ?? "—"}</td>
                            <td className="px-5 py-3.5 text-xs text-[#9CA3AF]">{req.reviewedAt ? formatDate(req.reviewedAt) : "—"}</td>
                          </tr>
                        ))}
                      </DataTable>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── SWAP REQUESTS ─────────────────────────────────────────── */}
          {section === "swap-requests" && (
            <div>
              <SectionHeader title="Turn Swap Requests" sub="Members requesting to swap their rotation positions" onRefresh={loadSwapRequests} loading={swapLoading} />
              {swapLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
              ) : swapRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E4DF] p-8">
                  <EmptyState icon={ArrowLeftRight} title="No swap requests" sub="Rotation swap requests will appear here for review." />
                </div>
              ) : (
                <div className="space-y-4">
                  {swapRequests.filter(r => r.status === "pending").map(req => (
                    <div key={req.id} className="bg-white rounded-2xl border border-blue-200 overflow-hidden">
                      <div className="bg-blue-50 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                            <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[#1F2937] flex items-center gap-2">
                              {req.requesterName} <ArrowLeftRight className="w-3.5 h-3.5 text-[#9CA3AF]" /> {req.targetMemberName}
                            </div>
                            <div className="text-xs text-[#9CA3AF]">{req.groupName ?? `Group #${req.groupId}`} · {formatDate(req.createdAt)}</div>
                          </div>
                        </div>
                        <Badge status="pending" />
                      </div>
                      <div className="px-6 py-5 space-y-3">
                        {req.reason && (
                          <div className="bg-[#FAFAF9] rounded-xl px-4 py-3">
                            <p className="text-sm text-[#374151] italic">"{req.reason}"</p>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSwapAction(req.id, "approve")}
                            disabled={swapActionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#3A5A40] hover:bg-[#2D4A32] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            {swapActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Approve & Swap
                          </button>
                          <button
                            onClick={() => handleSwapAction(req.id, "deny")}
                            disabled={swapActionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            {swapActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            Deny
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {swapRequests.filter(r => r.status !== "pending").length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider mb-3 mt-2">Resolved</h4>
                      <DataTable headers={["Swap", "Group", "Status", "Date"]}>
                        {swapRequests.filter(r => r.status !== "pending").map(req => (
                          <tr key={req.id} className="hover:bg-[#FAFAF9] transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="text-sm font-medium flex items-center gap-1.5">
                                {req.requesterName} <ArrowLeftRight className="w-3 h-3 text-[#9CA3AF]" /> {req.targetMemberName}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-sm text-[#6B7280]">{req.groupName}</td>
                            <td className="px-5 py-3.5"><Badge status={req.status} /></td>
                            <td className="px-5 py-3.5 text-xs text-[#9CA3AF]">{formatDate(req.createdAt)}</td>
                          </tr>
                        ))}
                      </DataTable>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── AUDIT LOG ─────────────────────────────────────────────── */}
          {section === "audit-logs" && (
            <div>
              <SectionHeader title="Audit Log" sub="Every significant platform action, immutable and timestamped" />
              <DataTable headers={["Action", "Performed by", "Target", "Details", "Timestamp"]}>
                {((auditLogs as any)?.logs ?? []).map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-5 py-3.5">
                      <code className="text-xs bg-[#F0F5F1] text-[#3A5A40] px-2 py-1 rounded-lg font-mono font-semibold">{log.action}</code>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#374151]">{log.user?.name ?? `User #${log.performedBy}`}</td>
                    <td className="px-5 py-3.5 text-sm text-[#6B7280] capitalize">{log.targetType}{log.targetId ? ` #${log.targetId}` : ""}</td>
                    <td className="px-5 py-3.5 text-xs text-[#9CA3AF] max-w-xs truncate">{log.details ?? "—"}</td>
                    <td className="px-5 py-3.5 text-xs text-[#9CA3AF] whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
