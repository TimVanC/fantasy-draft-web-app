/**
 * Post-draft report card: how the roster stacks up against Joel's board and
 * plan. Pure summary — no new opinions.
 */
import type { RankedPlayer, ScoringFormat, SleeperPick } from "../types";
import { boardRank } from "./rankings";

export interface ReportPick {
  pick: SleeperPick;
  player: RankedPlayer | null;
  /** Positive = he was ranked better than where I took him (value). */
  boardDelta: number | null;
}

export interface Report {
  picks: ReportPick[];
  targets: number;
  values: number;
  avoids: number;
  traps: number;
  splits: number;
  avgDelta: number | null;
  posCounts: Record<string, number>;
  onScriptRounds: number;
  scriptedRounds: number;
}

export function buildReport(
  myPicks: SleeperPick[],
  resolve: (p: SleeperPick) => RankedPlayer | null,
  format: ScoringFormat,
  roundPlan: { round: number; plan: string }[],
): Report {
  const picks: ReportPick[] = myPicks.map((pick) => {
    const player = resolve(pick);
    const rank = player ? boardRank(player, format) : null;
    return { pick, player, boardDelta: rank === null ? null : pick.pick_no - rank };
  });
  const players = picks.map((p) => p.player).filter((p): p is RankedPlayer => p !== null);
  const deltas = picks.map((p) => p.boardDelta).filter((d): d is number => d !== null);
  const posCounts: Record<string, number> = {};
  for (const p of myPicks) posCounts[p.metadata.position] = (posCounts[p.metadata.position] ?? 0) + 1;

  let onScript = 0;
  let scripted = 0;
  for (const { round, plan } of roundPlan) {
    const pos = plan.match(/\b(QB|RB|WR|TE)\b/)?.[1];
    const mine = myPicks.find((p) => p.round === round);
    if (!pos || !mine) continue;
    scripted++;
    if (mine.metadata.position === pos) onScript++;
  }

  return {
    picks,
    targets: players.filter((p) => p.tag === "target").length,
    values: players.filter((p) => p.value).length,
    avoids: players.filter((p) => p.tag === "avoid").length,
    traps: players.filter((p) => p.trap).length,
    splits: players.filter((p) => (p.tag === "target" && p.trap) || (p.tag === "avoid" && p.value)).length,
    avgDelta: deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null,
    posCounts,
    onScriptRounds: onScript,
    scriptedRounds: scripted,
  };
}
