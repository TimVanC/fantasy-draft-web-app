import { useState } from "react";
import type { RankedPlayer } from "../types";
import { playerKey } from "../lib/normalize";

const POSITIONS = ["RB", "WR", "QB", "TE"] as const;
const SHOW_COUNT = 15;

/**
 * Joel's top players per position. Drafted players keep their original
 * position rank number but grey out and sink to the bottom of the list.
 */
export default function PositionalBoard(props: {
  players: RankedPlayer[];
  draftedKeys: Set<string>;
}) {
  const [pos, setPos] = useState<(typeof POSITIONS)[number]>("RB");

  const list = props.players
    .filter((p) => p.pos === pos && p.posRank !== null)
    .sort((a, b) => (a.posRank ?? 999) - (b.posRank ?? 999))
    .slice(0, SHOW_COUNT);
  const open = list.filter((p) => !props.draftedKeys.has(playerKey(p)));
  const gone = list.filter((p) => props.draftedKeys.has(playerKey(p)));

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">
          His top {pos}s
        </h2>
        <div className="flex overflow-hidden rounded-md border border-zinc-700 text-xs font-semibold">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPos(p)}
              className={`px-2 py-1 ${
                pos === p ? "bg-zinc-200 text-zinc-900" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-0.5 text-sm">
        {open.map((p) => (
          <Row key={p.name} p={p} drafted={false} />
        ))}
        {gone.length > 0 && <li className="my-1 border-t border-zinc-800" />}
        {gone.map((p) => (
          <Row key={p.name} p={p} drafted />
        ))}
      </ul>
    </section>
  );
}

function Row(props: { p: RankedPlayer; drafted: boolean }) {
  const { p, drafted } = props;
  return (
    <li
      className={`flex items-center gap-2 ${
        drafted ? "text-zinc-600 line-through decoration-zinc-700" : "text-zinc-200"
      }`}
    >
      <span className={`w-7 shrink-0 text-right font-mono text-xs ${drafted ? "text-zinc-700" : "text-zinc-500"}`}>
        {p.posRank}
      </span>
      <span className="truncate">{p.name}</span>
      {!drafted && p.tag === "target" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
      {!drafted && p.tag === "pass" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
      {!drafted && p.tag === "avoid" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
    </li>
  );
}
