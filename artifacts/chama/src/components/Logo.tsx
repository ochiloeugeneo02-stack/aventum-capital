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
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <img
          src="/logo-icon-sage.png"
          alt=""
          aria-hidden="true"
          className="h-10 w-10 rounded-xl shrink-0"
        />
        <div className="flex flex-col leading-none">
          <span
            style={{
              fontSize: "20px",
              fontWeight: 300,
              letterSpacing: "0.02em",
              color: "white",
              lineHeight: 1.1,
            }}
          >
            Aventum
          </span>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 300,
              letterSpacing: "0.22em",
              color: "rgba(255,255,255,0.55)",
              textTransform: "uppercase",
              marginTop: "3px",
            }}
          >
            capital
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo-icon-dark-green.png"
        alt=""
        aria-hidden="true"
        className="h-8 w-8 rounded-lg shrink-0"
      />
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
