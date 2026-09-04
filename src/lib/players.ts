/**
 * Live Sleeper player map (via /api/players): the things a frozen PDF can't
 * know — current team, injury/roster status, depth chart. Used for the
 * injury guard, handcuff detection, and QB stacks. Never for ranking.
 */
import { matchPick, playerKey, type MatchIndex } from "./normalize";

export interface PlayerInfo {
  team: string | null;
  status: string | null;
  injuryStatus: string | null;
  depthChartOrder: number | null;
}

export type PlayerInfoMap = Map<string, PlayerInfo>;

interface RawPlayer {
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string | null;
  status?: string | null;
  injury_status?: string | null;
  depth_chart_order?: number | null;
}

/** Index the raw map by guide playerKey using the strict matcher. */
export function buildPlayerInfoMap(index: MatchIndex, raw: Record<string, RawPlayer>): PlayerInfoMap {
  const out: PlayerInfoMap = new Map();
  for (const p of Object.values(raw)) {
    if (!p.position || !["QB", "RB", "WR", "TE"].includes(p.position)) continue;
    const matched = matchPick(index, {
      metadata: {
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
        position: p.position,
        // Don't let a stale guide team veto the live map; the map IS the truth.
        team: undefined,
      },
    });
    if (!matched) continue;
    const key = playerKey(matched);
    if (out.has(key)) continue; // first match wins (duplicates are rare)
    out.set(key, {
      team: p.team ?? null,
      status: p.status ?? null,
      injuryStatus: p.injury_status ?? null,
      depthChartOrder: p.depth_chart_order ?? null,
    });
  }
  return out;
}

export async function fetchPlayerInfoMap(index: MatchIndex): Promise<PlayerInfoMap> {
  const res = await fetch("/api/players");
  if (!res.ok) throw new Error(`players fetch failed (${res.status})`);
  return buildPlayerInfoMap(index, (await res.json()) as Record<string, RawPlayer>);
}

export type Availability = "out" | "questionable" | "fa" | null;

/**
 * Draft-night availability verdict. "out" = don't draft as a starter (IR,
 * PUP, suspended, out, inactive roster status); "questionable" = Q/D;
 * "fa" = no NFL team at all.
 */
export function availability(info: PlayerInfo | undefined): Availability {
  if (!info) return null;
  if (!info.team) return "fa";
  const inj = (info.injuryStatus ?? "").toLowerCase();
  const st = (info.status ?? "").toLowerCase();
  if (["ir", "pup", "sus", "out", "dnr", "na", "cov"].includes(inj)) return "out";
  if (st.includes("injured reserve") || st.includes("unable to perform") || st.includes("suspended") || st === "inactive")
    return "out";
  if (inj === "questionable" || inj === "doubtful") return "questionable";
  return null;
}

/** Short label for a badge: "IR", "PUP", "SUS", "OUT", "Q", "D", "FA". */
export function availabilityLabel(info: PlayerInfo | undefined): string | null {
  const a = availability(info);
  if (a === null) return null;
  if (a === "fa") return "FA";
  const inj = (info?.injuryStatus ?? "").toLowerCase();
  if (inj === "questionable") return "Q";
  if (inj === "doubtful") return "D";
  if (inj === "ir") return "IR";
  if (inj === "pup") return "PUP";
  if (inj === "sus") return "SUS";
  if (inj === "out") return "OUT";
  if (inj) return inj.toUpperCase();
  const st = (info?.status ?? "").toLowerCase();
  if (st.includes("injured reserve")) return "IR";
  if (st.includes("unable")) return "PUP";
  if (st.includes("suspended")) return "SUS";
  return "OUT";
}

/**
 * Handcuff: an RB on the same team as one of my RBs, one rung below him on
 * the depth chart (or the #1 if I own the #2). Returns the name of my RB he
 * backs up, or null.
 */
export function handcuffFor(
  candidateKey: string,
  candidatePos: string,
  info: PlayerInfoMap,
  myRbKeys: { key: string; name: string }[],
): string | null {
  if (candidatePos !== "RB") return null;
  const c = info.get(candidateKey);
  if (!c?.team || c.depthChartOrder === null) return null;
  for (const mine of myRbKeys) {
    const m = info.get(mine.key);
    if (!m?.team || m.team !== c.team || m.depthChartOrder === null) continue;
    if (m.depthChartOrder === 1 && c.depthChartOrder === 2) return mine.name;
    if (m.depthChartOrder === 2 && c.depthChartOrder === 1) return mine.name;
  }
  return null;
}

/** Name of my QB this pass-catcher stacks with, or null. */
export function stacksWith(
  candidateKey: string,
  candidatePos: string,
  info: PlayerInfoMap,
  myQbKeys: { key: string; name: string }[],
): string | null {
  if (candidatePos !== "WR" && candidatePos !== "TE") return null;
  const c = info.get(candidateKey);
  if (!c?.team) return null;
  for (const qb of myQbKeys) {
    const q = info.get(qb.key);
    if (q?.team && q.team === c.team) return qb.name;
  }
  return null;
}
