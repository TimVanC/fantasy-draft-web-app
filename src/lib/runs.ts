/**
 * Positional run detector: runs move a position's survival odds faster than
 * ADP does, and they're exactly when people panic-reach.
 */
import type { SleeperPick } from "../types";

export interface Run {
  pos: string;
  count: number;
  window: number;
}

const WINDOW = 6;
const THRESHOLD = 4;

export function detectRun(picks: SleeperPick[]): Run | null {
  const recent = picks.slice(-WINDOW);
  if (recent.length < THRESHOLD) return null;
  const counts = new Map<string, number>();
  for (const p of recent) {
    const pos = p.metadata.position;
    if (!["QB", "RB", "WR", "TE"].includes(pos)) continue;
    counts.set(pos, (counts.get(pos) ?? 0) + 1);
  }
  let best: Run | null = null;
  for (const [pos, count] of counts) {
    if (count >= THRESHOLD && (!best || count > best.count)) {
      best = { pos, count, window: recent.length };
    }
  }
  return best;
}
