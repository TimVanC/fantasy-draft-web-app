import { useEffect, useMemo, useState } from "react";
import type { DraftHook } from "../App";
import { useClockAlerts } from "../hooks/useClockAlerts";
import HeaderBar from "../components/HeaderBar";
import RosterPanel from "../components/RosterPanel";
import SideFeed from "../components/SideFeed";
import { myFollowingPick, nextPickForSlot, picksUntilMyTurn, slotForPick } from "../lib/snake";
import { fetchNbaAdpMap, type NbaAdpMap } from "./adp";
import { matchNbaPicks } from "./match";
import { NBA_BOARD, NBA_FILE, NBA_INDEX } from "./rankings";
import { fillNbaSlots, openPositions } from "./roster";
import { nbaScarcity } from "./scarcity";
import NbaBoard from "./NbaBoard";
import NbaSidebar from "./NbaSidebar";
import type { SleeperPick } from "../types";

export default function NbaApp({ hook }: { hook: DraftHook }) {
  const { state, setMySlot, toggleOverride, toggleStar, replayControls, disconnect } = hook;
  const { draft, picks, mySlot, overrides, starred, source } = state;
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [liveAdp, setLiveAdp] = useState<NbaAdpMap>(new Map());
  const starredSet = useMemo(() => new Set(starred), [starred]);

  // Live Sleeper ADP for the season the flags were built against (so VALUE /
  // REACH and the ADP column agree); the JSON snapshot is the fallback.
  const season = NBA_FILE.adpSeason;
  useEffect(() => {
    let cancelled = false;
    fetchNbaAdpMap(season)
      .then((m) => {
        if (!cancelled) setLiveAdp(m);
      })
      .catch((e) => console.warn("[draft-war-room] NBA ADP unavailable, using snapshot:", e));
    return () => {
      cancelled = true;
    };
  }, [season]);
  const adpOf = useMemo(
    () => (id: string, fallback: number | null) => liveAdp.get(id)?.adp ?? fallback,
    [liveAdp],
  );
  // Live injury/team when we have it; the build-time snapshot otherwise.
  const liveOf = useMemo(
    () => (id: string) => liveAdp.get(id) ?? null,
    [liveAdp],
  );

  const matched = useMemo(() => matchNbaPicks(NBA_INDEX, picks), [picks]);

  const eligibleOf = useMemo(
    () => (pick: SleeperPick): string[] => {
      const p = NBA_INDEX.byId.get(pick.player_id);
      return p && p.eligible.length ? p.eligible : [pick.metadata.position];
    },
    [],
  );

  const derived = useMemo(() => {
    if (!draft) return null;
    const teams = draft.settings.teams;
    const rounds = draft.settings.rounds;
    const reversal = draft.settings.reversal_round ?? 0;
    const nextPickNo = picks.length + 1;
    const draftDone =
      picks.length >= teams * rounds || (source?.kind !== "replay" && draft.status === "complete");
    const { round: currentRound, slot: onClockSlot } = draftDone
      ? { round: rounds, slot: 0 }
      : slotForPick(nextPickNo, teams, reversal);
    const othersPicks =
      mySlot && !draftDone ? picksUntilMyTurn(mySlot, nextPickNo, teams, rounds, reversal) : null;
    const myNextPickNo =
      mySlot && !draftDone ? nextPickForSlot(mySlot, nextPickNo, teams, rounds, reversal) : null;
    const followingPick =
      mySlot && !draftDone ? myFollowingPick(mySlot, nextPickNo, teams, rounds, reversal) : null;

    const draftedIds = new Set<string>();
    for (const m of matched) if (m.playerKey) draftedIds.add(m.playerKey);
    for (const [id, action] of Object.entries(overrides)) {
      if (action === "drafted") draftedIds.add(id);
      else draftedIds.delete(id);
    }
    const available = NBA_BOARD.filter((p) => !draftedIds.has(p.id));
    const scarcity = nbaScarcity(available, othersPicks);

    const myPicks = picks.filter((p) => p.draft_slot === mySlot);
    const slots = mySlot ? fillNbaSlots(draft.settings, myPicks, eligibleOf) : [];
    const open = mySlot ? openPositions(slots) : null;
    const offBoard = matched.filter((m) => m.unmatched);

    return {
      teams,
      rounds,
      nextPickNo,
      currentRound,
      onClockSlot,
      draftDone,
      othersPicks,
      myNextPickNo,
      followingPick,
      onClock: mySlot !== null && othersPicks === 0,
      draftedIds,
      available,
      scarcity,
      myPicks,
      slots,
      openPositions: open,
      offBoard,
    };
  }, [draft, picks, matched, mySlot, overrides, source, eligibleOf]);

  const { permission, requestPermission } = useClockAlerts({
    enabled: alertsEnabled && mySlot !== null && source?.kind === "live",
    othersPicks: derived?.othersPicks ?? null,
    nextPickNo: derived?.nextPickNo ?? 0,
    draftDone: derived?.draftDone ?? true,
  });

  if (!draft || !derived || !source) return null;

  return (
    <div className="flex h-screen flex-col">
      <HeaderBar
        draft={draft}
        source={source}
        derived={derived}
        mySlot={mySlot}
        setMySlot={setMySlot}
        sportLabel="NBA"
        error={state.error}
        replay={state.replay}
        replayControls={replayControls}
        alerts={{
          enabled: alertsEnabled,
          toggle: () => setAlertsEnabled((v) => !v),
          permission,
          requestPermission,
        }}
        disconnect={disconnect}
      />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_360px]">
        <div className="flex min-h-0 flex-col gap-3">
          <NbaBoard
            available={derived.available}
            scarcity={derived.scarcity}
            overrides={overrides}
            toggleOverride={toggleOverride}
            starred={starredSet}
            toggleStar={toggleStar}
            adpOf={adpOf}
            liveOf={liveOf}
            liveAdp={liveAdp.size > 0}
            myNextPickNo={derived.myNextPickNo}
            followingPickNo={derived.followingPick}
            onClock={derived.onClock}
            currentPickNo={derived.nextPickNo}
            teams={derived.teams}
            openPositions={derived.openPositions}
            draftDone={derived.draftDone}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <RosterPanel slots={derived.slots} mySlot={mySlot} teams={derived.teams} eligibleOf={eligibleOf} />
          <NbaSidebar available={derived.available} draftedIds={derived.draftedIds} openPositions={derived.openPositions} adpOf={adpOf} />
          <SideFeed
            picks={picks}
            matched={matched}
            mySlot={mySlot}
            teams={derived.teams}
            unmatchedBadge={{
              text: "OFF BOARD",
              title: "Not in the top ~200 by last-year production, so nothing to remove from the board",
              tone: "muted",
            }}
          />
        </div>
      </main>
    </div>
  );
}
