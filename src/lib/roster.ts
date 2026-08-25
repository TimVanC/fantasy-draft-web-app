/**
 * Map my picks into actual starting slots read from the Sleeper draft
 * settings object — nothing about the league is hardcoded.
 */
import type { RosterSlot, SleeperDraft, SleeperPick } from "../types";

interface SlotDef {
  key: string;
  label: string;
  eligible: (pos: string) => boolean;
}

const SLOT_DEFS: SlotDef[] = [
  { key: "slots_qb", label: "QB", eligible: (p) => p === "QB" },
  { key: "slots_rb", label: "RB", eligible: (p) => p === "RB" },
  { key: "slots_wr", label: "WR", eligible: (p) => p === "WR" },
  { key: "slots_te", label: "TE", eligible: (p) => p === "TE" },
  { key: "slots_flex", label: "W/R/T", eligible: (p) => p === "WR" || p === "RB" || p === "TE" },
  { key: "slots_wrrb_flex", label: "W/R", eligible: (p) => p === "WR" || p === "RB" },
  { key: "slots_rec_flex", label: "W/T", eligible: (p) => p === "WR" || p === "TE" },
  { key: "slots_super_flex", label: "SFLEX", eligible: (p) => ["QB", "WR", "RB", "TE"].includes(p) },
  { key: "slots_def", label: "DEF", eligible: (p) => p === "DEF" },
  { key: "slots_k", label: "K", eligible: (p) => p === "K" },
];

export function buildSlots(settings: SleeperDraft["settings"]): RosterSlot[] {
  const slots: RosterSlot[] = [];
  for (const def of SLOT_DEFS) {
    const n = settings[def.key] ?? 0;
    for (let i = 0; i < n; i++) {
      slots.push({ label: def.label, eligible: def.eligible, pick: null });
    }
  }
  const bench = settings.slots_bn ?? 0;
  for (let i = 0; i < bench; i++) {
    slots.push({ label: "BN", eligible: () => true, pick: null });
  }
  return slots;
}

/**
 * Assign my picks, in draft order, each to the first open slot it can start
 * in (dedicated position slot, then flex), else bench.
 */
export function fillSlots(settings: SleeperDraft["settings"], myPicks: SleeperPick[]): RosterSlot[] {
  const slots = buildSlots(settings);
  for (const pick of myPicks) {
    const pos = pick.metadata.position;
    const open = slots.find((s) => s.label !== "BN" && s.pick === null && s.eligible(pos));
    const target = open ?? slots.find((s) => s.label === "BN" && s.pick === null);
    if (target) target.pick = pick;
  }
  return slots;
}

/** Starting-slot labels still unfilled (bench excluded). */
export function unfilledStarters(slots: RosterSlot[]): string[] {
  return slots.filter((s) => s.label !== "BN" && s.pick === null).map((s) => s.label);
}
