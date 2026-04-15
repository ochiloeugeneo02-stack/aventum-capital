import { useState } from "react";
import { useLocation } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();
  const { setUser, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    navigate("/dashboard");
    return null;
  }

  const loginMutation = useLoginUser({
    mutation: {
      onSuccess: (data) => {
        setUser(data.user as any);
        toast({ title: "Welcome back!", description: `Signed in as ${data.user.name}` });
        navigate("/dashboard");
      },
      onError: () => {
        toast({ title: "Login failed", description: "Invalid email or password", variant: "destructive" });
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ data: { email, password } });
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
            Welcome back to your savings circle
          </h2>
          <p className="text-white/60 mb-8">
            Sign in to track your contributions, view your payout schedule, and manage your groups.
          </p>
          <div className="space-y-3">
            {["Real-time contribution tracking", "Transparent rotation schedule", "Instant payout notifications"].map(item => (
              <div key={item} className="flex items-center gap-3 text-white/70 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[#7ec8a0]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex lg:hidden mb-8">
            <Logo variant="dark" className="h-8 w-auto" />
          </a>

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
            <Button type="submit" className="w-full bg-[#2E6B4A] hover:bg-[#245a3c]" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sign in
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted/50 rounded-xl text-xs text-muted-foreground">
            <p className="font-medium mb-1">Demo accounts:</p>
            <p>admin@aventum.co / admin123 (Super Admin)</p>
            <p>grace@aventum.co / grace123 (Group Admin)</p>
            <p>amina@aventum.co / member123 (Member)</p>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a href="/signup" className="text-[#2E6B4A] font-medium hover:underline">Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
