/**
 * Match Sleeper NBA picks to the board. Both sides come from Sleeper, so the
 * player_id is an exact key; the name fallback only matters for hand-edited
 * JSON or a fixture from another season.
 *
 * A miss here is not an error the way it is on the NFL side — the board is
 * the top ~200 by production, and late picks fall outside it by design. The
 * UI labels those "off board" rather than "no match".
 */
import type { MatchedPick, SleeperPick } from "../types";
import { lastName, normalizeName } from "../lib/normalize";
import type { NbaIndex } from "./rankings";
import type { NbaPlayer } from "./types";

export function matchNbaPick(index: NbaIndex, pick: Pick<SleeperPick, "player_id" | "metadata">): NbaPlayer | null {
  const byId = index.byId.get(pick.player_id);
  if (byId) return byId;
  const meta = pick.metadata;
  const full = normalizeName(`${meta.first_name} ${meta.last_name}`);
  const exact = index.byFull.get(full);
  if (exact) return exact;
  const candidates = (index.byLast.get(lastName(meta.last_name)) ?? []).filter(
    (c) => normalizeName(c.name).charAt(0) === full.charAt(0) && (!c.team || !meta.team || c.team === meta.team),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

const warned = new Set<string>();

export function matchNbaPicks(index: NbaIndex, picks: SleeperPick[]): MatchedPick[] {
  return picks.map((pick) => {
    const player = matchNbaPick(index, pick);
    const unmatched = player === null;
    const warnKey = `${pick.pick_no}|${pick.player_id}`;
    if (unmatched && !warned.has(warnKey)) {
      warned.add(warnKey);
      console.info(
        `[draft-war-room] NBA pick #${pick.pick_no} off board: ` +
          `${pick.metadata.first_name} ${pick.metadata.last_name} (${pick.metadata.position}, id ${pick.player_id})`,
      );
    }
    return { pick, playerKey: player ? player.id : null, unmatched };
  });
}
