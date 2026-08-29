/**
 * Roster awareness: warn when the draft is drifting away from what my roster
 * still needs — e.g. 4 WRs through five rounds while the startable RB pool
 * evaporates.
 *
 * Supply is Joel's ranked pool (his 60/60/32/32); depletion to my next pick
 * is the expected number of those players the other teams take, summed from
 * ADP survival odds. Plan drift compares my actual picks to his round plan.
 */
import type { RankedPlayer, RosterSlot, SleeperPick } from "../types";
import { conditionalSurvival } from "./advisor";
import { sheetAdpOverall } from "./cheatsheet";
import { playerKey } from "./normalize";
import type { AdpMap } from "./adp";

export interface PosOutlook {
  pos: string;
  /** Open dedicated starting slots for this position (flex not counted). */
  openStarters: number;
  /** Available players Joel ranks at this position. */
  rankedAvailable: number;
  /** Expected number of those still available at my next pick. */
  projectedAtMyPick: number;
}

export interface RosterAlert {
  level: "urgent" | "warn";
  text: string;
}

const POSITIONS = ["QB", "RB", "WR", "TE"] as const;

export function positionOutlooks(input: {
  available: RankedPlayer[];
  adpMap: AdpMap;
  slots: RosterSlot[];
  currentPickNo: number;
  myPick: number | null;
}): PosOutlook[] {
  return POSITIONS.map((pos) => {
    const openStarters = input.slots.filter(
      (s) => s.label === pos && s.pick === null,
    ).length;
    const ranked = input.available.filter((p) => p.pos === pos && p.posRank !== null);
    let expectedTaken = 0;
    if (input.myPick !== null && input.myPick > input.currentPickNo) {
      for (const p of ranked) {
        const adp =
          input.adpMap.get(playerKey(p))?.adp ??
          (p.sheet ? sheetAdpOverall(p.sheet) : null);
        if (adp !== null) {
          expectedTaken += 1 - conditionalSurvival(adp, input.currentPickNo, input.myPick);
        }
      }
    }
    return {
      pos,
      openStarters,
      rankedAvailable: ranked.length,
      projectedAtMyPick: Math.max(0, ranked.length - expectedTaken),
    };
  });
}

/** Positions worth boosting in the advisor: still needed and drying up. */
export function scarceNeededPositions(outlooks: PosOutlook[]): Set<string> {
  return new Set(
    outlooks
      .filter((o) => o.openStarters > 0 && o.projectedAtMyPick <= o.openStarters + 2)
      .map((o) => o.pos),
  );
}

export function supplyAlerts(outlooks: PosOutlook[]): RosterAlert[] {
  const alerts: RosterAlert[] = [];
  for (const o of outlooks) {
    if (o.openStarters === 0) continue;
    const proj = Math.round(o.projectedAtMyPick);
    if (o.rankedAvailable === 0) {
      alerts.push({
        level: "urgent",
        text: `You still need ${o.openStarters} ${o.pos} starter${o.openStarters > 1 ? "s" : ""} and his ranked ${o.pos}s are GONE — only deep-pool options remain.`,
      });
    } else if (proj <= o.openStarters) {
      alerts.push({
        level: "urgent",
        text: `${o.pos} well is running dry: you need ${o.openStarters}, only ~${proj} of his ranked ${o.pos}s likely left at your next pick (${o.rankedAvailable} now).`,
      });
    } else if (proj <= o.openStarters + 2) {
      alerts.push({
        level: "warn",
        text: `${o.pos} thinning out: ${o.openStarters} starter${o.openStarters > 1 ? "s" : ""} open, ~${proj} of his ranked ${o.pos}s likely left at your next pick.`,
      });
    }
  }
  return alerts;
}

/** Behind Joel's round plan by 2+ at a position = drifting off script. */
export function planDriftAlerts(
  myPicks: SleeperPick[],
  roundPlan: { round: number; plan: string }[],
  roundsCompleted: number,
): RosterAlert[] {
  const planned = new Map<string, number>();
  for (const { round, plan } of roundPlan) {
    if (round > roundsCompleted) continue;
    const pos = plan.match(/\b(QB|RB|WR|TE)\b/)?.[1];
    if (pos) planned.set(pos, (planned.get(pos) ?? 0) + 1);
  }
  const actual = new Map<string, number>();
  for (const p of myPicks) {
    actual.set(p.metadata.position, (actual.get(p.metadata.position) ?? 0) + 1);
  }
  const alerts: RosterAlert[] = [];
  for (const [pos, want] of planned) {
    const have = actual.get(pos) ?? 0;
    if (want - have >= 2) {
      alerts.push({
        level: "warn",
        text: `Off Joel's script: his plan had ${want} ${pos}${want > 1 ? "s" : ""} by Rd ${roundsCompleted}, you have ${have}.`,
      });
    }
  }
  return alerts;
}
