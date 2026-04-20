import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListGroups,
  useCreateGroup,
  useInviteMember,
  usePauseGroup,
  useResumeGroup,
  useGetGroupMembers,
  getListGroupsQueryKey,
  getGetGroupMembersQueryKey,
} from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { useRegion, REGIONS } from "@/contexts/RegionContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { Loader2, Plus, Users, Copy, Check, Mail, Link2, LogOut, Clock, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, ArrowLeftRight, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusBadgeSmall({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    paused: "bg-amber-100 text-amber-700",
    completed: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", map[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

function InviteLinkBox({ url, email }: { url: string; email: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 p-4 bg-[#3A5A40]/5 border border-[#3A5A40]/20 rounded-xl space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[#344E41]">
        <Link2 className="w-4 h-4" />
        Invitation link created for <span className="font-semibold">{email}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        They haven't registered yet — share this link so they can sign up and join the group directly.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={url} className="font-mono text-xs flex-1" />
        <Button size="sm" variant="outline" onClick={copy} className="gap-1.5 shrink-0">
          {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Mail className="w-3.5 h-3.5" />
        An invitation email was also sent if SMTP is configured.
      </p>
    </div>
  );
}

function GroupMembersList({ groupId }: { groupId: number }) {
  const { data } = useGetGroupMembers(groupId, { query: { queryKey: getGetGroupMembersQueryKey(groupId) } });
  const members = (data as any[]) ?? [];
  return (
    <div className="mt-3 space-y-2">
      {members.map((m: any) => (
        <div key={m.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {m.user?.name?.charAt(0) ?? "?"}
            </div>
            <div>
              <div className="text-sm font-medium">{m.user?.name}</div>
              <div className="text-xs text-muted-foreground">Order #{m.rotationOrder + 1}</div>
            </div>
          </div>
          <StatusBadge status={m.contributionStatus} />
        </div>
      ))}
    </div>
  );
}

interface ExitReq {
  id: number;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  status: string;
  reason: string | null;
  reviewNote: string | null;
  autoApproveAfterCycle: number | null;
  createdAt: string;
}

function GroupExitRequests({ groupId }: { groupId: number }) {
  const [requests, setRequests] = useState<ExitReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      const data = await apiRequest<ExitReq[]>(`/api/groups/${groupId}/exit-requests`);
      setRequests(data);
    } catch {}
    setLoading(false);
  }, [groupId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const pending = requests.filter(r => r.status === "pending");

  if (loading) return null;
  if (requests.length === 0) return null;

  const statusIcon = (s: string) => {
    if (s === "pending") return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    if (s === "approved" || s === "auto_approved") return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <LogOut className="w-4 h-4 text-destructive" />
        <span className="text-sm font-medium">Exit Requests</span>
        {pending.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pending.length} pending</span>
        )}
        <span className="ml-auto text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Info banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-700">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Approval handled by Aventum Capital</p>
              <p className="opacity-80 mt-0.5">Exit requests are reviewed by the platform team. Contact support if a member needs urgent assistance.</p>
            </div>
          </div>

          {[...pending, ...requests.filter(r => r.status !== "pending")].map(req => (
            <div key={req.id} className={cn("rounded-xl border p-4 space-y-2", req.status === "pending" ? "border-amber-200 bg-amber-50/40" : "border-border bg-muted/20")}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {statusIcon(req.status)}
                  <div>
                    <div className="text-sm font-medium">{req.userName ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{req.userEmail}</div>
                  </div>
                </div>
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", {
                  "bg-amber-100 text-amber-700": req.status === "pending",
                  "bg-green-100 text-green-700": req.status === "approved" || req.status === "auto_approved",
                  "bg-red-100 text-red-700": req.status === "denied",
                })}>
                  {req.status.replace("_", " ")}
                </span>
              </div>

              {req.reason && (
                <p className="text-xs text-muted-foreground italic">"{req.reason}"</p>
              )}

              {req.autoApproveAfterCycle && req.status === "pending" && (
                <p className="text-xs text-blue-600">Eligible for auto-approval after cycle {req.autoApproveAfterCycle}</p>
              )}

              {req.reviewNote && (
                <p className="text-xs text-muted-foreground">Note: {req.reviewNote}</p>
              )}

              {req.status === "pending" && (
                <a
                  href="mailto:info@aventumcapital.com?subject=Exit Request Support"
                  className="inline-flex items-center gap-1.5 text-xs text-[#3A5A40] font-medium hover:underline mt-1"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Contact Aventum support about this request
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SwapReq {
  id: number;
  requesterId: number;
  targetMemberId: number;
  requesterName: string | null;
  targetMemberName?: string | null;
  reason: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

function GroupSwapRequests({ groupId }: { groupId: number }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<SwapReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const data = await apiRequest<SwapReq[]>(`/api/groups/${groupId}/swap-requests`);
      setRequests(data);
    } catch {}
    setLoading(false);
  }, [groupId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleApprove = async (id: number) => {
    setProcessingId(id);
    try {
      await apiRequest(`/api/swap-requests/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      toast({ title: "Swap approved", description: "The rotation positions have been swapped." });
      loadRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not approve", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (id: number) => {
    setProcessingId(id);
    try {
      await apiRequest(`/api/swap-requests/${id}/deny`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      toast({ title: "Swap denied" });
      loadRequests();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not deny", variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null;

  const pending = requests.filter(r => r.status === "pending");

  return (
    <div className="border-t border-border pt-4 mt-4">
      <button
        className="flex items-center gap-2 w-full text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <ArrowLeftRight className="w-4 h-4 text-[#3A5A40]" />
        <span className="text-sm font-medium">Turn Swap Requests</span>
        {pending.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{pending.length} pending</span>
        )}
        <span className="ml-auto text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {[...pending, ...requests.filter(r => r.status !== "pending")].map(req => (
            <div key={req.id} className={cn(
              "rounded-xl border p-4 space-y-2",
              req.status === "pending" ? "border-amber-200 bg-amber-50/40" : "border-border bg-muted/20"
            )}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">
                    {req.requesterName ?? "Unknown"}
                    <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
                    {req.targetMemberName ?? "Unknown"}
                  </div>
                  <div className="text-xs text-muted-foreground">Swap rotation positions</div>
                </div>
                <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", {
                  "bg-amber-100 text-amber-700": req.status === "pending",
                  "bg-green-100 text-green-700": req.status === "approved",
                  "bg-red-100 text-red-700": req.status === "denied",
                  "bg-muted text-muted-foreground": req.status === "cancelled",
                })}>
                  {req.status}
                </span>
              </div>

              {req.reason && (
                <p className="text-xs text-muted-foreground italic">"{req.reason}"</p>
              )}

              {req.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="bg-[#3A5A40] hover:bg-[#344E41] h-7 text-xs"
                    disabled={processingId === req.id}
                    onClick={() => handleApprove(req.id)}
                  >
                    {processingId === req.id && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                    Approve & swap
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                    disabled={processingId === req.id}
                    onClick={() => handleDeny(req.id)}
                  >
                    Deny
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupDeleteSection({ groupId, groupName, onRequested }: { groupId: number; groupName: string; onRequested?: () => void }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<{ status: string; reason: string; requestedAt: string; reviewNote?: string | null } | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const tickets = await apiRequest<any[]>(`/api/support/tickets`);
        const match = tickets.find((t: any) => t.category === "group_deletion" && t.groupId === groupId);
        setExisting(match ? { status: match.status === "closed" ? "approved" : match.status, reason: "", requestedAt: match.createdAt } : null);
      } catch { setExisting(null); }
    })();
  }, [groupId]);

  const submit = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await apiRequest(`/api/support/tickets`, {
        method: "POST",
        body: JSON.stringify({
          category: "group_deletion",
          groupId,
          subject: `Group deletion request — ${groupName}`,
          message: reason.trim(),
        }),
        headers: { "Content-Type": "application/json" },
      });
      toast({ title: "Request submitted", description: "Aventum Capital will review your deletion request shortly. Check Support for updates." });
      setExisting({ status: "pending", reason: reason.trim(), requestedAt: new Date().toISOString() });
      setShowForm(false);
      setReason("");
      onRequested?.();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not submit request", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (existing === undefined) return null;

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <button
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => setExpanded(e => !e)}
      >
        <Trash2 className="w-4 h-4 text-destructive" />
        <span className="text-sm font-medium text-destructive">Request Group Deletion</span>
        {existing?.status === "pending" && (
          <span className="text-[11px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Pending review</span>
        )}
        {existing?.status === "approved" && (
          <span className="text-[11px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Approved</span>
        )}
        {existing?.status === "rejected" && (
          <span className="text-[11px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Rejected</span>
        )}
        <span className="ml-auto text-muted-foreground">{expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {/* Info banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Deletion requires Aventum Capital approval</p>
              <p className="opacity-80 mt-0.5">Submitting a request will notify our team. We'll review, arrange fund disbursement to all members, and confirm before closing the group.</p>
            </div>
          </div>

          {existing ? (
            <div className={cn("rounded-xl border p-4 space-y-2", statusColor[existing.status] ?? "bg-muted/20 border-border")}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold capitalize">{existing.status} — Deletion Request</span>
                <span className="text-xs opacity-70">{new Date(existing.requestedAt).toLocaleDateString()}</span>
              </div>
              <p className="text-xs italic">"{existing.reason}"</p>
              {existing.reviewNote && <p className="text-xs">Aventum note: {existing.reviewNote}</p>}
              {existing.status === "rejected" && (
                <button
                  className="text-xs text-destructive font-medium hover:underline mt-1"
                  onClick={() => { setExisting(null); setShowForm(true); }}
                >
                  Submit a new request
                </button>
              )}
            </div>
          ) : (
            <>
              {!showForm ? (
                <button
                  className="w-full text-sm font-medium text-destructive border border-destructive/30 rounded-xl py-3 hover:bg-destructive/5 transition-colors"
                  onClick={() => setShowForm(true)}
                >
                  + Submit deletion request for "{groupName}"
                </button>
              ) : (
                <div className="space-y-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Why do you want to delete this group?</p>
                    <button onClick={() => { setShowForm(false); setReason(""); }} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-destructive/30 bg-white resize-none"
                    rows={3}
                    placeholder="e.g. Group members have agreed to dissolve, all cycles complete, etc."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setReason(""); }}>Cancel</Button>
                    <Button
                      size="sm"
                      className="bg-destructive hover:bg-destructive/90 text-white"
                      onClick={submit}
                      disabled={loading || !reason.trim()}
                    >
                      {loading && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                      Submit request
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminGroup() {
  const { region, formatGroupAmount } = useRegion();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingInvite, setPendingInvite] = useState<{ url: string; email: string; groupId: number } | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    currency: region.currency,
    contributionAmount: "",
    schedule: "bi-weekly",
    maxMembers: "5",
  });

  const { data: groups, isLoading } = useListGroups({ query: { queryKey: getListGroupsQueryKey() } });

  const createMutation = useCreateGroup({
    mutation: {
      onSuccess: () => {
        toast({ title: "Group created!", description: "Your new savings group is ready." });
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setShowCreate(false);
        setCreateForm({ name: "", contributionAmount: "", schedule: "bi-weekly", maxMembers: "5" });
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error ?? "Could not create group", variant: "destructive" });
      },
    },
  });

  const inviteMutation = useInviteMember({
    mutation: {
      onSuccess: (data: any, vars) => {
        if (data?.type === "invitation" && data?.inviteUrl) {
          setPendingInvite({ url: data.inviteUrl, email: inviteEmail, groupId: vars.groupId });
          toast({
            title: "Invitation created",
            description: data.emailSent ? `Email sent to ${inviteEmail}` : `Share the invite link with ${inviteEmail}`,
          });
        } else {
          toast({ title: "Member added!", description: data?.message ?? `${inviteEmail} joined the group` });
          queryClient.invalidateQueries({ queryKey: getGetGroupMembersQueryKey(vars.groupId) });
          setInviteEmail("");
          setInviteGroupId(null);
        }
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error ?? "Could not send invitation", variant: "destructive" });
      },
    },
  });

  const pauseMutation = usePauseGroup({
    mutation: {
      onSuccess: () => {
        toast({ title: "Group paused" });
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      },
    },
  });

  const resumeMutation = useResumeGroup({
    mutation: {
      onSuccess: () => {
        toast({ title: "Group resumed" });
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
      },
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      data: {
        name: createForm.name,
        currency: createForm.currency,
        contributionAmount: parseFloat(createForm.contributionAmount),
        schedule: createForm.schedule as any,
        maxMembers: parseInt(createForm.maxMembers, 10),
      },
    });
  };

  const handleInvite = (groupId: number) => {
    if (!inviteEmail) return;
    setPendingInvite(null);
    inviteMutation.mutate({ groupId, data: { email: inviteEmail } });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <BackButton to="/groups" label="All Groups" />
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Group Admin</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your savings groups</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 bg-[#3A5A40] hover:bg-[#344E41]">
            <Plus className="w-4 h-4" /> New Group
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4">Create a new group</h3>
            <form onSubmit={handleCreate} className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Group name</Label>
                <Input placeholder="Nairobi Savings Circle" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Group currency</Label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  value={createForm.currency}
                  onChange={e => setCreateForm(f => ({ ...f, currency: e.target.value }))}
                  required
                >
                  {Object.values(REGIONS).map(r => (
                    <option key={r.currency} value={r.currency}>
                      {r.flag} {r.currency} — {r.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  All contribution amounts and payouts for this group will be in {createForm.currency}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Contribution amount ({createForm.currency})</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={createForm.contributionAmount}
                  onChange={e => setCreateForm(f => ({ ...f, contributionAmount: e.target.value }))}
                  required
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Schedule</Label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm"
                  value={createForm.schedule}
                  onChange={e => setCreateForm(f => ({ ...f, schedule: e.target.value }))}
                >
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Max members</Label>
                <Input type="number" min="2" max="20" value={createForm.maxMembers} onChange={e => setCreateForm(f => ({ ...f, maxMembers: e.target.value }))} />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <Button type="submit" disabled={createMutation.isPending} className="bg-[#3A5A40] hover:bg-[#344E41]">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create group
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        {/* Groups list */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : !groups || (groups as any[]).length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">No groups yet. Create your first group to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(groups as any[]).map(g => {
              const groupCurrency = g.currency ?? "KES";
              const fmtAmt = (n: number) => formatGroupAmount(n, groupCurrency);
              return (
                <div key={g.id} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">{g.name}</h3>
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{groupCurrency}</span>
                      </div>
                      <p className="text-sm text-muted-foreground capitalize">{g.schedule} • {g.totalMembers}/{g.maxMembers} members • Cycle {g.currentCycle}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadgeSmall status={g.status} />
                      {g.status === "active" ? (
                        <Button size="sm" variant="outline" onClick={() => pauseMutation.mutate({ groupId: g.id })} disabled={pauseMutation.isPending}>
                          Pause
                        </Button>
                      ) : g.status === "paused" ? (
                        <Button size="sm" variant="outline" onClick={() => resumeMutation.mutate({ groupId: g.id })} disabled={resumeMutation.isPending}>
                          Resume
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted/40 rounded-lg">
                      <div className="font-bold">{fmtAmt(g.contributionAmount)}</div>
                      <div className="text-xs text-muted-foreground">Per cycle</div>
                    </div>
                    <div className="text-center p-3 bg-muted/40 rounded-lg">
                      <div className="font-bold">{g.paidCount}/{g.totalMembers}</div>
                      <div className="text-xs text-muted-foreground">Paid</div>
                    </div>
                    <div className="text-center p-3 bg-muted/40 rounded-lg">
                      <div className="font-bold">{fmtAmt(g.contributionAmount * g.totalMembers)}</div>
                      <div className="text-xs text-muted-foreground">Pool size</div>
                    </div>
                  </div>

                  {/* Members */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Members</span>
                      <button
                        className="text-xs text-[#3A5A40] hover:underline font-medium"
                        onClick={() => {
                          setInviteGroupId(inviteGroupId === g.id ? null : g.id);
                          setPendingInvite(null);
                          setInviteEmail("");
                        }}
                      >
                        + Invite member
                      </button>
                    </div>

                    {inviteGroupId === g.id && (
                      <div className="mb-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="member@example.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleInvite(g.id)}
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleInvite(g.id)}
                            disabled={inviteMutation.isPending || !inviteEmail}
                            className="bg-[#3A5A40] hover:bg-[#344E41]"
                          >
                            {inviteMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                            Send invite
                          </Button>
                        </div>
                        {pendingInvite && pendingInvite.groupId === g.id && (
                          <InviteLinkBox url={pendingInvite.url} email={pendingInvite.email} />
                        )}
                      </div>
                    )}

                    <GroupMembersList groupId={g.id} />
                  </div>

                  <GroupExitRequests groupId={g.id} />
                  <GroupSwapRequests groupId={g.id} />
                  {g.status !== "deleted" && (
                    <GroupDeleteSection groupId={g.id} groupName={g.name} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
