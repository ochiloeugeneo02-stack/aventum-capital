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
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group",
        className
      )}
    >
      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
      <span>{label}</span>
    </button>
  );
}
