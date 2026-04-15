import { useState } from "react";
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
import { Loader2, Users, CreditCard, DollarSign, Activity, Shield } from "lucide-react";

const TABS = ["Overview", "Users", "Contributions", "Payouts", "Audit Logs"] as const;
type Tab = typeof TABS[number];

export default function SuperAdmin() {
  const { formatCurrency, formatDate, formatDateTime } = useRegion();
  const [tab, setTab] = useState<Tab>("Overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: users, isLoading: usersLoading } = useListUsers({}, { query: { queryKey: getListUsersQueryKey() }, enabled: tab === "Users" });
  const { data: contribs } = useListAllContributions({}, { query: { queryKey: getListAllContributionsQueryKey() }, enabled: tab === "Contributions" });
  const { data: payouts } = useListAllPayouts({}, { query: { queryKey: getListAllPayoutsQueryKey() }, enabled: tab === "Payouts" });
  const { data: auditLogs } = useListAuditLogs({}, { query: { queryKey: getListAuditLogsQueryKey() }, enabled: tab === "Audit Logs" });

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
