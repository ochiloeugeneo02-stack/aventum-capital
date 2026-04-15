import { useState } from "react";
import { useLocation } from "wouter";
import { useRegisterUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRegion, REGIONS } from "@/contexts/RegionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ChevronRight, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURED_REGIONS = ["KE", "US", "GB", "EU", "NG", "CA", "AU", "TZ", "UG"];

export default function Signup() {
  const [, navigate] = useLocation();
  const { setUser, isAuthenticated } = useAuth();
  const { region, setRegion } = useRegion();
  const { toast } = useToast();

  const [step, setStep] = useState<"region" | "account">("region");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "member" });
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(region.code);

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

  const handleRegionContinue = () => {
    setRegion(selectedRegion);
    setStep("account");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegion(selectedRegion);
    registerMutation.mutate({ data: form as any });
  };

  const selectedInfo = REGIONS[selectedRegion];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div
        className="hidden lg:flex w-1/2 flex-col justify-between px-16 py-16"
        style={{ background: "linear-gradient(135deg, #344E41 0%, #3A5A40 60%, #3A5A40 100%)" }}
      >
        <a href="/" className="inline-flex">
          <Logo variant="white" />
        </a>
        <div className="max-w-md">
          <div className="text-5xl mb-6">{selectedInfo.flag}</div>
          <h2 className="text-3xl font-bold text-white mb-4">
            {step === "region"
              ? "Where are you based?"
              : `Welcome from ${selectedInfo.name}`}
          </h2>
          <p className="text-white/60 leading-relaxed">
            {step === "region"
              ? "We'll show contribution amounts and payouts in your local currency, so everything feels familiar."
              : `You'll see all amounts in ${selectedInfo.currency}. You can change this anytime from the top menu.`}
          </p>
        </div>
        <div className="flex gap-2">
          <div className={cn("h-1.5 rounded-full w-8 transition-colors", step === "region" ? "bg-white" : "bg-white/30")} />
          <div className={cn("h-1.5 rounded-full w-8 transition-colors", step === "account" ? "bg-white" : "bg-white/30")} />
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex lg:hidden mb-8">
            <Logo variant="dark" iconOnly className="h-10 w-10" />
          </a>

          {/* Step 1: Region */}
          {step === "region" && (
            <div>
              <div className="mb-8">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Globe className="w-3.5 h-3.5" />
                  <span>Step 1 of 2</span>
                </div>
                <h1 className="text-2xl font-bold">Where are you based?</h1>
                <p className="text-muted-foreground mt-1">
                  We'll show amounts in your local currency — you can change this any time.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {FEATURED_REGIONS.map(code => {
                  const r = REGIONS[code];
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedRegion(code)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all",
                        selectedRegion === code
                          ? "border-[#3A5A40] bg-[#3A5A40]/5 shadow-sm"
                          : "border-border hover:border-[#3A5A40]/30 hover:bg-muted/30"
                      )}
                    >
                      <span className="text-2xl leading-none">{r.flag}</span>
                      <div className="font-medium text-xs leading-tight">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{r.currency}</div>
                    </button>
                  );
                })}
              </div>

              <Button
                className="w-full bg-[#3A5A40] hover:bg-[#344E41] gap-2"
                onClick={handleRegionContinue}
              >
                Continue with {selectedInfo.currency}
                <ChevronRight className="w-4 h-4" />
              </Button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <a href="/login" className="text-[#3A5A40] font-medium hover:underline">Sign in</a>
              </p>
            </div>
          )}

          {/* Step 2: Account details */}
          {step === "account" && (
            <div>
              <div className="mb-8">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="text-base">{selectedInfo.flag}</span>
                  <span>{selectedInfo.name} · {selectedInfo.currency}</span>
                  <button
                    type="button"
                    onClick={() => setStep("region")}
                    className="text-[#3A5A40] hover:underline ml-auto"
                  >
                    Change
                  </button>
                </div>
                <h1 className="text-2xl font-bold">Create your account</h1>
                <p className="text-muted-foreground mt-1">Step 2 of 2 — your account details</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    placeholder="Grace Wanjiku"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="grace@example.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                      minLength={6}
                      className="pr-10"
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
                        className={cn(
                          "p-3 rounded-xl border-2 text-left transition-colors",
                          form.role === opt.value
                            ? "border-[#3A5A40] bg-[#3A5A40]/5 text-[#3A5A40]"
                            : "border-border hover:border-[#3A5A40]/30"
                        )}
                      >
                        <div className="font-medium text-sm">{opt.label}</div>
                        <div className="text-xs text-muted-foreground">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#3A5A40] hover:bg-[#344E41]"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create account
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <a href="/login" className="text-[#3A5A40] font-medium hover:underline">Sign in</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
