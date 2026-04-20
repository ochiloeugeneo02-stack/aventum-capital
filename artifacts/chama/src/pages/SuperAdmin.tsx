import { useState, useEffect, useCallback, useRef } from "react";
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
  LayoutDashboard, Users, FolderOpen, CreditCard, DollarSign,
  ArrowLeftRight, FileText, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, Loader2, ChevronRight, Search, Shield, Activity, TrendingUp,
  X, Zap, MessageCircle, Send, ChevronLeft, HelpCircle, LogOut, Trash2,
} from "lucide-react";

type Section =
  | "overview"
  | "users"
  | "groups"
  | "contributions"
  | "payouts"
  | "support"
  | "swap-requests"
  | "audit-logs";

interface NavItem { id: Section; label: string; icon: React.ElementType; badge?: number; }

interface SupportTicket {
  id: number;
  category: string;
  subject: string;
  status: string;
  priority: string;
  groupId: number | null;
  groupName: string | null;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messageCount: number;
  unreadCount: number;
}

interface TicketMessage {
  id: number;
  message: string;
  isAdmin: boolean;
  readAt: string | null;
  createdAt: string;
  senderName: string | null;
  senderId: number;
}

interface TicketDetail extends SupportTicket { messages: TicketMessage[]; }

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
  createdAt: string;
}

function StatCard({ label, value, sub, icon: Icon, accent, onClick }: { label: string; value: string | number; sub?: string; icon: React.ElementType; accent: string; onClick?: () => void }) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accent}`}><Icon className="w-4 h-4" /></div>
      </div>
      <div className="text-2xl font-bold text-[#1F2937]">{value}</div>
      {sub && <div className="text-xs text-[#9CA3AF]">{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button onClick={onClick} className="bg-white rounded-2xl border border-[#E8E4DF] p-5 flex flex-col gap-3 text-left hover:border-[#3A5A40]/40 hover:shadow-sm transition-all group w-full">
        {inner}
      </button>
    );
  }
  return <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 flex flex-col gap-3">{inner}</div>;
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
      <div className="w-14 h-14 rounded-2xl bg-[#F5F4F0] flex items-center justify-center mb-4"><Icon className="w-6 h-6 text-[#9CA3AF]" /></div>
      <p className="font-medium text-[#374151]">{title}</p>
      {sub && <p className="text-sm text-[#9CA3AF] mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E4DF] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#F0EDE8] bg-[#FAFAF9]">
              {headers.map(h => <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EDE8]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    approved: "bg-green-50 text-green-700 border border-green-200",
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
    open: "bg-blue-50 text-blue-700 border border-blue-200",
    in_progress: "bg-amber-50 text-amber-700 border border-amber-200",
    resolved: "bg-green-50 text-green-700 border border-green-200",
    closed: "bg-[#F5F4F0] text-[#9CA3AF] border border-[#E8E4DF]",
  };
  return (
    <span className={cn("inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", map[status] ?? "bg-[#F5F4F0] text-[#9CA3AF] border border-[#E8E4DF]")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const CATEGORY_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  general:        { label: "General",        icon: HelpCircle,      color: "text-blue-600 bg-blue-50" },
  exit_request:   { label: "Exit request",   icon: LogOut,          color: "text-amber-600 bg-amber-50" },
  group_deletion: { label: "Group deletion", icon: Trash2,          color: "text-red-600 bg-red-50" },
  payment:        { label: "Payment issue",  icon: AlertTriangle,   color: "text-orange-600 bg-orange-50" },
  other:          { label: "Other",          icon: MessageCircle,   color: "text-gray-600 bg-gray-50" },
};

function categoryMeta(cat: string) { return CATEGORY_META[cat] ?? CATEGORY_META.general; }

function formatTime(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export default function SuperAdmin() {
  const { formatCurrency, formatDate, formatDateTime } = useRegion();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");

  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportLoading, setSupportLoading] = useState(false);
  const [supportFilter, setSupportFilter] = useState<"all" | "open" | "in_progress" | "closed">("open");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [adminReply, setAdminReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [closeNote, setCloseNote] = useState("");
  const [showCloseNote, setShowCloseNote] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const loadSupport = useCallback(async () => {
    setSupportLoading(true);
    try { setSupportTickets(await apiRequest<SupportTicket[]>("/api/admin/support/tickets")); } catch {}
    setSupportLoading(false);
  }, []);

  const openTicket = useCallback(async (id: number) => {
    setTicketLoading(true);
    setActiveTicket(null);
    try {
      const data = await apiRequest<TicketDetail>(`/api/admin/support/tickets/${id}`);
      setActiveTicket(data);
      setSupportTickets(prev => prev.map(t => t.id === id ? { ...t, unreadCount: 0 } : t));
    } catch {}
    setTicketLoading(false);
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
    if (section === "support") loadSupport();
    if (section === "swap-requests") loadSwapRequests();
    if (section === "groups") loadAllGroups();
  }, [section]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTicket?.messages]);

  const handleAdminReply = async () => {
    if (!adminReply.trim() || !activeTicket) return;
    setSendingReply(true);
    try {
      await apiRequest(`/api/admin/support/tickets/${activeTicket.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: adminReply.trim() }),
        headers: { "Content-Type": "application/json" },
      });
      setAdminReply("");
      await openTicket(activeTicket.id);
      await loadSupport();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not send reply", variant: "destructive" });
    } finally { setSendingReply(false); }
  };

  const handleCloseTicket = async () => {
    if (!activeTicket) return;
    setClosingTicket(true);
    try {
      await apiRequest(`/api/admin/support/tickets/${activeTicket.id}/close`, {
        method: "POST",
        body: JSON.stringify({ note: closeNote }),
        headers: { "Content-Type": "application/json" },
      });
      toast({ title: "Ticket closed" });
      setShowCloseNote(false);
      setCloseNote("");
      await openTicket(activeTicket.id);
      await loadSupport();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Failed", variant: "destructive" });
    } finally { setClosingTicket(false); }
  };

  const handleReopenTicket = async () => {
    if (!activeTicket) return;
    try {
      await apiRequest(`/api/admin/support/tickets/${activeTicket.id}/reopen`, {
        method: "POST", body: JSON.stringify({}), headers: { "Content-Type": "application/json" },
      });
      toast({ title: "Ticket reopened" });
      await openTicket(activeTicket.id);
      await loadSupport();
    } catch { toast({ title: "Error", variant: "destructive" }); }
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
  const openSupportCount = supportTickets.filter(t => t.status === "open" || t.status === "in_progress").length;
  const unreadSupportCount = supportTickets.reduce((sum, t) => sum + (t.unreadCount ?? 0), 0);
  const pendingSwap = swapRequests.filter(r => r.status === "pending").length;

  const navItems: NavItem[] = [
    { id: "overview",      label: "Overview",       icon: LayoutDashboard },
    { id: "users",         label: "Users",           icon: Users },
    { id: "groups",        label: "Groups",          icon: FolderOpen },
    { id: "contributions", label: "Contributions",   icon: CreditCard },
    { id: "payouts",       label: "Payouts",         icon: DollarSign },
    { id: "support",       label: "Support Tickets", icon: MessageCircle, badge: unreadSupportCount || openSupportCount || undefined },
    { id: "swap-requests", label: "Swap Requests",   icon: ArrowLeftRight, badge: pendingSwap || undefined },
    { id: "audit-logs",    label: "Audit Log",       icon: FileText },
  ];

  const filteredUsers = ((users as any)?.users ?? []).filter((u: any) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = allGroups.filter(g =>
    (groupsFilter === "all" || g.status === groupsFilter) &&
    (!search || g.name?.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredTickets = supportTickets.filter(t => {
    if (supportFilter !== "all" && t.status !== supportFilter) return false;
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="min-h-screen flex" style={{ background: "#F5F4F0" }}>
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col" style={{ background: "linear-gradient(180deg, #1C3229 0%, #243D2F 100%)" }}>
        <div className="px-6 pt-7 pb-6 border-b border-white/10">
          <Logo variant="white" className="h-8 w-8" />
          <div className="mt-3">
            <div className="text-white font-semibold text-sm">Control Panel</div>
            <div className="text-white/40 text-xs mt-0.5 font-light tracking-wide">Aventum Capital</div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setSection(item.id); setSearch(""); setActiveTicket(null); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                  isActive ? "bg-white/15 text-white shadow-sm" : "text-white/50 hover:text-white/80 hover:bg-white/8"
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

        <div className="px-4 py-4 border-t border-white/10 space-y-2">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-7 h-7 rounded-full bg-[#3A5A40] flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.charAt(0) ?? "A"}
            </div>
            <div className="overflow-hidden flex-1 min-w-0">
              <div className="text-white/80 text-xs font-medium truncate">{user?.name ?? "Admin"}</div>
              <div className="text-white/35 text-[10px] truncate">{user?.email ?? ""}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/50 hover:text-white/90 hover:bg-white/10 transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
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
                  type="text" placeholder={`Search ${section}…`} value={search} onChange={e => setSearch(e.target.value)}
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

          {/* ── OVERVIEW ─────────────────────────────────────────── */}
          {section === "overview" && (
            <div className="space-y-7">
              {statsLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
              ) : (
                <>
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

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total Users" value={s?.totalUsers ?? 0} icon={Users} accent="bg-blue-50 text-blue-500" sub="Registered members" onClick={() => setSection("users")} />
                    <StatCard label="Active Groups" value={s?.activeGroups ?? 0} icon={Activity} accent="bg-emerald-50 text-emerald-600" sub={`of ${s?.totalGroups ?? 0} total`} onClick={() => setSection("groups")} />
                    <StatCard label="Total Contributed" value={formatCurrency(s?.totalContributed ?? 0)} icon={TrendingUp} accent="bg-[#F0F5F1] text-[#3A5A40]" sub="Lifetime" onClick={() => setSection("contributions")} />
                    <StatCard label="Total Paid Out" value={formatCurrency(s?.totalPaidOut ?? 0)} icon={DollarSign} accent="bg-green-50 text-green-600" sub="Disbursed" onClick={() => setSection("payouts")} />
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Pending Payouts" value={s?.pendingPayouts ?? 0} icon={Clock} accent="bg-amber-50 text-amber-500" onClick={() => setSection("payouts")} />
                    <StatCard label="Open Support" value={openSupportCount} icon={MessageCircle} accent="bg-blue-50 text-blue-500" sub="Tickets needing attention" onClick={() => setSection("support")} />
                    <StatCard label="Unread Tickets" value={unreadSupportCount} icon={AlertTriangle} accent="bg-red-50 text-red-500" onClick={() => setSection("support")} />
                    <StatCard label="Organizations" value={s?.totalOrganizations ?? 0} icon={FolderOpen} accent="bg-purple-50 text-purple-500" onClick={() => setSection("groups")} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[#374151] mb-3">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Open Support Tickets", icon: MessageCircle, count: openSupportCount, section: "support" as Section, color: "text-blue-600 bg-blue-50" },
                        { label: "Swap Requests", icon: ArrowLeftRight, count: pendingSwap, section: "swap-requests" as Section, color: "text-indigo-600 bg-indigo-50" },
                        { label: "View All Users", icon: Users, count: s?.totalUsers, section: "users" as Section, color: "text-[#3A5A40] bg-[#F0F5F1]" },
                        { label: "All Groups", icon: FolderOpen, count: s?.totalGroups, section: "groups" as Section, color: "text-purple-600 bg-purple-50" },
                      ].map(item => (
                        <button key={item.label} onClick={() => setSection(item.section)}
                          className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#E8E4DF] hover:border-[#3A5A40]/30 hover:shadow-sm transition-all text-left group"
                        >
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}><item.icon className="w-4 h-4" /></div>
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

          {/* ── USERS ──────────────────────────────────────────────── */}
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
                          <div className="w-8 h-8 rounded-full bg-[#3A5A40]/10 flex items-center justify-center text-xs font-bold text-[#3A5A40] shrink-0">{u.name?.charAt(0)}</div>
                          <span className="text-sm font-medium text-[#1F2937]">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#6B7280]">{u.email}</td>
                      <td className="px-5 py-3.5"><Badge status={u.role} /></td>
                      <td className="px-5 py-3.5"><Badge status={u.isActive ? "active" : "paused"} /></td>
                      <td className="px-5 py-3.5"><span className={cn("text-[11px] font-medium", u.twoFactorEnabled ? "text-emerald-600" : "text-[#9CA3AF]")}>{u.twoFactorEnabled ? "✓ On" : "Off"}</span></td>
                      <td className="px-5 py-3.5 text-sm text-[#9CA3AF]">{formatDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          )}

          {/* ── GROUPS ─────────────────────────────────────────────── */}
          {section === "groups" && (
            <div>
              <SectionHeader
                title="All Groups" sub="Savings circles across the platform"
                onRefresh={loadAllGroups} loading={groupsLoading}
                action={
                  <div className="flex gap-1">
                    {(["all", "active", "paused", "deleted"] as const).map(f => (
                      <button key={f} onClick={() => setGroupsFilter(f)}
                        className={cn("px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors",
                          groupsFilter === f ? "bg-[#3A5A40] text-white" : "bg-white border border-[#E8E4DF] text-[#6B7280] hover:border-[#3A5A40]/30"
                        )}
                      >{f}</button>
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
                      <td className="px-5 py-3.5"><div className="text-sm font-medium text-[#1F2937]">{g.name}</div><div className="text-xs text-[#9CA3AF]">{g.currency}</div></td>
                      <td className="px-5 py-3.5"><div className="text-sm text-[#374151]">{g.admin?.name ?? "—"}</div><div className="text-xs text-[#9CA3AF]">{g.admin?.email}</div></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#F0EDE8] rounded-full h-1.5 w-16">
                            <div className="bg-[#3A5A40] h-1.5 rounded-full" style={{ width: `${Math.min(100, (g.totalMembers / g.maxMembers) * 100)}%` }} />
                          </div>
                          <span className="text-xs text-[#6B7280] tabular-nums">{g.totalMembers}/{g.maxMembers}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-[#3A5A40]">{g.currency} {Number(g.contributionAmount).toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-sm text-[#6B7280] capitalize">{g.schedule}</td>
                      <td className="px-5 py-3.5"><Badge status={g.status} /></td>
                      <td className="px-5 py-3.5 text-xs text-[#9CA3AF]">{formatDate(g.createdAt)}</td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </div>
          )}

          {/* ── CONTRIBUTIONS ──────────────────────────────────────── */}
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

          {/* ── PAYOUTS ────────────────────────────────────────────── */}
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
                        <button onClick={() => completePayout.mutate({ payoutId: p.id })} disabled={completePayout.isPending} className="text-xs font-medium text-[#3A5A40] hover:underline disabled:opacity-50">Mark Paid</button>
                      )}
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
          )}

          {/* ── SUPPORT TICKETS ─────────────────────────────────────── */}
          {section === "support" && (
            <div>
              {/* Ticket chat view */}
              {activeTicket ? (
                <div className="bg-white rounded-2xl border border-[#E8E4DF] overflow-hidden flex flex-col" style={{ minHeight: "600px" }}>
                  <div className="px-6 py-4 border-b border-[#E8E4DF] bg-[#FAFAF9] flex items-start gap-4">
                    <button onClick={() => setActiveTicket(null)} className="mt-0.5 text-[#6B7280] hover:text-[#1F2937] shrink-0">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-[#1F2937] text-sm">{activeTicket.subject}</span>
                        <Badge status={activeTicket.status} />
                        {(() => { const m = categoryMeta(activeTicket.category); const Icon = m.icon; return <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${m.color}`}><Icon className="w-3 h-3" />{m.label}</span>; })()}
                      </div>
                      <div className="text-xs text-[#9CA3AF]">
                        From: <span className="font-medium text-[#374151]">{activeTicket.userName}</span> ({activeTicket.userEmail})
                        {activeTicket.groupName && <> · Group: <span className="font-medium">{activeTicket.groupName}</span></>}
                        {" · "}{formatTime(activeTicket.createdAt)}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {activeTicket.status !== "closed" ? (
                        <button onClick={() => setShowCloseNote(v => !v)} className="text-xs font-medium px-3 py-1.5 rounded-xl border border-[#E8E4DF] text-[#6B7280] hover:border-red-300 hover:text-red-600 transition-colors">
                          Close ticket
                        </button>
                      ) : (
                        <button onClick={handleReopenTicket} className="text-xs font-medium px-3 py-1.5 rounded-xl border border-[#E8E4DF] text-[#6B7280] hover:border-[#3A5A40] hover:text-[#3A5A40] transition-colors">
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  {showCloseNote && (
                    <div className="px-6 py-4 bg-red-50 border-b border-red-200 flex items-end gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-red-700 block mb-1.5">Closing note (visible to user, optional)</label>
                        <input
                          type="text" value={closeNote} onChange={e => setCloseNote(e.target.value)}
                          placeholder="e.g. Your request has been resolved. Let us know if you need further help."
                          className="w-full px-3 py-2 text-sm border border-red-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 bg-white"
                        />
                      </div>
                      <button onClick={handleCloseTicket} disabled={closingTicket}
                        className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                      >
                        {closingTicket ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        Close
                      </button>
                      <button onClick={() => setShowCloseNote(false)} className="text-[#9CA3AF] hover:text-[#374151]"><X className="w-4 h-4" /></button>
                    </div>
                  )}

                  {ticketLoading ? (
                    <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
                  ) : (
                    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-[#FAFAFA]">
                      {activeTicket.messages.map(msg => (
                        <div key={msg.id} className={cn("flex gap-3", msg.isAdmin ? "justify-start" : "justify-end")}>
                          {msg.isAdmin && (
                            <div className="w-8 h-8 rounded-full bg-[#3A5A40] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">A</div>
                          )}
                          <div className={cn("max-w-[78%] space-y-1", msg.isAdmin ? "" : "items-end flex flex-col")}>
                            <div className={cn("px-4 py-3 rounded-2xl text-sm leading-relaxed",
                              msg.isAdmin ? "bg-white border border-[#E8E4DF] rounded-tl-sm text-[#1F2937]" : "bg-[#3A5A40] text-white rounded-tr-sm"
                            )}>
                              {msg.message}
                            </div>
                            <span className="text-[11px] text-[#9CA3AF] px-1">
                              {msg.isAdmin ? "Aventum Capital" : (activeTicket.userName ?? "User")} · {formatTime(msg.createdAt)}
                            </span>
                          </div>
                          {!msg.isAdmin && (
                            <div className="w-8 h-8 rounded-full bg-[#3A5A40]/10 flex items-center justify-center text-[#3A5A40] text-xs font-bold shrink-0 mt-0.5">
                              {activeTicket.userName?.charAt(0) ?? "U"}
                            </div>
                          )}
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}

                  {activeTicket.status !== "closed" && (
                    <div className="px-5 py-4 border-t border-[#E8E4DF] bg-white">
                      <div className="flex gap-2 items-end">
                        <textarea
                          className="flex-1 px-3 py-2.5 border border-[#E8E4DF] rounded-xl text-sm bg-[#FAFAF9] focus:outline-none focus:ring-2 focus:ring-[#3A5A40]/20 resize-none min-h-[42px] max-h-28"
                          rows={1} placeholder="Reply to this ticket…" value={adminReply} onChange={e => setAdminReply(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAdminReply(); } }}
                        />
                        <button onClick={handleAdminReply} disabled={sendingReply || !adminReply.trim()}
                          className="w-10 h-10 rounded-xl bg-[#3A5A40] hover:bg-[#2D4A32] disabled:opacity-50 flex items-center justify-center shrink-0 text-white transition-colors"
                        >
                          {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <SectionHeader
                    title="Support Tickets" sub="All member support requests — general, exit requests, and group deletions"
                    onRefresh={loadSupport} loading={supportLoading}
                    action={
                      <div className="flex gap-1.5 flex-wrap">
                        <div className="flex gap-1">
                          {(["all", "open", "in_progress", "closed"] as const).map(f => (
                            <button key={f} onClick={() => setSupportFilter(f)}
                              className={cn("px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition-colors",
                                supportFilter === f ? "bg-[#3A5A40] text-white" : "bg-white border border-[#E8E4DF] text-[#6B7280] hover:border-[#3A5A40]/30"
                              )}
                            >{f.replace("_", " ")}</button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          {["all", "general", "exit_request", "group_deletion", "payment", "other"].map(f => (
                            <button key={f} onClick={() => setCategoryFilter(f)}
                              className={cn("px-2.5 py-1 text-xs font-medium rounded-lg capitalize transition-colors",
                                categoryFilter === f ? "bg-[#1C3229] text-white" : "bg-white border border-[#E8E4DF] text-[#6B7280] hover:border-[#1C3229]/30"
                              )}
                            >{f.replace("_", " ")}</button>
                          ))}
                        </div>
                      </div>
                    }
                  />
                  {supportLoading ? (
                    <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
                  ) : filteredTickets.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-[#E8E4DF] p-8">
                      <EmptyState icon={MessageCircle} title="No tickets found" sub="Support tickets from members will appear here." />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredTickets.map(ticket => {
                        const m = categoryMeta(ticket.category);
                        const Icon = m.icon;
                        const isUrgent = (ticket.priority === "high" || ticket.priority === "urgent") && ticket.status !== "closed";
                        return (
                          <button key={ticket.id} onClick={() => openTicket(ticket.id)}
                            className={cn(
                              "w-full bg-white rounded-2xl border p-4 flex items-start gap-4 text-left transition-all hover:shadow-sm group",
                              isUrgent ? "border-amber-200 hover:border-amber-300" : "border-[#E8E4DF] hover:border-[#3A5A40]/40"
                            )}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${m.color}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="font-medium text-sm text-[#1F2937] truncate">{ticket.subject}</span>
                                {ticket.unreadCount > 0 && (
                                  <span className="shrink-0 text-[10px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded-full">{ticket.unreadCount} new</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[#9CA3AF] flex-wrap">
                                <span className="font-medium text-[#374151]">{ticket.userName}</span>
                                <span>·</span>
                                <Badge status={ticket.status} />
                                <span>·</span>
                                <span>{formatTime(ticket.updatedAt)}</span>
                                {ticket.groupName && <><span>·</span><span className="truncate">{ticket.groupName}</span></>}
                                <span>·</span>
                                <span>{ticket.messageCount} message{ticket.messageCount !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[#9CA3AF] shrink-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── SWAP REQUESTS ──────────────────────────────────────── */}
          {section === "swap-requests" && (
            <div>
              <SectionHeader title="Turn Swap Requests" sub="Members requesting to swap their rotation positions" onRefresh={loadSwapRequests} loading={swapLoading} />
              {swapLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#3A5A40]" /></div>
              ) : swapRequests.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#E8E4DF] p-8"><EmptyState icon={ArrowLeftRight} title="No swap requests" sub="Rotation swap requests will appear here." /></div>
              ) : (
                <div className="space-y-4">
                  {swapRequests.filter(r => r.status === "pending").map(req => (
                    <div key={req.id} className="bg-white rounded-2xl border border-blue-200 overflow-hidden">
                      <div className="bg-blue-50 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><ArrowLeftRight className="w-4 h-4 text-blue-600" /></div>
                          <div>
                            <div className="text-sm font-semibold text-[#1F2937] flex items-center gap-2">{req.requesterName} <ArrowLeftRight className="w-3.5 h-3.5 text-[#9CA3AF]" /> {req.targetMemberName}</div>
                            <div className="text-xs text-[#9CA3AF]">{req.groupName ?? `Group #${req.groupId}`} · {formatDate(req.createdAt)}</div>
                          </div>
                        </div>
                        <Badge status="pending" />
                      </div>
                      <div className="px-6 py-5 space-y-3">
                        {req.reason && <div className="bg-[#FAFAF9] rounded-xl px-4 py-3"><p className="text-sm text-[#374151] italic">"{req.reason}"</p></div>}
                        <div className="flex gap-2">
                          <button onClick={() => handleSwapAction(req.id, "approve")} disabled={swapActionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-2 bg-[#3A5A40] hover:bg-[#2D4A32] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            {swapActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve & Swap
                          </button>
                          <button onClick={() => handleSwapAction(req.id, "deny")} disabled={swapActionLoading === req.id}
                            className="flex-1 flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-60"
                          >
                            {swapActionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Deny
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
                            <td className="px-5 py-3.5"><div className="text-sm font-medium flex items-center gap-1.5">{req.requesterName} <ArrowLeftRight className="w-3 h-3 text-[#9CA3AF]" /> {req.targetMemberName}</div></td>
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

          {/* ── AUDIT LOG ──────────────────────────────────────────── */}
          {section === "audit-logs" && (
            <div>
              <SectionHeader title="Audit Log" sub="Every significant platform action, immutable and timestamped" />
              <DataTable headers={["Action", "Performed by", "Target", "Details", "Timestamp"]}>
                {((auditLogs as any)?.logs ?? []).map((log: any) => (
                  <tr key={log.id} className="hover:bg-[#FAFAF9] transition-colors">
                    <td className="px-5 py-3.5"><code className="text-xs bg-[#F0F5F1] text-[#3A5A40] px-2 py-1 rounded-lg font-mono font-semibold">{log.action}</code></td>
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
