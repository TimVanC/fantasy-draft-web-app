/**
 * Cheat-sheet integration (half-PPR stats sheet, ~327 skill players).
 *
 * Two jobs:
 *  1. VALUE tag — a player whose recent points-per-week positional rank beats
 *     his current positional draft cost by a clear margin. Distinct from and
 *     never replacing Joel's TARGET tag.
 *  2. Deep pool — sheet players Joel doesn't rank at all extend the board
 *     after his 150, so the late rounds aren't a blank page.
 */
import type { SheetEntry } from "../types";

/** Minimum games in a season for its production rank to count. */
const MIN_GAMES = 8;
/** Positional-rank spots by which production must beat cost. */
const VALUE_GAP = 8;
/** Production must have been startable to count as value at all. */
const RELEVANT_PROD_RANK: Record<string, number> = { QB: 20, TE: 20, RB: 48, WR: 48 };

/**
 * Best trustworthy production rank (recent seasons, enough games), or null.
 */
export function bestProdRank(e: SheetEntry): number | null {
  const candidates: number[] = [];
  if (e.ptwRank.y25 !== null && (e.gms.y25 ?? 0) >= MIN_GAMES) candidates.push(e.ptwRank.y25);
  if (e.ptwRank.y24 !== null && (e.gms.y24 ?? 0) >= MIN_GAMES) candidates.push(e.ptwRank.y24);
  return candidates.length ? Math.min(...candidates) : null;
}

/**
 * Positional-rank gap between what he costs and what he has produced.
 * Positive = production better than cost. Null when either side is unknown.
 */
export function valueGap(e: SheetEntry): number | null {
  const prod = bestProdRank(e);
  if (prod === null || e.posAdpRank === null) return null;
  return e.posAdpRank - prod;
}

export function isValue(e: SheetEntry): boolean {
  const gap = valueGap(e);
  const prod = bestProdRank(e);
  if (gap === null || prod === null) return false;
  return gap >= VALUE_GAP && prod <= (RELEVANT_PROD_RANK[e.pos] ?? 48);
}

/**
 * TRAP — the inverse of VALUE: a startable-cost player whose recent
 * production has never supported the price. Only applied to age-24+ players;
 * younger ones are expected to outgrow their history, so a thin résumé is
 * not evidence against them.
 */
export function isTrap(e: SheetEntry): boolean {
  const gap = valueGap(e);
  if (gap === null || e.posAdpRank === null) return false;
  return (
    gap <= -VALUE_GAP &&
    e.posAdpRank <= (RELEVANT_PROD_RANK[e.pos] ?? 48) &&
    (e.age ?? 0) >= 24
  );
}

/**
 * The sheet's own ADP as an overall pick number (assumes a 12-team board),
 * used only as a survival-odds fallback for players the FFC feed lacks.
 */
export function sheetAdpOverall(e: SheetEntry, teams = 12): number | null {
  const m = e.adp?.match(/^(\d+)\.(\d+)$/);
  if (!m) return null;
  return (parseInt(m[1], 10) - 1) * teams + parseInt(m[2], 10);
}

/** One-line summary for expanded rows and advisor reasons. */
export function sheetSummary(e: SheetEntry): string {
  const parts: string[] = [];
  if (e.adp) parts.push(`sheet ADP ${e.adp} (${e.pos}${e.posAdpRank ?? "?"})`);
  if (e.ptw.y25 !== null)
    parts.push(`'25 ${e.ptw.y25} pt/wk (${e.pos}${e.ptwRank.y25 ?? "?"}, ${e.gms.y25 ?? "?"} gms)`);
  if (e.ptw.y24 !== null)
    parts.push(`'24 ${e.ptw.y24} pt/wk (${e.pos}${e.ptwRank.y24 ?? "?"}, ${e.gms.y24 ?? "?"} gms)`);
  if (e.age !== null) parts.push(`age ${e.age}`);
  return parts.join(" · ");
}
