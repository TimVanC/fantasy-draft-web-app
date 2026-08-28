import { describe, expect, it } from "vitest";
import { bestProdRank, isValue, sheetAdpOverall, valueGap } from "./cheatsheet";
import { ALL_PLAYERS, DEEP_POOL, RANKINGS } from "./rankings";
import { playerKey } from "./normalize";
import type { SheetEntry } from "../types";

function entry(over: Partial<SheetEntry> = {}): SheetEntry {
  return {
    name: "Test Player",
    team: "DAL",
    age: 25,
    pos: "WR",
    posAdpRank: 40,
    rank: 100,
    adp: "8.04",
    adpHistory: { y25: null, y24: null, y23: null },
    ptw: { y25: 11.2, y24: 9.1, y23: null },
    ptwRank: { y25: 28, y24: 35, y23: null },
    gms: { y25: 15, y24: 16, y23: null },
    ...over,
  };
}

describe("cheat-sheet value logic", () => {
  it("takes the best production rank across recent healthy seasons", () => {
    expect(bestProdRank(entry())).toBe(28);
    expect(bestProdRank(entry({ ptwRank: { y25: 50, y24: 20, y23: null } }))).toBe(20);
  });

  it("ignores seasons with too few games", () => {
    // 2025 was a 3-game injury year: its shiny rank must not count.
    const e = entry({ ptwRank: { y25: 5, y24: 30, y23: null }, gms: { y25: 3, y24: 16, y23: null } });
    expect(bestProdRank(e)).toBe(30);
  });

  it("tags value only when production beats cost by the margin", () => {
    expect(valueGap(entry())).toBe(12); // WR40 cost, WR28 production
    expect(isValue(entry())).toBe(true);
    expect(isValue(entry({ posAdpRank: 30 }))).toBe(false); // gap 2
    expect(isValue(entry({ ptwRank: { y25: null, y24: null, y23: null } }))).toBe(false);
  });

  it("requires production to have been startable, not just cheap", () => {
    // WR120 cost with WR80 production is a big gap but not usable value.
    const fringe = entry({ posAdpRank: 120, ptwRank: { y25: 80, y24: null, y23: null } });
    expect(isValue(fringe)).toBe(false);
    // Positional cap: a TE must have been top-20, tighter than WR/RB.
    const te = entry({ pos: "TE", posAdpRank: 30, ptwRank: { y25: 22, y24: null, y23: null } });
    expect(isValue(te)).toBe(false);
    expect(isValue(entry({ pos: "TE", posAdpRank: 30, ptwRank: { y25: 15, y24: null, y23: null } }))).toBe(true);
  });

  it("parses sheet ADP round.pick into an overall pick", () => {
    expect(sheetAdpOverall(entry({ adp: "1.01" }))).toBe(1);
    expect(sheetAdpOverall(entry({ adp: "8.04" }))).toBe(88);
    expect(sheetAdpOverall(entry({ adp: null }))).toBeNull();
  });
});

describe("cheat-sheet merge onto the guide universe", () => {
  it("extends the universe with sheet-only players", () => {
    expect(DEEP_POOL.length).toBeGreaterThan(50);
    expect(ALL_PLAYERS.length).toBe(RANKINGS.length + DEEP_POOL.length);
  });

  it("creates no duplicate player keys", () => {
    const keys = ALL_PLAYERS.map((p) => playerKey(p));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("annotates known guide players with sheet stats", () => {
    const gibbs = RANKINGS.find((p) => p.name === "Jahmyr Gibbs");
    expect(gibbs?.sheet?.posAdpRank).toBe(1);
    expect(gibbs?.sheet?.gms.y25).toBe(17);
  });

  it("keeps Joel's tags untouched while adding value tags", () => {
    // Every tag still comes from the guide data; value is a separate flag.
    const tagged = RANKINGS.filter((p) => p.tag !== null);
    expect(tagged.length).toBeGreaterThan(50);
    const values = ALL_PLAYERS.filter((p) => p.value);
    expect(values.length).toBeGreaterThan(5);
    // A value tag never overwrites or requires a guide tag.
    expect(values.some((p) => p.tag === null)).toBe(true);
  });

  it("deep pool players are ordered by sheet rank", () => {
    const ranks = DEEP_POOL.map((p) => p.sheet?.rank ?? 0);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});
