import { useMemo } from "react";
import { useDraft } from "./hooks/useDraft";
import { MATCH_INDEX, sortedBoard, boardRank, RANKINGS, STRATEGY, DEEP_POOL } from "./lib/rankings";
import { playerKey } from "./lib/normalize";
import { picksUntilMyTurn, nextPickForSlot, myFollowingPick, slotForPick } from "./lib/snake";
import { scarcityLabels } from "./lib/scarcity";
import { fillSlots } from "./lib/roster";
import { advise } from "./lib/advisor";
import {
  planDriftAlerts,
  positionOutlooks,
  scarceNeededPositions,
  supplyAlerts,
} from "./lib/rosterAlerts";
import RosterAlerts from "./components/RosterAlerts";
import SetupScreen from "./components/SetupScreen";
import HeaderBar from "./components/HeaderBar";
import BestAvailable from "./components/BestAvailable";
import PickAdvisor from "./components/PickAdvisor";
import PositionalBoard from "./components/PositionalBoard";
import RosterPanel from "./components/RosterPanel";
import SplitsPanel from "./components/SplitsPanel";
import StrategyPanel from "./components/StrategyPanel";
import SideFeed from "./components/SideFeed";

export default function App() {
  const {
    state,
    adpMap,
    matched,
    connectLive,
    startReplay,
    disconnect,
    setMySlot,
    setFormat,
    toggleOverride,
    replayControls,
  } = useDraft();

  const { draft, picks, mySlot, format, overrides, source } = state;

  const derived = useMemo(() => {
    if (!draft) return null;
    const teams = draft.settings.teams;
    const rounds = draft.settings.rounds;
    const reversal = draft.settings.reversal_round ?? 0;
    const nextPickNo = picks.length + 1;
    // In replay the fixture's own status is always "complete"; doneness comes
    // from how far the replay has advanced instead.
    const draftDone =
      picks.length >= teams * rounds ||
      (source?.kind !== "replay" && draft.status === "complete");
    const { round: currentRound, slot: onClockSlot } = draftDone
      ? { round: rounds, slot: 0 }
      : slotForPick(nextPickNo, teams, reversal);

    const othersPicks =
      mySlot && !draftDone ? picksUntilMyTurn(mySlot, nextPickNo, teams, rounds, reversal) : null;
    const myNextPickNo =
      mySlot && !draftDone ? nextPickForSlot(mySlot, nextPickNo, teams, rounds, reversal) : null;

    // Drafted = synced picks that matched, adjusted by manual overrides.
    const draftedKeys = new Set<string>();
    for (const m of matched) if (m.playerKey) draftedKeys.add(m.playerKey);
    for (const [key, action] of Object.entries(overrides)) {
      if (action === "drafted") draftedKeys.add(key);
      else draftedKeys.delete(key);
    }

    // Joel's board first; past his last rank the cheat sheet's deep pool
    // keeps the list going (sheet order) so late rounds aren't a blank page.
    const board = [
      ...sortedBoard(format).filter((p) => boardRank(p, format) !== null),
      ...DEEP_POOL,
    ];
    const available = board.filter((p) => !draftedKeys.has(playerKey(p)));
    const scarcity = scarcityLabels(available, othersPicks, format);

    const myPicks = picks.filter((p) => p.draft_slot === mySlot);
    const slots = mySlot ? fillSlots(draft.settings, myPicks) : [];
    const unmatchedPicks = matched.filter((m) => m.unmatched);
    const myRoundsPicked = new Set(myPicks.map((p) => p.round));
    const myPosByRound = new Map(myPicks.map((p) => [p.round, p.metadata.position]));

    // ---- Pick Advisor inputs ----
    const onClock = mySlot !== null && othersPicks === 0;
    const followingPick =
      mySlot && !draftDone ? myFollowingPick(mySlot, nextPickNo, teams, rounds, reversal) : null;
    const myPosCounts = new Map<string, number>();
    for (const p of myPicks) {
      const pos = p.metadata.position;
      myPosCounts.set(pos, (myPosCounts.get(pos) ?? 0) + 1);
    }
    // Per-position demand from the league's actual roster structure.
    const posNeeds = new Map<string, import("./lib/advisor").PosNeed>();
    for (const pos of ["QB", "RB", "WR", "TE"]) {
      posNeeds.set(pos, {
        dedicatedOpen: slots.filter((s) => s.label === pos && s.pick === null).length,
        dedicatedTotal: slots.filter((s) => s.label === pos).length,
        flexOpen: slots.filter(
          (s) => s.label !== "BN" && s.label !== pos && s.pick === null && s.eligible(pos),
        ).length,
        count: myPosCounts.get(pos) ?? 0,
      });
    }
    const myRound = myNextPickNo ? slotForPick(myNextPickNo, teams, reversal).round : null;
    const planLabel = myRound
      ? STRATEGY.roundPlan.find((r) => r.round === myRound)?.plan ?? null
      : null;
    const planPosition = planLabel?.match(/\b(QB|RB|WR|TE)\b/)?.[1] ?? null;

    // ---- roster awareness: supply projections + plan drift ----
    const outlooks = mySlot
      ? positionOutlooks({ available, adpMap, slots, currentPickNo: nextPickNo, myPick: myNextPickNo })
      : [];
    const scarcePositions = scarceNeededPositions(outlooks);
    const rosterAlerts = mySlot && !draftDone
      ? [
          ...supplyAlerts(outlooks),
          ...planDriftAlerts(myPicks, STRATEGY.roundPlan, Math.max(0, currentRound - 1)),
        ]
      : [];

    return {
      teams,
      rounds,
      nextPickNo,
      currentRound,
      onClockSlot,
      draftDone,
      othersPicks,
      myNextPickNo,
      draftedKeys,
      available,
      scarcity,
      myPicks,
      slots,
      unmatchedPicks,
      myRoundsPicked,
      myPosByRound,
      finalTwoRounds: currentRound >= rounds - 1,
      onClock,
      followingPick,
      posNeeds,
      planPosition,
      scarcePositions,
      rosterAlerts,
    };
  }, [draft, picks, matched, mySlot, format, overrides, source, adpMap]);

  if (!draft || !derived || !source) {
    return (
      <SetupScreen
        connectLive={connectLive}
        startReplay={startReplay}
        connecting={state.connecting}
        error={state.error}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <HeaderBar
        draft={draft}
        source={source}
        derived={derived}
        mySlot={mySlot}
        setMySlot={setMySlot}
        format={format}
        setFormat={setFormat}
        error={state.error}
        replay={state.replay}
        replayControls={replayControls}
        disconnect={disconnect}
      />
      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[1fr_360px]">
        <div className="flex min-h-0 flex-col gap-3">
          {!derived.draftDone && <RosterAlerts alerts={derived.rosterAlerts} />}
          {!derived.draftDone && (
            <PickAdvisor
              mySlot={mySlot}
              advice={advise({
                available: derived.available,
                adpMap,
                format,
                currentPickNo: derived.nextPickNo,
                myPick: derived.myNextPickNo,
                myNextPick: derived.followingPick,
                onClock: derived.onClock,
                posNeeds: derived.posNeeds,
                scarcePositions: derived.scarcePositions,
                planPosition: derived.planPosition,
              })}
              myPick={derived.myNextPickNo}
              onClock={derived.onClock}
              format={format}
              adpLoaded={adpMap.size > 0}
            />
          )}
          <BestAvailable
            available={derived.available}
            scarcity={derived.scarcity}
            format={format}
            overrides={overrides}
            toggleOverride={toggleOverride}
            matchIndex={MATCH_INDEX}
            finalTwoRounds={derived.finalTwoRounds}
            unmatchedPicks={derived.unmatchedPicks}
            adpMap={adpMap}
            myNextPickNo={derived.myNextPickNo}
            currentPickNo={derived.nextPickNo}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <RosterPanel slots={derived.slots} mySlot={mySlot} teams={derived.teams} />
          <PositionalBoard players={RANKINGS} draftedKeys={derived.draftedKeys} format={format} />
          <SplitsPanel players={RANKINGS} draftedKeys={derived.draftedKeys} format={format} />
          <StrategyPanel
            currentRound={derived.currentRound}
            rounds={derived.rounds}
            myRoundsPicked={derived.myRoundsPicked}
            myPosByRound={derived.myPosByRound}
            draftDone={derived.draftDone}
          />
          <SideFeed picks={picks} matched={matched} mySlot={mySlot} teams={derived.teams} />
        </div>
      </main>
    </div>
  );
}
