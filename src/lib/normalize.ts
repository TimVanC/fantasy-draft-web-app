/**
 * Name normalization + pick-to-rankings matching.
 *
 * Sleeper names and the guide's strings differ on suffixes ("Jr.", "III"),
 * apostrophes, periods, hyphens, and the occasional spelling
 * ("Jonathan"/"Jonathon"). Both sides are normalized (lowercase, strip
 * punctuation, strip suffixes), then matched on full name + position first,
 * falling back to last name + position (+ team compatibility when both sides
 * know the team, + first-initial disambiguation when several share a last
 * name).
 */
import type { MatchedPick, RankedPlayer, SleeperPick } from "../types";

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** Lowercase, ASCII-fold, strip punctuation and generational suffixes. */
export function normalizeName(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ﬀ/g, "ff")
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl");
  const cleaned = ascii
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z ]/g, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter((p) => p && !SUFFIXES.has(p));
  return parts.join(" ");
}

export function lastName(name: string): string {
  const parts = normalizeName(name).split(" ");
  return parts[parts.length - 1] ?? "";
}

export function firstInitial(name: string): string {
  return normalizeName(name).charAt(0);
}

/** Stable key identifying a guide player. */
export function playerKey(p: { name: string; pos: string }): string {
  return `${normalizeName(p.name)}|${p.pos}`;
}

export interface MatchIndex {
  byFull: Map<string, RankedPlayer>;
  byLast: Map<string, RankedPlayer[]>;
  byKey: Map<string, RankedPlayer>;
}

export function buildMatchIndex(players: RankedPlayer[]): MatchIndex {
  const byFull = new Map<string, RankedPlayer>();
  const byLast = new Map<string, RankedPlayer[]>();
  const byKey = new Map<string, RankedPlayer>();
  for (const p of players) {
    byFull.set(`${normalizeName(p.name)}|${p.pos}`, p);
    byKey.set(playerKey(p), p);
    const lk = `${lastName(p.name)}|${p.pos}`;
    const arr = byLast.get(lk) ?? [];
    arr.push(p);
    byLast.set(lk, arr);
  }
  return { byFull, byLast, byKey };
}

/**
 * Match one Sleeper pick to a guide player. Returns the player or null.
 * Never throws; ambiguity resolves to null (surfaced as unmatched).
 */
export function matchPick(
  index: MatchIndex,
  pick: Pick<SleeperPick, "metadata">,
): RankedPlayer | null {
  const meta = pick.metadata;
  const pos = meta.position;
  const full = normalizeName(`${meta.first_name} ${meta.last_name}`);

  const exact = index.byFull.get(`${full}|${pos}`);
  if (exact) return exact;

  const candidates = index.byLast.get(`${lastName(meta.last_name)}|${pos}`) ?? [];
  // Team compatibility: reject a candidate only when both sides know the team
  // and they disagree.
  const compatible = candidates.filter(
    (c) => !c.team || !meta.team || c.team === meta.team,
  );
  // The first initial must agree even for a lone candidate: a different
  // player sharing a last name (Kaleb Johnson / Emmett Johnson) must surface
  // as unmatched rather than silently taking the wrong player off the board.
  const fi = full.charAt(0);
  const byInitial = compatible.filter((c) => firstInitial(c.name) === fi);
  if (byInitial.length === 1) return byInitial[0];
  return null;
}

const RANKED_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

// matchPicks re-runs on every poll; warn once per unmatched pick, not per run.
const warnedPicks = new Set<string>();

/**
 * Match every pick. K/DEF picks are expected to miss (the guide ranks none)
 * and are not flagged; a QB/RB/WR/TE miss is logged and flagged for the UI.
 */
export function matchPicks(index: MatchIndex, picks: SleeperPick[]): MatchedPick[] {
  return picks.map((pick) => {
    const player = matchPick(index, pick);
    const isRankedPos = RANKED_POSITIONS.has(pick.metadata.position);
    const unmatched = player === null && isRankedPos;
    const warnKey = `${pick.pick_no}|${pick.metadata.first_name} ${pick.metadata.last_name}`;
    if (unmatched && !warnedPicks.has(warnKey)) {
      warnedPicks.add(warnKey);
      console.warn(
        `[draft-war-room] unmatched pick #${pick.pick_no}: ` +
          `sleeper="${pick.metadata.first_name} ${pick.metadata.last_name}" ` +
          `(${pick.metadata.position} ${pick.metadata.team ?? "?"}) — no guide player matched`,
      );
    }
    return { pick, playerKey: player ? playerKey(player) : null, unmatched };
  });
}
