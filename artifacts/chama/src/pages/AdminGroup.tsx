import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { useRegion } from "@/contexts/RegionContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Users, Copy, Check, Mail, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatGroupAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

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

export default function AdminGroup() {
  const { region } = useRegion();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [pendingInvite, setPendingInvite] = useState<{ url: string; email: string; groupId: number } | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
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
        currency: region.currency,
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
                <Label>
                  Contribution amount ({region.currency})
                </Label>
                <Input
                  type="number"
                  placeholder={region.code === "KE" ? "5000" : region.code === "US" ? "38" : "50"}
                  value={createForm.contributionAmount}
                  onChange={e => setCreateForm(f => ({ ...f, contributionAmount: e.target.value }))}
                  required
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Stored in {region.currency} — all members will see amounts in the group's currency
                </p>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
