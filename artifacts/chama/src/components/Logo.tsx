/**
 * Logo component
 *
 * Uses the official Aventum Capital logo PNG.
 * The source file is 500×500 px — text lives in the top ~30%.
 * We render it at a fixed width and crop the bottom whitespace with overflow:hidden.
 *
 * variant="dark"  → black text, for white/light backgrounds
 * variant="white" → white text, for dark green backgrounds (CSS invert filter)
 * iconOnly        → AC initials icon, used where full wordmark doesn't fit
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

  /*
   * The 500×500 transparent PNG has content from approximately:
   *   top:  ~4%  (20px)
   *   bottom of "capital" line: ~29% (145px)
   *
   * Strategy: render at width 220px → natural height = 220px.
   * Crop container to height 64px → shows top 64/220 = 29% → exactly the text area.
   * This is a CROP not a stretch — the image proportions are untouched.
   */

  const RENDER_WIDTH = 220;   // px — controls how big the text appears
  const CROP_HEIGHT  = 64;    // px — hides the blank space below "capital"

  return (
    <div
      className={className}
      style={{
        width: `${RENDER_WIDTH}px`,
        height: `${CROP_HEIGHT}px`,
        overflow: "hidden",
        lineHeight: 0,
        flexShrink: 0,
      }}
    >
      <img
        src={logoTransparent}
        alt="Aventum Capital"
        style={{
          width: `${RENDER_WIDTH}px`,
          height: "auto",          // keeps native 1:1 aspect ratio
          display: "block",
          filter: variant === "white" ? "brightness(0) invert(1)" : "none",
        }}
        draggable={false}
      />
    </div>
  );
}
