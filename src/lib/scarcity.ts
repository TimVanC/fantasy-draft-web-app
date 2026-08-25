/**
 * Scarcity model per the spec: compare a player's standing on the analyst's
 * board against the number of picks other teams make before my next turn.
 *
 * A player whose index among *available* players (0-based, active board order)
 * is inside that window is "likely gone" by my next pick; outside it, he "can
 * wait". No consensus ADP is blended in — the disagreement with ADP is the
 * signal, so the window intentionally uses only the guide's own ordering.
 */
import type { RankedPlayer, ScoringFormat } from "../types";
import { boardRank } from "./rankings";

export type Scarcity = "likely-gone" | "can-wait" | null;

export function scarcityLabels(
  availableSorted: RankedPlayer[],
  othersPicksBeforeMyTurn: number | null,
  format: ScoringFormat,
): Map<RankedPlayer, Scarcity> {
  const out = new Map<RankedPlayer, Scarcity>();
  let idx = 0;
  for (const p of availableSorted) {
    if (othersPicksBeforeMyTurn === null || boardRank(p, format) === null) {
      out.set(p, null); // no next pick, or unranked player: no estimate
      continue;
    }
    out.set(p, idx < othersPicksBeforeMyTurn ? "likely-gone" : "can-wait");
    idx++;
  }
  return out;
}
