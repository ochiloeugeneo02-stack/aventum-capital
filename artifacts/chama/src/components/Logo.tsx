import logoSrc from "@/assets/logo-source.png";

interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ variant = "dark", className = "", iconOnly = false }: LogoProps) {
  if (iconOnly) {
    return (
      <img
        src="/logo-icon-sage.png"
        alt="AC"
        className={`rounded-xl ${className || "h-10 w-10"}`}
      />
    );
  }

  return (
    <img
      src={logoSrc}
      alt="Aventum Capital"
      style={{
        height: "64px",
        width: "auto",
        display: "block",
        filter: variant === "white" ? "brightness(0) invert(1)" : "none",
      }}
      className={className}
    />
  );
}
