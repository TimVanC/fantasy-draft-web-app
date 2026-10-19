/**
 * Will he be there at my next pick? Two estimates, same as the NFL board:
 *  - odds from Sleeper ADP (the market decides what everyone else does),
 *  - fallback: his index on the available board vs. picks before my turn.
 */
import { conditionalSurvival } from "../lib/advisor";
import type { NbaPlayer } from "./types";

export type Scarcity = "likely-gone" | "can-wait" | null;

export function nbaScarcity(available: NbaPlayer[], othersPicks: number | null): Map<string, Scarcity> {
  const out = new Map<string, Scarcity>();
  let idx = 0;
  for (const p of available) {
    if (othersPicks === null || p.rank === null) {
      out.set(p.id, null);
      continue;
    }
    out.set(p.id, idx < othersPicks ? "likely-gone" : "can-wait");
    idx++;
  }
  return out;
}

export function nbaSurvival(adp: number | null | undefined, currentPickNo: number, myNextPickNo: number | null): number | null {
  if (!adp || myNextPickNo === null) return null;
  return conditionalSurvival(adp, currentPickNo, myNextPickNo);
}
