import type { MatchedPick, SleeperPick } from "../types";

export default function SideFeed(props: {
  picks: SleeperPick[];
  matched: MatchedPick[];
  mySlot: number | null;
  teams: number;
}) {
  const recent = [...props.matched].slice(-8).reverse();

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <h2 className="mb-2 text-sm font-black uppercase tracking-wide text-zinc-300">
        Recent picks
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-zinc-500">No picks yet.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {recent.map((m) => {
            const meta = m.pick.metadata;
            const mine = props.mySlot !== null && m.pick.draft_slot === props.mySlot;
            return (
              <li key={m.pick.pick_no} className="flex items-center gap-2">
                <span className="w-10 shrink-0 font-mono text-xs text-zinc-500">
                  #{m.pick.pick_no}
                </span>
                <span className={`truncate ${mine ? "font-bold text-emerald-300" : ""}`}>
                  {meta.first_name} {meta.last_name}
                  <span className="ml-1.5 text-xs text-zinc-500">
                    {meta.position} · slot {m.pick.draft_slot}
                    {mine ? " (you)" : ""}
                  </span>
                </span>
                {m.unmatched && (
                  <span
                    className="ml-auto shrink-0 rounded bg-amber-950 px-1.5 py-0.5 text-[10px] font-bold text-amber-300"
                    title="This pick did not match any guide player — check the board"
                  >
                    NO MATCH
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
