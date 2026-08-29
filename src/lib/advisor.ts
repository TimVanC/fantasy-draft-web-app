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
import { sheetAdpOverall } from "./cheatsheet";
import { formatPick } from "./snake";
import type { AdpMap } from "./adp";

/**
 * Probability a player is still available at overall pick `pickNo`, given his
 * market ADP. Logistic around ADP with a spread that widens later in the
 * draft (early picks are scripted, late picks are chaos).
 */
export function survivalProb(adp: number, pickNo: number): number {
  const sigma = Math.max(1.5, 0.15 * adp);
  const p = 1 / (1 + Math.exp(-(adp - pickNo) / sigma));
  return Math.min(0.99, Math.max(0.01, p));
}

/**
 * P(still available at `toPick` | still available at `fromPick`). Raw
 * survivalProb says ~1% for a player already 100 picks past his ADP — but the
 * fact that he's STILL on the board is information: the market has moved on.
 * Conditioning on current availability (with the spread widened to wherever
 * the draft actually is) keeps late-round odds sane.
 */
export function conditionalSurvival(adp: number, fromPick: number, toPick: number): number {
  if (toPick <= fromPick) return 0.99;
  // Round 1 is scripted — the spread floor stays tight so a consensus 1.01
  // doesn't look 50/50 to reach pick 4.
  const sigma = Math.max(1.5, 0.15 * Math.max(adp, fromPick));
  const logistic = (x: number) => 1 / (1 + Math.exp(-x / sigma));
  const pFrom = logistic(adp - fromPick);
  const pTo = logistic(adp - toPick);
  const p = pTo / Math.max(pFrom, 0.001);
  return Math.min(0.99, Math.max(0.01, p));
}

export interface PosNeed {
  /** Open dedicated starting slots for this position. */
  dedicatedOpen: number;
  /** Open flex-type slots this position is eligible for. */
  flexOpen: number;
  /** Total dedicated starting slots in the league's roster. */
  dedicatedTotal: number;
  /** How many of my picks are already this position. */
  count: number;
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
  /** League size, for round.pick formatting in reasons. */
  teams: number;
  /** The next overall pick to be made in the draft right now. */
  currentPickNo: number;
  /** My upcoming pick number (null = no picks left). */
  myPick: number | null;
  /** My pick after that (null = last pick). */
  myNextPick: number | null;
  onClock: boolean;
  /** Per-position roster demand, derived from the league's actual slots. */
  posNeeds: Map<string, PosNeed>;
  /** Needed positions whose ranked pool is projected to run dry soon. */
  scarcePositions?: Set<string>;
  /** Position his round plan names for my upcoming round, if any. */
  planPosition: string | null;
}

const POOL_SIZE = 18;
const SUGGESTIONS = 6;

export interface Advice {
  suggestions: Suggestion[];
  /** Top-of-board players who very likely last to my next pick. */
  canWait: Suggestion[];
}

export function advise(input: AdviceInput): Advice {
  const { adpMap, teams, currentPickNo, myPick, myNextPick, onClock } = input;
  const fp = (n: number) => formatPick(n, teams);
  if (myPick === null) return { suggestions: [], canWait: [] };

  const pool = input.available.slice(0, POOL_SIZE);
  const scored: Suggestion[] = pool.map((player, availIndex) => {
    const rank = boardRank(player, input.format);
    const entry = adpMap.get(playerKey(player)) ?? null;
    // Survival proxy chain: FFC market ADP, else the cheat sheet's own ADP,
    // else — missing from a populated feed means the market is sleeping on
    // him, so he survives (that gap IS the value signal). Only when every
    // feed is unavailable does guide rank stand in.
    const effAdp =
      entry?.adp ??
      (player.sheet ? sheetAdpOverall(player.sheet) : null) ??
      (adpMap.size > 0 ? Math.max(rank ?? 999, 140) : (rank ?? 999));
    const pReach = onClock ? 1 : conditionalSurvival(effAdp, currentPickNo, myPick);
    const pSurviveNext =
      myNextPick === null ? null : conditionalSurvival(effAdp, currentPickNo, myNextPick);

    const reasons: string[] = [];
    let score = -availIndex; // base: the guide's own ordering

    // Urgency: a player who will NOT make it back gains priority now — but
    // urgency only matters to the extent he even reaches my pick, so it is
    // weighted by pReach (a player who's gone before my turn has no urgency).
    if (pSurviveNext !== null) {
      score += 6 * (1 - pSurviveNext) * pReach;
    }
    // Survival messaging depends on where I am. On the clock the question is
    // "if I pass, is he back at my NEXT turn"; while planning ahead the
    // question is "does he even reach my upcoming pick".
    if (onClock) {
      if (pSurviveNext !== null) {
        if (pSurviveNext < 0.35) reasons.push(`only ${Math.round(pSurviveNext * 100)}% to last to ${fp(myNextPick!)}`);
        else if (pSurviveNext > 0.7) reasons.push(`${Math.round(pSurviveNext * 100)}% to still be there at ${fp(myNextPick!)}`);
      }
    } else if (pReach >= 0.4 && pReach < 0.85) {
      reasons.push(`${Math.round(pReach * 100)}% to reach ${fp(myPick)}`);
    } else if (pReach >= 0.85 && pSurviveNext !== null && pSurviveNext > 0.7) {
      reasons.push(`${Math.round(pSurviveNext * 100)}% to last even to ${fp(myNextPick!)}`);
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

    // Cheat-sheet VALUE / TRAP: production rank vs draft cost.
    if (player.value) {
      score += 1.5;
      reasons.push(`sheet value${player.valueGap != null ? ` +${player.valueGap}` : ""}`);
    } else if (player.trap) {
      score -= 1.5;
      reasons.push(`sheet trap ${player.valueGap ?? ""}`.trim());
    }

    // Roster need, from the league's actual slots: filling a starter beats
    // filling a flex beats depth — and depth is priced by position. Extra
    // RB/WR depth is cheap and useful; a backup QB/TE in a one-starter
    // league is a luxury and must not sweep the suggestions.
    const need = input.posNeeds.get(player.pos);
    if (need) {
      if (need.dedicatedOpen > 0) {
        score += 1.5;
        if (input.scarcePositions?.has(player.pos)) {
          score += 2.5;
          reasons.push(`${player.pos} pool drying up`);
        } else {
          reasons.push(`fills ${player.pos}`);
        }
      } else if (need.flexOpen > 0) {
        score += 0.75;
        reasons.push("flex option");
      } else if (player.pos === "QB" || player.pos === "TE") {
        score -= need.count >= 2 ? 8 : 4;
        reasons.push(`backup ${player.pos} only (have ${need.count})`);
      } else {
        const over = Math.max(0, need.count - need.dedicatedTotal);
        score -= Math.min(3, 0.75 * (over + 1));
        if (over >= 2) reasons.push(`already deep at ${player.pos} (${need.count})`);
      }
    }

    // His round plan, as a nudge not a rule (BPA still most important).
    if (input.planPosition && player.pos === input.planPosition) {
      score += 1;
      reasons.push("plan round");
    }

    // If he probably won't even reach my pick, he can't be the advice.
    if (!onClock) {
      score -= 8 * (1 - pReach);
      if (pReach < 0.4) reasons.push(`may be gone before ${fp(myPick)} (${Math.round(pReach * 100)}%)`);
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
  // Never suggest his avoids, and prefer not to spend a slot planning for a
  // player who realistically won't reach my pick — but never go blank: if the
  // reachability filter empties the list, fall back to best score anyway so
  // there is always a recommendation on the clock.
  const suggestions = ranked
    .filter((s) => s.player.tag !== "avoid" && s.pReach >= 0.25)
    .slice(0, SUGGESTIONS);
  if (suggestions.length < SUGGESTIONS) {
    const chosen = new Set(suggestions.map((s) => playerKey(s.player)));
    for (const s of ranked) {
      if (suggestions.length >= SUGGESTIONS) break;
      if (s.player.tag === "avoid" || chosen.has(playerKey(s.player))) continue;
      suggestions.push(s);
    }
  }

  // "Can wait": guide's top players the market will very likely return to me.
  // His avoids don't belong here either — "can wait" implies "worth taking".
  const suggested = new Set(suggestions.map((s) => playerKey(s.player)));
  const canWait = scored
    .filter(
      (s) =>
        !suggested.has(playerKey(s.player)) &&
        s.player.tag !== "avoid" &&
        s.pSurviveNext !== null &&
        s.pSurviveNext >= 0.7 &&
        s.pReach >= 0.5,
    )
    .slice(0, 4);

  return { suggestions, canWait };
}
