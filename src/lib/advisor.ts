/**
 * Pick Advisor: who to take with my pick, and who can wait.
 *
 * Division of labor (his rule #1 — "use rankings to find value" against ADP):
 *  - VALUE comes only from the guide: board rank, tags, roster need, his
 *    round plan. Market opinion never reorders value.
 *  - AVAILABILITY comes from market ADP: the market, not the guide, decides
 *    who gets drafted by everyone else, so survival odds to my next pick are
 *    modeled on ADP (falling back to board rank when a player has no ADP).
 */
import type { RankedPlayer, ScoringFormat } from "../types";
import { boardRank } from "./rankings";
import { playerKey } from "./normalize";
import type { AdpMap } from "./adp";

/**
 * Probability a player is still available at overall pick `pickNo`, given his
 * market ADP. Logistic around ADP with a spread that widens later in the
 * draft (early picks are scripted, late picks are chaos).
 */
export function survivalProb(adp: number, pickNo: number): number {
  const sigma = Math.max(3, 0.15 * adp);
  const p = 1 / (1 + Math.exp(-(adp - pickNo) / sigma));
  return Math.min(0.99, Math.max(0.01, p));
}

export interface Suggestion {
  player: RankedPlayer;
  score: number;
  /** P(still available at my upcoming pick); 1 when I'm on the clock. */
  pReach: number;
  /** P(still available at the pick after that) — the "can he wait" number. */
  pSurviveNext: number | null;
  adp: number | null;
  adpFormatted: string | null;
  reasons: string[];
}

export interface AdviceInput {
  available: RankedPlayer[];
  adpMap: AdpMap;
  format: ScoringFormat;
  /** My upcoming pick number (null = no picks left). */
  myPick: number | null;
  /** My pick after that (null = last pick). */
  myNextPick: number | null;
  onClock: boolean;
  /** Positions that can still fill an open starting slot (incl. via flex). */
  openStarterPositions: Set<string>;
  /** Count of my picks per position, for saturation penalties. */
  myPosCounts: Map<string, number>;
  /** Position his round plan names for my upcoming round, if any. */
  planPosition: string | null;
}

const POOL_SIZE = 15;
const SUGGESTIONS = 3;

export interface Advice {
  suggestions: Suggestion[];
  /** Top-of-board players who very likely last to my next pick. */
  canWait: Suggestion[];
}

export function advise(input: AdviceInput): Advice {
  const { adpMap, myPick, myNextPick, onClock } = input;
  if (myPick === null) return { suggestions: [], canWait: [] };

  const pool = input.available.slice(0, POOL_SIZE);
  const scored: Suggestion[] = pool.map((player, availIndex) => {
    const rank = boardRank(player, input.format);
    const entry = adpMap.get(playerKey(player)) ?? null;
    // Missing from a populated ADP feed = the market is sleeping on him, so
    // he survives (that gap IS the value signal). Only when the whole feed is
    // unavailable do we fall back to guide rank as the survival proxy.
    const effAdp =
      entry?.adp ?? (adpMap.size > 0 ? Math.max(rank ?? 999, 140) : (rank ?? 999));
    const pReach = onClock ? 1 : survivalProb(effAdp, myPick);
    const pSurviveNext = myNextPick === null ? null : survivalProb(effAdp, myNextPick);

    const reasons: string[] = [];
    let score = -availIndex; // base: the guide's own ordering

    // Urgency: a player who will NOT make it back gains priority now — but
    // urgency only matters to the extent he even reaches my pick, so it is
    // weighted by pReach (a player who's gone before my turn has no urgency).
    if (pSurviveNext !== null) {
      score += 6 * (1 - pSurviveNext) * pReach;
      if (pReach >= 0.4) {
        if (pSurviveNext < 0.35) reasons.push(`only ${Math.round(pSurviveNext * 100)}% to last to #${myNextPick}`);
        else if (pSurviveNext > 0.7) reasons.push(`${Math.round(pSurviveNext * 100)}% to still be there at #${myNextPick}`);
      }
    }

    // Conviction tags are the guide's strongest signal.
    if (player.tag === "target") {
      score += 2;
      reasons.push("his target");
    } else if (player.tag === "pass") {
      score -= 2;
    } else if (player.tag === "avoid") {
      score -= 6;
      reasons.push("he's avoiding");
    }

    // Roster need.
    if (input.openStarterPositions.has(player.pos)) {
      score += 1.5;
      reasons.push(`fills ${player.pos}`);
    } else if ((input.myPosCounts.get(player.pos) ?? 0) >= 2) {
      score -= 3;
      reasons.push(`already ${input.myPosCounts.get(player.pos)} ${player.pos}s`);
    }

    // His round plan, as a nudge not a rule (BPA still most important).
    if (input.planPosition && player.pos === input.planPosition) {
      score += 1;
      reasons.push("plan round");
    }

    // If he probably won't even reach my pick, he can't be the advice.
    if (!onClock) {
      score -= 8 * (1 - pReach);
      if (pReach < 0.4) reasons.push(`may be gone before #${myPick} (${Math.round(pReach * 100)}%)`);
    }

    return {
      player,
      score,
      pReach,
      pSurviveNext,
      adp: entry?.adp ?? null,
      adpFormatted: entry?.formatted ?? null,
      reasons,
    };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  // Never suggest his avoids, and never spend a slot planning for a player
  // who realistically won't reach my pick.
  const suggestions = ranked
    .filter((s) => s.player.tag !== "avoid" && s.pReach >= 0.25)
    .slice(0, SUGGESTIONS);

  // "Can wait": guide's top players the market will very likely return to me.
  const suggested = new Set(suggestions.map((s) => playerKey(s.player)));
  const canWait = scored
    .filter(
      (s) =>
        !suggested.has(playerKey(s.player)) &&
        s.pSurviveNext !== null &&
        s.pSurviveNext >= 0.7 &&
        s.pReach >= 0.5,
    )
    .slice(0, 4);

  return { suggestions, canWait };
}
