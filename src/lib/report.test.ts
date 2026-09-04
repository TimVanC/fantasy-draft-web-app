import { describe, expect, it } from "vitest";
import { buildReport } from "./report";
import type { RankedPlayer, SleeperPick } from "../types";

function player(name: string, pos: string, pprRank: number, extra: Partial<RankedPlayer> = {}): RankedPlayer {
  return {
    name, pos, team: null, pprRank, halfRank: pprRank, posRank: 1, tag: null,
    adp: null, adjPpg2025: null, adjPpgNote: null, projPpg2026: null,
    ceiling: null, risk: null, notes: [], ...extra,
  };
}

function pick(no: number, round: number, position: string, name: string): SleeperPick {
  return {
    pick_no: no, round, draft_slot: 1, player_id: String(no),
    metadata: { first_name: name.split(" ")[0], last_name: name.split(" ")[1], position },
  };
}

describe("buildReport", () => {
  const players: Record<string, RankedPlayer> = {
    "A One": player("A One", "RB", 1, { tag: "target" }),
    "B Two": player("B Two", "WR", 30, { value: true }),
    "C Three": player("C Three", "QB", 60, { tag: "avoid", value: true }),
  };
  const myPicks = [pick(4, 1, "RB", "A One"), pick(17, 2, "WR", "B Two"), pick(24, 3, "QB", "C Three"), pick(37, 4, "K", "Some Kicker")];
  const plan = [{ round: 1, plan: "RB" }, { round: 2, plan: "RB" }, { round: 3, plan: "WR" }, { round: 4, plan: "BPA" }];
  const report = buildReport(myPicks, (p) => players[`${p.metadata.first_name} ${p.metadata.last_name}`] ?? null, "ppr", plan);

  it("counts tags and computes board deltas", () => {
    expect(report.targets).toBe(1);
    expect(report.values).toBe(2);
    expect(report.avoids).toBe(1);
    expect(report.splits).toBe(1); // C Three: avoid + value
    // deltas: 4-1=3, 17-30=-13, 24-60=-36 -> avg -15.33
    expect(report.avgDelta).toBeCloseTo(-15.33, 1);
    expect(report.picks[3].boardDelta).toBeNull(); // kicker not on the board
  });

  it("scores rounds against the plan", () => {
    // R1 RB->RB on script; R2 RB->WR off; R3 WR->QB off; R4 BPA not scripted.
    expect(report.scriptedRounds).toBe(3);
    expect(report.onScriptRounds).toBe(1);
    expect(report.posCounts).toEqual({ RB: 1, WR: 1, QB: 1, K: 1 });
  });
});
