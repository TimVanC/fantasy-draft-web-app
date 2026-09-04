import { describe, expect, it } from "vitest";
import {
  availability,
  availabilityLabel,
  buildPlayerInfoMap,
  handcuffFor,
  stacksWith,
  type PlayerInfoMap,
} from "./players";
import { buildMatchIndex, playerKey } from "./normalize";
import type { RankedPlayer } from "../types";

function player(name: string, pos: string): RankedPlayer {
  return {
    name, pos, team: null, pprRank: 1, halfRank: 1, posRank: 1, tag: null,
    adp: null, adjPpg2025: null, adjPpgNote: null, projPpg2026: null,
    ceiling: null, risk: null, notes: [],
  };
}

const gibbs = player("Jahmyr Gibbs", "RB");
const saylors = player("Jacob Saylors", "RB");
const allen = player("Josh Allen", "QB");
const shakir = player("Khalil Shakir", "WR");
const kupp = player("Cooper Kupp", "WR");
const index = buildMatchIndex([gibbs, saylors, allen, shakir, kupp]);

const raw = {
  "1": { first_name: "Jahmyr", last_name: "Gibbs", position: "RB", team: "DET", status: "Active", injury_status: null, depth_chart_order: 1 },
  "2": { first_name: "Jacob", last_name: "Saylors", position: "RB", team: "DET", status: "Active", injury_status: null, depth_chart_order: 2 },
  "3": { first_name: "Josh", last_name: "Allen", position: "QB", team: "BUF", status: "Active", injury_status: "Questionable", depth_chart_order: 1 },
  "4": { first_name: "Khalil", last_name: "Shakir", position: "WR", team: "BUF", status: "Active", injury_status: null, depth_chart_order: 1 },
  "5": { first_name: "Cooper", last_name: "Kupp", position: "WR", team: null, status: "Inactive", injury_status: null, depth_chart_order: null },
  "6": { first_name: "Some", last_name: "Kicker", position: "K", team: "DET", status: "Active", injury_status: null, depth_chart_order: 1 },
};
const info: PlayerInfoMap = buildPlayerInfoMap(index, raw);

describe("buildPlayerInfoMap", () => {
  it("indexes skill players by guide key and skips K/DEF", () => {
    expect(info.get(playerKey(gibbs))?.team).toBe("DET");
    expect(info.get(playerKey(allen))?.injuryStatus).toBe("Questionable");
    expect(info.size).toBe(5);
  });
});

describe("availability", () => {
  it("flags out/IR/PUP/suspended and inactive roster status", () => {
    expect(availability({ team: "X", status: "Active", injuryStatus: "IR", depthChartOrder: null })).toBe("out");
    expect(availability({ team: "X", status: "Active", injuryStatus: "PUP", depthChartOrder: null })).toBe("out");
    expect(availability({ team: "X", status: "Active", injuryStatus: "Sus", depthChartOrder: null })).toBe("out");
    expect(availability({ team: "X", status: "Injured Reserve", injuryStatus: null, depthChartOrder: null })).toBe("out");
    expect(availabilityLabel({ team: "X", status: "Active", injuryStatus: "Sus", depthChartOrder: null })).toBe("SUS");
  });

  it("flags questionable/doubtful softly and free agents", () => {
    expect(availability(info.get(playerKey(allen)))).toBe("questionable");
    expect(availabilityLabel(info.get(playerKey(allen)))).toBe("Q");
    expect(availability(info.get(playerKey(kupp)))).toBe("fa");
    expect(availabilityLabel(info.get(playerKey(kupp)))).toBe("FA");
  });

  it("is quiet for healthy rostered players and unknown players", () => {
    expect(availability(info.get(playerKey(gibbs)))).toBeNull();
    expect(availability(undefined)).toBeNull();
  });
});

describe("handcuffFor / stacksWith", () => {
  it("finds the depth-chart backup to one of my RBs", () => {
    const mine = [{ key: playerKey(gibbs), name: "Jahmyr Gibbs" }];
    expect(handcuffFor(playerKey(saylors), "RB", info, mine)).toBe("Jahmyr Gibbs");
    // The reverse: I own the #2, the #1 is the "handcuff" the other way.
    expect(handcuffFor(playerKey(gibbs), "RB", info, [{ key: playerKey(saylors), name: "Jacob Saylors" }])).toBe("Jacob Saylors");
    expect(handcuffFor(playerKey(shakir), "WR", info, mine)).toBeNull();
    expect(handcuffFor(playerKey(saylors), "RB", info, [])).toBeNull();
  });

  it("finds pass-catchers on my QB's team", () => {
    const qbs = [{ key: playerKey(allen), name: "Josh Allen" }];
    expect(stacksWith(playerKey(shakir), "WR", info, qbs)).toBe("Josh Allen");
    expect(stacksWith(playerKey(gibbs), "RB", info, qbs)).toBeNull();
    expect(stacksWith(playerKey(kupp), "WR", info, qbs)).toBeNull();
  });
});
