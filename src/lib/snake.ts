/**
 * Snake draft pick math. All pick numbers and rounds are 1-indexed.
 *
 * `reversalRound` (Sleeper's settings.reversal_round) supports third-round
 * reversal: when > 0, that round repeats the direction of the round before it,
 * then alternation resumes. 0 or undefined = standard snake.
 */

/** Direction of a round: true = forward (slot 1 picks first). */
export function roundIsForward(round: number, reversalRound = 0): boolean {
  const naturalForward = round % 2 === 1;
  if (!reversalRound || round < reversalRound) return naturalForward;
  // From the reversal round on, direction is the natural direction of the
  // previous round for even offsets, flipped for odd offsets.
  const anchorForward = (reversalRound - 1) % 2 === 1;
  return (round - reversalRound) % 2 === 0 ? anchorForward : !anchorForward;
}

/** Overall pick number for a draft slot in a given round. */
export function pickInRound(slot: number, round: number, teams: number, reversalRound = 0): number {
  const posInRound = roundIsForward(round, reversalRound) ? slot : teams - slot + 1;
  return (round - 1) * teams + posInRound;
}

/** Every overall pick number belonging to a draft slot. */
export function pickNumbersForSlot(slot: number, teams: number, rounds: number, reversalRound = 0): number[] {
  const out: number[] = [];
  for (let r = 1; r <= rounds; r++) out.push(pickInRound(slot, r, teams, reversalRound));
  return out;
}

/** Which round and draft slot an overall pick number belongs to. */
export function slotForPick(pickNo: number, teams: number, reversalRound = 0): { round: number; slot: number } {
  const round = Math.ceil(pickNo / teams);
  const posInRound = pickNo - (round - 1) * teams;
  const slot = roundIsForward(round, reversalRound) ? posInRound : teams - posInRound + 1;
  return { round, slot };
}

/**
 * My next overall pick number at or after `fromPickNo` (the next pick to be
 * made), or null when I have no picks left.
 */
export function nextPickForSlot(
  slot: number,
  fromPickNo: number,
  teams: number,
  rounds: number,
  reversalRound = 0,
): number | null {
  for (const p of pickNumbersForSlot(slot, teams, rounds, reversalRound)) {
    if (p >= fromPickNo) return p;
  }
  return null;
}

/**
 * How many picks other teams make before my next turn, given the next pick to
 * be made is `fromPickNo`. 0 means I am on the clock. Null when I have no
 * picks left.
 */
export function picksUntilMyTurn(
  slot: number,
  fromPickNo: number,
  teams: number,
  rounds: number,
  reversalRound = 0,
): number | null {
  const next = nextPickForSlot(slot, fromPickNo, teams, rounds, reversalRound);
  return next === null ? null : next - fromPickNo;
}

/**
 * The pick after that ("my pick after next") — used for the scarcity window
 * while I am on the clock deciding between two players.
 */
export function myFollowingPick(
  slot: number,
  fromPickNo: number,
  teams: number,
  rounds: number,
  reversalRound = 0,
): number | null {
  const next = nextPickForSlot(slot, fromPickNo, teams, rounds, reversalRound);
  if (next === null) return null;
  return nextPickForSlot(slot, next + 1, teams, rounds, reversalRound);
}
