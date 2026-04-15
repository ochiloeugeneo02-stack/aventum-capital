import { useListOrganizations, getListOrganizationsQueryKey } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useRegion } from "@/contexts/RegionContext";
import { Loader2, Building } from "lucide-react";

export default function Organization() {
  const { formatCurrency } = useRegion();
  const { data, isLoading } = useListOrganizations({ query: { queryKey: getListOrganizationsQueryKey() } });
  const orgs = (data as any[]) ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Organization</h1>
          <p className="text-muted-foreground text-sm mt-1">Overview of your organization's savings activity</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : orgs.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Building className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
            <p className="text-muted-foreground">No organization found</p>
          </div>
        ) : (
          orgs.map((org: any) => (
            <div key={org.id} className="space-y-4">
              <div className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Building className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{org.name}</h2>
                    <p className="text-sm text-muted-foreground">Organization ID: #{org.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total members", value: org.totalMembers },
                    { label: "Total groups", value: org.totalGroups },
                    { label: "Total contributed", value: formatCurrency(0) },
                    { label: "Total paid out", value: formatCurrency(0) },
                  ].map(stat => (
                    <div key={stat.label} className="bg-muted/40 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-primary">{stat.value}</div>
                      <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
