import { Link } from "wouter";
import { useListGroups, getListGroupsQueryKey } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useRegion } from "@/contexts/RegionContext";
import { Loader2, Users, ArrowRight } from "lucide-react";

export default function Groups() {
  const { formatGroupAmount, formatDate } = useRegion();
  const { data, isLoading } = useListGroups({ query: { queryKey: getListGroupsQueryKey() } });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">My Groups</h1>
          <p className="text-muted-foreground text-sm mt-1">All savings groups you belong to</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !data || (data as any[]).length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-40" />
            <h3 className="font-semibold mb-1">No groups yet</h3>
            <p className="text-muted-foreground text-sm">You haven't joined any groups yet. Ask a group admin to invite you.</p>
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
    </DashboardLayout>
  );
}
