import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PREDEFINED_QUESTIONS = [
  "What was the name of your first pet?",
  "What is your mother's maiden name?",
  "What was the name of the street you grew up on?",
  "What was your childhood nickname?",
  "What was the make and model of your first car?",
  "In what city were you born?",
  "What is the name of your favourite childhood teacher?",
  "What is your oldest sibling's middle name?",
  "What was the name of your elementary school?",
  "What is the first name of your oldest cousin?",
  "What was the name of the hospital where you were born?",
  "What was your childhood sports team?",
];

interface SecurityQuestionsSetupProps {
  user: { name?: string };
  onComplete: () => void;
}

export default function SecurityQuestionsSetup({ user, onComplete }: SecurityQuestionsSetupProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [questions, setQuestions] = useState([
    { questionIndex: 1, questionText: "", answer: "" },
    { questionIndex: 2, questionText: "", answer: "" },
    { questionIndex: 3, questionText: "", answer: "" },
  ]);

  function updateQuestion(index: number, field: "questionText" | "answer", value: string) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));
  }

  function availableQuestions(currentIndex: number) {
    const selectedOthers = questions
      .filter((_, i) => i !== currentIndex)
      .map(q => q.questionText)
      .filter(Boolean);
    return PREDEFINED_QUESTIONS.filter(q => !selectedOthers.includes(q));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const q of questions) {
      if (!q.questionText) { toast({ title: "Please select a question for each slot", variant: "destructive" }); return; }
      if (!q.answer.trim() || q.answer.trim().length < 2) { toast({ title: "Each answer must be at least 2 characters", variant: "destructive" }); return; }
    }

    setSaving(true);
    try {
      await apiRequest("/api/auth/security-questions/setup", {
        method: "POST",
        body: JSON.stringify({ questions }),
      });
      toast({ title: "Security questions saved", description: "Your account is now more secure." });
      onComplete();
    } catch (err: any) {
      toast({ title: "Error", description: err?.data?.error ?? "Could not save security questions", variant: "destructive" });
    }
    setSaving(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: "url('/staff-bg.jpg')", backgroundSize: "cover", backgroundPosition: "center top", filter: "grayscale(40%) brightness(0.28)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, rgba(11,20,15,0.82) 0%, rgba(18,30,22,0.88) 60%, rgba(10,14,12,0.95) 100%)" }} />

      <div className="relative w-full max-w-lg mx-4">
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="/logo-icon-sage.png" alt="Aventum Capital" className="w-12 h-12 rounded-2xl shadow-lg shadow-black/40" />
        </div>

        <div className="rounded-2xl border border-white/[0.06] p-8" style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(16px)" }}>
          <div className="mb-7">
            <div className="w-11 h-11 rounded-xl bg-[#3A5A40]/20 border border-[#3A5A40]/30 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-[#A3C4A8]" />
            </div>
            <h1 className="text-white text-xl font-bold">Set up security questions</h1>
            <p className="text-white/40 text-sm mt-1">
              Hi {user.name?.split(" ")[0] ?? "there"}, please set up 3 security questions. These are used to verify your identity if your account is ever locked.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {questions.map((q, i) => (
              <div key={i} className="space-y-2">
                <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">
                  Question {i + 1}
                </label>
                <select
                  value={q.questionText}
                  onChange={e => updateQuestion(i, "questionText", e.target.value)}
                  required
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl text-sm appearance-none",
                    "bg-white/[0.05] border border-white/10 text-white",
                    "focus:outline-none focus:border-[#3A5A40]/60 transition-all"
                  )}
                  style={{ colorScheme: "dark" }}
                >
                  <option value="" disabled style={{ background: "#1C3229" }}>Select a question…</option>
                  {availableQuestions(i).map(qt => (
                    <option key={qt} value={qt} style={{ background: "#1C3229" }}>{qt}</option>
                  ))}
                  {q.questionText && !availableQuestions(i).includes(q.questionText) && (
                    <option value={q.questionText} style={{ background: "#1C3229" }}>{q.questionText}</option>
                  )}
                </select>
                <input
                  type="text"
                  placeholder="Your answer"
                  value={q.answer}
                  onChange={e => updateQuestion(i, "answer", e.target.value)}
                  required
                  className={cn(
                    "w-full py-2.5 px-4 rounded-xl text-sm",
                    "bg-white/[0.05] border border-white/10 text-white placeholder-white/20",
                    "focus:outline-none focus:border-[#3A5A40]/60 focus:bg-white/[0.07] transition-all"
                  )}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={saving}
              className={cn(
                "w-full py-3 rounded-xl font-semibold text-sm transition-all mt-2",
                "bg-[#1C3229] text-white border border-[#3A5A40]/50",
                "hover:bg-[#243D2F] hover:border-[#3A5A40] disabled:opacity-40"
              )}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save security questions"}
            </button>
          </form>

          <p className="text-white/25 text-xs mt-5 text-center leading-relaxed">
            Your answers are encrypted and stored securely. They cannot be viewed by anyone.
          </p>
        </div>
      </div>
    </div>
  );
}
