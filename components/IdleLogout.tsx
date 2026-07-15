"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";
import { IDLE_TIMEOUT_SECONDS } from "@/lib/session-config";

const IDLE_MS = IDLE_TIMEOUT_SECONDS * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

// Signs the user out after IDLE_TIMEOUT_SECONDS of no interaction, and also when the tab/app
// was backgrounded (closed, minimized, switched away from) for that long and comes back —
// covers "walked away" and "closed and reopened later" without waiting on the session cookie
// to simply expire on the next request.
export default function IdleLogout() {
  const { status } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;

    function doSignOut() {
      signOut({ callbackUrl: "/login?reason=idle" });
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(doSignOut, IDLE_MS);
    }

    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current && Date.now() - hiddenAtRef.current >= IDLE_MS) {
        doSignOut();
        return;
      }
      hiddenAtRef.current = null;
      resetTimer();
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [status]);

  return null;
}
