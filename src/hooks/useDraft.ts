import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScoringFormat, SleeperDraft, SleeperPick } from "../types";
import { fetchDraft, fetchLeagueDrafts, fetchPicks, parseDraftId } from "../lib/sleeper";
import { matchPicks } from "../lib/normalize";
import { MATCH_INDEX } from "../lib/rankings";
import { fetchAdpMap, type AdpMap } from "../lib/adp";
import { fetchPlayerInfoMap, type PlayerInfoMap } from "../lib/players";
import fixtureDraft from "../../fixtures/draft.json";
import fixturePicks from "../../fixtures/picks.json";

// Adaptive polling: fast while picks are flying, relaxed while waiting.
// 2s ≈ 30 req/min/client — comfortably under Sleeper's 1000/min IP limit.
const POLL_ACTIVE_MS = 2000;
const POLL_IDLE_MS = 5000; // pre_draft / paused

export type Source = { kind: "live"; draftId: string } | { kind: "replay" };

/** Manual board overrides; they must survive polls, so they live outside the
 *  poll-derived state and win over sync in both directions. */
export type Overrides = Record<string, "drafted" | "available">;

export interface DraftState {
  source: Source | null;
  draft: SleeperDraft | null;
  picks: SleeperPick[];
  error: string | null;
  connecting: boolean;
  mySlot: number | null;
  format: ScoringFormat;
  overrides: Overrides;
  /** Advisor-only dismissals ("not him") — the player stays on the board. */
  dismissed: string[];
  /** Watchlist ("my guys"): advisor bump + badge. */
  starred: string[];
  replay: { index: number; playing: boolean; speedMs: number; total: number };
}

function storageKey(source: Source): string {
  return `dwr:${source.kind === "live" ? source.draftId : "replay"}`;
}

interface Persisted {
  mySlot: number | null;
  format: ScoringFormat;
  overrides: Overrides;
  dismissed?: string[];
  starred?: string[];
}

/** Recently connected drafts, for one-click reconnects on the setup screen. */
export interface RecentDraft {
  draftId: string;
  name: string;
  teams: number;
  at: number;
}

const RECENT_KEY = "dwr:recent";

export function loadRecentDrafts(): RecentDraft[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentDraft[]) : [];
  } catch {
    return [];
  }
}

function rememberDraft(entry: RecentDraft) {
  try {
    const list = loadRecentDrafts().filter((r) => r.draftId !== entry.draftId);
    list.unshift(entry);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    // storage unavailable: no recents, no harm
  }
}

/** Default board for a Sleeper scoring_type when nothing is saved. */
export function formatFromScoring(scoringType: string | undefined): ScoringFormat {
  const t = (scoringType ?? "").toLowerCase();
  if (t.includes("half")) return "half";
  if (t.includes("ppr")) return "ppr";
  if (t.includes("std") || t.includes("standard")) return "half"; // closest board
  return "ppr";
}

function loadPersisted(source: Source): Persisted | null {
  try {
    const raw = localStorage.getItem(storageKey(source));
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

export function useDraft() {
  const [source, setSource] = useState<Source | null>(null);
  const [draft, setDraft] = useState<SleeperDraft | null>(null);
  const [livePicks, setLivePicks] = useState<SleeperPick[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [format, setFormat] = useState<ScoringFormat>("ppr");
  const [overrides, setOverrides] = useState<Overrides>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [starred, setStarred] = useState<string[]>([]);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfoMap>(new Map());
  const [replayIndex, setReplayIndex] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeedMs, setReplaySpeedMs] = useState(1500);
  const [adpMap, setAdpMap] = useState<AdpMap>(new Map());
  const pollBusy = useRef(false);
  const pollCount = useRef(0);

  // ---- market ADP (display + survival odds only; never affects ordering) --
  const teamsCount = draft?.settings.teams ?? null;
  useEffect(() => {
    if (teamsCount === null) return;
    let cancelled = false;
    fetchAdpMap(MATCH_INDEX, format, teamsCount)
      .then((map) => {
        if (!cancelled) setAdpMap(map);
      })
      .catch((e) => {
        if (!cancelled) setAdpMap(new Map());
        console.warn("[draft-war-room] ADP unavailable:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [teamsCount, format]);

  // ---- live player map (injury/status/depth chart), once per connection --
  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    fetchPlayerInfoMap(MATCH_INDEX)
      .then((map) => {
        if (!cancelled) setPlayerInfo(map);
      })
      .catch((e) => {
        if (!cancelled) setPlayerInfo(new Map());
        console.warn("[draft-war-room] player map unavailable:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  // ---- persistence -------------------------------------------------------
  useEffect(() => {
    if (!source) return;
    try {
      localStorage.setItem(
        storageKey(source),
        JSON.stringify({ mySlot, format, overrides, dismissed, starred } satisfies Persisted),
      );
    } catch {
      // storage unavailable: overrides simply won't survive a reload
    }
  }, [source, mySlot, format, overrides, dismissed, starred]);

  // ---- connect -----------------------------------------------------------
  const connectLive = useCallback(async (input: string) => {
    const id = parseDraftId(input);
    if (!id) {
      setError("Could not find a draft ID in that input.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      let d: SleeperDraft;
      try {
        d = await fetchDraft(id);
      } catch {
        // Maybe a league ID was pasted; use its most recent draft.
        const drafts = await fetchLeagueDrafts(id);
        if (!drafts.length) throw new Error("No draft found for that ID.");
        d = await fetchDraft(drafts[0].draft_id);
      }
      const src: Source = { kind: "live", draftId: d.draft_id };
      const saved = loadPersisted(src);
      setDraft(d);
      setLivePicks(await fetchPicks(d.draft_id));
      setSource(src);
      setMySlot(saved?.mySlot ?? null);
      setFormat(saved?.format ?? formatFromScoring(d.metadata?.scoring_type));
      setOverrides(saved?.overrides ?? {});
      setDismissed(saved?.dismissed ?? []);
      setStarred(saved?.starred ?? []);
      rememberDraft({
        draftId: d.draft_id,
        name: d.metadata?.name || `Draft ${d.draft_id.slice(-6)}`,
        teams: d.settings.teams,
        at: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect to Sleeper.");
    } finally {
      setConnecting(false);
    }
  }, []);

  const startReplay = useCallback(() => {
    const src: Source = { kind: "replay" };
    const saved = loadPersisted(src);
    setDraft(fixtureDraft as unknown as SleeperDraft);
    setSource(src);
    setReplayIndex(0);
    setReplayPlaying(false);
    setMySlot(saved?.mySlot ?? null);
    setFormat(saved?.format ?? "ppr");
    setOverrides(saved?.overrides ?? {});
    setDismissed(saved?.dismissed ?? []);
    setStarred(saved?.starred ?? []);
    setError(null);
  }, []);

  const disconnect = useCallback(() => {
    setSource(null);
    setDraft(null);
    setLivePicks([]);
    setError(null);
    setReplayPlaying(false);
  }, []);

  // ---- live polling ------------------------------------------------------
  const draftStatus = draft?.status ?? null;
  useEffect(() => {
    if (source?.kind !== "live" || draftStatus === null) return;
    if (draftStatus === "complete") return; // spec: stop polling when complete
    const id = source.draftId;
    const poll = async () => {
      if (pollBusy.current) return;
      pollBusy.current = true;
      try {
        setLivePicks(await fetchPicks(id));
        pollCount.current += 1;
        // The draft object carries last_picked (pick clock) and status; fetch
        // it every tick but only swap state when something changed so the
        // effect (keyed on status) doesn't churn.
        const fresh = await fetchDraft(id);
        setDraft((prev) =>
          prev &&
          prev.status === fresh.status &&
          prev.last_picked === fresh.last_picked &&
          prev.settings.teams === fresh.settings.teams
            ? prev
            : fresh,
        );
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? `Sync issue: ${e.message}` : "Sync issue");
      } finally {
        pollBusy.current = false;
      }
    };
    const intervalMs = draftStatus === "drafting" ? POLL_ACTIVE_MS : POLL_IDLE_MS;
    const timer = setInterval(poll, intervalMs);
    void poll(); // sync immediately on (re)start instead of waiting a tick
    // Coming back to the tab mid-draft: refresh instantly.
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [source, draftStatus]);

  // ---- replay ticker -----------------------------------------------------
  const allReplayPicks = fixturePicks as unknown as SleeperPick[];
  useEffect(() => {
    if (source?.kind !== "replay" || !replayPlaying) return;
    const timer = setInterval(() => {
      setReplayIndex((i) => {
        if (i >= allReplayPicks.length) {
          setReplayPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, replaySpeedMs);
    return () => clearInterval(timer);
  }, [source, replayPlaying, replaySpeedMs, allReplayPicks.length]);

  const picks = useMemo(
    () => (source?.kind === "replay" ? allReplayPicks.slice(0, replayIndex) : livePicks),
    [source, replayIndex, livePicks, allReplayPicks],
  );

  const matched = useMemo(() => matchPicks(MATCH_INDEX, picks), [picks]);

  const toggleOverride = useCallback((key: string, matchedDrafted: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const cur = next[key];
      if (cur) {
        delete next[key]; // undo whichever override exists
      } else {
        next[key] = matchedDrafted ? "available" : "drafted";
      }
      return next;
    });
  }, []);

  return {
    state: {
      source,
      draft,
      picks,
      error,
      connecting,
      mySlot,
      format,
      overrides,
      dismissed,
      starred,
      replay: {
        index: replayIndex,
        playing: replayPlaying,
        speedMs: replaySpeedMs,
        total: allReplayPicks.length,
      },
    } satisfies DraftState,
    adpMap,
    playerInfo,
    toggleStar: (key: string) =>
      setStarred((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      ),
    toggleDismiss: (key: string) =>
      setDismissed((prev) =>
        prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
      ),
    matched,
    connectLive,
    startReplay,
    disconnect,
    setMySlot,
    setFormat,
    toggleOverride,
    replayControls: {
      play: () => setReplayPlaying(true),
      pause: () => setReplayPlaying(false),
      step: (n: number) =>
        setReplayIndex((i) => Math.max(0, Math.min(allReplayPicks.length, i + n))),
      reset: () => {
        setReplayIndex(0);
        setReplayPlaying(false);
      },
      setSpeed: (ms: number) => setReplaySpeedMs(ms),
    },
  };
}
