import logoSrc from "@/assets/logo-source.png";

interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
  iconOnly?: boolean;
}

/**
 * variant="dark"  → your uploaded logo as-is (black text, ideal on white/light nav)
 * variant="white" → same logo inverted to white (for dark green sidebar / dark backgrounds)
 * iconOnly        → sage icon tile only
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

  const isWhite = variant === "white";

  /* Crop wrapper: the 500×500 source PNG has text in the top ~35% */
  return (
    <div
      className={className}
      style={{ overflow: "hidden", height: "44px", display: "inline-block", lineHeight: 0 }}
    >
      <img
        src={logoSrc}
        alt="Aventum Capital"
        style={{
          height: "148px",
          width: "auto",
          display: "block",
          filter: isWhite ? "brightness(0) invert(1)" : "none",
        }}
      />
    </div>
  );
}
