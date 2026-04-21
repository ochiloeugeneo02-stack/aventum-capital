import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListGroups, useCreateGroup, getListGroupsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useRegion, REGIONS } from "@/contexts/RegionContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, ArrowRight, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SCHEDULES = [
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function Groups() {
  const { formatGroupAmount, formatDate } = useRegion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data, isLoading } = useListGroups({ query: { queryKey: getListGroupsQueryKey() } });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contributionAmount: "",
    schedule: "bi-weekly",
    maxMembers: "5",
    currency: "KES",
  });

  const createGroup = useCreateGroup({
    mutation: {
      onSuccess: (group: any) => {
        toast({ title: "Group created!", description: `${group.name} is ready. Invite members to get started.` });
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setShowCreate(false);
        setForm({ name: "", contributionAmount: "", schedule: "bi-weekly", maxMembers: "5", currency: "KES" });
        navigate(`/groups/${group.id}`);
      },
      onError: (err: any) => {
        toast({ title: "Failed to create group", description: err?.data?.error ?? "Please check your details", variant: "destructive" });
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createGroup.mutate({
      data: {
        name: form.name.trim(),
        contributionAmount: Number(form.contributionAmount),
        schedule: form.schedule as any,
        maxMembers: Number(form.maxMembers),
        currency: form.currency,
      },
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Groups</h1>
            <p className="text-muted-foreground text-sm mt-1">All savings groups you belong to</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Create Group
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !data || (data as any[]).length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold mb-1">No groups yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your own group or ask a group admin to invite you.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Create your first group
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(data as any[]).map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`}>
                <a className="block bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">{group.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5 capitalize">{group.schedule} contributions</p>
                    </div>
                    <StatusBadge status={group.status} />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contribution</span>
                      <span className="font-medium">{formatGroupAmount(group.contributionAmount, group.currency ?? "KES")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Members</span>
                      <span className="font-medium">{group.totalMembers}/{group.maxMembers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current cycle</span>
                      <span className="font-medium">Cycle {group.currentCycle}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{group.paidCount}/{group.totalMembers} paid</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${(group.paidCount / Math.max(group.totalMembers, 1)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Joined {formatDate(group.createdAt)}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <div>
                <h2 className="text-lg font-bold">Create a savings group</h2>
                <p className="text-sm text-muted-foreground mt-0.5">You'll be the group admin</p>
              </div>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Group name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nairobi Women's Circle"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Currency</label>
                  <select
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {REGIONS.map(r => (
                      <option key={r.currency} value={r.currency}>{r.currency} — {r.country}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Contribution amount</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="5000"
                    value={form.contributionAmount}
                    onChange={e => setForm(f => ({ ...f, contributionAmount: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Schedule</label>
                  <select
                    value={form.schedule}
                    onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {SCHEDULES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Max members</label>
                  <input
                    type="number"
                    required
                    min="2"
                    max="50"
                    value={form.maxMembers}
                    onChange={e => setForm(f => ({ ...f, maxMembers: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={createGroup.isPending}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {createGroup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {createGroup.isPending ? "Creating…" : "Create group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
