import { describe, expect, it } from "vitest";
import { scarcityLabels } from "./scarcity";
import type { RankedPlayer } from "../types";

function player(name: string, pprRank: number | null): RankedPlayer {
  return {
    name,
    pos: "RB",
    team: null,
    pprRank,
    halfRank: pprRank,
    posRank: null,
    tag: null,
    adp: null,
    adjPpg2025: null,
    adjPpgNote: null,
    projPpg2026: null,
    ceiling: null,
    risk: null,
    notes: [],
  };
}

describe("scarcityLabels", () => {
  const avail = [player("A", 1), player("B", 2), player("C", 3), player("D", 4)];

  it("flags the top of the available board as likely gone", () => {
    const labels = scarcityLabels(avail, 2, "ppr");
    expect(labels.get(avail[0])).toBe("likely-gone");
    expect(labels.get(avail[1])).toBe("likely-gone");
    expect(labels.get(avail[2])).toBe("can-wait");
    expect(labels.get(avail[3])).toBe("can-wait");
  });

  it("everything can wait when I am on the clock", () => {
    const labels = scarcityLabels(avail, 0, "ppr");
    expect([...labels.values()].every((v) => v === "can-wait")).toBe(true);
  });

  it("gives no estimate without a next pick or without a rank", () => {
    const noNext = scarcityLabels(avail, null, "ppr");
    expect([...noNext.values()].every((v) => v === null)).toBe(true);
    const unranked = [player("X", null), ...avail];
    const labels = scarcityLabels(unranked, 1, "ppr");
    expect(labels.get(unranked[0])).toBeNull();
    // The unranked player does not consume a slot in the window.
    expect(labels.get(avail[0])).toBe("likely-gone");
    expect(labels.get(avail[1])).toBe("can-wait");
  });
});
