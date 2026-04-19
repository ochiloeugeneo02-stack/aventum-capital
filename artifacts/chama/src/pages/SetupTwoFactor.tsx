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
import { ShieldCheck, ShieldOff, Loader2, Copy, Check, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function SetupTwoFactor() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<"prompt" | "setup" | "backup">("prompt");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) navigate("/login");
    else if ((user as any)?.twoFactorEnabled) navigate("/dashboard");
  }, [isAuthenticated, user]);

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      const data: any = await apiRequest("/api/auth/2fa/setup", { method: "GET" });
      setQrDataUrl(data.qrDataUrl);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep("setup");
    } catch {
      toast({ title: "Error", description: "Could not start setup. Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("/api/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: code.replace(/\s/g, ""), backupCodes }),
        headers: { "Content-Type": "application/json" },
      });
      queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      toast({ title: "2FA enabled", description: "Your account is now secured." });
      setStep("backup");
    } catch (err: any) {
      toast({ title: "Invalid code", description: err?.data?.error ?? "Try again.", variant: "destructive" });
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (c: string, idx: number) => {
    navigator.clipboard.writeText(c);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
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
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            {step === "backup" ? "You're protected." : "Protect your savings."}
          </h2>
          <p className="text-white/60 leading-relaxed">
            {step === "backup"
              ? "Two-factor authentication is now active. Your account and savings are secured."
              : "Add a second layer of security so only you can access your account — even if your password is ever compromised."}
          </p>

          {step === "prompt" && (
            <div className="mt-8 space-y-3">
              {[
                "Protects against password theft",
                "Required to approve large transactions",
                "Takes less than 60 seconds to set up",
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

          {/* ── Step: prompt ── */}
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
                <h1 className="text-2xl font-bold">Set up two-factor authentication</h1>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  Hi {user?.name?.split(" ")[0]}, we strongly recommend enabling 2FA. It only takes a minute and adds a critical layer of protection to your savings account.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  className="w-full bg-[#3A5A40] hover:bg-[#344E41] h-11"
                  onClick={handleStartSetup}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                  Set up authenticator app
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
                <a href="/settings" className="text-[#3A5A40] hover:underline">Settings → Two-factor authentication</a>.
                <br />To turn it off after enabling, go to Settings and click "Disable".
              </p>
            </>
          )}

          {/* ── Step: setup (QR + verify) ── */}
          {step === "setup" && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold">Scan the QR code</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Open Google Authenticator, Authy, or any TOTP app and scan this code
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-white border border-border rounded-2xl shadow-sm">
                    <img src={qrDataUrl} alt="2FA QR code" className="w-48 h-48" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Can't scan?{" "}
                    <span className="font-medium">Enter this key manually:</span>
                    <br />
                    <code className="font-mono bg-muted px-2 py-0.5 rounded text-xs select-all mt-1 inline-block">{secret}</code>
                  </p>
                </div>

                <form onSubmit={handleVerify} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Enter the 6-digit code to confirm</Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      placeholder="000 000"
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      className="text-center text-xl font-mono tracking-widest"
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
                    Verify and enable 2FA
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => navigate("/dashboard")}
                  >
                    Skip for now
                  </Button>
                </form>
              </div>
            </>
          )}

          {/* ── Step: backup codes ── */}
          {step === "backup" && (
            <>
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#3A5A40]/10 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6 text-[#3A5A40]" />
                </div>
                <h1 className="text-2xl font-bold">Save your backup codes</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Store these in a safe place. If you ever lose access to your authenticator app, you can use one of these codes to sign in. Each code works once.
                </p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                <p className="text-xs font-semibold text-amber-800">
                  ⚠️ These codes will not be shown again. Copy them now.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-6">
                {backupCodes.map((c, idx) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => copyCode(c, idx)}
                    className="flex items-center justify-between px-3 py-2.5 bg-muted hover:bg-muted/80 rounded-lg font-mono text-sm transition-colors"
                  >
                    <span>{c}</span>
                    {copiedIndex === idx
                      ? <Check className="w-3.5 h-3.5 text-[#3A5A40]" />
                      : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                ))}
              </div>

              <Button
                className="w-full bg-[#3A5A40] hover:bg-[#344E41] h-11"
                onClick={() => navigate("/dashboard")}
              >
                Done — go to dashboard
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
