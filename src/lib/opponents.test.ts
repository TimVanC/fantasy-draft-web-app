import { describe, expect, it } from "vitest";
import { adjustSurvival, buildDemandFn, teamDemandFactor } from "./opponents";
import type { SleeperPick } from "../types";

const SETTINGS = {
  teams: 10, rounds: 15, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1,
  slots_flex: 1, slots_def: 1, slots_k: 1, slots_bn: 6,
};

let no = 0;
function pick(position: string, slot: number): SleeperPick {
  no += 1;
  return {
    pick_no: no, round: Math.ceil(no / 10), draft_slot: slot, player_id: String(no),
    metadata: { first_name: `P${no}`, last_name: position, position },
  };
}

describe("teamDemandFactor", () => {
  it("is hungry with open starters, saturated when stacked", () => {
    expect(teamDemandFactor(SETTINGS, [], "RB")).toBe(1.25);
    const twoRb = [pick("RB", 1), pick("RB", 1)];
    expect(teamDemandFactor(SETTINGS, twoRb, "RB")).toBe(1.0); // flex still open
    const stacked = [...twoRb, pick("RB", 1), pick("RB", 1)];
    expect(teamDemandFactor(SETTINGS, stacked, "RB")).toBeLessThan(1);
  });

  it("treats a second QB/TE as a rare luxury", () => {
    expect(teamDemandFactor(SETTINGS, [pick("QB", 1)], "QB")).toBe(0.4);
    expect(teamDemandFactor(SETTINGS, [pick("QB", 1), pick("QB", 1)], "QB")).toBe(0.15);
  });
});

describe("buildDemandFn", () => {
  it("averages demand over the specific teams picking before me", () => {
    no = 0;
    // 10 teams. Slots 2..10 each already have a QB; slot 1 (me) does not.
    const picks: SleeperPick[] = [];
    for (let s = 2; s <= 10; s++) picks.push(pick("QB", s));
    const demand = buildDemandFn(SETTINGS, picks, 1);
    // Between pick 11 (2.01, slot 10) and my pick 20 (2.10, slot 1): nine
    // opponents, all with a QB -> QB demand well under 1; RB demand full.
    expect(demand("QB", 11, 20)).toBeCloseTo(0.4, 5);
    expect(demand("RB", 11, 20)).toBe(1.25);
    // A zero-length window is neutral.
    expect(demand("RB", 20, 20)).toBe(1);
  });
});

describe("adjustSurvival", () => {
  it("raises survival when opponents don't need the position, lowers when they do", () => {
    expect(adjustSurvival(0.5, 0.4)).toBeGreaterThan(0.5);
    expect(adjustSurvival(0.5, 1.25)).toBeLessThan(0.5);
    expect(adjustSurvival(0.5, 1)).toBeCloseTo(0.5, 5);
  });
});
