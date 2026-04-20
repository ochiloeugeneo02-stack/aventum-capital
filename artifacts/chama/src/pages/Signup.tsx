import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useRegisterUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRegion, REGIONS } from "@/contexts/RegionContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, ChevronRight, Globe, MapPin, CheckSquare, Square } from "lucide-react";
import { cn } from "@/lib/utils";

const slideVariants = {
  enter: (dir: number) => ({ x: dir * 52, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit: (dir: number) => ({ x: dir * -52, opacity: 0, transition: { duration: 0.22, ease: "easeIn" } }),
};

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? "";
    const country = data.address?.country ?? "";
    return [city, country].filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

const FEATURED_REGIONS = ["KE", "US", "GB", "EU", "NG", "CA", "AU", "TZ", "UG"];

const MOTIVATIONS = [
  { id: "car_note",        emoji: "🚗", label: "Pay car note" },
  { id: "rent",            emoji: "🏠", label: "Pay rent" },
  { id: "school",          emoji: "🎓", label: "Pay for school" },
  { id: "house_down",      emoji: "🏡", label: "Save for house down payment" },
  { id: "concert",         emoji: "🎵", label: "Save for concert" },
  { id: "car_down",        emoji: "🚘", label: "Save for car down payment" },
  { id: "vacation",        emoji: "✈️", label: "Save for family vacation" },
  { id: "other",           emoji: "✏️", label: "Other" },
];

const LEFT_PANEL: Record<string, { heading: string; body: string }> = {
  region:     { heading: "Where are you based?",          body: "This sets your display preference for how amounts are shown to you. Each group's actual currency is chosen by whoever creates it." },
  motivation: { heading: "What's driving you?",           body: "Tell us your savings goal and we'll help you find the right group to get there faster." },
  account:    { heading: "Almost there!",                  body: "Create your account and you'll be matched with a savings group that fits your goal." },
};

export default function Signup() {
  const [, navigate] = useLocation();
  const { setUser, isAuthenticated } = useAuth();
  const { region, setRegion } = useRegion();
  const { toast } = useToast();

  const [step, setStep] = useState<"region" | "motivation" | "account">("region");
  const directionRef = useRef<1 | -1>(1);
  const [form, setForm] = useState({ name: "", email: "", username: "", password: "", role: "group_admin", phoneNumber: "", emailMarketing: true });
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(region.code);
  const [selectedMotivation, setSelectedMotivation] = useState<string | null>(null);
  const [otherMotivation, setOtherMotivation] = useState("");
  const [location, setLocation] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);

  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !submitted) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, submitted]);

  const registerMutation = useRegisterUser({
    mutation: {
      onSuccess: async (data) => {
        setSubmitted(true);
        setUser(data.user as any);
        toast({ title: "Account created!", description: `Welcome, ${data.user.name}` });
        const pendingToken = localStorage.getItem("aventum_pending_invite");
        if (pendingToken) {
          try {
            const { apiRequest } = await import("@/lib/api");
            await apiRequest(`/api/invitations/${pendingToken}/accept`, { method: "POST" });
            localStorage.removeItem("aventum_pending_invite");
            toast({ title: "You've joined the group!", description: "Your invitation was accepted." });
            navigate("/setup-2fa");
          } catch {
            localStorage.removeItem("aventum_pending_invite");
            navigate("/setup-2fa");
          }
        } else {
          navigate("/setup-2fa");
        }
      },
      onError: (error: any) => {
        const message = error?.data?.error ?? "Registration failed";
        toast({ title: "Error", description: message, variant: "destructive" });
      },
    },
  });

  const handleRegionContinue = () => {
    directionRef.current = 1;
    setRegion(selectedRegion);
    setStep("motivation");
  };

  const resolvedMotivation = selectedMotivation === "other"
    ? otherMotivation.trim()
    : (MOTIVATIONS.find(m => m.id === selectedMotivation)?.label ?? null);

  const handleMotivationContinue = () => {
    if (selectedMotivation === "other" && !otherMotivation.trim()) return;
    directionRef.current = 1;
    setStep("account");
  };

  const goBack = (to: "region" | "motivation") => {
    directionRef.current = -1;
    setStep(to);
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location not available", description: "Your browser doesn't support location services." });
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocation(label || `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`);
        setLocationLoading(false);
      },
      () => {
        setLocationLoading(false);
        toast({ title: "Location denied", description: "You can still sign up — location is optional." });
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRegion(selectedRegion);
    registerMutation.mutate({
      data: {
        ...form,
        motivation: resolvedMotivation ?? undefined,
        location: location || undefined,
      } as any,
    });
  };

  const selectedInfo = REGIONS[selectedRegion];
  const stepIndex = step === "region" ? 0 : step === "motivation" ? 1 : 2;
  const panel = LEFT_PANEL[step];

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
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="max-w-md"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <div className="text-5xl mb-6">
              {step === "region" ? selectedInfo.flag : step === "motivation" ? "🎯" : "✅"}
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">{panel.heading}</h2>
            <p className="text-white/60 leading-relaxed">{panel.body}</p>
          </motion.div>
        </AnimatePresence>
        {/* Step dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === stepIndex ? "bg-white w-8" : i < stepIndex ? "bg-white/60 w-5" : "bg-white/30 w-5"
              )}
            />
          ))}
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <a href="/" className="inline-flex lg:hidden mb-8">
            <Logo variant="dark" iconOnly className="h-10 w-10" />
          </a>

          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={directionRef.current}>

              {/* Step 1: Region */}
              {step === "region" && (
                <motion.div
                  key="region"
                  custom={directionRef.current}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <div className="mb-8">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Step 1 of 3</span>
                    </div>
                    <h1 className="text-2xl font-bold">Where are you based?</h1>
                    <p className="text-muted-foreground mt-1">
                      This sets how amounts are displayed to you. Each group's currency is set by whoever creates it.
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
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <a href="/login" className="text-[#3A5A40] font-medium hover:underline">Sign in</a>
                  </p>
                </motion.div>
              )}

              {/* Step 2: Motivation */}
              {step === "motivation" && (
                <motion.div
                  key="motivation"
                  custom={directionRef.current}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <div className="mb-8">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="text-base">🎯</span>
                      <span>Step 2 of 3</span>
                    </div>
                    <h1 className="text-2xl font-bold">What's your savings goal?</h1>
                    <p className="text-muted-foreground mt-1">
                      Pick the one that best describes what you're saving towards.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {MOTIVATIONS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMotivation(m.id)}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all",
                          selectedMotivation === m.id
                            ? "border-[#3A5A40] bg-[#3A5A40]/5 shadow-sm"
                            : "border-border hover:border-[#3A5A40]/30 hover:bg-muted/30"
                        )}
                      >
                        <span className="text-2xl leading-none shrink-0">{m.emoji}</span>
                        <span className={cn(
                          "text-xs font-medium leading-snug",
                          selectedMotivation === m.id ? "text-[#3A5A40]" : "text-foreground"
                        )}>
                          {m.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {selectedMotivation === "other" && (
                    <div className="mb-4">
                      <Input
                        autoFocus
                        placeholder="Tell us what you're saving for…"
                        value={otherMotivation}
                        onChange={e => setOtherMotivation(e.target.value)}
                        className="border-[#3A5A40]/40 focus-visible:ring-[#3A5A40]/30"
                      />
                    </div>
                  )}

                  <Button
                    className="w-full bg-[#3A5A40] hover:bg-[#344E41] gap-2"
                    onClick={handleMotivationContinue}
                    disabled={!selectedMotivation || (selectedMotivation === "other" && !otherMotivation.trim())}
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </Button>

                  <button
                    type="button"
                    onClick={() => goBack("region")}
                    className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Back
                  </button>
                </motion.div>
              )}

              {/* Step 3: Account details */}
              {step === "account" && (
                <motion.div
                  key="account"
                  custom={directionRef.current}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="text-base">{selectedInfo.flag}</span>
                      <span>{selectedInfo.name} · {selectedInfo.currency}</span>
                      <button
                        type="button"
                        onClick={() => goBack("region")}
                        className="text-[#3A5A40] hover:underline ml-auto"
                      >
                        Change
                      </button>
                    </div>
                    <h1 className="text-2xl font-bold">Create your account</h1>
                    <p className="text-muted-foreground mt-1">Step 3 of 3 — your account details</p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
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
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          placeholder="grace_w"
                          value={form.username}
                          onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, "_") }))}
                        />
                      </div>
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
                      <Label htmlFor="phone">Phone number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+1 555 000 0000"
                        value={form.phoneNumber}
                        onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
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

                    {/* Location */}
                    <div className="space-y-2">
                      <Label>Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      {location ? (
                        <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-[#3A5A40] bg-[#3A5A40]/5">
                          <MapPin className="w-4 h-4 text-[#3A5A40] shrink-0" />
                          <span className="text-sm text-[#3A5A40] flex-1">{location}</span>
                          <button type="button" onClick={() => setLocation("")} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRequestLocation}
                          disabled={locationLoading}
                          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-border hover:border-[#3A5A40]/40 text-sm text-muted-foreground hover:text-foreground transition-all"
                        >
                          {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                          {locationLoading ? "Detecting location…" : "Allow location access"}
                        </button>
                      )}
                    </div>

                    {/* Email marketing consent */}
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, emailMarketing: !f.emailMarketing }))}
                      className="w-full flex items-start gap-3 p-3 rounded-xl border border-border hover:border-[#3A5A40]/30 text-left transition-colors"
                    >
                      {form.emailMarketing
                        ? <CheckSquare className="w-4 h-4 text-[#3A5A40] shrink-0 mt-0.5" />
                        : <Square className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        I'd like to receive savings tips, group updates, and promotional emails from Aventum Capital. You can unsubscribe any time.
                      </span>
                    </button>

                    <Button
                      type="submit"
                      className="w-full bg-[#3A5A40] hover:bg-[#344E41]"
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create account
                    </Button>
                  </form>

                  <button
                    type="button"
                    onClick={() => goBack("motivation")}
                    className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Back
                  </button>

                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <a href="/login" className="text-[#3A5A40] font-medium hover:underline">Sign in</a>
                  </p>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
