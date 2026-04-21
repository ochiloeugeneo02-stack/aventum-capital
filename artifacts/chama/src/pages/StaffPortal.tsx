import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import SuperAdmin from "@/pages/SuperAdmin";
import { Eye, EyeOff, Loader2, ShieldCheck, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const SESSION_KEY_2FA_TOKEN = "aventum_staff_2fa_token";
const SESSION_KEY_2FA_EMAIL_HINT = "aventum_staff_2fa_email_hint";
const SESSION_KEY_REQUIRES_2FA = "aventum_staff_requires_2fa";

export default function StaffPortal() {
  const [, navigate] = useLocation();
  const { setUser, isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [requires2fa, setRequires2fa] = useState(() => sessionStorage.getItem(SESSION_KEY_REQUIRES_2FA) === "true");
  const [emailHint, setEmailHint] = useState(() => sessionStorage.getItem(SESSION_KEY_2FA_EMAIL_HINT) ?? "");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState(() => sessionStorage.getItem(SESSION_KEY_2FA_TOKEN) ?? "");
  const [validating2fa, setValidating2fa] = useState(false);
  const [resending, setResending] = useState(false);

  function enter2faState(token: string, hint: string) {
    sessionStorage.setItem(SESSION_KEY_2FA_TOKEN, token);
    sessionStorage.setItem(SESSION_KEY_2FA_EMAIL_HINT, hint);
    sessionStorage.setItem(SESSION_KEY_REQUIRES_2FA, "true");
    setTwoFactorToken(token);
    setEmailHint(hint);
    setRequires2fa(true);
  }

  function clear2faState() {
    sessionStorage.removeItem(SESSION_KEY_2FA_TOKEN);
    sessionStorage.removeItem(SESSION_KEY_2FA_EMAIL_HINT);
    sessionStorage.removeItem(SESSION_KEY_REQUIRES_2FA);
    setTwoFactorToken("");
    setEmailHint("");
    setRequires2fa(false);
    setTwoFactorCode("");
  }

  const loginMutation = useLoginUser({
    mutation: {
      onSuccess: async (data: any) => {
        if (data.requiresTwoFactor) {
          enter2faState(data.twoFactorToken ?? "", data.emailHint ?? "");
          return;
        }
        clear2faState();
        await completeLogin(data.user);
      },
      onError: () => {
        toast({ title: "Access denied", description: "Invalid credentials", variant: "destructive" });
      },
    },
  });

  async function completeLogin(u: any) {
    if (u.role !== "super_admin") {
      toast({ title: "Unauthorised", description: "This portal is for Aventum staff only.", variant: "destructive" });
      return;
    }
    setUser(u);
    toast({ title: "Welcome back", description: u.name });
  }

  async function handle2faSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = twoFactorCode.replace(/\s/g, "");
    if (code.length < 6) return;
    if (!twoFactorToken) {
      toast({ title: "Session expired", description: "Please sign in again.", variant: "destructive" });
      clear2faState();
      return;
    }
    setValidating2fa(true);
    try {
      const data: any = await apiRequest("/api/auth/2fa/validate", {
        method: "POST",
        body: JSON.stringify({ code, twoFactorToken }),
      });
      clear2faState();
      await completeLogin(data.user);
    } catch (err: any) {
      const msg = err?.data?.error ?? "Invalid code. Try again.";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
      setTwoFactorCode("");
    } finally {
      setValidating2fa(false);
    }
  }

  // If already authenticated as super_admin, render the admin panel
  if (!isLoading && isAuthenticated && user?.role === "super_admin") {
    return <SuperAdmin />;
  }

  const StaffBg = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: "url('/staff-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center top", filter: "grayscale(40%) brightness(0.28)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(11,20,15,0.82) 0%, rgba(18,30,22,0.88) 60%, rgba(10,14,12,0.95) 100%)" }} />
      <div className="relative">{children}</div>
    </div>
  );

  // If authenticated but wrong role, show unauthorised
  if (!isLoading && isAuthenticated && user?.role !== "super_admin") {
    return (
      <StaffBg>
        <div className="text-center space-y-4 px-6">
          <img src="/logo-icon-sage.png" alt="" className="w-12 h-12 rounded-xl mx-auto opacity-60 mb-2" />
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-white font-bold text-xl">Unauthorised</h2>
          <p className="text-white/40 text-sm">This portal is restricted to Aventum staff.</p>
          <button onClick={() => navigate("/")} className="text-[#A3C4A8] text-sm hover:underline block mx-auto pt-1">
            Back to the app
          </button>
        </div>
      </StaffBg>
    );
  }

  // Loading splash
  if (isLoading) {
    return (
      <StaffBg>
        <div className="flex flex-col items-center gap-4">
          <img src="/logo-icon-sage.png" alt="" className="w-12 h-12 rounded-xl opacity-80" />
          <Loader2 className="w-5 h-5 animate-spin text-[#3A5A40]" />
        </div>
      </StaffBg>
    );
  }

  // Staff sign-in page
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background photo — skyscraper, desaturated + heavily darkened */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/staff-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          filter: "grayscale(40%) brightness(0.28)",
        }}
      />
      {/* Warm dark green tint overlay */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(160deg, rgba(11,20,15,0.82) 0%, rgba(18,30,22,0.88) 60%, rgba(10,14,12,0.95) 100%)" }}
      />
      {/* Subtle vignette */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 100% 80% at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 70%)" }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md mx-4">
        {/* Logo + brand */}
        <div className="flex flex-col items-center gap-3 mb-9">
          <img
            src="/logo-icon-sage.png"
            alt="Aventum Capital"
            className="w-14 h-14 rounded-2xl shadow-lg shadow-black/40"
          />
          <div className="text-center">
            <div className="text-white/90 font-semibold text-base tracking-[0.18em] uppercase">Aventum Capital</div>
            <div className="text-white/30 text-[11px] tracking-[0.22em] uppercase mt-0.5">Operations Centre</div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-white/[0.06] p-8"
          style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(16px)" }}
        >
          {requires2fa ? (
            <>
              <div className="mb-7">
                <div className="w-11 h-11 rounded-xl bg-[#3A5A40]/20 border border-[#3A5A40]/30 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-5 h-5 text-[#A3C4A8]" />
                </div>
                <h1 className="text-white text-xl font-bold">Two-factor authentication</h1>
                <p className="text-white/40 text-sm mt-1">
                  Code sent to <span className="text-white/60">{emailHint || "your email"}</span>
                </p>
              </div>

              <form onSubmit={handle2faSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                    Verification code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={e => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    autoFocus
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={cn(
                      "w-full text-center text-2xl tracking-[0.5em] font-mono py-3 px-4 rounded-xl",
                      "bg-white/[0.05] border border-white/10 text-white placeholder-white/20",
                      "focus:outline-none focus:border-[#3A5A40]/60 focus:bg-white/[0.07] transition-all"
                    )}
                  />
                </div>
                <button
                  type="submit"
                  disabled={validating2fa || twoFactorCode.length < 6}
                  className={cn(
                    "w-full py-3 rounded-xl font-semibold text-sm transition-all",
                    "bg-[#1C3229] text-white border border-[#3A5A40]/50",
                    "hover:bg-[#243D2F] hover:border-[#3A5A40] disabled:opacity-40"
                  )}
                >
                  {validating2fa ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Verify and continue"}
                </button>
              </form>

              <div className="mt-5 flex flex-col items-center gap-3">
                <button
                  type="button"
                  disabled={resending}
                  className="text-xs text-[#A3C4A8]/70 hover:text-[#A3C4A8] transition-colors disabled:opacity-40"
                  onClick={async () => {
                    setResending(true);
                    try {
                      const data: any = await apiRequest("/api/auth/2fa/resend", {
                        method: "POST",
                        body: JSON.stringify({ twoFactorToken }),
                      });
                      if (data.twoFactorToken) enter2faState(data.twoFactorToken, emailHint);
                      setTwoFactorCode("");
                      toast({ title: "Code resent" });
                    } catch {
                      toast({ title: "Could not resend", variant: "destructive" });
                    } finally { setResending(false); }
                  }}
                >
                  {resending ? "Resending…" : "Resend code"}
                </button>
                <button
                  type="button"
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                  onClick={() => clear2faState()}
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-white text-xl font-bold">Staff sign in</h1>
                <p className="text-white/30 text-sm mt-1">Restricted to authorised Aventum personnel</p>
              </div>

              {/* Quick-fill — demo staff accounts */}
              <div className="mb-6">
                <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2.5">Quick sign in</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { name: "Super Admin", title: "admin@aventum.co", initials: "SA", email: "admin@aventum.co", password: "Aventum2024!" },
                  ].map(emp => (
                    <button
                      key={emp.name}
                      type="button"
                      onClick={() => { setEmail(emp.email); setPassword(emp.password); }}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl border border-white/[0.06] hover:border-[#3A5A40]/40 hover:bg-white/[0.04] transition-all group text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#1C3229] border border-[#3A5A40]/30 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-semibold text-[#A3C4A8]">{emp.initials}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-white/70 text-xs font-medium leading-none group-hover:text-white/90 transition-colors">{emp.name}</div>
                        <div className="text-white/25 text-[10px] mt-0.5 leading-none">{emp.title}</div>
                      </div>
                      <div className="ml-auto text-white/15 text-[10px] group-hover:text-[#A3C4A8]/50 transition-colors shrink-0">Fill →</div>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                    Work email
                  </label>
                  <input
                    type="email"
                    placeholder="you@aventum.co"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={cn(
                      "w-full py-3 px-4 rounded-xl text-sm",
                      "bg-white/[0.05] border border-white/10 text-white placeholder-white/20",
                      "focus:outline-none focus:border-[#3A5A40]/60 focus:bg-white/[0.07] transition-all"
                    )}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className={cn(
                        "w-full py-3 px-4 pr-11 rounded-xl text-sm",
                        "bg-white/[0.05] border border-white/10 text-white placeholder-white/20",
                        "focus:outline-none focus:border-[#3A5A40]/60 focus:bg-white/[0.07] transition-all"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className={cn(
                    "w-full py-3 rounded-xl font-semibold text-sm transition-all",
                    "bg-[#1C3229] text-white border border-[#3A5A40]/50",
                    "hover:bg-[#243D2F] hover:border-[#3A5A40] disabled:opacity-40"
                  )}
                >
                  {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Access portal"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-white/15 text-[11px] mt-6 tracking-wide">
          Aventum Capital · Internal use only
        </p>
      </div>
    </div>
  );
}
