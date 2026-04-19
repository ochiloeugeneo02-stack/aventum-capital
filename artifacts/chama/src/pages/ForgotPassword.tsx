import { useState } from "react";
import { useLocation } from "wouter";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { apiRequest } from "@/lib/api";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
      });
      setSent(true);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again later.", variant: "destructive" });
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
          <h2 className="text-3xl font-bold text-white mb-4">Forgot your password?</h2>
          <p className="text-white/60 leading-relaxed">
            No worries — it happens to everyone. Enter your email and we'll send you a secure link to reset it.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex lg:hidden mb-8">
            <Logo variant="dark" iconOnly className="h-10 w-10" />
          </a>

          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-[#3A5A40]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-[#3A5A40]" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Check your email</h1>
              <p className="text-muted-foreground mb-8">
                If <strong>{email}</strong> is registered, you'll receive a reset link within a few minutes. Check your spam folder if you don't see it.
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => navigate("/login")}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
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
                <h1 className="text-2xl font-bold">Reset your password</h1>
                <p className="text-muted-foreground mt-1">
                  Enter your email address and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="grace@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-[#3A5A40] hover:bg-[#344E41]"
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Send reset link
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
