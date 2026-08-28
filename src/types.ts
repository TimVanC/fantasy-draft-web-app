export type Pos = "QB" | "RB" | "WR" | "TE" | "K" | "DEF";
export type Tag = "target" | "pass" | "avoid" | null;

/** One entry of data/cheatsheet.json (the half-PPR stats cheat sheet). */
export interface SheetEntry {
  name: string;
  team: string | null;
  age: number | null;
  pos: string;
  posAdpRank: number | null;
  rank: number;
  adp: string | null;
  adpHistory: { y25: string | null; y24: string | null; y23: string | null };
  ptw: { y25: number | null; y24: number | null; y23: number | null };
  ptwRank: { y25: number | null; y24: number | null; y23: number | null };
  gms: { y25: number | null; y24: number | null; y23: number | null };
}

/** One record in data/rankings.json (extracted from the draft guide).
 *  `sheet`/`value`/`valueGap` are attached at runtime from the cheat sheet —
 *  the guide data files stay pure. */
export interface RankedPlayer {
  name: string;
  pos: string;
  team: string | null;
  pprRank: number | null;
  halfRank: number | null;
  posRank: number | null;
  tag: Tag;
  adp: number | null;
  adjPpg2025: number | null;
  adjPpgNote: string | null;
  projPpg2026: number | null;
  ceiling: number | null;
  risk: number | null;
  notes: string[];
  sheet?: SheetEntry;
  /** Cheat-sheet VALUE tag: recent production rank beats current draft cost. */
  value?: boolean;
  /** Cheat-sheet TRAP tag: startable price his production has never backed. */
  trap?: boolean;
  valueGap?: number | null;
}

/** Sleeper GET /draft/{id} — only the fields we consume. */
export interface SleeperDraft {
  draft_id: string;
  status: "pre_draft" | "drafting" | "paused" | "complete" | string;
  type: "snake" | "linear" | "auction" | string;
  settings: {
    teams: number;
    rounds: number;
    reversal_round?: number;
    pick_timer?: number;
    slots_qb?: number;
    slots_rb?: number;
    slots_wr?: number;
    slots_te?: number;
    slots_flex?: number;
    slots_super_flex?: number;
    slots_wrrb_flex?: number;
    slots_rec_flex?: number;
    slots_k?: number;
    slots_def?: number;
    slots_bn?: number;
    [key: string]: number | undefined;
  };
  draft_order: Record<string, number> | null;
  slot_to_roster_id: Record<string, number> | null;
  metadata?: { scoring_type?: string; name?: string };
}

/** Sleeper GET /draft/{id}/picks item — only the fields we consume. */
export interface SleeperPick {
  pick_no: number;
  round: number;
  draft_slot: number;
  player_id: string;
  picked_by?: string;
  metadata: {
    first_name: string;
    last_name: string;
    position: string;
    team?: string;
  };
}

/** A Sleeper pick after attempting to match it to the guide rankings. */
export interface MatchedPick {
  pick: SleeperPick;
  /** Matched guide player key (name|pos), or null when no match. */
  playerKey: string | null;
  /** True when a QB/RB/WR/TE pick failed to match — surfaced in the UI. */
  unmatched: boolean;
}

export type ScoringFormat = "ppr" | "half";

export interface RosterSlot {
  label: string;
  eligible: (pos: string) => boolean;
  pick: SleeperPick | null;
}
