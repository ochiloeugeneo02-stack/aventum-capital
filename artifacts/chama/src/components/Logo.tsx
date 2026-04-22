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
        alt="AC — Aventum Capital"
        className={`rounded-xl ${className || "h-12 w-12"}`}
      />
    );
  }

  if (variant === "white") {
    return (
      <div
        style={{ overflow: "hidden", height: "56px", display: "inline-block" }}
        className={className}
      >
        <img
          src="/logo-aventum-transparent.png"
          alt="Aventum Capital"
          style={{
            filter: "brightness(0) invert(1)",
            height: "188px",
            width: "auto",
            display: "block",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{ overflow: "hidden", height: "44px", display: "inline-block" }}
      className={className}
    >
      <img
        src="/logo-aventum-transparent.png"
        alt="Aventum Capital"
        style={{
          height: "148px",
          width: "auto",
          display: "block",
        }}
      />
    </div>
  );
}
