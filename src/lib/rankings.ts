import rawRankings from "../../data/rankings.json";
import rawStrategy from "../../data/strategy.json";
import rawSheet from "../../data/cheatsheet.json";
import type { RankedPlayer, ScoringFormat, SheetEntry } from "../types";
import { buildMatchIndex, matchPick, playerKey } from "./normalize";
import { isTrap, isValue, valueGap } from "./cheatsheet";

export const RANKINGS = rawRankings as RankedPlayer[];
export const STRATEGY = rawStrategy as {
  source: string;
  note: string;
  roundPlan: { round: number; plan: string }[];
  rules: string[];
  positional: Record<string, { main: string; secondary?: string; note?: string }>;
};

// ---- merge the cheat sheet onto the guide universe -------------------------
// Matched sheet entries annotate Joel's players (VALUE tag + stats); the rest
// become the deep pool that extends the board past his 150.
const SHEET = rawSheet as SheetEntry[];
const guideIndex = buildMatchIndex(RANKINGS);
const deepPool: RankedPlayer[] = [];

for (const entry of SHEET) {
  const space = entry.name.indexOf(" ");
  const matched = matchPick(guideIndex, {
    metadata: {
      first_name: space === -1 ? entry.name : entry.name.slice(0, space),
      last_name: space === -1 ? "" : entry.name.slice(space + 1),
      position: entry.pos,
      team: entry.team ?? undefined,
    },
  });
  if (matched) {
    matched.sheet = entry;
    matched.value = isValue(entry);
    matched.trap = isTrap(entry);
    matched.valueGap = valueGap(entry);
    if (matched.team === null && entry.team) matched.team = entry.team;
  } else {
    deepPool.push({
      name: entry.name,
      pos: entry.pos,
      team: entry.team,
      pprRank: null,
      halfRank: null,
      posRank: null,
      tag: null,
      adp: null,
      adjPpg2025: null,
      adjPpgNote: null,
      projPpg2026: null,
      ceiling: null,
      risk: null,
      notes: [],
      sheet: entry,
      value: isValue(entry),
      trap: isTrap(entry),
      valueGap: valueGap(entry),
    });
  }
}

deepPool.sort((a, b) => (a.sheet?.rank ?? 999) - (b.sheet?.rank ?? 999));

/** Sheet-only players, in sheet order — the board past Joel's last rank. */
export const DEEP_POOL: RankedPlayer[] = deepPool;

/** Everyone matchable: guide players + sheet-only players. */
export const ALL_PLAYERS: RankedPlayer[] = [...RANKINGS, ...DEEP_POOL];

export const MATCH_INDEX = buildMatchIndex(ALL_PLAYERS);

export function boardRank(p: RankedPlayer, format: ScoringFormat): number | null {
  return format === "ppr" ? p.pprRank : p.halfRank;
}

/**
 * Guide players sorted by the active board. Players without an overall rank
 * sort after ranked ones, by position rank — they exist mostly so live picks
 * can still match; the UI keeps them out of the way.
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
