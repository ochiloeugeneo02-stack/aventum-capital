import { useListOrganizations } from "@workspace/api-client-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BackButton } from "@/components/BackButton";
import { useRegion } from "@/contexts/RegionContext";
import {
  Loader2, Building2, Globe, Mail, Users2, Shield, CalendarRange,
  TrendingUp, Users, FolderOpen, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PLAN_META: Record<string, { label: string; color: string; desc: string }> = {
  free:         { label: "Free",         color: "bg-gray-100 text-gray-600",         desc: "Basic access for small circles" },
  starter:      { label: "Starter",      color: "bg-blue-50 text-blue-700",           desc: "Ideal for growing communities" },
  professional: { label: "Professional", color: "bg-indigo-50 text-indigo-700",       desc: "Advanced features for active chamas" },
  enterprise:   { label: "Enterprise",   color: "bg-purple-50 text-purple-700",       desc: "Full platform with dedicated support" },
  custom:       { label: "Custom",       color: "bg-[#F0F5F1] text-[#3A5A40]",        desc: "Tailored to your organisation's needs" },
};

const STATUS_META: Record<string, { label: string; dot: string }> = {
  active:    { label: "Active",    dot: "bg-emerald-500" },
  trial:     { label: "Trial",     dot: "bg-amber-400" },
  suspended: { label: "Suspended", dot: "bg-red-500" },
  churned:   { label: "Churned",   dot: "bg-gray-400" },
};

export default function Organization() {
  const { formatCurrency } = useRegion();
  const { data, isLoading } = useListOrganizations({});
  const orgs = (data as any[]) ?? [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <BackButton />

        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Your Organisation</h1>
          <p className="text-[#6B7280] text-sm mt-1">Account details and enterprise plan information</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="bg-white border border-border rounded-2xl p-14 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F0F5F1] flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-[#A3C4A8]" />
            </div>
            <p className="font-semibold text-[#374151]">No organisation linked</p>
            <p className="text-sm text-[#9CA3AF] mt-1">You haven't been added to an enterprise account yet</p>
          </div>
        ) : (
          orgs.map((org: any) => {
            const plan = PLAN_META[org.plan ?? "free"] ?? PLAN_META.free;
            const status = STATUS_META[org.status ?? "active"] ?? STATUS_META.active;

            return (
              <div key={org.id} className="space-y-4">
                {/* Header card */}
                <div className="bg-white border border-[#E8E4DF] rounded-2xl overflow-hidden">
                  {/* Top accent */}
                  <div className="h-1.5 bg-gradient-to-r from-[#1C3229] to-[#3A5A40]" />

                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-xl bg-[#F0F5F1] flex items-center justify-center text-2xl font-bold text-[#3A5A40] shrink-0">
                        {org.name?.charAt(0)?.toUpperCase() ?? "O"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-bold text-[#111827]">{org.name}</h2>
                        {org.industry && (
                          <p className="text-sm text-[#6B7280] mt-0.5">{org.industry}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                          {/* Plan badge */}
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full", plan.color)}>
                            <Zap className="w-3 h-3" />
                            {plan.label} Plan
                          </span>
                          {/* Status badge */}
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-[#F5F4F0] text-[#6B7280]">
                            <span className={cn("w-1.5 h-1.5 rounded-full", status.dot)} />
                            {status.label}
                          </span>
                        </div>
                        <p className="text-xs text-[#9CA3AF] mt-1.5 italic">{plan.desc}</p>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-3 mt-6">
                      {[
                        { icon: Users, label: "Members", value: org.totalMembers },
                        { icon: FolderOpen, label: "Groups", value: org.totalGroups },
                        { icon: TrendingUp, label: "Contributed", value: formatCurrency(org.totalContributed ?? 0) },
                      ].map(m => (
                        <div key={m.label} className="bg-[#FAFAF9] border border-[#F0EDE8] rounded-xl p-4 text-center">
                          <m.icon className="w-4 h-4 text-[#A3C4A8] mx-auto mb-1.5" />
                          <div className="text-lg font-bold text-[#111827]">{m.value}</div>
                          <div className="text-xs text-[#9CA3AF]">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Details card */}
                <div className="bg-white border border-[#E8E4DF] rounded-2xl p-6">
                  <h3 className="text-sm font-semibold text-[#374151] mb-4">Account details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {org.website && (
                      <DetailRow icon={Globe} label="Website">
                        <a href={org.website} target="_blank" rel="noopener noreferrer"
                           className="text-sm text-[#3A5A40] hover:underline truncate">
                          {org.website.replace(/^https?:\/\//, "")}
                        </a>
                      </DetailRow>
                    )}
                    {org.billingEmail && (
                      <DetailRow icon={Mail} label="Billing contact">
                        <span className="text-sm text-[#374151]">{org.billingEmail}</span>
                      </DetailRow>
                    )}
                    {org.employeeCount && (
                      <DetailRow icon={Users2} label="Company size">
                        <span className="text-sm text-[#374151]">{org.employeeCount} employees</span>
                      </DetailRow>
                    )}
                    {org.accountManager && (
                      <DetailRow icon={Shield} label="Account manager">
                        <span className="text-sm text-[#374151]">{org.accountManager}</span>
                      </DetailRow>
                    )}
                    {(org.contractStart || org.contractEnd) && (
                      <DetailRow icon={CalendarRange} label="Contract period">
                        <span className="text-sm text-[#374151]">
                          {org.contractStart ? new Date(org.contractStart).toLocaleDateString() : "—"}
                          {" → "}
                          {org.contractEnd ? new Date(org.contractEnd).toLocaleDateString() : "Ongoing"}
                        </span>
                      </DetailRow>
                    )}
                    <DetailRow icon={CalendarRange} label="Member since">
                      <span className="text-sm text-[#374151]">{new Date(org.createdAt).toLocaleDateString()}</span>
                    </DetailRow>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#F0F5F1] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-[#3A5A40]" />
      </div>
      <div>
        <div className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{label}</div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}
