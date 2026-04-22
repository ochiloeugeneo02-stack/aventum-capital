import { cn } from "@/lib/utils";
import { getStatusColor, getStatusLabel } from "@/lib/api";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
        getStatusColor(status)
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}
