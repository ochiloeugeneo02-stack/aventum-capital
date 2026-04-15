interface LogoProps {
  variant?: "dark" | "white";
  className?: string;
  iconOnly?: boolean;
}

/**
 * Logo component:
 *
 * <Logo />                   → Forest-green "Aventum capital" wordmark badge (for white navbar)
 * <Logo variant="white" />   → AC monogram on sage green tile (for dark panels / sidebar)
 * <Logo iconOnly />          → AC monogram on sage green tile (small usage on dark bg)
 * <Logo variant="dark" iconOnly /> → same, suitable on any bg as an accent
 */
export function Logo({ variant = "dark", className = "", iconOnly = false }: LogoProps) {
  // AC monogram — sage green tile reads beautifully on dark forest-green surfaces
  if (iconOnly || variant === "white") {
    return (
      <img
        src="/logo-icon-sage.png"
        alt="AC — Aventum Capital"
        className={`rounded-xl ${className || "h-12 w-12"}`}
      />
    );
  }

  // Main wordmark — forest-green square PNG, cropped to text area
  return (
    <img
      src="/logo-wordmark.png"
      alt="Aventum Capital"
      className={`object-cover object-left-top rounded-sm ${className || "w-28 h-10"}`}
    />
  );
}
