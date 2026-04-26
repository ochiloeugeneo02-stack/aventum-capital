import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ContributionPaymentDialog } from "@/components/ContributionPaymentDialog";
import { useRegion } from "@/contexts/RegionContext";
import { CreditCard, DollarSign, TrendingUp, Clock, Loader2, Users } from "lucide-react";

export default function Dashboard() {
  const { region, formatCurrency, formatGroupAmount, formatDate } = useRegion();
  const queryClient = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data, isLoading, error } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() },
  });

  const handlePay = () => {
    if (!data?.currentGroup || !data?.cycleId) return;
    setPaymentOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center text-muted-foreground py-16">Failed to load dashboard data.</div>
      </DashboardLayout>
    );
  }

  const summary = data as any;
  const contributionPaid = summary?.contributionStatus === "paid";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {summary?.user?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground text-sm mt-1">Here's an overview of your savings activity</p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Total Contributed</span>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary?.totalContributed ?? 0)}</div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Current Group</span>
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-accent-foreground" />
              </div>
            </div>
            <div className="text-lg font-semibold truncate">{summary?.currentGroup?.name ?? "No group"}</div>
            {summary?.currentGroup && (
              <div className="text-xs text-muted-foreground mt-1">{summary.currentGroup.totalMembers} members</div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">This Cycle</span>
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-green-600" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={summary?.contributionStatus ?? "none"} />
            </div>
            {summary?.currentGroup && (
              <div className="text-xs text-muted-foreground mt-1">
                {formatGroupAmount(summary.currentGroup.contributionAmount, (summary.currentGroup as any).currency ?? "USD")} due
              </div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Next Due Date</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-sm font-semibold">{formatDate(summary?.nextDueDate)}</div>
          </div>
        </div>

        {/* Group action & upcoming recipient */}
        {summary?.currentGroup && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-1">Pay Contribution</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Contribute {formatGroupAmount(summary.currentGroup.contributionAmount, (summary.currentGroup as any).currency ?? "USD")} for Cycle {summary.currentGroup.currentCycle}
              </p>
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Group progress</span>
                  <span>{summary.currentGroup.paidCount}/{summary.currentGroup.totalMembers} paid</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(summary.currentGroup.paidCount / Math.max(summary.currentGroup.totalMembers, 1)) * 100}%` }}
                  />
                </div>
              </div>
              {!contributionPaid ? (
                <Button
                  className="w-full"
                  onClick={handlePay}
                  disabled={!summary.cycleId}
                >
                  Pay {formatGroupAmount(summary.currentGroup.contributionAmount, (summary.currentGroup as any).currency ?? "USD")}
                </Button>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  Paid for this cycle
                </Button>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-semibold mb-1">Upcoming Payout Recipient</h3>
              <p className="text-sm text-muted-foreground mb-4">Who gets paid when everyone contributes</p>
              {summary.upcomingRecipient ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {summary.upcomingRecipient.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-semibold">{summary.upcomingRecipient.name}</div>
                    <div className="text-sm text-muted-foreground">Will receive {formatGroupAmount((summary.currentGroup.contributionAmount ?? 0) * (summary.currentGroup.totalMembers ?? 0), (summary.currentGroup as any).currency ?? "USD")}</div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No recipient determined yet</p>
              )}
            </div>
          </div>
        )}

        {/* Recent contributions */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold">Recent Contributions</h3>
          </div>
          <div className="divide-y divide-border">
            {summary?.recentContributions?.length > 0 ? (
              summary.recentContributions.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-sm font-medium">{formatCurrency(c.amount)}</div>
                    <div className="text-xs text-muted-foreground">Cycle {c.cycleId} — {formatDate(c.createdAt)}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No contributions yet</div>
            )}
          </div>
        </div>

        {/* Recent payouts */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold">Payout History</h3>
          </div>
          <div className="divide-y divide-border">
            {summary?.recentPayouts?.length > 0 ? (
              summary.recentPayouts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Received {formatCurrency(p.amount)}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</div>
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No payouts yet</div>
            )}
          </div>
        </div>
        {summary?.currentGroup && (
          <ContributionPaymentDialog
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            groupId={summary.currentGroup.id}
            cycleId={summary.cycleId}
            amountLabel={formatGroupAmount(summary.currentGroup.contributionAmount, (summary.currentGroup as any).currency ?? "USD")}
            groupName={summary.currentGroup.name}
            currency={region.currency}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
