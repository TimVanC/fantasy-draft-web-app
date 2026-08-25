import { describe, expect, it } from "vitest";
import { fillSlots, unfilledStarters } from "./roster";
import type { SleeperPick } from "../types";

const SETTINGS = {
  teams: 10,
  rounds: 15,
  slots_qb: 1,
  slots_rb: 2,
  slots_wr: 2,
  slots_te: 1,
  slots_flex: 1,
  slots_def: 1,
  slots_k: 1,
  slots_bn: 6,
};

let pickNo = 0;
function pick(position: string, name = `P${++pickNo}`): SleeperPick {
  return {
    pick_no: pickNo,
    round: 1,
    draft_slot: 1,
    player_id: String(pickNo),
    metadata: { first_name: name, last_name: position, position },
  };
}

describe("fillSlots", () => {
  it("fills dedicated slots before flex, then bench", () => {
    const picks = [pick("RB"), pick("RB"), pick("WR"), pick("RB"), pick("RB")];
    const slots = fillSlots(SETTINGS, picks);
    const labels = slots.filter((s) => s.pick).map((s) => s.label);
    // RB, RB fill the two RB slots; third RB flows into W/R/T; fourth to BN.
    expect(labels).toEqual(["RB", "RB", "WR", "W/R/T", "BN"]);
  });

  it("reports unfilled starters", () => {
    const slots = fillSlots(SETTINGS, [pick("QB"), pick("WR"), pick("WR"), pick("WR")]);
    expect(unfilledStarters(slots)).toEqual(["RB", "RB", "TE", "DEF", "K"]);
  });

  it("builds slots purely from the settings object", () => {
    const superflex = { ...SETTINGS, slots_super_flex: 1, slots_flex: 2 };
    const slots = fillSlots(superflex, []);
    expect(slots.filter((s) => s.label === "SFLEX")).toHaveLength(1);
    expect(slots.filter((s) => s.label === "W/R/T")).toHaveLength(2);
  });
});
