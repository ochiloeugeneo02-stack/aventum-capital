import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";

const SESSION_KEY_2FA_TOKEN = "aventum_2fa_token";
const SESSION_KEY_2FA_EMAIL_HINT = "aventum_2fa_email_hint";
const SESSION_KEY_REQUIRES_2FA = "aventum_requires_2fa";

export default function Login() {
  const [, navigate] = useLocation();
  const { setUser, isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Restore 2FA state from sessionStorage (survives HMR / page reload)
  const [requires2fa, setRequires2fa] = useState(() => sessionStorage.getItem(SESSION_KEY_REQUIRES_2FA) === "true");
  const [emailHint, setEmailHint] = useState(() => sessionStorage.getItem(SESSION_KEY_2FA_EMAIL_HINT) ?? "");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState(() => sessionStorage.getItem(SESSION_KEY_2FA_TOKEN) ?? "");
  const [validating2fa, setValidating2fa] = useState(false);
  const [resending, setResending] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);

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
      onError: () => {
        toast({ title: "Login failed", description: "Invalid email or password", variant: "destructive" });
      },
    },
  });

  async function completeLogin(user: any) {
    setUser(user);
    toast({ title: "Welcome back!", description: `Signed in as ${user.name}` });

    // Super admins belong in the staff portal
    if (user.role === "super_admin") {
      navigate("/staff");
      return;
    }

    const pendingToken = localStorage.getItem("aventum_pending_invite");
    if (pendingToken) {
      try {
        await apiRequest(`/api/invitations/${pendingToken}/accept`, { method: "POST" });
        localStorage.removeItem("aventum_pending_invite");
        toast({ title: "You've joined the group!", description: "Your invitation was accepted." });
      } catch {
        localStorage.removeItem("aventum_pending_invite");
      }
    }
    navigate("/dashboard");
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
        navigate(`/reset-password?token=${encodeURIComponent(data.resetToken)}`);
        return;
      }
      await completeLogin(data.user);
    } catch (err: any) {
      const msg = err?.data?.error ?? err?.message ?? "Invalid code. Try again.";
      toast({ title: "Verification failed", description: msg, variant: "destructive" });
      setTwoFactorCode("");
    } finally {
      setValidating2fa(false);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.role === "super_admin") navigate("/staff");
    else navigate("/dashboard");
  }, [isAuthenticated, user]);

  if (isAuthenticated) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex w-1/2 flex-col justify-center px-16"
        style={{ background: "linear-gradient(135deg, #344E41 0%, #3A5A40 60%, #3A5A40 100%)" }}
      >
        <div className="max-w-md">
          <a href="/" className="inline-flex mb-12">
            <Logo variant="white" />
          </a>
          <h2 className="text-3xl font-bold text-white mb-4">
            {requires2fa ? "One more step" : "Welcome back to your savings circle"}
          </h2>
          <p className="text-white/60 mb-8">
            {requires2fa
              ? "We emailed you a 6-digit code. Enter it below to complete sign-in."
              : "Sign in to track your contributions, view your payout schedule, and manage your groups."}
          </p>
          {!requires2fa && (
            <div className="space-y-3">
              {["Real-time contribution tracking", "Transparent rotation schedule", "Instant payout notifications"].map(item => (
                <div key={item} className="flex items-center gap-3 text-white/70 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A3B18A]" />
                  {item}
                </div>
              ))}
            </div>
          )}
          {requires2fa && (
            <div className="flex items-center gap-3 text-white/70 text-sm">
              <ShieldCheck className="w-5 h-5 text-[#A3B18A]" />
              Your account is protected with two-factor authentication
            </div>
          )}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex lg:hidden mb-8">
            <Logo variant="dark" iconOnly className="h-10 w-10" />
          </a>

          {requires2fa ? (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#3A5A40]/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-[#3A5A40]" />
                </div>
                <h1 className="text-2xl font-bold">Check your email</h1>
                <p className="text-muted-foreground mt-1">
                  We sent a 6-digit code to <span className="font-medium">{emailHint || "your email"}</span>
                </p>
              </div>

              <form onSubmit={handle2faSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="totp-code">Verification code</Label>
                  <Input
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={twoFactorCode}
                    onChange={e => setTwoFactorCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    autoFocus
                    autoComplete="one-time-code"
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#3A5A40] hover:bg-[#344E41]"
                  disabled={validating2fa || twoFactorCode.length < 6}
                >
                  {validating2fa && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify and sign in
                </Button>
              </form>

              {devOtp && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  <span className="font-medium">Demo code:</span>
                  <code
                    className="font-mono font-bold tracking-widest cursor-pointer hover:bg-amber-100 px-1 rounded"
                    onClick={() => setTwoFactorCode(devOtp)}
                    title="Click to fill"
                  >
                    {devOtp}
                  </code>
                  <span className="text-amber-600 ml-auto">(click to fill)</span>
                </div>
              )}

              <div className="mt-5 space-y-3 text-center">
                <button
                  type="button"
                  disabled={resending}
                  className="text-sm text-[#3A5A40] hover:underline disabled:opacity-50"
                  onClick={async () => {
                    setResending(true);
                    try {
                      const data: any = await apiRequest("/api/auth/2fa/resend", {
                        method: "POST",
                        body: JSON.stringify({ twoFactorToken }),
                      });
                      if (data.twoFactorToken) {
                        enter2faState(data.twoFactorToken, emailHint);
                      }
                      if (data.testOtp) setDevOtp(data.testOtp);
                      setTwoFactorCode("");
                      toast({ title: "Code resent", description: "Check your inbox for a new code." });
                    } catch {
                      toast({ title: "Could not resend", description: "Please try again.", variant: "destructive" });
                    } finally {
                      setResending(false);
                    }
                  }}
                >
                  {resending ? "Resending…" : "Didn't get it? Resend code"}
                </button>
                <div>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => clear2faState()}
                  >
                    ← Back to login
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-bold">Sign in</h1>
                <p className="text-muted-foreground mt-1">Enter your credentials to access your account</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="grace@aventum.co" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" className="pr-10" />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-[#3A5A40] hover:bg-[#344E41]" disabled={loginMutation.isPending}>
                  {loginMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign in
                </Button>
              </form>

              <div className="mt-6 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground">
                <p className="font-medium mb-2">Demo accounts — click to fill:</p>
                <div className="space-y-1.5">
                  {[
                    { label: "Super Admin", email: "admin@aventum.co", password: "admin123", color: "bg-purple-100 text-purple-700 hover:bg-purple-200" },
                    { label: "Grace", email: "grace@aventum.co", password: "grace123", color: "bg-[#3A5A40]/10 text-[#3A5A40] hover:bg-[#3A5A40]/20" },
                    { label: "Amina", email: "amina@aventum.co", password: "member123", color: "bg-blue-100 text-blue-700 hover:bg-blue-200" },
                  ].map(({ label, email, password, color }) => (
                    <button
                      key={email}
                      type="button"
                      onClick={() => { setEmail(email); setPassword(password); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${color}`}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="opacity-70">{email}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm text-[#3A5A40] hover:underline"
                >
                  Forgot your password?
                </button>
              </div>

              <p className="mt-4 text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <a href="/signup" className="text-[#3A5A40] font-medium hover:underline">Sign up</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
