/**
 * Vercel serverless function: proxy + hourly cache for Fantasy Football
 * Calculator's public ADP API (live market ADP from their mock drafts).
 *
 * Display-only data: the app never blends ADP into recommendation order —
 * it is shown next to the guide's rank so the gap between the two is
 * visible. FFC sends no CORS headers, hence this proxy.
 */

const FORMATS = new Set(["ppr", "half-ppr", "standard"]);
const TEAM_SIZES = new Set(["8", "10", "12", "14"]);

export default async function handler(
  req: { query?: Record<string, string | string[]> },
  res: {
    setHeader: (k: string, v: string) => void;
    status: (code: number) => { json: (body: unknown) => void };
  },
) {
  const q = req.query ?? {};
  const format = String(q.format ?? "ppr");
  const teams = String(q.teams ?? "12");
  const year = String(q.year ?? new Date().getFullYear());
  if (!FORMATS.has(format) || !TEAM_SIZES.has(teams) || !/^20\d{2}$/.test(year)) {
    res.status(400).json({ error: "invalid format/teams/year" });
    return;
  }
  try {
    const upstream = await fetch(
      `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${year}`,
    );
    if (!upstream.ok) {
      res.status(502).json({ error: `FFC returned ${upstream.status}` });
      return;
    }
    const data = await upstream.json();
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=1800");
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "fetch failed" });
  }
}
