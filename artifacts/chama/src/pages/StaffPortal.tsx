import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLoginUser, useVerifySecurityQuestions, getSecurityQuestions } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import SuperAdmin from "@/pages/SuperAdmin";
import SecurityQuestionsSetup from "@/components/staff/SecurityQuestionsSetup";
import { Eye, EyeOff, Loader2, ShieldCheck, Lock, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SESSION_KEY_2FA_TOKEN = "aventum_staff_2fa_token";
const SESSION_KEY_2FA_EMAIL_HINT = "aventum_staff_2fa_email_hint";
const SESSION_KEY_REQUIRES_2FA = "aventum_staff_requires_2fa";

export const STAFF_ROLES = ["ceo", "cto_admin", "it_support", "finance", "marketing", "relationship_manager", "super_admin"];

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
  const [devOtp, setDevOtp] = useState<string | null>(null);

  // Locked account recovery flow
  const [accountLocked, setAccountLocked] = useState(false);
  const [lockedEmail, setLockedEmail] = useState("");
  const [recoveryStep, setRecoveryStep] = useState<"questions" | "success">("questions");
  const [securityQuestions, setSecurityQuestions] = useState<Array<{ questionIndex: number; questionText: string }>>([]);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [securityAnswers, setSecurityAnswers] = useState<Record<number, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [submittingRecovery, setSubmittingRecovery] = useState(false);

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
    setDevOtp(null);
  }

  const loginMutation = useLoginUser({
    mutation: {
      onSuccess: async (data: any) => {
        if (data.requiresTwoFactor) {
          enter2faState(data.twoFactorToken ?? "", data.emailHint ?? "");
          if (data.testOtp) setDevOtp(data.testOtp);
          return;
        }
        clear2faState();
        await completeLogin(data.user);
      },
      onError: (err: any) => {
        const errData = (err as any)?.response?.data ?? (err as any)?.data;
        if (errData?.error === "accountLocked") {
          // Use canonicalEmail from response if provided (guards against username-vs-email mismatch)
          handleAccountLocked(errData?.canonicalEmail ?? email, errData?.recoveryChallenge);
          return;
        }
        toast({ title: "Access denied", description: "Invalid credentials", variant: "destructive" });
      },
    },
  });

  async function handleAccountLocked(userEmail: string, recoveryChallenge?: string) {
    setLockedEmail(userEmail);
    setAccountLocked(true);
    if (!recoveryChallenge) {
      toast({ title: "Recovery link expired", description: "Please try logging in again to receive a new recovery challenge.", variant: "destructive" });
      return;
    }
    setLoadingQuestions(true);
    try {
      const data = await getSecurityQuestions(userEmail, { challenge: recoveryChallenge });
      setSecurityQuestions(data.questions ?? []);
      setRecoveryToken(data.recoveryToken ?? null);
    } catch {
      toast({ title: "Could not load security questions", description: "Please contact your system administrator.", variant: "destructive" });
    }
    setLoadingQuestions(false);
  }

  async function completeLogin(u: any) {
    if (!STAFF_ROLES.includes(u.role)) {
      toast({ title: "Unauthorised", description: "This portal is for Aventum staff only.", variant: "destructive" });
      return;
    }
    setUser(u);
    toast({ title: "Welcome back", description: u.name });
    if (u.requiresPasswordReset) {
      navigate("/set-password");
    }
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
      if (data.passwordResetRequired && data.resetToken) {
        window.location.href = `/reset-password?token=${encodeURIComponent(data.resetToken)}`;
        return;
      }
      await completeLogin(data.user);
    } catch (err: any) {
      const msg = err?.data?.error ?? "Invalid code. Try again.";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
      setTwoFactorCode("");
    } finally {
      setValidating2fa(false);
    }
  }

  const verifySecurityQuestionsMutation = useVerifySecurityQuestions({
    mutation: {
      onSuccess: () => {
        setRecoveryStep("success");
        setSubmittingRecovery(false);
      },
      onError: (err: any) => {
        const msg = err?.data?.error ?? "One or more answers are incorrect. Please try again.";
        toast({ title: "Verification failed", description: msg, variant: "destructive" });
        setSubmittingRecovery(false);
      },
    },
  });

  function handleRecoverySubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingRecovery(true);
    const answers = securityQuestions.map(q => ({
      questionIndex: q.questionIndex,
      answer: securityAnswers[q.questionIndex] ?? "",
    }));
    verifySecurityQuestionsMutation.mutate({ data: { recoveryToken: recoveryToken ?? "", answers } });
  }

  const isStaffUser = user && STAFF_ROLES.includes(user.role);

  useEffect(() => {
    if (!isLoading && isAuthenticated && isStaffUser && (user as any)?.requiresPasswordReset) {
      navigate("/set-password");
    }
  }, [isLoading, isAuthenticated, isStaffUser, (user as any)?.requiresPasswordReset]);

  // If authenticated as staff user — gate on password reset first, then security questions
  if (!isLoading && isAuthenticated && isStaffUser) {
    if ((user as any).requiresPasswordReset) {
      return null;
    }
    if (!(user as any).securityQuestionsSet) {
      return <SecurityQuestionsSetup user={user} onComplete={() => setUser({ ...(user as any), securityQuestionsSet: true })} />;
    }
    return <SuperAdmin />;
  }

  const StaffBg = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: "url('/staff-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center top", filter: "grayscale(40%) brightness(0.28)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(11,20,15,0.82) 0%, rgba(18,30,22,0.88) 60%, rgba(10,14,12,0.95) 100%)" }} />
      <div className="relative">{children}</div>
    </div>
  );

  if (!isLoading && isAuthenticated && !isStaffUser) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <a
        href="/"
        className="group absolute top-6 left-6 z-20 flex items-center gap-2"
        style={{ color: "rgba(255,255,255,0.45)", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.04em", fontWeight: 500, transition: "color 0.2s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.9)")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
      >
        <span className="flex items-center justify-center rounded-full border" style={{ width: "28px", height: "28px", borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.05)", backdropFilter: "blur(8px)" }}>
          <ArrowLeft className="w-3.5 h-3.5" />
        </span>
        <span>Home</span>
      </a>

      <div className="absolute inset-0" style={{ backgroundImage: "url('/staff-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center top", filter: "grayscale(40%) brightness(0.28)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(11,20,15,0.82) 0%, rgba(18,30,22,0.88) 60%, rgba(10,14,12,0.95) 100%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 100% 80% at 50% 100%, rgba(0,0,0,0.5) 0%, transparent 70%)" }} />

      <div className="relative w-full max-w-md mx-4">
        <div className="flex flex-col items-center gap-3 mb-9">
          <img src="/logo-icon-sage.png" alt="Aventum Capital" className="w-14 h-14 rounded-2xl shadow-lg shadow-black/40" />
          <div className="text-center">
            <div className="text-white/90 font-semibold text-base tracking-[0.18em] uppercase">Aventum Capital</div>
            <div className="text-white/30 text-[11px] tracking-[0.22em] uppercase mt-0.5">Operations Centre</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.06] p-8" style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(16px)" }}>

          {/* ── ACCOUNT LOCKED RECOVERY ─────────────────────────────── */}
          {accountLocked ? (
            <>
              {recoveryStep === "success" ? (
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h2 className="text-white font-bold text-lg">Request submitted</h2>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Your answers were verified. An unlock request has been sent to IT/Support. You will receive an email once your account is restored.
                  </p>
                  <button
                    onClick={() => { setAccountLocked(false); setRecoveryStep("questions"); setSecurityAnswers({}); setLockedEmail(""); }}
                    className="text-xs text-white/30 hover:text-white/50 transition-colors mt-2"
                  >
                    ← Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mb-4">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    </div>
                    <h1 className="text-white text-xl font-bold">Account locked</h1>
                    <p className="text-white/40 text-sm mt-1">
                      Answer your security questions to request an unlock.
                    </p>
                  </div>

                  {loadingQuestions ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#3A5A40]" /></div>
                  ) : securityQuestions.length === 0 ? (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-white/40 text-sm">No security questions found for this account.</p>
                      <p className="text-white/30 text-xs">Please contact your system administrator to unlock your account.</p>
                    </div>
                  ) : (
                    <form onSubmit={handleRecoverySubmit} className="space-y-4">
                      {securityQuestions.map((q, i) => (
                        <div key={q.questionIndex}>
                          <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-1.5">
                            Question {i + 1}: {q.questionText}
                          </label>
                          <input
                            type="text"
                            placeholder="Your answer"
                            value={securityAnswers[q.questionIndex] ?? ""}
                            onChange={e => setSecurityAnswers(prev => ({ ...prev, [q.questionIndex]: e.target.value }))}
                            required
                            className={cn(
                              "w-full py-2.5 px-4 rounded-xl text-sm",
                              "bg-white/[0.05] border border-white/10 text-white placeholder-white/20",
                              "focus:outline-none focus:border-[#3A5A40]/60 focus:bg-white/[0.07] transition-all"
                            )}
                          />
                        </div>
                      ))}
                      <button
                        type="submit"
                        disabled={submittingRecovery || securityQuestions.some(q => !securityAnswers[q.questionIndex]?.trim())}
                        className={cn(
                          "w-full py-3 rounded-xl font-semibold text-sm transition-all mt-2",
                          "bg-[#1C3229] text-white border border-[#3A5A40]/50",
                          "hover:bg-[#243D2F] hover:border-[#3A5A40] disabled:opacity-40"
                        )}
                      >
                        {submittingRecovery ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit answers"}
                      </button>
                    </form>
                  )}

                  <button
                    type="button"
                    className="mt-5 text-xs text-white/30 hover:text-white/50 transition-colors block mx-auto"
                    onClick={() => { setAccountLocked(false); setSecurityAnswers({}); }}
                  >
                    ← Back to sign in
                  </button>
                </>
              )}
            </>
          ) : requires2fa ? (
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

              {devOtp && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  <span className="font-medium">Demo code:</span>
                  <code
                    className="font-mono font-bold tracking-widest cursor-pointer hover:bg-amber-500/10 px-1 rounded"
                    onClick={() => setTwoFactorCode(devOtp)}
                    title="Click to fill"
                  >
                    {devOtp}
                  </code>
                  <span className="text-amber-400/60 ml-auto">(click to fill)</span>
                </div>
              )}

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
                      if (data.testOtp) setDevOtp(data.testOtp);
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

              <div className="mb-6">
                <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2.5">Quick sign in</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { name: "CEO", title: "ceo@aventum.co", initials: "CE", email: "admin@aventum.co", password: "Aventum2024!" },
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
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Work email</label>
                  <input
                    type="email"
                    placeholder="you@aventum.co"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className={cn("w-full py-3 px-4 rounded-xl text-sm", "bg-white/[0.05] border border-white/10 text-white placeholder-white/20", "focus:outline-none focus:border-[#3A5A40]/60 focus:bg-white/[0.07] transition-all")}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className={cn("w-full py-3 px-4 pr-11 rounded-xl text-sm", "bg-white/[0.05] border border-white/10 text-white placeholder-white/20", "focus:outline-none focus:border-[#3A5A40]/60 focus:bg-white/[0.07] transition-all")}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className={cn("w-full py-3 rounded-xl font-semibold text-sm transition-all", "bg-[#1C3229] text-white border border-[#3A5A40]/50", "hover:bg-[#243D2F] hover:border-[#3A5A40] disabled:opacity-40")}
                >
                  {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Access portal"}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-white/15 text-[11px] mt-6 tracking-wide">
          Aventum Capital · Internal use only
        </p>
      </div>
    </div>
  );
}
