/**
 * Live Sleeper NBA ADP + injury status, keyed by player_id. Display and
 * survival odds only — the board order never changes. The JSON ships with a
 * build-time snapshot; this refreshes it on connect so draft-night ADP and
 * injury chips are current. api.sleeper.com sends open CORS headers, so no
 * proxy is needed.
 */
import { NBA_POSITIONS } from "./types";

export interface LiveEntry {
  adp: number | null;
  injury: string | null;
  team: string | null;
}

export type NbaAdpMap = Map<string, LiveEntry>;

interface ProjRow {
  player_id: string;
  stats?: { adp_std?: number | null } | null;
  player?: { injury_status?: string | null; team?: string | null } | null;
}

export function adpUrl(season: string | number): string {
  const pos = NBA_POSITIONS.map((p) => `position[]=${p}`).join("&");
  return `https://api.sleeper.com/projections/nba/${season}?season_type=regular&${pos}&order_by=adp_std`;
}

export function buildNbaAdpMap(rows: ProjRow[]): NbaAdpMap {
  const map: NbaAdpMap = new Map();
  for (const r of rows) {
    const adp = r.stats?.adp_std;
    map.set(r.player_id, {
      adp: typeof adp === "number" && adp > 0 ? adp : null,
      injury: r.player?.injury_status ?? null,
      team: r.player?.team ?? null,
    });
  }
  return map;
}

export async function fetchNbaAdpMap(season: string | number): Promise<NbaAdpMap> {
  const res = await fetch(adpUrl(season));
  if (!res.ok) throw new Error(`Sleeper NBA ADP fetch failed (${res.status})`);
  return buildNbaAdpMap((await res.json()) as ProjRow[]);
}
