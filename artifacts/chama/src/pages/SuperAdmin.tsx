import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAdminStats,
  useListUsers,
  useListAllContributions,
  useListAllPayouts,
  useListAuditLogs,
  useCompletePayout,
  useTriggerPayout,
  getGetAdminStatsQueryKey,
  getListUsersQueryKey,
  getListAllContributionsQueryKey,
  getListAllPayoutsQueryKey,
  getListAuditLogsQueryKey,
} from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { useRegion } from "@/contexts/RegionContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Loader2, Users, CreditCard, DollarSign, Activity, Shield, LogOut, Clock, CheckCircle2, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = ["Overview", "Users", "Contributions", "Payouts", "Exit Requests", "Swap Requests", "Audit Logs"] as const;
type Tab = typeof TABS[number];

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

interface AdminSwapReq {
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

export default function SuperAdmin() {
  const { formatCurrency, formatDate, formatDateTime } = useRegion();
  const [tab, setTab] = useState<Tab>("Overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [exitRequests, setExitRequests] = useState<ExitReq[]>([]);
  const [exitLoading, setExitLoading] = useState(false);
  const [exitActionLoading, setExitActionLoading] = useState<number | null>(null);
  const [exitNotes, setExitNotes] = useState<Record<number, string>>({});

  const [swapRequests, setSwapRequests] = useState<AdminSwapReq[]>([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapActionLoading, setSwapActionLoading] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: users, isLoading: usersLoading } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() }, enabled: tab === "Users" });
  const { data: contribs } = useListAllContributions({}, { query: { queryKey: getListAllContributionsQueryKey() }, enabled: tab === "Contributions" });
  const { data: payouts } = useListAllPayouts({}, { query: { queryKey: getListAllPayoutsQueryKey() }, enabled: tab === "Payouts" });
  const { data: auditLogs } = useListAuditLogs({}, { query: { queryKey: getListAuditLogsQueryKey() }, enabled: tab === "Audit Logs" });

  const loadExitRequests = useCallback(async () => {
    setExitLoading(true);
    try {
      const data = await apiRequest<ExitReq[]>("/api/exit-requests/all");
      setExitRequests(data);
    } catch {}
    setExitLoading(false);
  }, []);

  const loadSwapRequests = useCallback(async () => {
    setSwapLoading(true);
    try {
      const data = await apiRequest<AdminSwapReq[]>("/api/admin/swap-requests");
      setSwapRequests(data);
    } catch {}
    setSwapLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "Exit Requests") loadExitRequests();
    if (tab === "Swap Requests") loadSwapRequests();
  }, [tab, loadExitRequests, loadSwapRequests]);

  const handleSwapAction = async (id: number, action: "approve" | "deny") => {
    setSwapActionLoading(id);
    try {
      await apiRequest(`/api/swap-requests/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      });
      toast({ title: action === "approve" ? "Swap approved" : "Swap denied", description: action === "approve" ? "Rotation positions have been swapped." : undefined });
      await loadSwapRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Action failed", variant: "destructive" });
    } finally {
      setSwapActionLoading(null);
    }
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
    } finally {
      setExitActionLoading(null);
    }
  };

  const completePayout = useCompletePayout({
    mutation: {
      onSuccess: () => {
        toast({ title: "Payout completed!" });
        queryClient.invalidateQueries({ queryKey: getListAllPayoutsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAdminStatsQueryKey() });
      },
    },
  });

  const s = stats as any;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Super Admin Panel</h1>
            <p className="text-muted-foreground text-sm">Platform-wide oversight and controls</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "Overview" && (
          <div>
            {statsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: s?.totalUsers ?? 0, icon: Users, color: "text-blue-500 bg-blue-500/10" },
                  { label: "Total Groups", value: s?.totalGroups ?? 0, icon: Activity, color: "text-primary bg-primary/10" },
                  { label: "Active Groups", value: s?.activeGroups ?? 0, icon: Activity, color: "text-green-500 bg-green-500/10" },
                  { label: "Organizations", value: s?.totalOrganizations ?? 0, icon: Shield, color: "text-purple-500 bg-purple-500/10" },
                  { label: "Total Contributed", value: formatCurrency(s?.totalContributed ?? 0), icon: CreditCard, color: "text-primary bg-primary/10" },
                  { label: "Total Paid Out", value: formatCurrency(s?.totalPaidOut ?? 0), icon: DollarSign, color: "text-green-500 bg-green-500/10" },
                  { label: "Pending Payouts", value: s?.pendingPayouts ?? 0, icon: DollarSign, color: "text-amber-500 bg-amber-500/10" },
                  { label: "Failed Transactions", value: s?.failedTransactions ?? 0, icon: Shield, color: "text-destructive bg-destructive/10" },
                ].map(stat => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-card border border-border rounded-xl p-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stat.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      </div>
                      <div className="text-xl font-bold">{stat.value}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* USERS */}
        {tab === "Users" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border"><h3 className="font-semibold">All Users</h3></div>
            {usersLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Name</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Role</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {((users as any)?.users ?? []).map((u: any) => (
                      <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium">{u.name}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{u.email}</td>
                        <td className="px-5 py-4 text-sm capitalize">{u.role.replace("_", " ")}</td>
                        <td className="px-5 py-4"><StatusBadge status={u.isActive ? "active" : "paused"} /></td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* CONTRIBUTIONS */}
        {tab === "Contributions" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border"><h3 className="font-semibold">All Contributions</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">User</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Group</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((contribs as any)?.contributions ?? []).map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4 text-sm">{c.user?.name ?? `User #${c.userId}`}</td>
                      <td className="px-5 py-4 text-sm font-semibold">{formatCurrency(c.amount)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">Group #{c.groupId}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(c.createdAt)}</td>
                      <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PAYOUTS */}
        {tab === "Payouts" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border"><h3 className="font-semibold">All Payouts</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Recipient</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Group</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((payouts as any)?.payouts ?? []).map((p: any) => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4 text-sm">{p.recipient?.name ?? `User #${p.recipientId}`}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-primary">{formatCurrency(p.amount)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{p.group?.name ?? `Group #${p.groupId}`}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(p.createdAt)}</td>
                      <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                      <td className="px-5 py-4">
                        {p.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => completePayout.mutate({ payoutId: p.id })}
                            disabled={completePayout.isPending}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EXIT REQUESTS */}
        {tab === "Exit Requests" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Member Exit Requests</h3>
                <p className="text-sm text-muted-foreground mt-0.5">Review and action group exit requests across the platform</p>
              </div>
              <Button size="sm" variant="outline" onClick={loadExitRequests} disabled={exitLoading}>
                {exitLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Refresh
              </Button>
            </div>

            {exitLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : exitRequests.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <LogOut className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No exit requests</p>
                <p className="text-muted-foreground text-sm mt-1">Members' exit requests will appear here for review</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Pending first */}
                {exitRequests.filter(r => r.status === "pending").length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pending Review</h4>
                    <div className="space-y-3">
                      {exitRequests.filter(r => r.status === "pending").map(req => (
                        <div key={req.id} className="bg-card border border-amber-200 rounded-xl p-5">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-amber-600" />
                              </div>
                              <div>
                                <div className="font-medium text-sm">{req.userName ?? "Unknown Member"}</div>
                                <div className="text-xs text-muted-foreground">{req.userEmail}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-muted-foreground">{req.groupName ?? `Group #${req.groupId}`}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{formatDate(req.createdAt)}</div>
                            </div>
                          </div>

                          {req.reason && (
                            <div className="mb-3 px-3 py-2 bg-muted/40 rounded-lg">
                              <p className="text-xs text-muted-foreground italic">"{req.reason}"</p>
                            </div>
                          )}

                          {req.autoApproveAfterCycle && (
                            <p className="text-xs text-blue-600 mb-3">
                              Member has received payout — eligible for auto-approval after cycle {req.autoApproveAfterCycle}
                            </p>
                          )}

                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Add a note to the member (optional)..."
                              className="w-full px-3 py-2 text-xs border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                              value={exitNotes[req.id] ?? ""}
                              onChange={e => setExitNotes(n => ({ ...n, [req.id]: e.target.value }))}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1 bg-[#3A5A40] hover:bg-[#344E41] text-xs"
                                onClick={() => handleExitAction(req.id, "approve")}
                                disabled={exitActionLoading === req.id}
                              >
                                {exitActionLoading === req.id && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                Approve & Remove Member
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-xs border-destructive text-destructive hover:bg-destructive/5"
                                onClick={() => handleExitAction(req.id, "deny")}
                                disabled={exitActionLoading === req.id}
                              >
                                {exitActionLoading === req.id && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                                Deny Request
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolved */}
                {exitRequests.filter(r => r.status !== "pending").length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Resolved</h4>
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Member</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Group</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Note</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Resolved</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {exitRequests.filter(r => r.status !== "pending").map(req => (
                            <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium">{req.userName}</div>
                                <div className="text-xs text-muted-foreground">{req.userEmail}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{req.groupName ?? `Group #${req.groupId}`}</td>
                              <td className="px-4 py-3">
                                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", {
                                  "bg-green-100 text-green-700": req.status === "approved" || req.status === "auto_approved",
                                  "bg-red-100 text-red-700": req.status === "denied",
                                })}>
                                  {req.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{req.reviewNote ?? "—"}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(req.reviewedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SWAP REQUESTS */}
        {tab === "Swap Requests" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Turn Swap Requests</h3>
              {swapRequests.filter(r => r.status === "pending").length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {swapRequests.filter(r => r.status === "pending").length} pending
                </span>
              )}
            </div>
            {swapLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : swapRequests.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center">
                <ArrowLeftRight className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
                <p className="text-muted-foreground text-sm">No swap requests yet</p>
              </div>
            ) : (
              <>
                {/* Pending */}
                {swapRequests.filter(r => r.status === "pending").length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pending Review</h4>
                    <div className="space-y-3">
                      {swapRequests.filter(r => r.status === "pending").map(req => (
                        <div key={req.id} className="bg-card border border-amber-200 rounded-xl p-5 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2">
                                <span>{req.requesterName ?? "Unknown"}</span>
                                <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>{req.targetMemberName ?? "Unknown"}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Group: {req.groupName ?? `#${req.groupId}`} • {formatDate(req.createdAt)}
                              </div>
                            </div>
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">pending</span>
                          </div>
                          {req.reason && (
                            <div className="px-3 py-2 bg-muted/40 rounded-lg">
                              <p className="text-xs text-muted-foreground italic">"{req.reason}"</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 bg-[#3A5A40] hover:bg-[#344E41] text-xs"
                              onClick={() => handleSwapAction(req.id, "approve")}
                              disabled={swapActionLoading === req.id}
                            >
                              {swapActionLoading === req.id && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                              Approve & Swap
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs border-destructive text-destructive hover:bg-destructive/5"
                              onClick={() => handleSwapAction(req.id, "deny")}
                              disabled={swapActionLoading === req.id}
                            >
                              {swapActionLoading === req.id && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
                              <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                              Deny
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolved */}
                {swapRequests.filter(r => r.status !== "pending").length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4">Resolved</h4>
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Requester → Target</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Group</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {swapRequests.filter(r => r.status !== "pending").map(req => (
                            <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium flex items-center gap-1.5">
                                  {req.requesterName}
                                  <ArrowLeftRight className="w-3 h-3 text-muted-foreground" />
                                  {req.targetMemberName}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{req.groupName ?? `#${req.groupId}`}</td>
                              <td className="px-4 py-3">
                                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", {
                                  "bg-green-100 text-green-700": req.status === "approved",
                                  "bg-red-100 text-red-700": req.status === "denied",
                                  "bg-muted text-muted-foreground": req.status === "cancelled",
                                })}>
                                  {req.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(req.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* AUDIT LOGS */}
        {tab === "Audit Logs" && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-5 border-b border-border"><h3 className="font-semibold">Audit Logs</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Action</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Performed by</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Target</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Details</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {((auditLogs as any)?.logs ?? []).map((log: any) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{log.action}</code>
                      </td>
                      <td className="px-5 py-4 text-sm">{log.user?.name ?? `User #${log.performedBy}`}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground capitalize">{log.targetType}{log.targetId ? ` #${log.targetId}` : ""}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{log.details ?? "—"}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDateTime(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
