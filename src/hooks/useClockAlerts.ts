import { useEffect, useRef, useState } from "react";

/**
 * On-deck / on-the-clock alerts: tab-title flash, a short beep, and (when
 * granted) a browser notification — because the Sleeper tab, not this one,
 * is probably focused. Fires once per pick number per transition.
 */
export function useClockAlerts(input: {
  enabled: boolean;
  othersPicks: number | null;
  nextPickNo: number;
  draftDone: boolean;
}) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );
  const firedFor = useRef<string | null>(null);
  const baseTitle = useRef(document.title);

  useEffect(() => {
    const { enabled, othersPicks, nextPickNo, draftDone } = input;
    if (!enabled || draftDone || othersPicks === null) {
      document.title = baseTitle.current;
      return;
    }
    const state = othersPicks === 0 ? "clock" : othersPicks === 1 ? "deck" : null;
    if (!state) {
      document.title = baseTitle.current;
      firedFor.current = null;
      return;
    }
    const key = `${state}:${nextPickNo}`;
    document.title = state === "clock" ? "⏰ YOUR PICK — Draft War Room" : "On deck — Draft War Room";
    if (firedFor.current === key) return;
    firedFor.current = key;

    beep(state === "clock" ? 2 : 1);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(state === "clock" ? "You're on the clock" : "You're on deck", {
          body: state === "clock" ? "Draft War Room has your plan ready." : "One pick until yours.",
          tag: key,
        });
      } catch {
        // notifications blocked at the OS level: the title + beep still fire
      }
    }
  }, [input.enabled, input.othersPicks, input.nextPickNo, input.draftDone]);

  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
  };

  return { permission, requestPermission };
}

/** Short beep(s) via Web Audio — no asset needed. */
function beep(times: number) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.08;
      osc.connect(gain).connect(ctx.destination);
      const t = ctx.currentTime + i * 0.25;
      osc.start(t);
      osc.stop(t + 0.15);
    }
  } catch {
    // audio blocked until user gesture: fine, the title flash still works
  }
}
