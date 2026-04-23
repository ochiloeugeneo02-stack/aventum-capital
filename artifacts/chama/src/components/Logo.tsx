/**
 * Logo component — Aventum Capital
 *
 * The source PNG is 500×500 px with "Aventum / capital" text
 * in the top ~30% and whitespace below.
 *
 * We scale the image to width:220px (→ rendered height: 220px)
 * and clip the container to 64px tall — showing only the text area.
 * This is a pure CROP: no stretching, no distortion, native aspect ratio kept.
 *
 * variant="dark"  → black text on transparent bg, for white/light backgrounds
 * variant="white" → white text via brightness(0)+invert(1), for dark backgrounds
 * iconOnly        → AC initials icon tile for tight spaces
 */

import logoTransparent from "@/assets/logo-main-transparent.png";

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
    <div
      className={className}
      style={{ width: "220px", height: "64px", overflow: "hidden", flexShrink: 0, lineHeight: 0 }}
    >
      <img
        src={logoTransparent}
        alt="Aventum Capital"
        draggable={false}
        style={{
          width: "220px",   /* scale to 220px wide → 220px tall (1:1 aspect ratio) */
          height: "auto",   /* maintain native aspect ratio */
          display: "block",
          filter: variant === "white" ? "brightness(0) invert(1)" : "none",
        }}
      />
    </div>
  );
}
