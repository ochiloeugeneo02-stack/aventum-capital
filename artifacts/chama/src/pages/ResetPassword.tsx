import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const token = new URLSearchParams(search).get("token");

  useEffect(() => {
    if (!token) setError("Invalid or missing reset token. Please request a new link.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
        headers: { "Content-Type": "application/json" },
      });
      setDone(true);
    } catch (err: any) {
      const msg = err?.data?.error ?? "This reset link is invalid or has expired. Please request a new one.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div
        className="hidden lg:flex w-1/2 flex-col justify-center px-16"
        style={{ background: "linear-gradient(135deg, #344E41 0%, #3A5A40 60%, #3A5A40 100%)" }}
      >
        <div className="max-w-md">
          <a href="/" className="inline-flex mb-12"><Logo variant="white" /></a>
          <h2 className="text-3xl font-bold text-white mb-4">Choose a new password</h2>
          <p className="text-white/60 leading-relaxed">
            Make it strong — at least 6 characters. You'll use it to sign in to your savings circle.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex lg:hidden mb-8">
            <Logo variant="dark" iconOnly className="h-10 w-10" />
          </a>

          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-[#3A5A40]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-[#3A5A40]" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Password updated!</h1>
              <p className="text-muted-foreground mb-8">
                Your password has been changed successfully. You can now sign in with your new password.
              </p>
              <Button className="bg-[#3A5A40] hover:bg-[#344E41]" onClick={() => navigate("/login")}>
                Sign in now
              </Button>
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>

              <div className="mb-8">
                <h1 className="text-2xl font-bold">Set new password</h1>
                <p className="text-muted-foreground mt-1">Choose a strong password for your account.</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-destructive/10 text-destructive text-sm p-3 rounded-lg mb-5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                      disabled={!token}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    disabled={!token}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#3A5A40] hover:bg-[#344E41]"
                  disabled={loading || !token}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update password
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
