import type { RosterSlot } from "../types";
import { unfilledStarters } from "../lib/roster";

const SLOT_COLOR: Record<string, string> = {
  QB: "text-rose-300",
  RB: "text-sky-300",
  WR: "text-emerald-300",
  TE: "text-orange-300",
  "W/R/T": "text-violet-300",
  "W/R": "text-violet-300",
  "W/T": "text-violet-300",
  SFLEX: "text-violet-300",
  DEF: "text-zinc-300",
  K: "text-zinc-300",
  BN: "text-zinc-500",
};

export default function RosterPanel(props: {
  slots: RosterSlot[];
  mySlot: number | null;
  teams: number;
}) {
  if (props.mySlot === null) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-sm text-zinc-400">
        <h2 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">My roster</h2>
        Pick your draft slot (1–{props.teams}) in the header to track your roster and pick
        timing.
      </section>
    );
  }

  const missing = unfilledStarters(props.slots);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">My roster</h2>
        {missing.length > 0 ? (
          <span className="text-xs text-amber-400">
            {missing.length} starter{missing.length === 1 ? "" : "s"} open
          </span>
        ) : (
          <span className="text-xs text-emerald-400">starters filled</span>
        )}
      </div>
      <ul className="space-y-1 text-sm">
        {props.slots.map((slot, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={`w-12 shrink-0 text-[11px] font-bold ${SLOT_COLOR[slot.label] ?? "text-zinc-400"}`}
            >
              {slot.label}
            </span>
            {slot.pick ? (
              <span className="truncate">
                {slot.pick.metadata.first_name} {slot.pick.metadata.last_name}
                <span className="ml-1.5 text-xs text-zinc-500">
                  {slot.pick.metadata.team ?? ""} · Rd {slot.pick.round}
                </span>
              </span>
            ) : (
              <span className="text-zinc-600">—</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
