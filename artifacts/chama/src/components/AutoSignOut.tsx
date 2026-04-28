import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const AUTO_SIGNOUT_KEY = "aventum_auto_signout";
const IDLE_TIMEOUT = 30 * 60 * 1000;
const WARN_BEFORE = 2 * 60 * 1000;
const EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"] as const;

export function getAutoSignOutEnabled(): boolean {
  return localStorage.getItem(AUTO_SIGNOUT_KEY) !== "false";
}

export function setAutoSignOutEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_SIGNOUT_KEY, enabled ? "true" : "false");
  window.dispatchEvent(new Event("aventum_autosignout_changed"));
}

export function AutoSignOut() {
  const { logout, isAuthenticated } = useAuth();
  const [enabled, setEnabled] = useState(getAutoSignOutEnabled);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(WARN_BEFORE / 1000));

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    const warnSecs = Math.floor(WARN_BEFORE / 1000);
    setSecondsLeft(warnSecs);
    setShowWarning(true);
    countdownRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { stopCountdown(); return 0; }
        return s - 1;
      });
    }, 1000);
  }, [stopCountdown]);

  const resetTimers = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warnTimer.current) clearTimeout(warnTimer.current);
    stopCountdown();
    setShowWarning(false);

    if (!enabled || !isAuthenticated) return;

    warnTimer.current = setTimeout(startCountdown, IDLE_TIMEOUT - WARN_BEFORE);
    idleTimer.current = setTimeout(() => {
      setShowWarning(false);
      stopCountdown();
      logout();
    }, IDLE_TIMEOUT);
  }, [enabled, isAuthenticated, startCountdown, stopCountdown, logout]);

  useEffect(() => {
    const sync = () => setEnabled(getAutoSignOutEnabled());
    window.addEventListener("storage", sync);
    window.addEventListener("aventum_autosignout_changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("aventum_autosignout_changed", sync);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    resetTimers();
    EVENTS.forEach(e => window.addEventListener(e, resetTimers, { passive: true }));
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      stopCountdown();
      EVENTS.forEach(e => window.removeEventListener(e, resetTimers));
    };
  }, [isAuthenticated, enabled, resetTimers, stopCountdown]);

  if (!showWarning) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")} min` : `${secs}s`;

  return (
    <Dialog open={showWarning} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <div className="flex flex-col items-center gap-5 py-3 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Still there?</h2>
            <p className="text-sm text-muted-foreground mt-1.5">
              You've been inactive for a while. You'll be signed out in
            </p>
            <p className="text-4xl font-mono font-bold text-amber-600 mt-3 tabular-nums">{timeStr}</p>
          </div>
          <div className="flex gap-3 w-full pt-1">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => { setShowWarning(false); stopCountdown(); logout(); }}
            >
              Sign out now
            </Button>
            <Button
              className="flex-1 bg-[#3A5A40] hover:bg-[#344E41]"
              onClick={resetTimers}
            >
              Stay signed in
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
