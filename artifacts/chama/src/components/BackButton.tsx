import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export function BackButton({ to, label = "Back", className }: BackButtonProps) {
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (to) navigate(to);
    else window.history.back();
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-2 text-sm font-medium text-[#374151] hover:text-[#1C3229] transition-colors group",
        className
      )}
    >
      <span className="w-7 h-7 rounded-lg bg-[#F0EDE8] group-hover:bg-[#E8E4DF] flex items-center justify-center transition-colors">
        <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
      </span>
      <span>{label}</span>
    </button>
  );
}
