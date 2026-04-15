interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ variant = "dark", className = "", iconOnly = false }: LogoProps) {
  const color = variant === "white" ? "text-white" : "text-[#344E41]";

  if (iconOnly) {
    return (
      <img
        src="/logo-icon.png"
        alt="Aventum Capital"
        className={className || "h-9 w-9"}
        style={variant === "white" ? { filter: "brightness(0) invert(1)" } : undefined}
      />
    );
  }

  return (
    <div className={`inline-flex flex-col leading-none select-none ${className}`}>
      <span className={`text-xl font-light tracking-wide ${color}`}>
        Aventum
      </span>
      <span className={`text-[9px] font-light tracking-[0.18em] uppercase mt-0.5 ${color} opacity-75`}>
        capital
      </span>
    </div>
  );
}
