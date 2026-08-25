/**
 * Vercel serverless function: proxy + daily cache for Sleeper's ~5MB NFL
 * player map. The CDN cache header means Sleeper is hit at most about once a
 * day per region — the client must never call Sleeper's players endpoint
 * directly.
 */
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
    const data = await upstream.json();
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=43200");
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "fetch failed" });
  }
}
