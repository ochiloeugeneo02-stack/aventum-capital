import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetGroup,
  usePayContribution,
  getGetGroupQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useRegion } from "@/contexts/RegionContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users } from "lucide-react";

export default function GroupDetail() {
  const { formatGroupAmount, formatDate } = useRegion();
  const [, params] = useRoute("/groups/:id");
  const groupId = parseInt(params?.id ?? "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: group, isLoading } = useGetGroup(groupId, {
    query: { queryKey: getGetGroupQueryKey(groupId), enabled: !!groupId },
  });

  const payMutation = usePayContribution({
    mutation: {
      onSuccess: () => {
        toast({ title: "Contribution paid!", description: "Your payment has been recorded." });
        queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(groupId) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
      onError: (e: any) => {
        toast({ title: "Payment failed", description: e?.response?.data?.error ?? "Could not process payment", variant: "destructive" });
      },
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 text-muted-foreground">Group not found.</div>
      </DashboardLayout>
    );
  }

  const g = group as any;
  const myMembership = g.members?.find((m: any) => m.userId === user?.id);
  const myStatus = myMembership?.contributionStatus ?? "none";
  const totalPayout = g.contributionAmount * g.members?.length;

  const handlePay = () => {
    if (!g.id) return;
    const cycle = g.currentCycle;
    payMutation.mutate({ data: { groupId: g.id, cycleId: cycle } });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{g.name}</h1>
            <p className="text-muted-foreground text-sm mt-1 capitalize">{g.schedule} contributions • Cycle {g.currentCycle}</p>
          </div>
          <StatusBadge status={g.status} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Contribution", value: formatGroupAmount(g.contributionAmount, g.currency ?? "KES") },
            { label: "Pool size", value: formatGroupAmount(totalPayout, g.currency ?? "KES") },
            { label: "Members", value: `${g.totalMembers}/${g.maxMembers}` },
            { label: "Paid this cycle", value: `${g.paidCount}/${g.totalMembers}` },
          ].map(stat => (
            <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="text-xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Cycle progress</span>
            <span className="text-muted-foreground">{g.paidCount} of {g.totalMembers} members paid</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(g.paidCount / Math.max(g.totalMembers, 1)) * 100}%` }}
            />
          </div>
          {g.nextDueDate && (
            <p className="text-xs text-muted-foreground mt-2">Due by {formatDate(g.nextDueDate)}</p>
          )}
        </div>

        {/* Two column: pay + recipient */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Your Contribution</h3>
            <p className="text-sm text-muted-foreground mb-3">Pay for the current cycle to keep the rotation going</p>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-muted-foreground">Status:</span>
              <StatusBadge status={myStatus} />
            </div>
            {myStatus !== "paid" ? (
              <Button className="w-full" onClick={handlePay} disabled={payMutation.isPending || g.status !== "active"}>
                {payMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Pay {formatGroupAmount(g.contributionAmount, g.currency ?? "KES")}
              </Button>
            ) : (
              <Button variant="outline" className="w-full" disabled>Paid for this cycle</Button>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold mb-1">Current Recipient</h3>
            <p className="text-sm text-muted-foreground mb-3">Who receives the payout when all members pay</p>
            {g.currentRecipient ? (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {g.currentRecipient.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div className="font-medium">{g.currentRecipient.name}</div>
                  <div className="text-sm text-muted-foreground">Will receive {formatGroupAmount(totalPayout, g.currency ?? "KES")}</div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No recipient yet</p>
            )}
          </div>
        </div>

        {/* Members list */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Members & Rotation Order</h3>
          </div>
          <div className="divide-y divide-border">
            {g.members?.length > 0 ? (
              g.members.map((member: any, idx: number) => (
                <div key={member.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {idx + 1}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold">
                      {member.user?.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{member.user?.name ?? "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{member.user?.email}</div>
                    </div>
                    {member.rotationOrder === g.currentRotationIndex && (
                      <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-0.5 rounded-full">Next</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {member.hasReceivedPayout && (
                      <span className="text-xs text-muted-foreground">Received payout</span>
                    )}
                    <StatusBadge status={member.contributionStatus} />
                  </div>
                </div>
              ))
            ) : (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">No members</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
