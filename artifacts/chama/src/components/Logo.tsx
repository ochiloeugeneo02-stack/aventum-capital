import logoTransparent from "@/assets/logo-transparent.png";
import logoDark from "@/assets/logo-source.png";

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

  if (variant === "white") {
    /* Crop wrapper: shows only the text area of the 500×500 logo */
    return (
      <div
        className={className}
        style={{ overflow: "hidden", height: "52px", display: "inline-block", lineHeight: 0 }}
      >
        <img
          src={logoTransparent}
          alt="Aventum Capital"
          style={{
            height: "172px",
            width: "auto",
            display: "block",
            filter: "brightness(0) invert(1)",
          }}
        />
      </div>
    );
  }

  return (
    <img
      src={logoDark}
      alt="Aventum Capital"
      className={className}
      style={{ height: "40px", width: "auto" }}
    />
  );
}
