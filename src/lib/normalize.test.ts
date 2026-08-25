import { describe, expect, it } from "vitest";
import { buildMatchIndex, matchPick, matchPicks, normalizeName } from "./normalize";
import type { RankedPlayer, SleeperPick } from "../types";
import rankings from "../../data/rankings.json";
import fixturePicks from "../../fixtures/picks.json";

const INDEX = buildMatchIndex(rankings as RankedPlayer[]);

function sleeperMeta(first: string, last: string, position: string, team?: string) {
  return { metadata: { first_name: first, last_name: last, position, team } };
}

describe("normalizeName", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeName("Ja'Marr Chase")).toBe("jamarr chase");
    expect(normalizeName("A.J. Brown")).toBe("aj brown");
    expect(normalizeName("De'Von Achane")).toBe("devon achane");
  });

  it("strips generational suffixes", () => {
    expect(normalizeName("Kenneth Walker III")).toBe("kenneth walker");
    expect(normalizeName("Marvin Harrison Jr.")).toBe("marvin harrison");
    expect(normalizeName("Aaron Jones Sr.")).toBe("aaron jones");
    expect(normalizeName("Patrick Mahomes II")).toBe("patrick mahomes");
  });

  it("treats hyphens as spaces", () => {
    expect(normalizeName("Jacory Croskey-Merritt")).toBe("jacory croskey merritt");
    expect(normalizeName("Amon-Ra St. Brown")).toBe("amon ra st brown");
  });
});

describe("matchPick against the real guide rankings", () => {
  it("matches suffix mismatches (Sleeper drops or keeps Jr/III)", () => {
    expect(matchPick(INDEX, sleeperMeta("Kenneth", "Walker", "RB", "KC"))?.name).toBe(
      "Kenneth Walker III",
    );
    expect(matchPick(INDEX, sleeperMeta("Travis", "Etienne Jr.", "RB"))?.name).toBe(
      "Travis Etienne Jr.",
    );
    expect(matchPick(INDEX, sleeperMeta("Brian", "Thomas", "WR"))?.name).toBe(
      "Brian Thomas Jr.",
    );
  });

  it("matches first-name spelling drift via last name + initial", () => {
    // Sleeper spells him Jonathan; the guide prints Jonathon.
    expect(matchPick(INDEX, sleeperMeta("Jonathan", "Brooks", "RB", "CAR"))?.name).toBe(
      "Jonathon Brooks",
    );
  });

  it("refuses same-last-name different players (fixture false-positive traps)", () => {
    // All four appear in the 2025 fixture and share a last name + position
    // with a different guide player. A silent wrong match is the worst
    // failure mode, so these must return null, not the wrong player.
    expect(matchPick(INDEX, sleeperMeta("Kaleb", "Johnson", "RB", "PIT"))).toBeNull();
    expect(matchPick(INDEX, sleeperMeta("Jayden", "Higgins", "WR", "HOU"))).toBeNull();
    expect(matchPick(INDEX, sleeperMeta("Keenan", "Allen", "WR", "LAC"))).toBeNull();
    expect(matchPick(INDEX, sleeperMeta("Jalen", "McMillan", "WR", "TB"))).toBeNull();
  });

  it("uses team to veto only the last-name fallback, not exact name matches", () => {
    // Exact name + position always matches — the guide's team data can be
    // stale, and a full-name agreement is stronger evidence than a team field.
    expect(matchPick(INDEX, sleeperMeta("Tyler", "Warren", "TE", "SEA"))?.name).toBe(
      "Tyler Warren",
    );
    // But on the fuzzy path (spelling drift forces last-name matching), a
    // team disagreement rejects the candidate: Jonathon Brooks is CAR in the
    // guide, so a "Jonathan Brooks" claimed on SEA stays unmatched.
    expect(matchPick(INDEX, sleeperMeta("Jonathan", "Brooks", "RB", "SEA"))).toBeNull();
    expect(matchPick(INDEX, sleeperMeta("Jonathan", "Brooks", "RB", "CAR"))?.name).toBe(
      "Jonathon Brooks",
    );
  });

  it("does not confuse same last name across positions", () => {
    // Jaylen Warren (RB) must not collide with Tyler Warren (TE).
    expect(matchPick(INDEX, sleeperMeta("Jaylen", "Warren", "RB", "PIT"))?.name).toBe(
      "Jaylen Warren",
    );
  });
});

describe("matchPicks over the full 2025 fixture", () => {
  const results = matchPicks(INDEX, fixturePicks as unknown as SleeperPick[]);

  it("never flags K/DEF picks as unmatched", () => {
    const kdef = results.filter((r) =>
      ["K", "DEF"].includes(r.pick.metadata.position),
    );
    expect(kdef.length).toBeGreaterThan(0);
    expect(kdef.every((r) => !r.unmatched)).toBe(true);
  });

  it("matches the strong majority of skill picks and flags the rest", () => {
    const skill = results.filter((r) =>
      ["QB", "RB", "WR", "TE"].includes(r.pick.metadata.position),
    );
    const matched = skill.filter((r) => r.playerKey !== null);
    // 2025 fixture vs 2026 guide: some drafted players simply are not in the
    // guide. Those must be flagged, not silently dropped.
    expect(matched.length).toBeGreaterThanOrEqual(120);
    for (const r of skill) {
      expect(r.unmatched).toBe(r.playerKey === null);
    }
  });

  it("never matches two different picks to the same guide player", () => {
    const keys = results.map((r) => r.playerKey).filter((k): k is string => k !== null);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
