/**
 * Opponent-need-adjusted survival. Raw ADP says who the market takes; but
 * the specific teams picking between now and my turn have rosters, and a
 * team with two RBs already is less likely to grab a third. We know every
 * team's picks and the league's slots, so hazard is scaled by how much the
 * intervening pickers still want the position.
 */
import type { SleeperDraft, SleeperPick } from "../types";
import { fillSlots } from "./roster";
import { slotForPick } from "./snake";

/** How hungry a team is for a position: >1 needs it, <1 is saturated. */
export function teamDemandFactor(
  settings: SleeperDraft["settings"],
  teamPicks: SleeperPick[],
  pos: string,
): number {
  const slots = fillSlots(settings, teamPicks);
  const dedicatedOpen = slots.filter((s) => s.label === pos && s.pick === null).length;
  const flexOpen = slots.filter(
    (s) => s.label !== "BN" && s.label !== pos && s.pick === null && s.eligible(pos),
  ).length;
  const count = teamPicks.filter((p) => p.metadata.position === pos).length;
  if (dedicatedOpen > 0) return 1.25;
  if (flexOpen > 0) return 1.0;
  // Starters + flex filled: depth. Cheap for RB/WR, rare for QB/TE.
  if (pos === "QB" || pos === "TE") return count >= 2 ? 0.15 : 0.4;
  return count >= 4 ? 0.5 : 0.8;
}

export type DemandFn = (pos: string, fromPick: number, toPick: number) => number;

/**
 * Build a function giving the average demand factor for `pos` among the
 * teams that pick in (fromPick, toPick). Memoized per position+slot since
 * rosters only change when picks change.
 */
export function buildDemandFn(
  settings: SleeperDraft["settings"],
  picks: SleeperPick[],
  mySlot: number | null,
): DemandFn {
  const teams = settings.teams;
  const reversal = settings.reversal_round ?? 0;
  const bySlot = new Map<number, SleeperPick[]>();
  for (const p of picks) {
    const arr = bySlot.get(p.draft_slot) ?? [];
    arr.push(p);
    bySlot.set(p.draft_slot, arr);
  }
  const cache = new Map<string, number>();
  const factorFor = (slot: number, pos: string) => {
    const k = `${slot}|${pos}`;
    let f = cache.get(k);
    if (f === undefined) {
      f = teamDemandFactor(settings, bySlot.get(slot) ?? [], pos);
      cache.set(k, f);
    }
    return f;
  };
  return (pos, fromPick, toPick) => {
    let sum = 0;
    let n = 0;
    for (let p = fromPick; p < toPick; p++) {
      const { slot } = slotForPick(p, teams, reversal);
      if (slot === mySlot) continue;
      sum += factorFor(slot, pos);
      n++;
    }
    return n === 0 ? 1 : sum / n;
  };
}

/** Scale a survival probability by opponent demand (hazard multiplier). */
export function adjustSurvival(p: number, demandFactor: number): number {
  const hazard = -Math.log(Math.max(0.01, Math.min(0.99, p)));
  return Math.min(0.99, Math.max(0.01, Math.exp(-hazard * demandFactor)));
}
