import { useListPayouts, getListPayoutsQueryKey } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { useRegion } from "@/contexts/RegionContext";
import { Loader2, DollarSign } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export default function Payouts() {
  const { formatCurrency, formatDate } = useRegion();
  const { data, isLoading } = useListPayouts({}, { query: { queryKey: getListPayoutsQueryKey() } });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold">Payouts</h1>
          <p className="text-muted-foreground text-sm mt-1">Your received payouts from all groups</p>
        </div>

        <div className="bg-card border border-border rounded-xl">
          <div className="p-5 border-b border-border">
            <h3 className="font-semibold">Payout History</h3>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !data || (data as any[]).length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground text-sm">No payouts yet. Keep contributing!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Group</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Created</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Paid on</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(data as any[]).map(p => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-semibold text-primary">{formatCurrency(p.amount)}</span>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{p.group?.name ?? `Group #${p.groupId}`}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(p.createdAt)}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(p.paidAt)}</td>
                      <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
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
