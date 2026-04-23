/**
 * Logo component — Aventum Capital
 *
 * variant="dark"  → icon + "Aventum / CAPITAL" on white/light backgrounds (navbar)
 * variant="white" → icon + "Aventum / CAPITAL" white on dark green backgrounds
 * iconOnly        → AC icon tile only, for sidebars and tight spaces
 */

interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ variant = "dark", className = "", iconOnly = false }: LogoProps) {
  const textColor   = variant === "white" ? "#ffffff"   : "#1a3a22";
  const subColor    = variant === "white" ? "rgba(255,255,255,0.7)" : "rgba(26,58,34,0.55)";

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
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Green rounded icon */}
      <img
        src="/logo-icon-sage.png"
        alt=""
        aria-hidden="true"
        style={{ height: "44px", width: "44px", borderRadius: "10px", flexShrink: 0 }}
      />
      {/* Wordmark */}
      <div style={{ lineHeight: 1.1 }}>
        <div style={{
          color: textColor,
          fontSize: "22px",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        }}>
          Aventum
        </div>
        <div style={{
          color: subColor,
          fontSize: "10px",
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
        }}>
          Capital
        </div>
      </div>
    </div>
  );
}
