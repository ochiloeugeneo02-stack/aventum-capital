import { useState } from "react";
import { useLocation } from "wouter";
import { useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";
import { Eye, EyeOff, Loader2, ChevronDown, Smartphone, Zap, Settings, Facebook, Twitter, Instagram } from "lucide-react";

function HeroLoginPanel() {
  const [, navigate] = useLocation();
  const { setUser } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

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

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
      <h3 className="text-xl font-bold text-gray-900 mb-6">Welcome back!</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          loginMutation.mutate({ data: { email, password } });
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3A5A40] focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3A5A40] focus:border-transparent pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full bg-[#3A5A40] hover:bg-[#344E41] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loginMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Login
        </button>
      </form>
      <div className="mt-4 space-y-1 text-xs text-gray-500">
        <p className="cursor-pointer hover:text-[#3A5A40] transition-colors">Forgot password?</p>
        <p>
          Don't have an account?{" "}
          <a href="/signup" className="text-[#3A5A40] font-medium hover:underline">
            Sign up
          </a>
        </p>
      </div>
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-500">
        <p className="font-semibold mb-1 text-gray-600">Demo accounts:</p>
        <p>admin@aventum.co / admin123</p>
        <p>grace@aventum.co / grace123</p>
        <p>amina@aventum.co / member123</p>
      </div>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 py-4">
      <button className="w-full flex items-center justify-between text-left gap-4" onClick={() => setOpen(!open)}>
        <span className="text-sm font-medium text-gray-800">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="mt-3 text-sm text-gray-500 leading-relaxed pr-8">{a}</p>}
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <Logo variant="dark" />
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#how" className="hover:text-[#3A5A40] transition-colors">Home</a>
            <a href="#why" className="hover:text-[#3A5A40] transition-colors">Services</a>
            <a href="#faq" className="hover:text-[#3A5A40] transition-colors">FAQ</a>
            <a href="#footer" className="hover:text-[#3A5A40] transition-colors">Contact</a>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <a href="/dashboard" className="bg-[#3A5A40] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#344E41] transition-colors">
                Dashboard
              </a>
            ) : (
              <>
                <a href="#hero-login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Login</a>
                <a href="/signup" className="bg-[#3A5A40] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#344E41] transition-colors">
                  Get Started
                </a>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section
        id="hero-login"
        className="relative min-h-[520px] flex items-center"
        style={{ background: "linear-gradient(135deg, #344E41 0%, #3A5A40 40%, #3A5A40 70%, #2B3E35 100%)" }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.5'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative max-w-7xl mx-auto px-6 py-20 w-full flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="flex-1 max-w-xl">
            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
              Simple, Transparent,<br />and Affordable savings
            </h1>
            <p className="text-white/70 text-base leading-relaxed max-w-md">
              Join trusted rotational savings groups and achieve your financial goals together with like-minded individuals.
            </p>
          </div>
          <div className="w-full lg:w-auto lg:min-w-[340px]">
            <HeroLoginPanel />
          </div>
        </div>
      </section>

      {/* ── How Aventum Works ───────────────────────────────── */}
      <section id="how" className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">How Aventum Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: "1", emoji: "👥", title: "Join a Group", desc: "Create or join a Chama group with 5 trusted members." },
              { num: "2", emoji: "💳", title: "Contribute Regularly", desc: "Make weekly contributions of $250." },
              { num: "3", emoji: "💰", title: "Receive Payouts", desc: "Get your turn to receive the full group collection." },
            ].map((item) => (
              <div key={item.num} className="text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-white rounded-full border border-gray-200 flex items-center justify-center text-2xl shadow-sm">
                  {item.emoji}
                </div>
                <div className="text-xs font-semibold text-[#3A5A40] mb-1">{item.num}.</div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose ──────────────────────────────────────── */}
      <section id="why" className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">Why Choose Aventum Capital</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              {
                icon: <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
                title: "Secure Platform",
                desc: "Bank level security for your transactions",
              },
              { icon: <Smartphone className="w-7 h-7" />, title: "Easy Mobile Access", desc: "Manage your groups on the go" },
              { icon: <Zap className="w-7 h-7" />, title: "Automated Payments", desc: "Never miss a contribution" },
              { icon: <Settings className="w-7 h-7" />, title: "Group Management", desc: "Efficient group coordination" },
            ].map((item) => (
              <div key={item.title} className="text-center p-6 rounded-xl border border-gray-100 hover:border-[#3A5A40]/30 hover:shadow-sm transition-all">
                <div className="text-[#3A5A40] flex justify-center mb-3">{item.icon}</div>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Do Best ─────────────────────────────────── */}
      <section
        className="relative py-20"
        style={{ background: "linear-gradient(135deg, #344E41 0%, #3A5A40 60%, #3A5A40 100%)" }}
      >
        <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-12">
          <div className="w-full lg:w-1/2 aspect-video rounded-2xl overflow-hidden relative shadow-2xl">
            <img
              src="/community.jpg"
              alt="Aventum Capital community"
              className="w-full h-full object-cover object-center"
            />
            <div
              className="absolute inset-0 rounded-2xl"
              style={{ background: "linear-gradient(135deg, rgba(26,58,42,0.45) 0%, rgba(21,46,30,0.3) 100%)" }}
            />
          </div>
          <div className="w-full lg:w-1/2">
            <p className="text-[#A3B18A] text-sm font-semibold uppercase tracking-wider mb-4">What we do best</p>
            <blockquote className="text-white text-base leading-relaxed">
              "At Aventum Capital, we make saving simple, powerful, and collaborative. Our platform connects individuals who contribute to a shared cycle, where each member takes a turn receiving the full group payout. It's a trusted, transparent way to access funds — one turn at a time.
              <br /><br />
              Together, we turn collective effort into real financial momentum."
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">Powerful features for powerful people</h2>
          <p className="text-center text-gray-500 text-sm mb-12">Choose the plan that fits your savings goals</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free */}
            <div className="border border-gray-200 rounded-2xl p-6 flex flex-col">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Custom</h3>
                <p className="text-xs text-gray-500 mb-4">For motivated individuals who want to manage their own group with full control</p>
                <div className="text-3xl font-bold text-gray-900 mb-6">$0</div>
              </div>
              <a href="/signup" className="block w-full text-center border border-[#3A5A40] text-[#3A5A40] font-medium py-2.5 rounded-lg text-sm hover:bg-[#3A5A40] hover:text-white transition-colors mb-6">
                Get Started Now
              </a>
              <ul className="space-y-2.5 text-xs text-gray-600">
                {["Personalized contribution", "Custom group", "Group info", "Keep analytics", "Access to community", "Purchase add-ons for pending savings"].map(f => (
                  <li key={f} className="flex items-start gap-2"><span className="text-[#3A5A40] shrink-0 mt-0.5">✓</span>{f}</li>
                ))}
              </ul>
            </div>

            {/* Featured */}
            <div className="border-2 border-[#3A5A40] rounded-2xl p-6 relative shadow-lg flex flex-col">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="bg-[#3A5A40] text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Group of 1</h3>
                <p className="text-xs text-gray-500 mb-4">Ideal for individuals looking for a solo savings group</p>
                <div className="text-3xl font-bold text-gray-900 mb-6">$50 <span className="text-sm font-normal text-gray-400">/ month</span></div>
              </div>
              <a href="/signup" className="block w-full text-center bg-[#3A5A40] text-white font-medium py-2.5 rounded-lg text-sm hover:bg-[#344E41] transition-colors mb-6">
                Get Started Now
              </a>
              <ul className="space-y-2.5 text-xs text-gray-600">
                {["Get $1,250 at your turn", "Group info", "Group chat", "Keep analytics", "Milestone done in 3 months"].map(f => (
                  <li key={f} className="flex items-start gap-2"><span className="text-[#3A5A40] shrink-0 mt-0.5">✓</span>{f}</li>
                ))}
              </ul>
            </div>

            {/* Group 2 */}
            <div className="border border-gray-200 rounded-2xl p-6 flex flex-col">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Group 2</h3>
                <p className="text-xs text-gray-500 mb-4">For individuals looking to maximize their group savings</p>
                <div className="text-3xl font-bold text-gray-900 mb-6">$100 <span className="text-sm font-normal text-gray-400">/ month</span></div>
              </div>
              <a href="/signup" className="block w-full text-center border border-[#3A5A40] text-[#3A5A40] font-medium py-2.5 rounded-lg text-sm hover:bg-[#3A5A40] hover:text-white transition-colors mb-6">
                Get Started Now
              </a>
              <ul className="space-y-2.5 text-xs text-gray-600">
                {["Get $2,500 at your turn", "Group info", "Group chat", "Keep analytics", "Milestone done in 5 months"].map(f => (
                  <li key={f} className="flex items-start gap-2"><span className="text-[#3A5A40] shrink-0 mt-0.5">✓</span>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Frequently Asked Questions</h2>
          {[
            { q: "What Are The Benefits Of Using Aventum Capital?", a: "Aventum Capital helps you save consistently through structured rotational groups, giving you access to a lump sum payout when it's your turn. You benefit from community accountability, automated tracking, and a transparent system." },
            { q: "What Is Aventum Capital?", a: "Aventum Capital is a digital savings platform that modernizes the traditional chama (rotating savings group) model. Members contribute regularly and take turns receiving the full group pool." },
            { q: "How Does The Savings Cycle Work?", a: "Each member contributes a fixed amount every cycle. When all members have contributed, the full pool is paid out to the next person in the rotation order. This repeats until every member has received their payout." },
            { q: "Do I Need To Know The Other People In My Group?", a: "Not necessarily. You can join pre-formed groups or invite people you trust. Our platform provides transparency so every member can see contribution status in real time." },
            { q: "What Happens If Someone Misses A Payment?", a: "The system sends automated reminders before each due date. Group admins are notified of missed payments, and the group's payout cycle can be paused until all contributions are settled." },
            { q: "Is My Money Safe With Aventum?", a: "Yes. All transactions are recorded on our secure platform with full audit logs. We use bank-level encryption to protect your data and financial records." },
          ].map((item) => <FAQItem key={item.q} q={item.q} a={item.a} />)}
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────── */}
      <section className="bg-[#344E41] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-white font-semibold text-lg">Ready to get started?</p>
          <a href="/signup" className="bg-white text-[#344E41] font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition-colors">
            Get started
          </a>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer id="footer" className="bg-[#344E41] border-t border-white/10 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="mb-4">
                <Logo variant="white" />
              </div>
              <p className="text-white/50 text-xs mb-4 leading-relaxed">Subscribe to our newsletter</p>
              <div className="flex gap-2">
                <input type="email" placeholder="your@email.com" className="flex-1 bg-white/10 border border-white/20 text-white placeholder-white/30 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-white/40 min-w-0" />
                <button className="bg-[#3A5A40] text-white px-3 py-2 rounded-lg hover:bg-[#344E41] transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
              <div className="flex gap-3 mt-4">
                <a href="#" className="text-white/50 hover:text-white transition-colors"><Facebook className="w-4 h-4" /></a>
                <a href="#" className="text-white/50 hover:text-white transition-colors"><Twitter className="w-4 h-4" /></a>
                <a href="#" className="text-white/50 hover:text-white transition-colors"><Instagram className="w-4 h-4" /></a>
              </div>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">About</h4>
              <ul className="space-y-2 text-xs text-white/50">
                {["Company", "Team", "Careers", "Press"].map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">FAQ</h4>
              <ul className="space-y-2 text-xs text-white/50">
                {["How it works", "Pricing", "Security", "Support"].map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
              </ul>
            </div>
            <div>
              <h4 className="text-white text-sm font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-2 text-xs text-white/50">
                {["info@aventumcapital.com", "United States, Arizona"].map(l => <li key={l}>{l}</li>)}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/40">
            <p>© 2026 Aventum Capital. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white/70 transition-colors">Terms & Conditions</a>
              <a href="#" className="hover:text-white/70 transition-colors">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
