import { useListContributions, getListContributionsQueryKey } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useRegion } from "@/contexts/RegionContext";
import { Loader2, CreditCard } from "lucide-react";
import { useState } from "react";
import { BackButton } from "@/components/BackButton";

export default function Contributions() {
  const { formatCurrency, formatDate } = useRegion();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading } = useListContributions(
    statusFilter ? { status: statusFilter as any } : {},
    { query: { queryKey: getListContributionsQueryKey(statusFilter ? { status: statusFilter as any } : {}) } }
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold">Contributions</h1>
          <p className="text-muted-foreground text-sm mt-1">Your complete contribution history</p>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {[undefined, "paid", "pending", "failed"].map(s => (
            <button
              key={s ?? "all"}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border hover:border-primary/40"
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold">All Contributions</h3>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !data || (data as any[]).length === 0 ? (
            <div className="py-12 text-center">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground text-sm">No contributions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Group</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Paid on</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data as any[]).map(c => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4 font-semibold">{formatCurrency(c.amount)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">Group #{c.groupId}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(c.createdAt)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(c.paidAt)}</td>
                      <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
