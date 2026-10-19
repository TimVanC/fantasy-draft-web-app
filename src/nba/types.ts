/** NBA position codes as Sleeper uses them. */
export type NbaPos = "PG" | "SG" | "SF" | "PF" | "C";

export const NBA_POSITIONS: NbaPos[] = ["PG", "SG", "SF", "PF", "C"];

/** How the player's ADP compares to where he finished last season. */
export type GapFlag =
  | "severely-underrated"
  | "underrated"
  | "fair"
  | "overrated"
  | "severely-overrated"
  | "small-sample"
  | "no-data"
  | "no-adp";

/** One record in data/nba-rankings.json (built by scripts/build_nba_rankings.py). */
export interface NbaPlayer {
  /** Sleeper player_id — the match key for picks. */
  id: string;
  name: string;
  /** Sleeper's primary position. */
  pos: NbaPos | string | null;
  /** Every slot position he can start at, in PG→C order. */
  eligible: NbaPos[];
  team: string | null;
  gp: number;
  /** Last season's per-game fantasy points under the league's scoring, or null with no games. */
  fppg: number | null;
  total: number | null;
  /** Per-game raw categories (only categories the league scores). */
  stats: Record<string, number>;
  /** Sleeper ADP for the upcoming season at build time. */
  adp: number | null;
  injury: string | null;
  yearsExp: number | null;
  /** Overall rank by fppg among players with enough games, else null. */
  rank: number | null;
  /** Rank at each eligible position, among qualifiers. */
  posRank: Partial<Record<NbaPos, number>>;
  flag: GapFlag;
  /** adp − rank: positive = going later than he finished. */
  adpDelta: number | null;
}

export interface NbaRankingsFile {
  generatedAt: string;
  leagueId: string;
  leagueName: string | null;
  statsSeason: string;
  adpSeason: string;
  minGp: number;
  scoring: Record<string, number>;
  rosterPositions: string[] | null;
  players: NbaPlayer[];
}
