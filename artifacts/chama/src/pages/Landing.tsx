import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { Eye, EyeOff, Loader2, ChevronDown, Facebook, Twitter, Instagram, ArrowRight, Shield, Zap, Globe, BarChart3, Users, CheckCircle2 } from "lucide-react";

/* ─── 3D Floating Coin Stack SVG ─────────────────────────── */
function CoinStack3D({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="coinTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="100%" stopColor="#F0A030" />
        </linearGradient>
        <linearGradient id="coinSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C97B1A" />
          <stop offset="100%" stopColor="#8B5A00" />
        </linearGradient>
        <linearGradient id="coinShine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFF5B0" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FFE066" stopOpacity="0" />
        </linearGradient>
      </defs>
      <ellipse cx="70" cy="130" rx="52" ry="16" fill="url(#coinSide)" />
      <ellipse cx="70" cy="118" rx="52" ry="16" fill="url(#coinTop)" />
      <ellipse cx="70" cy="118" rx="36" ry="10" fill="url(#coinShine)" fillOpacity="0.5" />
      <ellipse cx="70" cy="108" rx="52" ry="16" fill="url(#coinSide)" />
      <ellipse cx="70" cy="96" rx="52" ry="16" fill="url(#coinTop)" />
      <ellipse cx="70" cy="96" rx="36" ry="10" fill="url(#coinShine)" fillOpacity="0.5" />
      <ellipse cx="70" cy="86" rx="52" ry="16" fill="url(#coinSide)" />
      <ellipse cx="70" cy="74" rx="52" ry="16" fill="url(#coinTop)" />
      <ellipse cx="70" cy="74" rx="36" ry="10" fill="url(#coinShine)" fillOpacity="0.5" />
      <ellipse cx="70" cy="64" rx="52" ry="16" fill="url(#coinSide)" />
      <ellipse cx="70" cy="52" rx="52" ry="16" fill="url(#coinTop)" />
      <text x="70" y="57" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#8B5A00" fontFamily="serif">$</text>
      <ellipse cx="70" cy="52" rx="36" ry="10" fill="url(#coinShine)" fillOpacity="0.4" />
    </svg>
  );
}

/* ─── 3D Savings Card SVG ─────────────────────────────────── */
function SavingsCard3D({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2D5F38" />
          <stop offset="100%" stopColor="#1a3a22" />
        </linearGradient>
        <linearGradient id="cardShine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.15" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="chipGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD966" />
          <stop offset="100%" stopColor="#C97B1A" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="184" height="114" rx="12" fill="black" fillOpacity="0.25" />
      <rect x="2" y="2" width="184" height="114" rx="12" fill="url(#cardBg)" />
      <rect x="2" y="2" width="184" height="114" rx="12" fill="url(#cardShine)" />
      <rect x="18" y="28" width="34" height="26" rx="4" fill="url(#chipGold)" />
      <rect x="24" y="33" width="22" height="4" rx="2" fill="#8B5A00" fillOpacity="0.4" />
      <rect x="24" y="40" width="22" height="4" rx="2" fill="#8B5A00" fillOpacity="0.4" />
      <rect x="24" y="47" width="12" height="4" rx="2" fill="#8B5A00" fillOpacity="0.4" />
      {[30, 66, 102, 138].map((x, i) => (
        <g key={i}>
          <circle cx={x} cy="82" r="3" fill="white" fillOpacity={i === 3 ? 1 : 0.4} />
          <circle cx={x + 8} cy="82" r="3" fill="white" fillOpacity={i === 3 ? 1 : 0.4} />
          <circle cx={x + 16} cy="82" r="3" fill="white" fillOpacity={i === 3 ? 1 : 0.4} />
          {i < 3 && <circle cx={x + 24} cy="82" r="3" fill="white" fillOpacity="0.4" />}
        </g>
      ))}
      <text x="18" y="108" fontSize="9" fill="white" fillOpacity="0.7" fontFamily="monospace" letterSpacing="1">AVENTUM CAPITAL</text>
      <circle cx="162" cy="38" r="14" fill="#A3B18A" fillOpacity="0.8" />
      <circle cx="152" cy="38" r="14" fill="#3A5A40" fillOpacity="0.9" />
      <path d="M168 26 Q175 31 175 38 Q175 45 168 50" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5" />
      <path d="M172 22 Q181 28 181 38 Q181 48 172 54" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.3" />
    </svg>
  );
}

/* ─── 3D Trophy SVG ─────────────────────────────────────── */
function Trophy3D({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trophyGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFE066" />
          <stop offset="50%" stopColor="#F0A030" />
          <stop offset="100%" stopColor="#C97B1A" />
        </linearGradient>
        <linearGradient id="trophyShine" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.6" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="30" y="102" width="40" height="8" rx="3" fill="url(#trophyGold)" />
      <rect x="38" y="94" width="24" height="10" rx="2" fill="#C97B1A" />
      <path d="M20 20 Q20 78 50 82 Q80 78 80 20 Z" fill="url(#trophyGold)" />
      <path d="M20 20 Q20 78 50 82 Q80 78 80 20 Z" fill="url(#trophyShine)" />
      <path d="M20 28 Q6 28 6 44 Q6 60 20 60" stroke="#C97B1A" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M80 28 Q94 28 94 44 Q94 60 80 60" stroke="#C97B1A" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M50 35 L53 45 L63 45 L55 51 L58 61 L50 55 L42 61 L45 51 L37 45 L47 45 Z" fill="white" fillOpacity="0.8" />
      <ellipse cx="50" cy="20" rx="30" ry="8" fill="#F0A030" />
      <ellipse cx="50" cy="20" rx="30" ry="8" fill="url(#trophyShine)" />
    </svg>
  );
}

/* ─── Floating Group Card ─────────────────────────────────── */
function GroupCard3D({ name, amount, members, gradient }: { name: string; amount: string; members: number; gradient: string }) {
  return (
    <div
      className="relative rounded-2xl p-5 text-white shadow-2xl"
      style={{
        background: gradient,
        transform: "perspective(600px) rotateY(-8deg) rotateX(4deg)",
        boxShadow: "8px 12px 40px rgba(0,0,0,0.35)",
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Savings Group</div>
      <div className="text-base font-bold mb-3">{name}</div>
      <div className="text-3xl font-extrabold mb-1">{amount}</div>
      <div className="text-xs opacity-60">{members} members · Active</div>
      <div className="absolute bottom-4 right-4 flex -space-x-2">
        {Array.from({ length: Math.min(members, 4) }).map((_, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-full border-2 border-white/30 flex items-center justify-center text-xs font-bold"
            style={{ background: `hsl(${140 + i * 30} 40% 40%)` }}
          >
            {String.fromCharCode(65 + i)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Hero Login Panel ─────────────────────────────────────── */
function HeroLoginPanel() {
  const [, navigate] = useLocation();
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const loginMutation = useLoginUser({
    mutation: {
      onSuccess: (data: any) => {
        if (data.requiresTwoFactor) {
          sessionStorage.setItem("aventum_2fa_token", data.twoFactorToken ?? "");
          sessionStorage.setItem("aventum_2fa_email_hint", data.emailHint ?? "");
          sessionStorage.setItem("aventum_requires_2fa", "true");
          navigate("/login");
          return;
        }
        setUser(data.user);
        toast({ title: "Welcome back!", description: `Signed in as ${data.user.name}` });
        navigate("/dashboard");
      },
      onError: () => {
        toast({ title: "Login failed", description: "Invalid email or password", variant: "destructive" });
      },
    },
  });

  return (
    <div
      className="rounded-3xl p-6 sm:p-8 w-full max-w-sm backdrop-blur-xl"
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
      }}
    >
      <h3 className="text-xl font-bold text-white mb-1">Welcome back!</h3>
      <p className="text-white/50 text-sm mb-6">Sign in to your savings circle</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loginMutation.mutate({ data: { email: email.trim().toLowerCase(), password } });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Email or username</label>
          <input
            type="text"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 focus:outline-none pr-10"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 hover:opacity-90"
          style={{ background: "white", color: "#1a3a22" }}
        >
          {loginMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Sign In
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between text-xs text-white/40">
        <button onClick={() => navigate("/forgot-password")} className="hover:text-white/70 transition-colors">
          Forgot password?
        </button>
        <button onClick={() => navigate("/signup")} className="text-white/70 font-semibold hover:text-white transition-colors">
          Create account →
        </button>
      </div>
      <div className="mt-5 pt-4 border-t border-white/10 text-xs text-white/30 hidden sm:block">
        <p className="font-medium text-white/40 mb-1.5">Demo accounts</p>
        <p>admin@aventum.co · Aventum2024!</p>
        <p>grace@aventum.co · grace123</p>
      </div>
    </div>
  );
}

/* ─── FAQ Item ─────────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#3A5A40]/15 py-5">
      <button className="w-full flex items-center justify-between text-left gap-4" onClick={() => setOpen(!open)}>
        <span className="text-sm font-semibold text-[#1a3a22]">{q}</span>
        <ChevronDown className={`w-4 h-4 text-[#3A5A40] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="mt-3 text-sm text-gray-500 leading-relaxed pr-8">{a}</p>}
    </div>
  );
}

/* ─── Step Card ────────────────────────────────────────────── */
function StepCard({ number, title, desc, icon, delay }: { number: string; title: string; desc: string; icon: React.ReactNode; delay: string }) {
  return (
    <div
      className="relative rounded-3xl p-8 text-white reveal"
      style={{
        background: "linear-gradient(135deg, #2D5F38 0%, #1a3a22 100%)",
        boxShadow: "0 20px 60px rgba(26,58,34,0.35)",
        transitionDelay: delay,
      }}
    >
      <div className="absolute top-5 right-6 text-6xl font-black opacity-10 select-none">{number}</div>
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: "rgba(163,177,138,0.2)", border: "1px solid rgba(163,177,138,0.3)" }}
      >
        <span className="text-[#A3B18A]">{icon}</span>
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

/* ─── Feature Pill ─────────────────────────────────────────── */
function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
      style={{ background: "rgba(58,90,64,0.08)", border: "1px solid rgba(58,90,64,0.15)", color: "#2D5F38" }}
    >
      <span className="text-[#3A5A40]">{icon}</span>
      {label}
    </div>
  );
}

/* ─── Main Landing ─────────────────────────────────────────── */
export default function Landing() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { e.target.classList.add("in-view"); observer.unobserve(e.target); }
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -30px 0px" }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: "#f8f6f0" }}>

      {/* ── Navbar — logo only, transparent over hero ──────── */}
      <nav className="sticky top-0 z-50" style={{ background: "transparent" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <Logo variant="white" />
          </a>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <a href="/dashboard" className="nav-cta-btn">Dashboard</a>
            ) : (
              <a href="/signup" className="nav-cta-btn">Get Started</a>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section
        id="hero-login"
        className="relative min-h-[92vh] flex items-center overflow-hidden"
        style={{ background: "linear-gradient(155deg, #1a3a22 0%, #2D5F38 35%, #3A5A40 65%, #1a3a22 100%)" }}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`, backgroundSize: "36px 36px" }}
        />
        {/* Glow blobs */}
        <div className="absolute top-[-120px] right-[-120px] w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #A3B18A 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #3A5A40 0%, transparent 70%)" }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left: copy */}
            <div className="hero-copy">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-semibold"
                style={{ background: "rgba(163,177,138,0.15)", border: "1px solid rgba(163,177,138,0.3)", color: "#A3B18A" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#A3B18A] animate-pulse" />
                Trusted by savers worldwide
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white leading-[1.05] mb-6">
                Save together.<br />
                <span className="text-white/90">Win together.</span>
              </h1>
              <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-md mb-8">
                Join trusted rotational savings circles and receive your full group payout — transparently, automatically, and on time.
              </p>
              <div className="flex flex-wrap gap-3 mb-10">
                <a
                  href="/signup"
                  className="inline-flex items-center gap-2 font-bold px-6 py-3.5 rounded-xl text-sm transition-all hover:opacity-90 hover:scale-105"
                  style={{ background: "white", color: "#1a3a22", boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
                >
                  Start saving free <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#how"
                  className="inline-flex items-center gap-2 font-semibold px-6 py-3.5 rounded-xl text-sm transition-all hover:bg-white/10"
                  style={{ color: "white", border: "1px solid rgba(255,255,255,0.2)" }}
                >
                  See how it works
                </a>
              </div>

              {/* 3D elements — mobile only */}
              <div className="relative h-52 sm:h-64 lg:hidden">
                <div className="absolute left-0 top-4 animate-[float_4s_ease-in-out_infinite]">
                  <CoinStack3D className="w-28 h-28 drop-shadow-2xl" />
                </div>
                <div className="absolute left-32 top-0 animate-[float_5s_ease-in-out_0.8s_infinite]">
                  <SavingsCard3D className="w-44 drop-shadow-2xl" />
                </div>
                <div className="absolute right-0 top-8 animate-[float_3.5s_ease-in-out_1.5s_infinite]">
                  <Trophy3D className="w-20 h-24 drop-shadow-2xl" />
                </div>
              </div>
            </div>

            {/* Right: 3D elements + login */}
            <div className="hero-panel flex flex-col items-center lg:items-end gap-8">
              <div className="hidden lg:block relative w-full">
                <div className="absolute top-0 left-4 animate-[float_4s_ease-in-out_infinite]">
                  <CoinStack3D className="w-32 h-32 drop-shadow-2xl" />
                </div>
                <div className="absolute top-6 left-36 animate-[float_5s_ease-in-out_0.8s_infinite]">
                  <SavingsCard3D className="w-52 drop-shadow-2xl" />
                </div>
                <div className="absolute top-2 right-2 animate-[float_3.5s_ease-in-out_1.2s_infinite]">
                  <Trophy3D className="w-24 h-28 drop-shadow-2xl" />
                </div>
                <div className="pt-40" />
              </div>
              <div className="w-full max-w-sm hidden lg:block">
                <GroupCard3D name="Alpha Savers" amount="$1,250 / mo" members={5} gradient="linear-gradient(135deg, #2D5F38 0%, #1a3a22 100%)" />
              </div>
              <HeroLoginPanel />
            </div>
          </div>
        </div>

        {/* Wave transition */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0 80 L0 40 Q360 0 720 40 Q1080 80 1440 40 L1440 80 Z" fill="#f8f6f0" />
          </svg>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────── */}
      <section className="py-10 bg-[#f8f6f0]">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#3A5A40]/40 mb-6">Trusted across 30+ countries</p>
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-30 grayscale">
            {["Stripe", "Plaid", "Visa", "Mastercard", "Chase"].map((b) => (
              <span key={b} className="text-lg font-black tracking-tight text-[#2D5F38]">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────── */}
      <section id="how" className="py-20 bg-[#f8f6f0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14 reveal">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ background: "rgba(58,90,64,0.1)", color: "#2D5F38" }}>Simple & powerful</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1a3a22] mb-4">How Aventum Works</h2>
            <p className="text-[#5a7a60] max-w-md mx-auto text-base">Three simple steps to start saving and receiving payouts with your circle.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <StepCard number="1" title="Join or Create a Group" desc="Start with 3–10 trusted people. Set your contribution amount and schedule. Everyone commits together." icon={<Users className="w-5 h-5" />} delay="0s" />
            <StepCard number="2" title="Contribute Every Cycle" desc="Automated reminders and Stripe payments make contributing effortless. Never miss your cycle again." icon={<Zap className="w-5 h-5" />} delay="0.1s" />
            <StepCard number="3" title="Receive Your Full Payout" desc="When it's your turn, the entire group pool lands in your account. Everyone gets their turn." icon={<BarChart3 className="w-5 h-5" />} delay="0.2s" />
          </div>
        </div>
      </section>

      {/* ── Why Aventum ─────────────────────────────────────── */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="reveal">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-5" style={{ background: "rgba(58,90,64,0.1)", color: "#2D5F38" }}>Why choose us</span>
              <h2 className="text-3xl sm:text-4xl font-black text-[#1a3a22] mb-5">
                Built for serious<br />savers &amp; groups
              </h2>
              <p className="text-[#5a7a60] text-base leading-relaxed mb-8">
                Aventum Capital brings the power of traditional rotating savings circles into the digital age — with the security, automation, and transparency that modern savers deserve.
              </p>
              <div className="flex flex-wrap gap-3">
                <FeaturePill icon={<Shield className="w-3.5 h-3.5" />} label="Bank-level security" />
                <FeaturePill icon={<Globe className="w-3.5 h-3.5" />} label="30+ currencies" />
                <FeaturePill icon={<Zap className="w-3.5 h-3.5" />} label="Automated payments" />
                <FeaturePill icon={<BarChart3 className="w-3.5 h-3.5" />} label="Real-time analytics" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 reveal reveal-d2">
              {[
                { title: "Stripe Payments", desc: "Secure card payments with automatic retry and fraud protection.", icon: "💳", bg: "linear-gradient(135deg, #1a3a22 0%, #2D5F38 100%)", color: "white" },
                { title: "Real-time Tracking", desc: "See who's paid, who's next, and when your payout arrives.", icon: "📊", bg: "linear-gradient(135deg, #3A5A40 0%, #2D5F38 100%)", color: "white" },
                { title: "Multi-currency", desc: "USD, EUR, GBP, KES and 30+ more currencies supported globally.", icon: "🌍", bg: "linear-gradient(135deg, #f0f7f0 0%, #dceede 100%)", color: "#1a3a22" },
                { title: "Group Chat", desc: "Built-in messaging so your circle stays coordinated.", icon: "💬", bg: "linear-gradient(135deg, #eef5ee 0%, #d4e8d4 100%)", color: "#1a3a22" },
              ].map((f) => (
                <div key={f.title} className="rounded-2xl p-6" style={{ background: f.bg, color: f.color }}>
                  <div className="text-2xl mb-3">{f.icon}</div>
                  <div className="font-bold text-sm mb-1">{f.title}</div>
                  <div className="text-xs opacity-70 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Showcase / Mission section ───────────────────────── */}
      <section className="py-20 relative overflow-hidden" style={{ background: "linear-gradient(155deg, #1a3a22 0%, #2D5F38 40%, #3A5A40 100%)" }}>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`, backgroundSize: "40px 40px" }} />
        <div className="absolute top-10 right-10 animate-[float_6s_ease-in-out_infinite]">
          <CoinStack3D className="w-40 h-48 opacity-60" />
        </div>
        <div className="absolute bottom-10 right-40 animate-[float_5s_ease-in-out_2s_infinite]">
          <Trophy3D className="w-28 h-32 opacity-40" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Dashboard mockup */}
            <div className="reveal flex flex-col gap-4">
              <div
                className="rounded-3xl p-8 text-white relative overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  transform: "perspective(800px) rotateY(4deg) rotateX(-2deg)",
                  boxShadow: "20px 30px 80px rgba(0,0,0,0.4)",
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-3">Your payout this cycle</div>
                <div className="text-5xl font-black text-white mb-2">$2,500</div>
                <div className="text-white/50 text-sm mb-6">Alpha Savers · Cycle 3 of 5</div>
                <div className="flex items-center gap-3 mb-4">
                  {["A", "O", "M", "J", "K"].map((l, i) => (
                    <div key={l} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 border-white/20" style={{ background: `hsl(${140 + i * 25} 35% ${30 + i * 5}%)` }}>
                      {l}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  {[1, 1, 1, 0, 0].map((p, i) => (
                    <div key={i} className="flex-1 h-1.5 rounded-full" style={{ background: p ? "#A3B18A" : "rgba(255,255,255,0.2)" }} />
                  ))}
                </div>
                <div className="text-xs text-white/40 mt-1">3 / 5 members paid this cycle</div>
              </div>
              <SavingsCard3D className="w-56 self-center opacity-80" />
            </div>
            {/* Text */}
            <div className="reveal reveal-d2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-6" style={{ background: "rgba(163,177,138,0.2)", color: "#A3B18A" }}>Our mission</span>
              <blockquote className="text-white text-xl sm:text-2xl font-light leading-relaxed mb-6">
                "We make saving <strong className="font-black text-white">simple</strong>, powerful, and collaborative. Together, we turn collective effort into real financial momentum."
              </blockquote>
              <p className="text-white/50 text-sm leading-relaxed mb-8">
                At Aventum Capital, everyone in a group contributes a fixed amount each cycle. The full pool goes to one member at a time — rotating until everyone has received their share.
              </p>
              <a
                href="/signup"
                className="inline-flex items-center gap-2 font-semibold px-6 py-3 rounded-xl text-sm transition-all hover:scale-105 hover:opacity-90"
                style={{ background: "white", color: "#1a3a22" }}
              >
                Join a circle today <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="py-20 bg-[#f8f6f0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14 reveal">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ background: "rgba(58,90,64,0.1)", color: "#2D5F38" }}>Pricing</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1a3a22] mb-3">Simple, transparent plans</h2>
            <p className="text-[#5a7a60] text-base">Start free, scale as your circle grows.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            <div className="bg-white rounded-3xl p-8 flex flex-col reveal reveal-d1 border border-[#3A5A40]/10 hover:shadow-lg transition-all">
              <div className="flex-1">
                <h3 className="font-black text-[#1a3a22] text-xl mb-1">Custom</h3>
                <p className="text-[#5a7a60] text-sm mb-6">For individuals who want to manage their own circle.</p>
                <div className="text-5xl font-black text-[#1a3a22] mb-1">$0</div>
                <div className="text-sm text-[#5a7a60] mb-8">Forever free</div>
              </div>
              <a
                href="/signup"
                className="block w-full text-center font-semibold py-3 rounded-xl text-sm transition-all mb-8 hover:bg-[#3A5A40] hover:text-white"
                style={{ border: "2px solid #3A5A40", color: "#3A5A40" }}
              >
                Get Started Free
              </a>
              <ul className="space-y-3">
                {["Personalized contribution amount", "Custom group settings", "Group analytics", "Community access", "Add-on purchases available"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#4a6a50]">
                    <CheckCircle2 className="w-4 h-4 text-[#3A5A40] shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Featured */}
            <div
              className="rounded-3xl p-8 flex flex-col reveal reveal-d2 relative"
              style={{ background: "linear-gradient(155deg, #1a3a22 0%, #2D5F38 60%, #3A5A40 100%)", boxShadow: "0 30px 80px rgba(26,58,34,0.4)" }}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="font-bold px-4 py-1.5 rounded-full text-xs text-white" style={{ background: "#3A5A40", border: "1px solid rgba(163,177,138,0.4)" }}>Most Popular</span>
              </div>
              <div className="flex-1">
                <h3 className="font-black text-white text-xl mb-1">Group 1</h3>
                <p className="text-white/50 text-sm mb-6">Perfect for your first savings circle.</p>
                <div className="text-5xl font-black text-white mb-1">$50</div>
                <div className="text-sm text-white/40 mb-8">per month</div>
              </div>
              <a
                href="/signup"
                className="block w-full text-center font-bold py-3 rounded-xl text-sm transition-all mb-8 hover:scale-105 hover:opacity-90"
                style={{ background: "white", color: "#1a3a22" }}
              >
                Get Started Now
              </a>
              <ul className="space-y-3">
                {["Receive $1,250 at your turn", "Full group chat", "Real-time analytics dashboard", "Milestone in 3 months", "Priority support"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
                    <CheckCircle2 className="w-4 h-4 text-[#A3B18A] shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Group 2 */}
            <div className="bg-white rounded-3xl p-8 flex flex-col reveal reveal-d3 border border-[#3A5A40]/10 hover:shadow-lg transition-all">
              <div className="flex-1">
                <h3 className="font-black text-[#1a3a22] text-xl mb-1">Group 2</h3>
                <p className="text-[#5a7a60] text-sm mb-6">Maximize your savings with a larger group.</p>
                <div className="text-5xl font-black text-[#1a3a22] mb-1">$100</div>
                <div className="text-sm text-[#5a7a60] mb-8">per month</div>
              </div>
              <a
                href="/signup"
                className="block w-full text-center font-semibold py-3 rounded-xl text-sm transition-all mb-8 hover:bg-[#3A5A40] hover:text-white"
                style={{ border: "2px solid #3A5A40", color: "#3A5A40" }}
              >
                Get Started Now
              </a>
              <ul className="space-y-3">
                {["Receive $2,500 at your turn", "Full group chat", "Advanced analytics", "Milestone in 5 months", "Priority support"].map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[#4a6a50]">
                    <CheckCircle2 className="w-4 h-4 text-[#3A5A40] shrink-0 mt-0.5" />{f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Referral CTA Banner ──────────────────────────────── */}
      <section className="py-16 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #1a3a22 0%, #2D5F38 50%, #344E41 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(circle, #ffffff 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
        <div className="absolute top-0 right-0 w-80 h-full opacity-15">
          <Trophy3D className="w-full h-full" />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 reveal">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">Invite friends, save together</h2>
            <p className="text-white/60 text-sm">Every member you invite strengthens the circle — and your returns.</p>
          </div>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 font-bold px-8 py-4 rounded-2xl text-sm whitespace-nowrap transition-all hover:scale-105 hover:opacity-90"
            style={{ background: "white", color: "#1a3a22" }}
          >
            Start your circle <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12 reveal">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ background: "rgba(58,90,64,0.1)", color: "#2D5F38" }}>FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-black text-[#1a3a22]">Common questions</h2>
          </div>
          <div className="reveal reveal-d1">
            {[
              { q: "What Are The Benefits Of Using Aventum Capital?", a: "Aventum Capital helps you save consistently through structured rotational groups, giving you access to a lump sum payout when it's your turn. You benefit from community accountability, automated tracking, and a transparent system." },
              { q: "What Is Aventum Capital?", a: "Aventum Capital is a digital savings platform that modernizes the traditional chama (rotating savings group) model. Members contribute regularly and take turns receiving the full group pool." },
              { q: "How Does The Savings Cycle Work?", a: "Each member contributes a fixed amount every cycle. When all members have contributed, the full pool is paid out to the next person in the rotation order. This repeats until every member has received their payout." },
              { q: "Do I Need To Know The Other People In My Group?", a: "Not necessarily. You can join pre-formed groups or invite people you trust. Our platform provides transparency so every member can see contribution status in real time." },
              { q: "What Happens If Someone Misses A Payment?", a: "The system sends automated reminders before each due date. Group admins are notified of missed payments, and the group's payout cycle can be paused until all contributions are settled." },
              { q: "Is My Money Safe With Aventum?", a: "Yes. All transactions are recorded on our secure platform with full audit logs. We use bank-level encryption to protect your data and financial records." },
            ].map((item) => <FAQItem key={item.q} q={item.q} a={item.a} />)}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer id="footer" style={{ background: "linear-gradient(155deg, #1a3a22 0%, #2D5F38 100%)" }}>
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4"><Logo variant="white" /></div>
              <p className="text-white/40 text-xs mb-5 leading-relaxed">Rotational savings for the modern world.</p>
              <p className="text-white/40 text-xs mb-3 font-semibold uppercase tracking-wider">Newsletter</p>
              <div className="flex gap-2">
                <input type="email" placeholder="your@email.com" className="flex-1 text-xs px-3 py-2 rounded-lg text-white placeholder-white/30 focus:outline-none min-w-0" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }} />
                <button className="px-3 py-2 rounded-lg transition-colors hover:opacity-80" style={{ background: "#3A5A40", border: "1px solid rgba(163,177,138,0.3)" }}>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="flex gap-3 mt-4">
                <a href="#" className="text-white/30 hover:text-white transition-colors"><Facebook className="w-4 h-4" /></a>
                <a href="#" className="text-white/30 hover:text-white transition-colors"><Twitter className="w-4 h-4" /></a>
                <a href="#" className="text-white/30 hover:text-white transition-colors"><Instagram className="w-4 h-4" /></a>
              </div>
            </div>
            <div>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-5">About</h4>
              <ul className="space-y-3">
                {["Company", "Team", "Careers", "Press"].map(l => (
                  <li key={l}><a href="#" className="text-xs text-white/40 hover:text-white transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-5">Product</h4>
              <ul className="space-y-3">
                {[{ label: "How it works", href: "#how" }, { label: "Pricing", href: "#pricing" }, { label: "Security", href: "#" }, { label: "Support", href: "mailto:info@aventumcapital.com" }].map(l => (
                  <li key={l.label}><a href={l.href} className="text-xs text-white/40 hover:text-white transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-5">Contact</h4>
              <ul className="space-y-3 text-xs text-white/40">
                <li>info@aventumcapital.com</li>
                <li>United States, Arizona</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/30" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <p>© 2026 Aventum Capital. All rights reserved.</p>
            <div className="flex gap-5">
              <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
              <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-12px) rotate(1deg); }
          66% { transform: translateY(-6px) rotate(-0.5deg); }
        }
        .nav-cta-btn {
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.625rem 1.25rem;
          border-radius: 0.75rem;
          background: rgba(255,255,255,0.15);
          color: white;
          border: 1px solid rgba(255,255,255,0.25);
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }
        .nav-cta-btn:hover {
          background: rgba(255,255,255,0.25);
          border-color: rgba(255,255,255,0.4);
        }
      `}</style>
    </div>
  );
}
