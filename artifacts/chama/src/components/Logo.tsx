interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
  iconOnly?: boolean;
}

/**
 * Logo placement guide:
 *
 * <Logo />                   → Full lockup: AC monogram + "Aventum / capital" text (navbar, light bg)
 * <Logo variant="white" />   → Sage-green AC monogram tile only (dark panels, sidebar, footer)
 * <Logo iconOnly />          → Sage-green AC monogram tile only (compact / icon use)
 */
export function Logo({ variant = "dark", className = "", iconOnly = false }: LogoProps) {
  // Monogram-only — sage green tile on dark surfaces
  if (iconOnly || variant === "white") {
    return (
      <img
        src="/logo-icon-sage.png"
        alt="AC — Aventum Capital"
        className={`rounded-xl ${className || "h-12 w-12"}`}
      />
    );
  }

  // Full navbar lockup — AC badge + wordmark text side-by-side
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* AC monogram badge — forest green tile */}
      <img
        src="/logo-icon-dark-green.png"
        alt=""
        aria-hidden="true"
        className="h-8 w-8 rounded-lg shrink-0"
      />
      {/* Wordmark in brand typeface */}
      <div className="flex flex-col leading-none">
        <span className="text-[17px] font-light tracking-wide text-[#344E41]">
          Aventum
        </span>
        <span className="text-[9px] font-light tracking-[0.22em] uppercase text-[#344E41]/60 mt-0.5">
          capital
        </span>
      </div>
    </div>
  );
}
