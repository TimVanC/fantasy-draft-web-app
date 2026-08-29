import { describe, expect, it } from "vitest";
import { advise, conditionalSurvival, survivalProb, type AdviceInput } from "./advisor";
import { buildAdpMap, nearestFfcTeams } from "./adp";
import { buildMatchIndex, playerKey } from "./normalize";
import type { RankedPlayer } from "../types";

function player(name: string, pos: string, pprRank: number, tag: RankedPlayer["tag"] = null): RankedPlayer {
  return {
    name, pos, team: null, pprRank, halfRank: pprRank, posRank: null, tag,
    adp: null, adjPpg2025: null, adjPpgNote: null, projPpg2026: null,
    ceiling: null, risk: null, notes: [],
  };
}

describe("survivalProb", () => {
  it("is low when ADP is well before the pick, high when well after", () => {
    expect(survivalProb(20, 40)).toBeLessThan(0.05);
    expect(survivalProb(60, 40)).toBeGreaterThan(0.9);
    expect(survivalProb(40, 40)).toBeCloseTo(0.5, 1);
  });

  it("spreads out later in the draft", () => {
    // Same 10-pick gap is more certain early than late.
    expect(survivalProb(10, 20)).toBeLessThan(survivalProb(100, 110));
  });
});

describe("conditionalSurvival", () => {
  it("conditions on the player still being available now", () => {
    // ADP 28 but the draft is at pick 131 and he's still on the board:
    // the market has moved on, so odds to reach #144 are moderate, not ~1%.
    const p = conditionalSurvival(28, 131, 144);
    expect(p).toBeGreaterThan(0.3);
    expect(p).toBeLessThan(0.8);
    // Raw survivalProb would call it hopeless.
    expect(survivalProb(28, 144)).toBeLessThan(0.02);
  });

  it("matches intuition before the ADP is reached", () => {
    expect(conditionalSurvival(40, 20, 30)).toBeGreaterThan(0.7); // ADP after my pick
    expect(conditionalSurvival(22, 20, 40)).toBeLessThan(0.35); // ADP right now, long wait
  });

  it("is certain for picks that already happened", () => {
    expect(conditionalSurvival(50, 30, 30)).toBe(0.99);
  });
});

describe("nearestFfcTeams", () => {
  it("snaps league sizes to FFC-supported boards", () => {
    expect(nearestFfcTeams(10)).toBe(10);
    expect(nearestFfcTeams(11)).toBe(10);
    expect(nearestFfcTeams(9)).toBe(8);
    expect(nearestFfcTeams(16)).toBe(14);
  });
});

describe("buildAdpMap", () => {
  const players = [player("Jahmyr Gibbs", "RB", 1), player("Tee Higgins", "WR", 40)];
  const index = buildMatchIndex(players);

  it("matches FFC rows with the same strict matcher as picks", () => {
    const map = buildAdpMap(index, [
      { name: "Jahmyr Gibbs", position: "RB", team: "DET", adp: 1.5, adp_formatted: "1.01" },
      { name: "Jayden Higgins", position: "WR", adp: 90 }, // must NOT hit Tee
      { name: "Justin Tucker", position: "PK", adp: 160 }, // ignored position
    ]);
    expect(map.get(playerKey(players[0]))?.formatted).toBe("1.01");
    expect(map.has(playerKey(players[1]))).toBe(false);
    expect(map.size).toBe(1);
  });
});

describe("advise", () => {
  const a = player("Alpha RB", "RB", 1);
  const b = player("Bravo WR", "WR", 2);
  const c = player("Charlie RB", "RB", 3, "target");
  const d = player("Delta TE", "TE", 4, "avoid");
  const available = [a, b, c, d];
  const index = buildMatchIndex(available);

  /** A fresh 1QB/2RB/2WR/1TE/1flex roster with nothing drafted yet. */
  function freshNeeds(counts: Record<string, number> = {}) {
    const dedicated: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1 };
    return new Map(
      Object.entries(dedicated).map(([pos, total]) => {
        const count = counts[pos] ?? 0;
        const dedicatedOpen = Math.max(0, total - count);
        // One W/R/T flex, consumed once RB+WR+TE overflow starts.
        const flexUsed = Math.max(0, (counts.RB ?? 0) - 2) + Math.max(0, (counts.WR ?? 0) - 2) + Math.max(0, (counts.TE ?? 0) - 1);
        const flexOpen = pos === "QB" ? 0 : Math.max(0, 1 - flexUsed);
        return [pos, { dedicatedOpen, flexOpen, dedicatedTotal: total, count }];
      }),
    );
  }

  function baseInput(overrides: Partial<AdviceInput> = {}): AdviceInput {
    return {
      available,
      adpMap: new Map(),
      format: "ppr",
      currentPickNo: 20,
      myPick: 20,
      myNextPick: 21,
      onClock: true,
      posNeeds: freshNeeds(),
      planPosition: null,
      ...overrides,
    };
  }

  it("never suggests a player he's avoiding", () => {
    const { suggestions } = advise(baseInput());
    expect(suggestions.map((s) => s.player.name)).not.toContain("Delta TE");
    expect(suggestions).toHaveLength(3);
  });

  it("prioritizes a player who won't survive over a safe one", () => {
    // Bravo's market ADP is way before my next pick; Alpha's and Charlie's
    // are way after.
    const adpMap = buildAdpMap(index, [
      { name: "Alpha RB", position: "RB", adp: 80 },
      { name: "Bravo WR", position: "WR", adp: 5 },
      { name: "Charlie RB", position: "RB", adp: 85 },
    ]);
    const { suggestions } = advise(baseInput({ adpMap, myPick: 20, myNextPick: 40 }));
    expect(suggestions[0].player.name).toBe("Bravo WR");
    const alpha = suggestions.find((s) => s.player.name === "Alpha RB");
    expect(alpha?.pSurviveNext).toBeGreaterThan(0.7);
  });

  it("treats a player the market ignores as safe to wait on", () => {
    // Feed has data but no row for Alpha: the market is sleeping on him, so
    // he should look survivable, not urgent.
    const adpMap = buildAdpMap(index, [{ name: "Bravo WR", position: "WR", adp: 5 }]);
    const { suggestions } = advise(baseInput({ adpMap, myPick: 20, myNextPick: 40 }));
    expect(suggestions[0].player.name).toBe("Bravo WR");
    const alpha = suggestions.find((s) => s.player.name === "Alpha RB");
    expect(alpha?.pSurviveNext).toBeGreaterThan(0.9);
  });

  it("lists safe top players under canWait", () => {
    const wide = [
      ...available,
      player("Echo WR", "WR", 5),
      player("Foxtrot RB", "RB", 6),
      player("Golf WR", "WR", 7),
    ];
    const wideIndex = buildMatchIndex(wide);
    const adpMap = buildAdpMap(wideIndex, [
      { name: "Alpha RB", position: "RB", adp: 90 },
      { name: "Bravo WR", position: "WR", adp: 5 },
      { name: "Charlie RB", position: "RB", adp: 6 },
      { name: "Echo WR", position: "WR", adp: 7 },
      { name: "Foxtrot RB", position: "RB", adp: 8 },
      { name: "Golf WR", position: "WR", adp: 9 },
    ]);
    const { suggestions, canWait } = advise(
      baseInput({ available: wide, adpMap, myPick: 20, myNextPick: 40 }),
    );
    // Alpha survives easily -> a wait candidate, not one of the 3 picks now.
    expect(suggestions.map((s) => s.player.name)).not.toContain("Alpha RB");
    expect(canWait.map((s) => s.player.name)).toContain("Alpha RB");
  });

  it("penalizes players unlikely to reach my pick when not on the clock", () => {
    const adpMap = buildAdpMap(index, [
      { name: "Alpha RB", position: "RB", adp: 5 },
      { name: "Bravo WR", position: "WR", adp: 60 },
      { name: "Charlie RB", position: "RB", adp: 60 },
    ]);
    const { suggestions } = advise(
      baseInput({ adpMap, onClock: false, currentPickNo: 25, myPick: 30, myNextPick: 50 }),
    );
    expect(suggestions[0].player.name).not.toBe("Alpha RB");
  });

  it("does not spend suggestions on players who won't reach my pick", () => {
    // Alpha and Bravo go top-5 by market; my pick is #30 — both are dreams.
    // Charlie reaches me. The advice must not lead with dreams.
    const adpMap = buildAdpMap(index, [
      { name: "Alpha RB", position: "RB", adp: 4 },
      { name: "Bravo WR", position: "WR", adp: 5 },
      { name: "Charlie RB", position: "RB", adp: 33 },
    ]);
    const { suggestions } = advise(
      baseInput({ adpMap, onClock: false, currentPickNo: 25, myPick: 30, myNextPick: 50 }),
    );
    expect(suggestions[0].player.name).toBe("Charlie RB");
  });

  it("never goes blank: falls back past the reachability filter", () => {
    // Everyone's market ADP is long gone before my pick — the filter would
    // empty the list, but the advisor must still recommend the best of them.
    const adpMap = buildAdpMap(index, [
      { name: "Alpha RB", position: "RB", adp: 2 },
      { name: "Bravo WR", position: "WR", adp: 3 },
      { name: "Charlie RB", position: "RB", adp: 4 },
    ]);
    const { suggestions } = advise(
      baseInput({ adpMap, onClock: false, currentPickNo: 21, myPick: 40, myNextPick: 60 }),
    );
    expect(suggestions.length).toBe(3);
    expect(suggestions.map((s) => s.player.name)).not.toContain("Delta TE"); // still no avoids
  });

  it("does not let backup QBs sweep the suggestions once QB is filled", () => {
    // Joel's remaining board is QB-heavy at the top, but I already have my
    // starter: the advice must surface the skill players instead.
    const qbHeavy = [
      player("Q One", "QB", 1), player("Q Two", "QB", 2), player("Q Three", "QB", 3),
      player("Wide Out", "WR", 4), player("Runner Back", "RB", 5),
    ];
    const { suggestions } = advise(
      baseInput({ available: qbHeavy, posNeeds: freshNeeds({ QB: 1 }) }),
    );
    expect(suggestions[0].player.pos).not.toBe("QB");
    expect(suggestions.filter((s) => s.player.pos === "QB").length).toBeLessThanOrEqual(1);
    const qb = suggestions.find((s) => s.player.pos === "QB");
    if (qb) expect(qb.reasons.join(" ")).toContain("backup QB");
  });

  it("keeps RB/WR depth cheap but not free", () => {
    const pool = [player("Wide One", "WR", 1), player("Runner One", "RB", 2)];
    // 3 WRs deep: the clearly better WR still leads — depth is only a nudge.
    const three = advise(
      baseInput({ available: pool, posNeeds: freshNeeds({ WR: 3, RB: 2, QB: 1, TE: 1 }) }),
    );
    expect(three.suggestions[0].player.name).toBe("Wide One");
    // 4 WRs deep: the growing penalty finally tips it to the RB.
    const four = advise(
      baseInput({ available: pool, posNeeds: freshNeeds({ WR: 4, RB: 2, QB: 1, TE: 1 }) }),
    );
    expect(four.suggestions[0].player.name).toBe("Runner One");
  });

  it("returns nothing when I have no picks left", () => {
    const { suggestions, canWait } = advise(baseInput({ myPick: null }));
    expect(suggestions).toHaveLength(0);
    expect(canWait).toHaveLength(0);
  });
});
