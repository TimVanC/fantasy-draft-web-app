import rawRankings from "../../data/rankings.json";
import rawStrategy from "../../data/strategy.json";
import type { RankedPlayer, ScoringFormat } from "../types";
import { buildMatchIndex, playerKey } from "./normalize";

export const RANKINGS = rawRankings as RankedPlayer[];
export const STRATEGY = rawStrategy as {
  source: string;
  note: string;
  roundPlan: { round: number; plan: string }[];
  rules: string[];
  positional: Record<string, { main: string; secondary?: string; note?: string }>;
};

export const MATCH_INDEX = buildMatchIndex(RANKINGS);

export function boardRank(p: RankedPlayer, format: ScoringFormat): number | null {
  return format === "ppr" ? p.pprRank : p.halfRank;
}

/**
 * Players sorted by the active board. Players without an overall rank sort
 * after ranked ones, by position rank — they exist mostly so live picks can
 * still match; the UI keeps them out of the way.
 */
export function sortedBoard(format: ScoringFormat): RankedPlayer[] {
  return [...RANKINGS].sort((a, b) => {
    const ra = boardRank(a, format);
    const rb = boardRank(b, format);
    if (ra !== null && rb !== null) return ra - rb;
    if (ra !== null) return -1;
    if (rb !== null) return 1;
    return (a.posRank ?? 999) - (b.posRank ?? 999);
  });
}

export { playerKey };
