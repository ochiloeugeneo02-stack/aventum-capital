import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListGroups, useCreateGroup, getListGroupsQueryKey } from "@workspace/api-client-react";
import type { CreateGroupBodySchedule } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { DEFAULT_CURRENCY, useRegion, REGIONS } from "@/contexts/RegionContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Users, ArrowRight, Plus } from "lucide-react";

const SCHEDULES = [
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function Groups() {
  const { formatGroupAmount, formatDate, region } = useRegion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { data, isLoading } = useListGroups({ query: { queryKey: getListGroupsQueryKey() } });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    contributionAmount: "",
    schedule: "bi-weekly",
    maxMembers: "5",
    currency: region.currency ?? DEFAULT_CURRENCY,
  });

  const createGroup = useCreateGroup({
    mutation: {
      onSuccess: (group: any) => {
        toast({ title: "Group created!", description: `${group.name} is ready. Invite members to get started.` });
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setOpen(false);
        setForm({ name: "", contributionAmount: "", schedule: "bi-weekly", maxMembers: "5", currency: region.currency ?? DEFAULT_CURRENCY });
        navigate(`/groups/${group.id}`);
      },
      onError: (err: any) => {
        toast({ title: "Failed to create group", description: err?.data?.error ?? "Please check your details and try again.", variant: "destructive" });
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createGroup.mutate({
      data: {
        name: form.name.trim(),
        contributionAmount: Number(form.contributionAmount),
        schedule: form.schedule as CreateGroupBodySchedule,
        maxMembers: Number(form.maxMembers),
        currency: form.currency || undefined,
      },
    });
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">My Groups</h1>
            <p className="text-muted-foreground text-sm mt-1">All savings groups you belong to</p>
          </div>
          <Button onClick={() => setOpen(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Group
          </Button>
        </div>

        {/* Group list */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !data || (data as any[]).length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold mb-1">No groups yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your own group or ask a group admin to invite you.</p>
            <Button onClick={() => setOpen(true)} className="flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" />
              Create your first group
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(data as any[]).map((group) => (
              <Link key={group.id} href={`/groups/${group.id}`} className="block bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all">
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
                    <span className="font-medium">{formatGroupAmount(group.contributionAmount, group.currency ?? DEFAULT_CURRENCY)}</span>
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
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Dialog — rendered via Portal, always above everything */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a savings group</DialogTitle>
            <DialogDescription>
              You'll be set as the group admin. Invite members after creation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Group name */}
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                required
                placeholder="e.g. Family Builders Circle"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Currency + Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {Object.values(REGIONS).map(r => (
                    <option key={r.currency} value={r.currency}>{r.currency} — {r.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Contribution amount</Label>
                <Input
                  id="amount"
                  type="number"
                  required
                  min="1"
                  placeholder="5000"
                  value={form.contributionAmount}
                  onChange={e => setForm(f => ({ ...f, contributionAmount: e.target.value }))}
                />
              </div>
            </div>

            {/* Schedule + Max members */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="schedule">Schedule</Label>
                <select
                  id="schedule"
                  value={form.schedule}
                  onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {SCHEDULES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="max-members">Max members</Label>
                <Input
                  id="max-members"
                  type="number"
                  required
                  min="2"
                  max="50"
                  value={form.maxMembers}
                  onChange={e => setForm(f => ({ ...f, maxMembers: e.target.value }))}
                />
              </div>
            </div>

            <Button type="submit" disabled={createGroup.isPending} className="w-full mt-2">
              {createGroup.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" />Create group</>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
