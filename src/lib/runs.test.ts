import { describe, expect, it } from "vitest";
import { detectRun } from "./runs";
import type { SleeperPick } from "../types";

let no = 0;
function pick(position: string): SleeperPick {
  no += 1;
  return {
    pick_no: no, round: 1, draft_slot: 1, player_id: String(no),
    metadata: { first_name: `P${no}`, last_name: position, position },
  };
}

describe("detectRun", () => {
  it("flags 4+ of the last 6 picks at one position", () => {
    const picks = ["WR", "RB", "RB", "WR", "RB", "RB"].map(pick);
    expect(detectRun(picks)).toEqual({ pos: "RB", count: 4, window: 6 });
  });

  it("stays quiet for balanced drafting or too few picks", () => {
    expect(detectRun(["WR", "RB", "QB", "TE", "WR", "RB"].map(pick))).toBeNull();
    expect(detectRun(["RB", "RB", "RB"].map(pick))).toBeNull();
  });

  it("ignores K/DEF in the window", () => {
    const picks = ["K", "DEF", "WR", "WR", "WR", "WR"].map(pick);
    expect(detectRun(picks)?.pos).toBe("WR");
  });
});
