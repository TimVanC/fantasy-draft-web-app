/**
 * NBA roster slots from the Sleeper draft settings object (slots_pg, slots_g,
 * slots_util, ...). Nothing about the league is hardcoded.
 *
 * Most NBA players are eligible at two or three positions, so a greedy
 * first-open-slot fill can strand a starter on the bench (a SG/SF/PF taking
 * the SG slot before a pure SG arrives). Picks are therefore assigned with a
 * small maximum bipartite matching that maximises filled starting slots, then
 * everyone left goes to the bench.
 */
import type { RosterSlot, SleeperDraft, SleeperPick } from "../types";
import type { NbaPos } from "./types";

interface SlotDef {
  key: string;
  label: string;
  positions: NbaPos[];
}

const SLOT_DEFS: SlotDef[] = [
  { key: "slots_pg", label: "PG", positions: ["PG"] },
  { key: "slots_sg", label: "SG", positions: ["SG"] },
  { key: "slots_g", label: "G", positions: ["PG", "SG"] },
  { key: "slots_sf", label: "SF", positions: ["SF"] },
  { key: "slots_pf", label: "PF", positions: ["PF"] },
  { key: "slots_f", label: "F", positions: ["SF", "PF"] },
  { key: "slots_c", label: "C", positions: ["C"] },
  { key: "slots_util", label: "UTIL", positions: ["PG", "SG", "SF", "PF", "C"] },
];

export function buildNbaSlots(settings: SleeperDraft["settings"]): RosterSlot[] {
  const slots: RosterSlot[] = [];
  for (const def of SLOT_DEFS) {
    const n = settings[def.key] ?? 0;
    for (let i = 0; i < n; i++) {
      slots.push({ label: def.label, eligible: (p) => def.positions.includes(p as NbaPos), pick: null });
    }
  }
  const bench = settings.slots_bn ?? 0;
  for (let i = 0; i < bench; i++) slots.push({ label: "BN", eligible: () => true, pick: null });
  return slots;
}

/** Positions a pick can start at: the rankings' eligibility list when we know
 *  the player, else the single position Sleeper put on the pick. */
export type EligibleFn = (pick: SleeperPick) => string[];

export function fillNbaSlots(
  settings: SleeperDraft["settings"],
  myPicks: SleeperPick[],
  eligibleFor: EligibleFn,
): RosterSlot[] {
  const slots = buildNbaSlots(settings);
  const starters = slots.map((_, i) => i).filter((i) => slots[i].label !== "BN");
  const canStart = myPicks.map((pick) => {
    const positions = eligibleFor(pick);
    return starters.filter((i) => positions.some((pos) => slots[i].eligible(pos)));
  });

  // Kuhn's augmenting paths: picks on the left, starting slots on the right.
  const slotOwner = new Map<number, number>(); // slot index -> pick index
  const tryAssign = (pi: number, seen: Set<number>): boolean => {
    for (const si of canStart[pi]) {
      if (seen.has(si)) continue;
      seen.add(si);
      const owner = slotOwner.get(si);
      if (owner === undefined || tryAssign(owner, seen)) {
        slotOwner.set(si, pi);
        return true;
      }
    }
    return false;
  };
  // Earlier picks get first crack so ties resolve toward draft order.
  for (let pi = 0; pi < myPicks.length; pi++) tryAssign(pi, new Set());

  const placed = new Set<number>();
  for (const [si, pi] of slotOwner) {
    slots[si].pick = myPicks[pi];
    placed.add(pi);
  }
  for (let pi = 0; pi < myPicks.length; pi++) {
    if (placed.has(pi)) continue;
    const bench = slots.find((s) => s.label === "BN" && s.pick === null);
    if (bench) bench.pick = myPicks[pi];
  }
  return slots;
}

/** Positions that still have an open starting slot (dedicated, G/F, or UTIL). */
export function openPositions(slots: RosterSlot[]): NbaPos[] {
  const out: NbaPos[] = [];
  for (const pos of ["PG", "SG", "SF", "PF", "C"] as NbaPos[]) {
    if (slots.some((s) => s.label !== "BN" && s.pick === null && s.eligible(pos))) out.push(pos);
  }
  return out;
}
