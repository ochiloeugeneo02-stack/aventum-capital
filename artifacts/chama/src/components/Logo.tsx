import logoSrc from "@/assets/logo-source.png";

interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
  iconOnly?: boolean;
}

/**
 * variant="dark"  — black text, for light backgrounds
 * variant="white" — white text, for dark green hero
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

  const color = variant === "white" ? "#ffffff" : "#0d1f10";

  return (
    <div className={`select-none ${className}`} style={{ lineHeight: 1 }}>
      <div
        style={{
          color,
          fontSize: "26px",
          fontWeight: 300,
          letterSpacing: "-0.01em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Inter', sans-serif",
        }}
      >
        Aventum
      </div>
      <div
        style={{
          color,
          fontSize: "11px",
          fontWeight: 400,
          letterSpacing: "0.04em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', 'Inter', sans-serif",
          opacity: variant === "white" ? 0.75 : 0.6,
          marginTop: "1px",
        }}
      >
        capital
      </div>
    </div>
  );
}

/* Keep the source PNG exported in case it's needed elsewhere */
export { logoSrc };
