import { useState, useRef, useEffect } from "react";
import { useRegion, REGIONS } from "@/contexts/RegionContext";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function RegionSelector() {
  const { region, setRegion } = useRegion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium"
        aria-label="Change region and currency"
      >
        <span className="text-base leading-none">{region.flag}</span>
        <span className="text-muted-foreground hidden sm:block">{region.currency}</span>
        <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-popover border border-border rounded-xl shadow-lg py-1 z-50 overflow-hidden">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
            Region & Currency
          </div>
          {Object.values(REGIONS).map(r => (
            <button
              key={r.code}
              onClick={() => { setRegion(r.code); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left",
                region.code === r.code && "bg-primary/5 text-primary font-medium"
              )}
            >
              <span className="text-base leading-none">{r.flag}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.currency}</div>
              </div>
              {region.code === r.code && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
            </button>
          ))}
          <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border mt-1">
            Rates are approximate
          </div>
        </div>
      )}
    </div>
  );
}
