import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCurrentUserQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, ShieldOff, Loader2, Mail, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function SetupTwoFactor() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"prompt" | "verify" | "done">("prompt");
  const [emailHint, setEmailHint] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if ((user as any)?.twoFactorEnabled) navigate("/dashboard");
  }, [isAuthenticated, user]);

  const handleSendCode = async () => {
    setLoading(true);
    try {
      const data: any = await apiRequest("/api/auth/2fa/request", { method: "POST" });
      setEmailHint(data.emailHint ?? "");
      setStep("verify");
    } catch {
      toast({ title: "Error", description: "Could not send code. Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await apiRequest("/api/auth/2fa/request", { method: "POST" });
      toast({ title: "Code resent", description: "Check your inbox for a new code." });
    } catch {
      toast({ title: "Error", description: "Could not resend code.", variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("/api/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: code.replace(/\s/g, "") }),
        headers: { "Content-Type": "application/json" },
      });
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({ title: "Email verification enabled", description: "Your account is now protected." });
      setStep("done");
    } catch (err: any) {
      toast({ title: "Invalid code", description: err?.data?.error ?? "Try again.", variant: "destructive" });
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div
        className="hidden lg:flex w-5/12 flex-col justify-between px-14 py-12"
        style={{ background: "linear-gradient(150deg, #2D4A35 0%, #3A5A40 55%, #4a7c57 100%)" }}
      >
        <a href="/">
          <Logo variant="white" />
        </a>

        <div className="max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
            {step === "done" ? <ShieldCheck className="w-7 h-7 text-white" /> : <Mail className="w-7 h-7 text-white" />}
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            {step === "done" ? "You're protected." : "Protect your savings."}
          </h2>
          <p className="text-white/60 leading-relaxed">
            {step === "done"
              ? "Email verification is now active. Each time you log in you'll get a one-time code sent to your inbox."
              : "Add a second layer of security. Each sign-in will require a code sent to your email — no apps needed."}
          </p>

          {step === "prompt" && (
            <div className="mt-8 space-y-3">
              {[
                "Code sent to your email on every sign-in",
                "No authenticator app required",
                "Takes less than 30 seconds to set up",
              ].map(item => (
                <div key={item} className="flex items-center gap-3 text-white/70 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A3B18A] shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-white/30 text-xs">© {new Date().getFullYear()} Aventum Capital</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* ── Prompt ── */}
          {step === "prompt" && (
            <>
              <div className="mb-8">
                <a href="/" className="inline-flex lg:hidden mb-6">
                  <Logo variant="dark" iconOnly className="h-9 w-9" />
                </a>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full mb-4">
                  <ShieldOff className="w-3.5 h-3.5" />
                  Your account is not fully secured yet
                </div>
                <h1 className="text-2xl font-bold">Enable email verification</h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Hi {user?.name?.split(" ")[0]}, we strongly recommend enabling two-factor authentication. Every time you sign in, we'll send a quick code to your email to confirm it's really you.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full bg-[#3A5A40] hover:bg-[#344E41] h-11"
                  onClick={handleSendCode}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Send me a verification code
                </Button>

                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                  onClick={() => navigate("/dashboard")}
                >
                  Skip for now
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>

              <p className="mt-5 text-center text-xs text-muted-foreground">
                You can always enable this later in{" "}
                <a href="/settings" className="text-[#3A5A40] hover:underline">Settings → Security</a>.
              </p>
            </>
          )}

          {/* ── Verify ── */}
          {step === "verify" && (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#3A5A40]/10 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-[#3A5A40]" />
                </div>
                <h1 className="text-2xl font-bold">Enter the code</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  We sent a 6-digit code to <span className="font-medium">{emailHint || "your email"}</span>. Enter it below to activate email verification.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification code</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                    maxLength={6}
                    autoFocus
                    autoComplete="one-time-code"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#3A5A40] hover:bg-[#344E41] h-11"
                  disabled={loading || code.length < 6}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify and enable
                </Button>
              </form>

              <div className="mt-5 space-y-3 text-center">
                <button
                  type="button"
                  disabled={resending}
                  className="text-sm text-[#3A5A40] hover:underline disabled:opacity-50"
                  onClick={handleResend}
                >
                  {resending ? "Resending…" : "Didn't get it? Resend code"}
                </button>
                <div>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground"
                    onClick={() => navigate("/dashboard")}
                  >
                    Skip for now
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <>
              <div className="mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#3A5A40]/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-[#3A5A40]" />
                </div>
                <h1 className="text-2xl font-bold">You're all set!</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Email verification is now active. From now on, each sign-in will require a code sent to your email.
                </p>
              </div>

              <Button
                className="w-full bg-[#3A5A40] hover:bg-[#344E41] h-11"
                onClick={() => navigate("/dashboard")}
              >
                Go to dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
