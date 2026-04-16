import { useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import { apiRequest } from "@/lib/api";
import { Loader2, Users, LogOut, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const EXIT_TERMS = [
  "I understand I must continue contributing for the full current savings cycle before my exit can be processed.",
  "I acknowledge that leaving mid-cycle may disrupt other members' payouts and that my exit is subject to admin review.",
  "I confirm that once approved, my rotation slot and any future payout eligibility in this group will be forfeited.",
  "If I have already received my rotation payout, my exit may be automatically approved once the current cycle completes.",
  "Aventum Capital reserves the right to deny my exit request if it would negatively impact the group's operations.",
];

type ExitRequestStatus = "none" | "pending" | "approved" | "denied" | "auto_approved";

interface MyExitRequest {
  id: number;
  status: ExitRequestStatus;
  reviewNote: string | null;
  autoApproveAfterCycle: number | null;
  createdAt: string;
}

export default function GroupDetail() {
  const { formatGroupAmount, formatDate } = useRegion();
  const [, params] = useRoute("/groups/:id");
  const groupId = parseInt(params?.id ?? "0", 10);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showExitModal, setShowExitModal] = useState(false);
  const [exitReason, setExitReason] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);
  const [submittingExit, setSubmittingExit] = useState(false);
  const [myExitRequest, setMyExitRequest] = useState<MyExitRequest | null>(null);
  const [exitRequestLoaded, setExitRequestLoaded] = useState(false);

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

  useEffect(() => {
    if (!groupId || !user) return;
    (async () => {
      try {
        const requests = await apiRequest<MyExitRequest[]>("/api/exit-requests/mine");
        const mine = requests.find(r => r.groupId === groupId) ?? null;
        setMyExitRequest(mine as any);
      } catch {}
      setExitRequestLoaded(true);
    })();
  }, [groupId, user]);

  const handleSubmitExit = async () => {
    if (!termsChecked) return;
    setSubmittingExit(true);
    try {
      const result = await apiRequest<any>(`/api/groups/${groupId}/exit-request`, {
        method: "POST",
        body: JSON.stringify({ reason: exitReason || undefined, termsAccepted: true }),
        headers: { "Content-Type": "application/json" },
      });
      setMyExitRequest({ id: result.id, status: "pending", reviewNote: null, autoApproveAfterCycle: result.autoApproveAfterCycle, createdAt: new Date().toISOString() });
      setShowExitModal(false);
      setExitReason("");
      setTermsChecked(false);
      toast({ title: "Exit request submitted", description: result.message });
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not submit exit request", variant: "destructive" });
    } finally {
      setSubmittingExit(false);
    }
  };

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
  const isAdmin = g.adminId === user?.id;

  const handlePay = () => {
    if (!g.id) return;
    payMutation.mutate({ data: { groupId: g.id, cycleId: g.currentCycle } });
  };

  const exitStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: "Exit request pending admin review", color: "text-amber-700 bg-amber-50 border-amber-200", icon: Clock },
    approved: { label: "Your exit request was approved", color: "text-green-700 bg-green-50 border-green-200", icon: CheckCircle2 },
    denied: { label: "Your exit request was denied", color: "text-red-700 bg-red-50 border-red-200", icon: AlertTriangle },
    auto_approved: { label: "Your exit was auto-approved after cycle completion", color: "text-blue-700 bg-blue-50 border-blue-200", icon: CheckCircle2 },
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

        {/* Exit request status banner */}
        {exitRequestLoaded && myExitRequest && myExitRequest.status !== "none" && (
          <div className={cn("flex items-start gap-3 p-4 rounded-xl border text-sm", exitStatusConfig[myExitRequest.status]?.color)}>
            {(() => { const Icon = exitStatusConfig[myExitRequest.status]?.icon; return Icon ? <Icon className="w-4 h-4 mt-0.5 shrink-0" /> : null; })()}
            <div>
              <p className="font-medium">{exitStatusConfig[myExitRequest.status]?.label}</p>
              {myExitRequest.autoApproveAfterCycle && myExitRequest.status === "pending" && (
                <p className="text-xs mt-0.5 opacity-80">Will auto-approve after cycle {myExitRequest.autoApproveAfterCycle} completes</p>
              )}
              {myExitRequest.reviewNote && (
                <p className="text-xs mt-0.5 opacity-80">Note: {myExitRequest.reviewNote}</p>
              )}
            </div>
          </div>
        )}

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

        {/* Leave group — only non-admin members with no active exit request */}
        {!isAdmin && myMembership && exitRequestLoaded && !myExitRequest && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-destructive">Leave this group</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Submit a request to exit. You must complete your contribution obligations before leaving.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/5 gap-2 shrink-0"
                onClick={() => setShowExitModal(true)}
              >
                <LogOut className="w-4 h-4" />
                Request to leave
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Exit request modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <h2 className="text-lg font-bold">Request to leave group</h2>
              </div>
              <p className="text-sm text-muted-foreground ml-13">
                Your request will be reviewed by the group admin. Please read and agree to the terms below.
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Terms of Service */}
              <div className="bg-muted/40 rounded-xl p-4 border border-border">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Terms & Conditions for Group Exit
                </h3>
                <ul className="space-y-2.5">
                  {EXIT_TERMS.map((term, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
                      <span className="w-4 h-4 rounded-full bg-border flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {term}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason for leaving (optional)</label>
                <textarea
                  className="w-full h-20 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Tell us why you want to leave..."
                  value={exitReason}
                  onChange={e => setExitReason(e.target.value)}
                />
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={termsChecked}
                    onChange={e => setTermsChecked(e.target.checked)}
                    className="w-4 h-4 accent-[#3A5A40]"
                  />
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">
                  I have read and agree to the terms above. I understand my exit is subject to admin approval and that I must fulfil my contribution obligations for the current cycle.
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="p-6 border-t border-border flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowExitModal(false); setExitReason(""); setTermsChecked(false); }}
                disabled={submittingExit}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-destructive hover:bg-destructive/90"
                disabled={!termsChecked || submittingExit}
                onClick={handleSubmitExit}
              >
                {submittingExit && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Submit exit request
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
