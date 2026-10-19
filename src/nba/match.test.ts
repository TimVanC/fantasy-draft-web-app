import { describe, expect, it } from "vitest";
import type { SleeperPick } from "../types";
import fixturePicks from "../../fixtures/nba-picks.json";
import { matchNbaPick, matchNbaPicks } from "./match";
import { NBA_INDEX, buildNbaIndex } from "./rankings";
import type { NbaPlayer } from "./types";

const PICKS = fixturePicks as unknown as SleeperPick[];

function player(partial: Partial<NbaPlayer> & { id: string; name: string }): NbaPlayer {
  return {
    pos: "PG",
    eligible: ["PG"],
    team: null,
    gp: 70,
    fppg: 30,
    total: 2100,
    stats: {},
    adp: null,
    injury: null,
    yearsExp: 5,
    rank: 1,
    posRank: {},
    flag: "fair",
    adpDelta: null,
    ...partial,
  };
}

describe("matchNbaPick", () => {
  it("matches by Sleeper player_id first", () => {
    const jokic = PICKS[0];
    expect(jokic.player_id).toBe("1658");
    expect(matchNbaPick(NBA_INDEX, jokic)?.name).toBe("Nikola Jokić");
  });

  it("falls back to a diacritic-insensitive name match", () => {
    const idx = buildNbaIndex([player({ id: "x1", name: "Luka Dončić", team: "LAL" })]);
    const pick = { player_id: "nope", metadata: { first_name: "Luka", last_name: "Doncic", position: "PG", team: "LAL" } };
    expect(matchNbaPick(idx, pick)?.id).toBe("x1");
  });

  it("refuses an ambiguous last-name match", () => {
    const idx = buildNbaIndex([
      player({ id: "a", name: "Jalen Williams", team: "OKC" }),
      player({ id: "b", name: "Jaylin Williams", team: "OKC" }),
    ]);
    const pick = { player_id: "?", metadata: { first_name: "J.", last_name: "Williams", position: "PF", team: "OKC" } };
    expect(matchNbaPick(idx, pick)).toBeNull();
  });

  it("matches every early pick of last year's real draft by id", () => {
    const matched = matchNbaPicks(NBA_INDEX, PICKS);
    const firstHundred = matched.slice(0, 100);
    const misses = firstHundred.filter((m) => m.unmatched).map((m) => m.pick.metadata.last_name);
    expect(misses).toEqual([]);
    // Late picks can legitimately be off the top-200 board; they are flagged, not errors.
    expect(matched.filter((m) => m.unmatched).length).toBeLessThan(30);
  });
});
