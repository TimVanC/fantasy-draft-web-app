import { describe, expect, it } from "vitest";
import type { SleeperPick } from "../types";
import { buildNbaSlots, fillNbaSlots, openPositions } from "./roster";

// The user's league: PG SG G SF PF F C UTIL×3, 4 bench — read from settings.
const SETTINGS = {
  teams: 10,
  rounds: 14,
  slots_pg: 1,
  slots_sg: 1,
  slots_g: 1,
  slots_sf: 1,
  slots_pf: 1,
  slots_f: 1,
  slots_c: 1,
  slots_util: 3,
  slots_bn: 4,
};

let n = 0;
function pick(name: string, elig: string[]): SleeperPick & { elig: string[] } {
  n++;
  return {
    pick_no: n,
    round: n,
    draft_slot: 1,
    player_id: String(n),
    metadata: { first_name: name, last_name: "", position: elig[0] },
    elig,
  };
}
const eligibleOf = (p: SleeperPick) => (p as SleeperPick & { elig: string[] }).elig;

function labelsByName(slots: ReturnType<typeof fillNbaSlots>) {
  const out: Record<string, string> = {};
  for (const s of slots) if (s.pick) out[s.pick.metadata.first_name] = s.label;
  return out;
}

describe("buildNbaSlots", () => {
  it("builds the slot list purely from the settings object", () => {
    const labels = buildNbaSlots(SETTINGS).map((s) => s.label);
    expect(labels).toEqual(["PG", "SG", "G", "SF", "PF", "F", "C", "UTIL", "UTIL", "UTIL", "BN", "BN", "BN", "BN"]);
  });
});

describe("fillNbaSlots", () => {
  it("does not let a multi-position player strand a pure one on the bench", () => {
    // Brown (SG/SF/PF) arrives first; a greedy fill would park him at SG and
    // leave Maxey (pure SG... call him PG-only here) short. Matching re-routes.
    const brown = pick("Brown", ["SG", "SF", "PF"]);
    const pureSg = pick("Mitchell", ["SG"]);
    const pureSf = pick("Durant", ["SF"]);
    const purePf = pick("Banchero", ["PF"]);
    const g2 = pick("Giddey", ["PG"]);
    const c = pick("Jokic", ["C"]);
    const tight = { ...SETTINGS, slots_util: 0, slots_bn: 1 };
    const slots = fillNbaSlots(tight, [brown, pureSg, pureSf, purePf, g2, c], eligibleOf);
    const where = labelsByName(slots);
    // Every pure player gets a dedicated slot; Brown lands in G or F, not the bench.
    expect(where.Mitchell).toBe("SG");
    expect(where.Durant).toBe("SF");
    expect(where.Banchero).toBe("PF");
    expect(where.Giddey).toBe("PG");
    expect(where.Jokic).toBe("C");
    expect(["G", "F"]).toContain(where.Brown);
    expect(slots.filter((s) => s.label === "BN" && s.pick)).toHaveLength(0);
  });

  it("uses G, F and UTIL once dedicated slots are full, then the bench", () => {
    const picks = [
      pick("A", ["PG"]),
      pick("B", ["PG"]),
      pick("C1", ["PG"]),
      pick("D", ["PG"]),
      pick("E", ["PG"]),
      pick("F1", ["PG"]),
      pick("G1", ["PG"]),
    ];
    const slots = fillNbaSlots(SETTINGS, picks, eligibleOf);
    const labels = slots.filter((s) => s.pick).map((s) => s.label).sort();
    // 1 PG + 1 G + 3 UTIL can start point guards; the other two sit.
    expect(labels).toEqual(["BN", "BN", "G", "PG", "UTIL", "UTIL", "UTIL"]);
  });

  it("reports which positions still have an open starting slot", () => {
    const slots = fillNbaSlots(SETTINGS, [pick("Jokic", ["C"]), pick("Luka", ["PG"])], eligibleOf);
    // C filled but UTIL still takes a C; everything stays open until UTIL fills.
    expect(openPositions(slots)).toEqual(["PG", "SG", "SF", "PF", "C"]);
    const many = [
      pick("c1", ["C"]),
      pick("c2", ["C"]),
      pick("c3", ["C"]),
      pick("c4", ["C"]),
      pick("pg", ["PG"]),
      pick("sg", ["SG"]),
      pick("g", ["PG"]),
    ];
    const s2 = fillNbaSlots(SETTINGS, many, eligibleOf);
    // C + 3 UTIL hold centers; PG, SG, G hold guards -> only SF/PF/F remain.
    expect(openPositions(s2)).toEqual(["SF", "PF"]);
  });

  it("falls back to the pick's own position when the player is off the board", () => {
    const slots = fillNbaSlots(SETTINGS, [pick("Unknown", ["SF"])], (p) => [p.metadata.position]);
    expect(labelsByName(slots).Unknown).toBe("SF");
  });
});
