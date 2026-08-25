/**
 * Vercel serverless function: proxy + daily cache for Sleeper's NFL player
 * map. The client must never call Sleeper's players endpoint directly.
 *
 * The raw endpoint is ~15MB, which is over Vercel's 10MB CDN-cacheable
 * response limit — an uncacheable proxy would hit Sleeper on every request.
 * So the function trims the map to fantasy-relevant positions and the fields
 * the app uses; the result (~1MB) caches at the CDN for a day
 * (s-maxage=86400), meaning Sleeper is fetched at most about once a day per
 * region.
 */

const KEEP_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

interface SleeperPlayer {
  player_id?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string | null;
  active?: boolean;
}

export default async function handler(_req: unknown, res: {
  setHeader: (k: string, v: string) => void;
  status: (code: number) => { json: (body: unknown) => void };
}) {
  try {
    const upstream = await fetch("https://api.sleeper.app/v1/players/nfl");
    if (!upstream.ok) {
      res.status(502).json({ error: `Sleeper returned ${upstream.status}` });
      return;
    }
    const full = (await upstream.json()) as Record<string, SleeperPlayer>;
    const trimmed: Record<
      string,
      { first_name: string; last_name: string; position: string; team: string | null }
    > = {};
    for (const [id, p] of Object.entries(full)) {
      if (!p || !p.position || !KEEP_POSITIONS.has(p.position)) continue;
      if (p.active === false) continue;
      trimmed[id] = {
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
        position: p.position,
        team: p.team ?? null,
      };
    }
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=43200");
    res.status(200).json(trimmed);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "fetch failed" });
  }
}
