import { describe, expect, it } from "vitest";
import {
  planDriftAlerts,
  positionOutlooks,
  scarceNeededPositions,
  supplyAlerts,
} from "./rosterAlerts";
import { buildAdpMap, type AdpMap } from "./adp";
import { buildMatchIndex } from "./normalize";
import { fillSlots } from "./roster";
import type { RankedPlayer, SleeperPick } from "../types";

const SETTINGS = {
  teams: 10, rounds: 15, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_te: 1,
  slots_flex: 1, slots_def: 1, slots_k: 1, slots_bn: 6,
};

function player(name: string, pos: string, posRank: number): RankedPlayer {
  return {
    name, pos, team: null, pprRank: posRank, halfRank: posRank, posRank, tag: null,
    adp: null, adjPpg2025: null, adjPpgNote: null, projPpg2026: null,
    ceiling: null, risk: null, notes: [],
  };
}

let no = 0;
function pick(position: string, round: number): SleeperPick {
  no += 1;
  return {
    pick_no: no, round, draft_slot: 1, player_id: String(no),
    metadata: { first_name: `P${no}`, last_name: position, position },
  };
}

describe("the 4-WR-1-RB-through-five-rounds scenario", () => {
  // My roster after 5 rounds: 1 RB, 4 WR. One RB starter still open.
  const myPicks = [pick("RB", 1), pick("WR", 2), pick("WR", 3), pick("WR", 4), pick("WR", 5)];
  const slots = fillSlots(SETTINGS, myPicks);
  // Only 3 of his ranked RBs left, all with ADP right around the corner.
  const available = [
    player("Last RbOne", "RB", 40), player("Last RbTwo", "RB", 41), player("Last RbThree", "RB", 42),
    player("Wr A", "WR", 30), player("Wr B", "WR", 31), player("Wr C", "WR", 32),
    player("Wr D", "WR", 33), player("Wr E", "WR", 34), player("Wr F", "WR", 35),
    player("Qb A", "QB", 10), player("Qb B", "QB", 11), player("Qb C", "QB", 12),
    player("Te A", "TE", 8), player("Te B", "TE", 9), player("Te C", "TE", 10),
  ];
  const adpMap: AdpMap = buildAdpMap(buildMatchIndex(available), [
    { name: "Last RbOne", position: "RB", adp: 52 },
    { name: "Last RbTwo", position: "RB", adp: 55 },
    { name: "Last RbThree", position: "RB", adp: 58 },
  ]);
  const outlooks = positionOutlooks({
    available, adpMap, slots, currentPickNo: 51, myPick: 70,
  });

  it("projects the RB pool nearly gone by my next pick", () => {
    const rb = outlooks.find((o) => o.pos === "RB")!;
    expect(rb.openStarters).toBe(1);
    expect(rb.rankedAvailable).toBe(3);
    expect(rb.projectedAtMyPick).toBeLessThan(1.5);
  });

  it("raises an urgent supply alert for RB and none for stocked positions", () => {
    const alerts = supplyAlerts(outlooks);
    const rbAlert = alerts.find((a) => a.text.includes("RB"));
    expect(rbAlert?.level).toBe("urgent");
    expect(alerts.some((a) => a.text.startsWith("WR"))).toBe(false);
  });

  it("marks RB as a scarce needed position for the advisor boost", () => {
    expect(scarceNeededPositions(outlooks).has("RB")).toBe(true);
    expect(scarceNeededPositions(outlooks).has("WR")).toBe(false);
  });

  it("flags an empty ranked pool as urgent even without ADP data", () => {
    const none = positionOutlooks({
      available: available.filter((p) => p.pos !== "RB"),
      adpMap: new Map(), slots, currentPickNo: 51, myPick: 70,
    });
    const alerts = supplyAlerts(none);
    expect(alerts.find((a) => a.text.includes("GONE"))?.level).toBe("urgent");
  });
});

describe("planDriftAlerts", () => {
  const plan = [
    { round: 1, plan: "RB" }, { round: 2, plan: "RB" }, { round: 3, plan: "WR" },
    { round: 4, plan: "BPA" }, { round: 5, plan: "WR" }, { round: 6, plan: "BPA" },
    { round: 7, plan: "BPA" }, { round: 8, plan: "QB" },
  ];

  it("stays quiet when roughly on script", () => {
    no = 0;
    const picks = [pick("RB", 1), pick("RB", 2), pick("WR", 3)];
    expect(planDriftAlerts(picks, plan, 3)).toHaveLength(0);
  });

  it("warns when 2+ behind the plan at a position", () => {
    no = 0;
    // Through 5 rounds the plan wanted 2 RB; I took zero.
    const picks = [pick("WR", 1), pick("WR", 2), pick("WR", 3), pick("TE", 4), pick("WR", 5)];
    const alerts = planDriftAlerts(picks, plan, 5);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].text).toContain("2 RBs");
    expect(alerts[0].text).toContain("you have 0");
  });

  it("ignores rounds not yet completed", () => {
    no = 0;
    const picks = [pick("WR", 1)];
    // Only round 1 done: one RB planned, zero taken — under the threshold.
    expect(planDriftAlerts(picks, plan, 1)).toHaveLength(0);
  });
});
