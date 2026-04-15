interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
}

export function Logo({ variant = "dark", className = "h-9 w-auto" }: LogoProps) {
  return (
    <img
      src="/logo-transparent.png"
      alt="Aventum Capital"
      className={className}
      style={variant === "white" ? { filter: "brightness(0) invert(1)" } : undefined}
    />
  );
}
