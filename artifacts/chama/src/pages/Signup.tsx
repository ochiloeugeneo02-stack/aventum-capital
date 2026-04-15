import { useState } from "react";
import { useLocation } from "wouter";
import { useRegisterUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Signup() {
  const [, navigate] = useLocation();
  const { setUser, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    navigate("/dashboard");
    return null;
  }

  const registerMutation = useRegisterUser({
    mutation: {
      onSuccess: (data) => {
        setUser(data.user as any);
        toast({ title: "Account created!", description: `Welcome, ${data.user.name}` });
        navigate("/dashboard");
      },
      onError: (error: any) => {
        const message = error?.data?.error ?? "Registration failed";
        toast({ title: "Error", description: message, variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ data: form as any });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex w-1/2 flex-col justify-center px-16"
        style={{ background: "linear-gradient(135deg, #1a3a2a 0%, #2d5a3d 60%, #1e4a30 100%)" }}
      >
        <div className="max-w-md">
          <a href="/" className="inline-flex mb-12">
            <Logo variant="white" className="h-10 w-auto" />
          </a>
          <h2 className="text-3xl font-bold text-white mb-4">
            Start saving with your community
          </h2>
          <p className="text-white/60">
            Join thousands using Aventum Capital to grow their savings through structured, transparent rotational savings groups.
          </p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex lg:hidden mb-8">
            <Logo variant="dark" className="h-8 w-auto" />
          </a>

          <div className="mb-8">
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-muted-foreground mt-1">Join the platform and start your savings journey</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Grace Wanjiku" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="grace@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="At least 6 characters" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Account type</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: "member", label: "Member", desc: "Join existing groups" },
                  { value: "group_admin", label: "Group Admin", desc: "Create and manage groups" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: opt.value }))}
                    className={`p-3 rounded-xl border-2 text-left transition-colors ${form.role === opt.value ? "border-[#2E6B4A] bg-[#2E6B4A]/5 text-[#2E6B4A]" : "border-border hover:border-[#2E6B4A]/30"}`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full bg-[#2E6B4A] hover:bg-[#245a3c]" disabled={registerMutation.isPending}>
              {registerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/login" className="text-[#2E6B4A] font-medium hover:underline">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
