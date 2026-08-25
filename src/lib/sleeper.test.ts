import { describe, expect, it } from "vitest";
import { parseDraftId } from "./sleeper";

describe("parseDraftId", () => {
  it("accepts raw numeric IDs", () => {
    expect(parseDraftId("1260297814596927488")).toBe("1260297814596927488");
    expect(parseDraftId("  1260297814596927488  ")).toBe("1260297814596927488");
  });

  it("parses sleeper.com and sleeper.app draft URLs", () => {
    expect(parseDraftId("https://sleeper.com/draft/nfl/1260297814596927488")).toBe(
      "1260297814596927488",
    );
    expect(parseDraftId("https://sleeper.app/draft/nfl/1260297814596927488")).toBe(
      "1260297814596927488",
    );
    expect(parseDraftId("sleeper.com/draft/nfl/1260297814596927488?x=1")).toBe(
      "1260297814596927488",
    );
  });

  it("rejects inputs without an ID", () => {
    expect(parseDraftId("hello")).toBeNull();
    expect(parseDraftId("")).toBeNull();
  });
});
