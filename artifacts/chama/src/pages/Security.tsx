import { ShieldCheck, Lock, Eye, RefreshCw, Bell, Users, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

const pillars = [
  {
    icon: Lock,
    title: "Your money stays yours",
    body: "Every contribution is recorded on our platform the moment it is made. You can see exactly what you paid, when you paid it, and what the group total looks like — in real time, any time.",
  },
  {
    icon: Eye,
    title: "Full transparency, always",
    body: "All group activity — contributions, payouts, and member standings — is visible to everyone in your group. There are no hidden fees, no back-room decisions. What you see is what it is.",
  },
  {
    icon: ShieldCheck,
    title: "Bank-grade data protection",
    body: "Your personal information and financial records are protected with the same level of encryption used by major financial institutions. Your data is never sold or shared with third parties.",
  },
  {
    icon: RefreshCw,
    title: "Automated & auditable",
    body: "Payouts follow a fixed rotation set at group creation. No manual decisions, no favouritism. Every action on the platform is logged with a full audit trail that can be reviewed at any time.",
  },
  {
    icon: Bell,
    title: "Proactive alerts",
    body: "You receive notifications for every important event — when a contribution is recorded, when your payout is approaching, and if a group member falls behind. You are never left in the dark.",
  },
  {
    icon: Users,
    title: "Accountable by design",
    body: "Groups are structured so every member has skin in the game. Automated reminders and admin controls ensure that the people in your circle stay committed — and that you always know the status.",
  },
];

export default function Security() {
  return (
    <div className="min-h-screen font-sans" style={{ background: "#f8f7f4" }}>

      {/* Nav */}
      <nav className="w-full bg-white border-b border-black/[0.06] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <a href="/">
            <Logo variant="dark" />
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#2D5F38] font-medium hover:opacity-75 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="py-24 px-6 text-center relative overflow-hidden"
        style={{ background: "linear-gradient(155deg, #1a3a22 0%, #2D5F38 60%, #3A5A40 100%)" }}
      >
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
        <div className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-8 shadow-lg" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5" style={{ letterSpacing: "-0.03em" }}>
            Built for trust.
          </h1>
          <p className="text-lg text-white/60 leading-relaxed max-w-xl mx-auto">
            Rotating savings only works when everyone can trust the platform holding the group together. Here is how Aventum Capital earns and keeps that trust.
          </p>
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl p-7 bg-white border border-black/[0.06] shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: "#f0f5f1" }}>
                <Icon className="w-5 h-5" style={{ color: "#2D5F38" }} />
              </div>
              <h3 className="font-semibold text-[#1a3a22] mb-2" style={{ fontSize: "1rem" }}>{title}</h3>
              <p className="text-sm text-[#5a6672] leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust statement */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="rounded-2xl p-10 border" style={{ background: "#fff", borderColor: "rgba(0,0,0,0.06)" }}>
          <p className="text-[#1a3a22] font-semibold text-lg mb-3">Our commitment to you</p>
          <p className="text-[#5a6672] text-sm leading-relaxed">
            Aventum Capital was built on the belief that people deserve a savings system they can actually trust. We do not take custody of your contributions — all funds move directly through verified payment channels and are recorded immediately. Our platform exists to coordinate, track, and ensure accountability — nothing more.
          </p>
          <div className="mt-8">
            <a
              href="/signup"
              className="inline-block px-7 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: "#2D5F38" }}
            >
              Start saving with confidence
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-6 text-center text-xs text-[#9aa38d]" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        © {new Date().getFullYear()} Aventum Capital. All rights reserved.
      </footer>
    </div>
  );
}
