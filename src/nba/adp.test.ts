import { describe, expect, it } from "vitest";
import { adpUrl, buildNbaAdpMap } from "./adp";

describe("NBA ADP", () => {
  it("keys live ADP and injury by player_id, null when Sleeper has none", () => {
    const map = buildNbaAdpMap([
      { player_id: "1", stats: { adp_std: 2.5 }, player: { injury_status: "Out", team: "DEN" } },
      { player_id: "2", stats: { adp_std: null }, player: { injury_status: null, team: null } },
      { player_id: "3", stats: null },
    ]);
    expect(map.get("1")).toEqual({ adp: 2.5, injury: "Out", team: "DEN" });
    expect(map.get("2")).toEqual({ adp: null, injury: null, team: null });
    expect(map.get("3")).toEqual({ adp: null, injury: null, team: null });
  });

  it("asks Sleeper for every position in one request", () => {
    const url = adpUrl(2026);
    expect(url).toContain("/projections/nba/2026");
    for (const pos of ["PG", "SG", "SF", "PF", "C"]) expect(url).toContain(`position[]=${pos}`);
  });
});
