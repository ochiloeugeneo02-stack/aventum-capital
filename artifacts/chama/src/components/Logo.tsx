import logoSrc from "@/assets/logo-source.png";
import logoTransparent from "@/assets/logo-transparent.png";

interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
  iconOnly?: boolean;
}

/**
 * variant="dark"  — original PNG as-is, for use on white/light backgrounds
 * variant="white" — background-removed PNG inverted to white, for dark green backgrounds
 * iconOnly        — sage icon tile only
 */
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

  if (variant === "white") {
    return (
      <img
        src={logoTransparent}
        alt="Aventum Capital"
        style={{
          height: "52px",
          width: "auto",
          display: "block",
          filter: "brightness(0) invert(1)",
        }}
        className={className}
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
      }}
      className={className}
    />
  );
}
