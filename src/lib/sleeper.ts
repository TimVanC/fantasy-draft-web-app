import type { SleeperDraft, SleeperPick } from "../types";

const BASE = "https://api.sleeper.app/v1";

/**
 * Accept a Sleeper draft URL or a raw ID and return the numeric draft ID.
 * Handles https://sleeper.com/draft/nfl/{id}, sleeper.app links, and bare IDs.
 */
export function parseDraftId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d{10,}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/draft\/(?:nfl\/)?(\d{10,})/) ?? trimmed.match(/(\d{10,})/);
  return m ? m[1] : null;
}

export async function fetchDraft(draftId: string): Promise<SleeperDraft> {
  const res = await fetch(`${BASE}/draft/${draftId}`);
  if (!res.ok) throw new Error(`Sleeper draft fetch failed (${res.status})`);
  const data = await res.json();
  if (!data) throw new Error("Draft not found — check the ID");
  return data as SleeperDraft;
}

export async function fetchPicks(draftId: string): Promise<SleeperPick[]> {
  const res = await fetch(`${BASE}/draft/${draftId}/picks`);
  if (!res.ok) throw new Error(`Sleeper picks fetch failed (${res.status})`);
  return ((await res.json()) ?? []) as SleeperPick[];
}

/** Resolve a league ID (pasted instead of a draft ID) to its most recent draft. */
export async function fetchLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  const res = await fetch(`${BASE}/league/${leagueId}/drafts`);
  if (!res.ok) throw new Error(`Sleeper league drafts fetch failed (${res.status})`);
  return ((await res.json()) ?? []) as SleeperDraft[];
}
