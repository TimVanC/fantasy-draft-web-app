/**
 * Pick Advisor: who to take with my pick, and who can wait.
 *
 * Division of labor (his rule #1 — "use rankings to find value" against ADP):
 *  - VALUE comes only from the guide: board rank, tags, roster need, his
 *    round plan (plus the cheat sheet's value/trap and my own watchlist).
 *    Market opinion never reorders value.
 *  - AVAILABILITY comes from market ADP, adjusted for what the specific
 *    teams picking before me still need: the market, not the guide, decides
 *    who gets drafted by everyone else.
 *  - Live Sleeper status (IR/PUP/suspended/free agent) can veto — a frozen
 *    PDF can't know who got hurt last week.
 */
import type { RankedPlayer, ScoringFormat } from "../types";
import { boardRank } from "./rankings";
import { playerKey } from "./normalize";
import { sheetAdpOverall } from "./cheatsheet";
import { formatPick } from "./snake";
import { adjustSurvival, type DemandFn } from "./opponents";
import { availability, availabilityLabel, handcuffFor, stacksWith, type PlayerInfoMap } from "./players";
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
  /** Live Sleeper availability badge ("Q", "IR", "FA"…), if any. */
  availLabel: string | null;
  handcuff: string | null;
  stack: string | null;
  starred: boolean;
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
  /** His plan calls for a handcuff this round. */
  planHandcuff?: boolean;
  /** Opponent-need demand for survival adjustment. */
  demand?: DemandFn;
  /** Live Sleeper player map for injury/handcuff/stack. */
  playerInfo?: PlayerInfoMap;
  starred?: Set<string>;
  myRbs?: { key: string; name: string }[];
  myQbs?: { key: string; name: string }[];
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
  const info = input.playerInfo ?? new Map();

  const pool = input.available.slice(0, POOL_SIZE);
  const scored: Suggestion[] = pool.map((player, availIndex) => {
    const key = playerKey(player);
    const rank = boardRank(player, input.format);
    const entry = adpMap.get(key) ?? null;
    // Survival proxy chain: FFC market ADP, else the cheat sheet's own ADP,
    // else — missing from a populated feed means the market is sleeping on
    // him, so he survives (that gap IS the value signal). Only when every
    // feed is unavailable does guide rank stand in.
    const effAdp =
      entry?.adp ??
      (player.sheet ? sheetAdpOverall(player.sheet) : null) ??
      (adpMap.size > 0 ? Math.max(rank ?? 999, 140) : (rank ?? 999));
    const survive = (to: number) => {
      const raw = conditionalSurvival(effAdp, currentPickNo, to);
      return input.demand ? adjustSurvival(raw, input.demand(player.pos, currentPickNo, to)) : raw;
    };
    const pReach = onClock ? 1 : survive(myPick);
    const pSurviveNext = myNextPick === null ? null : survive(myNextPick);

    const reasons: string[] = [];
    let score = -availIndex; // base: the guide's own ordering

    // Survival odds REORDER only on the clock (the take-now-vs-wait
    // decision). While planning ahead they only ANNOTATE: the list stays in
    // best-available order — seeing "Gibbs, likely gone (27%)" at the top is
    // honest; hiding or demoting him is not.
    if (onClock) {
      if (pSurviveNext !== null) {
        // Urgency: a player who will NOT make it back gains priority now.
        score += 6 * (1 - pSurviveNext);
        if (pSurviveNext < 0.35) reasons.push(`only ${Math.round(pSurviveNext * 100)}% to last to ${fp(myNextPick!)}`);
        else if (pSurviveNext > 0.7) reasons.push(`${Math.round(pSurviveNext * 100)}% to still be there at ${fp(myNextPick!)}`);
      }
    } else if (pReach < 0.4) {
      reasons.push(`likely gone before ${fp(myPick)} (${Math.round(pReach * 100)}%)`);
    } else if (pReach < 0.85) {
      reasons.push(`${Math.round(pReach * 100)}% to reach ${fp(myPick)}`);
    } else if (pSurviveNext !== null && pSurviveNext > 0.7) {
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

    // My watchlist.
    const starred = input.starred?.has(key) ?? false;
    if (starred) {
      score += 2;
      reasons.push("your guy ★");
    }

    // Live Sleeper status: a frozen PDF can't know who got hurt last week.
    const pinfo = info.get(key);
    const avail = availability(pinfo);
    const availLabel = availabilityLabel(pinfo);
    if (avail === "questionable") {
      score -= 0.5;
      reasons.push(`${availLabel} per Sleeper`);
    } else if (avail === "out" || avail === "fa") {
      score -= 20;
      reasons.push(avail === "fa" ? "no NFL team (Sleeper)" : `${availLabel} per Sleeper`);
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

    // Handcuffs to my RBs and stacks with my QB (live depth chart / teams).
    const handcuff = handcuffFor(key, player.pos, info, input.myRbs ?? []);
    if (handcuff) {
      score += input.planHandcuff ? 3.5 : 1.5;
      reasons.push(`handcuffs ${handcuff}`);
    }
    const stack = stacksWith(key, player.pos, info, input.myQbs ?? []);
    if (stack) {
      score += 0.5;
      reasons.push(`stacks w/ ${stack}`);
    }

    // His round plan, as a nudge not a rule (BPA still most important).
    if (input.planPosition && player.pos === input.planPosition) {
      score += 1;
      reasons.push("plan round");
    }

    return {
      player,
      score,
      pReach,
      pSurviveNext,
      adp: entry?.adp ?? null,
      adpFormatted: entry?.formatted ?? null,
      reasons,
      availLabel,
      handcuff,
      stack,
      starred,
    };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const unavailable = (s: Suggestion) => {
    const a = availability(info.get(playerKey(s.player)));
    return a === "out" || a === "fa";
  };
  // Never suggest his avoids or players Sleeper says can't play; everyone
  // else is fair to show — an unreachable stud appears in his true spot with
  // a "likely gone" caveat instead of being demoted or hidden.
  const suggestions = ranked
    .filter((s) => s.player.tag !== "avoid" && !unavailable(s))
    .slice(0, SUGGESTIONS);

  // "Can wait": guide's top players the market will very likely return to me.
  // His avoids don't belong here either — "can wait" implies "worth taking".
  const suggested = new Set(suggestions.map((s) => playerKey(s.player)));
  const canWait = scored
    .filter(
      (s) =>
        !suggested.has(playerKey(s.player)) &&
        s.player.tag !== "avoid" &&
        !unavailable(s) &&
        s.pSurviveNext !== null &&
        s.pSurviveNext >= 0.7 &&
        s.pReach >= 0.5,
    )
    .slice(0, 4);

  return { suggestions, canWait };
}
