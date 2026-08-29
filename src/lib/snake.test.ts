import { describe, expect, it } from "vitest";
import {
  formatPick,
  myFollowingPick,
  nextPickForSlot,
  pickNumbersForSlot,
  picksUntilMyTurn,
  slotForPick,
} from "./snake";

describe("snake pick math", () => {
  it("slot 1 in a 10-team, 15-round draft gets the turn picks", () => {
    // The league in CLAUDE.md: 1.01 owner picks 1, 20, 21, 40, 41, ...
    expect(pickNumbersForSlot(1, 10, 15)).toEqual([
      1, 20, 21, 40, 41, 60, 61, 80, 81, 100, 101, 120, 121, 140, 141,
    ]);
  });

  it("slot N (10 of 10) mirrors slot 1", () => {
    expect(pickNumbersForSlot(10, 10, 4)).toEqual([10, 11, 30, 31]);
  });

  it("middle slot alternates correctly in odd and even rounds", () => {
    // 12 teams, slot 5: round 1 pick 5; round 2 reversed -> 12*2-5+1 = 20
    expect(pickNumbersForSlot(5, 12, 4)).toEqual([5, 20, 29, 44]);
  });

  it("slotForPick is the inverse of pickInRound", () => {
    for (const teams of [8, 10, 12, 14]) {
      for (let pick = 1; pick <= teams * 4; pick++) {
        const { round, slot } = slotForPick(pick, teams);
        expect(pickNumbersForSlot(slot, teams, 6)[round - 1]).toBe(pick);
      }
    }
  });

  it("supports third-round reversal", () => {
    // 3RR, 10 teams: round 2 runs 20..11, round 3 repeats that direction
    // (slot 10 picks 21), round 4 forward again.
    expect(pickNumbersForSlot(1, 10, 5, 3)).toEqual([1, 20, 30, 31, 50]);
    expect(pickNumbersForSlot(10, 10, 5, 3)).toEqual([10, 11, 21, 40, 41]);
    const { round, slot } = slotForPick(21, 10, 3);
    expect(round).toBe(3);
    expect(slot).toBe(10);
  });

  it("nextPickForSlot and picksUntilMyTurn track the clock", () => {
    // 10 teams, I'm slot 1. Next pick to be made is #5 -> my next is #20.
    expect(nextPickForSlot(1, 5, 10, 15)).toBe(20);
    expect(picksUntilMyTurn(1, 5, 10, 15)).toBe(15);
    // On the clock: next pick IS mine.
    expect(picksUntilMyTurn(1, 20, 10, 15)).toBe(0);
    // Back-to-back turn: after making #20, #21 is also mine.
    expect(picksUntilMyTurn(1, 21, 10, 15)).toBe(0);
    // No picks left.
    expect(nextPickForSlot(1, 142, 10, 15)).toBeNull();
    expect(picksUntilMyTurn(1, 142, 10, 15)).toBeNull();
  });

  it("formats overall picks as round.pick draft-speak", () => {
    expect(formatPick(1, 10)).toBe("1.01");
    expect(formatPick(10, 10)).toBe("1.10");
    expect(formatPick(11, 10)).toBe("2.01");
    expect(formatPick(120, 10)).toBe("12.10");
    expect(formatPick(25, 12)).toBe("3.01");
  });

  it("myFollowingPick gives the pick after my next", () => {
    expect(myFollowingPick(1, 5, 10, 15)).toBe(21);
    expect(myFollowingPick(1, 22, 10, 15)).toBe(41);
    expect(myFollowingPick(1, 141, 10, 15)).toBeNull();
  });
});
