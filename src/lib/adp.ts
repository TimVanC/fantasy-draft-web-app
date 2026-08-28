/**
 * Live market ADP from Fantasy Football Calculator mock drafts, matched onto
 * guide players. STRICTLY display-only: the board is always sorted by the
 * guide's ranks, and ADP exists so the gap between the guide and the market
 * is visible (his rule #1: use rankings to find value against ADP).
 */
import type { ScoringFormat } from "../types";
import { matchPick, playerKey, type MatchIndex } from "./normalize";

export interface AdpEntry {
  /** Overall ADP as a pick number, e.g. 27.4 */
  adp: number;
  /** Round.pick form, e.g. "3.05" */
  formatted: string;
}

export type AdpMap = Map<string, AdpEntry>;

interface FfcPlayer {
  name: string;
  position: string;
  team?: string;
  adp: number;
  adp_formatted?: string;
}

/** FFC supports 8/10/12/14-team boards; snap other league sizes to nearest. */
export function nearestFfcTeams(teams: number): number {
  const sizes = [8, 10, 12, 14];
  return sizes.reduce((best, s) =>
    Math.abs(s - teams) < Math.abs(best - teams) ? s : best,
  );
}

export function ffcFormat(format: ScoringFormat): string {
  return format === "ppr" ? "ppr" : "half-ppr";
}

/** Match FFC rows onto guide players using the same strict matcher as picks. */
export function buildAdpMap(index: MatchIndex, players: FfcPlayer[]): AdpMap {
  const map: AdpMap = new Map();
  for (const p of players) {
    if (!["QB", "RB", "WR", "TE"].includes(p.position)) continue;
    const space = p.name.indexOf(" ");
    const meta = {
      first_name: space === -1 ? p.name : p.name.slice(0, space),
      last_name: space === -1 ? "" : p.name.slice(space + 1),
      position: p.position,
      team: p.team,
    };
    const matched = matchPick(index, { metadata: meta });
    if (!matched) continue;
    const key = playerKey(matched);
    if (!map.has(key)) {
      map.set(key, { adp: p.adp, formatted: p.adp_formatted ?? String(p.adp) });
    }
  }
  return map;
}

export async function fetchAdpMap(
  index: MatchIndex,
  format: ScoringFormat,
  teams: number,
): Promise<AdpMap> {
  const year = new Date().getFullYear();
  const url = `/api/adp?format=${ffcFormat(format)}&teams=${nearestFfcTeams(teams)}&year=${year}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ADP fetch failed (${res.status})`);
  const data = (await res.json()) as { players?: FfcPlayer[] };
  return buildAdpMap(index, data.players ?? []);
}
