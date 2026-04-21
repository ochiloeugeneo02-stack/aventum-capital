import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { REGIONS } from "@/contexts/RegionContext";
import { apiRequest } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Clock, Users, Repeat2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type InviteStatus = "loading" | "valid" | "accepting" | "accepted" | "error";

interface InviteData {
  token: string;
  email: string;
  status: string;
  expiresAt: string;
  group: {
    id: number;
    name: string;
    currency: string;
    contributionAmount: number;
    schedule: string;
    maxMembers: number;
    totalMembers: number;
  };
  inviter: { name: string; email: string } | null;
}


function formatAmount(amount: number, currency: string, fractionDigits = 0): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function scheduleLabel(s: string): string {
  if (s === "weekly") return "weekly";
  if (s === "bi-weekly") return "every two weeks";
  if (s === "monthly") return "monthly";
  return s;
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  const [status, setStatus] = useState<InviteStatus>("loading");
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const data = await apiRequest<InviteData>(`/api/invitations/${token}`);
        setInvite(data);
        setStatus("valid");
      } catch (err: any) {
        setError(err?.data?.error ?? "Invitation not found or expired");
        setStatus("error");
      }
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!isAuthenticated) {
      localStorage.setItem("aventum_pending_invite", token ?? "");
      navigate("/signup");
      return;
    }
    setStatus("accepting");
    try {
      await apiRequest(`/api/invitations/${token}/accept`, { method: "POST" });
      setStatus("accepted");
    } catch (err: any) {
      setError(err?.data?.error ?? "Could not accept invitation");
      setStatus("error");
    }
  };

  const g = invite?.group;

  const groupCurrency = g?.currency ?? "USD";
  const groupFractionDigits = REGIONS[Object.keys(REGIONS).find(k => REGIONS[k].currency === groupCurrency) ?? ""]?.fractionDigits ?? 0;

  const displayContribution = g ? formatAmount(g.contributionAmount, groupCurrency, groupFractionDigits) : "";
  const displayPool = g ? formatAmount(g.contributionAmount * g.maxMembers, groupCurrency, groupFractionDigits) : "";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(160deg, #f9f8f5 0%, #eef2ec 100%)" }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <button type="button" onClick={() => navigate("/")} className="focus:outline-none"><Logo variant="dark" /></button>
        {!isAuthenticated && (
          <div className="flex gap-3">
            <Button variant="ghost" size="sm" onClick={() => {
              if (token) localStorage.setItem("aventum_pending_invite", token);
              navigate("/login");
            }}>Sign in</Button>
            <Button size="sm" className="bg-[#3A5A40] hover:bg-[#344E41]" onClick={() => {
              if (token) localStorage.setItem("aventum_pending_invite", token);
              navigate("/signup");
            }}>Create account</Button>
          </div>
        )}
      </nav>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* Loading */}
          {status === "loading" && (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#3A5A40] mx-auto mb-3" />
              <p className="text-muted-foreground">Loading your invitation…</p>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="text-center py-20">
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-4 opacity-60" />
              <h2 className="text-xl font-bold mb-2">Invitation unavailable</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button className="bg-[#3A5A40] hover:bg-[#344E41]" onClick={() => navigate("/signup")}>Create an account anyway</Button>
            </div>
          )}

          {/* Accepted */}
          {status === "accepted" && g && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">You're in!</h2>
              <p className="text-muted-foreground mb-8">
                You've joined <span className="font-semibold text-foreground">{g.name}</span>. Head to your dashboard to see your group.
              </p>
              <Button className="bg-[#3A5A40] hover:bg-[#344E41]" onClick={() => navigate("/dashboard")}>
                Go to dashboard →
              </Button>
            </div>
          )}

          {/* Valid invite card */}
          {(status === "valid" || status === "accepting") && invite && g && (
            <div>
              {/* Invite from header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-white/70 backdrop-blur px-3 py-1.5 rounded-full border border-border mb-4">
                  <span className="w-5 h-5 rounded-full bg-[#3A5A40]/10 flex items-center justify-center text-[11px] font-bold text-[#3A5A40]">
                    {invite.inviter?.name?.charAt(0) ?? "A"}
                  </span>
                  {invite.inviter?.name ?? "A group admin"} invited you
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Join their savings circle</h1>
                <p className="text-muted-foreground">
                  You've been invited to <span className="font-semibold text-foreground">{g.name}</span>
                </p>
              </div>

              {/* Card */}
              <div className="bg-white rounded-2xl shadow-md border border-border overflow-hidden mb-4">
                {/* Green header */}
                <div className="px-6 py-5 bg-gradient-to-r from-[#344E41] to-[#3A5A40] text-white">
                  <div className="text-xs font-semibold tracking-widest uppercase opacity-70 mb-1">Savings Group</div>
                  <div className="text-2xl font-bold">{g.name}</div>
                  <div className="flex items-center gap-3 mt-2 text-white/70 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      {g.totalMembers}/{g.maxMembers} members
                    </span>
                    <span className="opacity-40">·</span>
                    <span className="flex items-center gap-1.5">
                      <Repeat2 className="w-3.5 h-3.5" />
                      {scheduleLabel(g.schedule)}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                  <div className="p-5 text-center">
                    <div className="text-2xl font-bold text-[#344E41]">{displayContribution}</div>
                    <div className="text-xs text-muted-foreground mt-1">Your contribution per cycle</div>
                  </div>
                  <div className="p-5 text-center">
                    <div className="text-2xl font-bold text-[#344E41]">{displayPool}</div>
                    <div className="text-xs text-muted-foreground mt-1">Pool size at full capacity</div>
                  </div>
                </div>

                {/* How it works */}
                <div className="px-6 py-5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#3A5A40]/10 flex items-center justify-center shrink-0 mt-0.5">
                      <TrendingUp className="w-4 h-4 text-[#3A5A40]" />
                    </div>
                    <div>
                      <div className="font-medium text-sm mb-0.5">How rotating savings work</div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Everyone contributes {displayContribution} {scheduleLabel(g.schedule)}. The full pool ({displayPool} when full) is paid out to one member each cycle — rotating until everyone has received their share.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expiry */}
                <div className="px-6 pb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  Invitation expires {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>

              {/* CTA */}
              <Button
                className={cn("w-full text-base font-semibold py-6 rounded-xl bg-[#3A5A40] hover:bg-[#344E41]", status === "accepting" && "opacity-80")}
                onClick={handleAccept}
                disabled={status === "accepting"}
              >
                {status === "accepting" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Joining group…</>
                ) : isAuthenticated ? (
                  "Accept invitation →"
                ) : (
                  "Create account to join →"
                )}
              </Button>

              {!isAuthenticated && (
                <p className="text-center text-sm text-muted-foreground mt-3">
                  Already have an account?{" "}
                  <button
                    className="text-[#3A5A40] font-medium hover:underline"
                    onClick={() => {
                      localStorage.setItem("aventum_pending_invite", token ?? "");
                      navigate("/login");
                    }}
                  >
                    Sign in and accept
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
