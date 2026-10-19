/**
 * NBA board: last season's production rescored under the league's own
 * scoring settings (see scripts/build_nba_rankings.py). No analyst layer and
 * no consensus blend — Sleeper's ADP is carried only so the gap between where
 * a player finished and where he is being drafted can be flagged.
 */
import raw from "../../data/nba-rankings.json";
import { normalizeName, lastName } from "../lib/normalize";
import type { NbaPlayer, NbaPos, NbaRankingsFile } from "./types";

export const NBA_FILE = raw as unknown as NbaRankingsFile;
export const NBA_PLAYERS: NbaPlayer[] = NBA_FILE.players;

export interface NbaIndex {
  byId: Map<string, NbaPlayer>;
  byFull: Map<string, NbaPlayer>;
  byLast: Map<string, NbaPlayer[]>;
}

export function buildNbaIndex(players: NbaPlayer[]): NbaIndex {
  const byId = new Map<string, NbaPlayer>();
  const byFull = new Map<string, NbaPlayer>();
  const byLast = new Map<string, NbaPlayer[]>();
  for (const p of players) {
    byId.set(p.id, p);
    byFull.set(normalizeName(p.name), p);
    const lk = lastName(p.name);
    const arr = byLast.get(lk) ?? [];
    arr.push(p);
    byLast.set(lk, arr);
  }
  return { byId, byFull, byLast };
}

export const NBA_INDEX = buildNbaIndex(NBA_PLAYERS);

/** Ranked players first (by last-year finish), then the unranked by ADP. */
export const NBA_BOARD: NbaPlayer[] = [...NBA_PLAYERS].sort((a, b) => {
  if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
  if (a.rank !== null) return -1;
  if (b.rank !== null) return 1;
  return (a.adp ?? 999) - (b.adp ?? 999);
});

/** Human label for the flag chip; null when nothing is worth a chip. */
export function flagLabel(p: NbaPlayer): { text: string; tone: "good" | "bad" | "warn" } | null {
  switch (p.flag) {
    case "severely-underrated":
      return { text: "VALUE++", tone: "good" };
    case "underrated":
      return { text: "VALUE", tone: "good" };
    case "severely-overrated":
      return { text: "REACH++", tone: "bad" };
    case "overrated":
      return { text: "REACH", tone: "bad" };
    case "small-sample":
      return { text: `${p.gp} GP`, tone: "warn" };
    case "no-data":
      return { text: p.yearsExp === 0 ? "ROOKIE" : "NO '25", tone: "warn" };
    default:
      return null;
  }
}

/** Best position rank among the given open positions (or all eligible). */
export function bestPosRank(p: NbaPlayer, among?: NbaPos[]): { pos: NbaPos; rank: number } | null {
  let best: { pos: NbaPos; rank: number } | null = null;
  for (const pos of p.eligible) {
    if (among && !among.includes(pos)) continue;
    const r = p.posRank[pos];
    if (r !== undefined && (best === null || r < best.rank)) best = { pos, rank: r };
  }
  return best;
}
