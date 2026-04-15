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
import { Loader2, Plus, Users } from "lucide-react";

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
  const { formatCurrency } = useRegion();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<number | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
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
      onSuccess: (_, vars) => {
        toast({ title: "Member invited!", description: `Invitation sent to ${inviteEmail}` });
        queryClient.invalidateQueries({ queryKey: getGetGroupMembersQueryKey(vars.groupId) });
        setInviteEmail("");
        setInviteGroupId(null);
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.error ?? "Could not invite member", variant: "destructive" });
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
        contributionAmount: parseFloat(createForm.contributionAmount),
        schedule: createForm.schedule as any,
        maxMembers: parseInt(createForm.maxMembers, 10),
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Group Admin</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage your savings groups</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="gap-2">
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
                <Label>Contribution amount (KES)</Label>
                <Input type="number" placeholder="5000" value={createForm.contributionAmount} onChange={e => setCreateForm(f => ({ ...f, contributionAmount: e.target.value }))} required min="100" />
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
                <Button type="submit" disabled={createMutation.isPending}>
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
            {(groups as any[]).map(g => (
              <div key={g.id} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{g.name}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{g.schedule} • {g.totalMembers}/{g.maxMembers} members • Cycle {g.currentCycle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={g.status} />
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
                    <div className="font-bold">{formatCurrency(g.contributionAmount)}</div>
                    <div className="text-xs text-muted-foreground">Per cycle</div>
                  </div>
                  <div className="text-center p-3 bg-muted/40 rounded-lg">
                    <div className="font-bold">{g.paidCount}/{g.totalMembers}</div>
                    <div className="text-xs text-muted-foreground">Paid</div>
                  </div>
                  <div className="text-center p-3 bg-muted/40 rounded-lg">
                    <div className="font-bold">{formatCurrency(g.contributionAmount * g.totalMembers)}</div>
                    <div className="text-xs text-muted-foreground">Pool size</div>
                  </div>
                </div>

                {/* Members */}
                <div className="border-t border-border pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Members</span>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => setInviteGroupId(inviteGroupId === g.id ? null : g.id)}
                    >
                      + Invite member
                    </button>
                  </div>

                  {inviteGroupId === g.id && (
                    <div className="flex gap-2 mb-3">
                      <Input
                        placeholder="member@example.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => inviteMutation.mutate({ groupId: g.id, data: { email: inviteEmail } })}
                        disabled={inviteMutation.isPending || !inviteEmail}
                      >
                        {inviteMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        Invite
                      </Button>
                    </div>
                  )}

                  <GroupMembersList groupId={g.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
