import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { STAFF_ROLES } from "@/pages/StaffPortal";

export default function SetPassword() {
  const [, navigate] = useLocation();
  const { user, setUser, isLoading } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/staff");
      return;
    }
    if (!user.requiresPasswordReset) {
      navigate(STAFF_ROLES.includes(user.role) ? "/staff" : "/dashboard");
    }
  }, [isLoading, user]);

  if (isLoading || !user || !user.requiresPasswordReset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiRequest("/api/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ password }),
        headers: { "Content-Type": "application/json" },
      });
      setUser({ ...user!, requiresPasswordReset: false });
      toast({ title: "Password set!", description: "Your new password is active. Welcome to the staff portal." });
      navigate("/staff");
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to set password. Please try again.");
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
          <a href="/" className="inline-flex mb-12">
            <Logo variant="white" />
          </a>
          <h2 className="text-3xl font-bold text-white mb-4">Set your password</h2>
          <p className="text-white/60 leading-relaxed mb-8">
            Your account was created with a temporary password. Choose a strong personal password to secure your access to the staff portal.
          </p>
          <div className="space-y-3">
            {["At least 8 characters long", "Mix of letters and numbers recommended", "You'll use it every time you sign in"].map(tip => (
              <div key={tip} className="flex items-center gap-3 text-white/70 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[#A3B18A]" />
                {tip}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex lg:hidden mb-8">
            <Logo variant="dark" iconOnly className="h-10 w-10" />
          </a>

          <div className="mb-8">
            <div className="w-12 h-12 rounded-xl bg-[#3A5A40]/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-[#3A5A40]" />
            </div>
            <h1 className="text-2xl font-bold">Set your password</h1>
            <p className="text-muted-foreground mt-1">
              Welcome, <span className="font-medium">{user?.name ?? "there"}</span>. Before you continue, choose a personal password for your account.
            </p>
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
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="pr-10"
                  autoFocus
                  autoComplete="new-password"
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
                autoComplete="new-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#3A5A40] hover:bg-[#344E41]"
              disabled={loading || password.length < 8}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Set password and continue
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
