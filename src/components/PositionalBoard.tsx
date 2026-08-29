import { useState } from "react";
import type { RankedPlayer, ScoringFormat } from "../types";
import { playerKey } from "../lib/normalize";
import { boardRank } from "../lib/rankings";

const TABS = ["ALL", "RB", "WR", "QB", "TE"] as const;
const SHOW_COUNT = 15;
const SHOW_COUNT_ALL = 20;

/**
 * Joel's top players — overall board or per position. Drafted players keep
 * their original rank number but grey out and sink to the bottom.
 */
export default function PositionalBoard(props: {
  players: RankedPlayer[];
  draftedKeys: Set<string>;
  format: ScoringFormat;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("ALL");

  const isAll = tab === "ALL";
  const list = isAll
    ? [...props.players]
        .filter((p) => boardRank(p, props.format) !== null)
        .sort((a, b) => (boardRank(a, props.format) ?? 999) - (boardRank(b, props.format) ?? 999))
        .slice(0, SHOW_COUNT_ALL)
    : props.players
        .filter((p) => p.pos === tab && p.posRank !== null)
        .sort((a, b) => (a.posRank ?? 999) - (b.posRank ?? 999))
        .slice(0, SHOW_COUNT);
  const open = list.filter((p) => !props.draftedKeys.has(playerKey(p)));
  const gone = list.filter((p) => props.draftedKeys.has(playerKey(p)));

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">
          {isAll ? "His board" : `His top ${tab}s`}
        </h2>
        <div className="flex overflow-hidden rounded-md border border-zinc-700 text-xs font-semibold">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-2 py-1 ${
                tab === t ? "bg-zinc-200 text-zinc-900" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-0.5 text-sm">
        {open.map((p) => (
          <Row key={playerKey(p)} p={p} drafted={false} rank={isAll ? boardRank(p, props.format) : p.posRank} showPos={isAll} />
        ))}
        {gone.length > 0 && <li className="my-1 border-t border-zinc-800" />}
        {gone.map((p) => (
          <Row key={playerKey(p)} p={p} drafted rank={isAll ? boardRank(p, props.format) : p.posRank} showPos={isAll} />
        ))}
      </ul>
    </section>
  );
}

function Row(props: { p: RankedPlayer; drafted: boolean; rank: number | null; showPos: boolean }) {
  const { p, drafted } = props;
  return (
    <li
      className={`flex items-center gap-2 ${
        drafted ? "text-zinc-600 line-through decoration-zinc-700" : "text-zinc-200"
      }`}
    >
      <span className={`w-7 shrink-0 text-right font-mono text-xs ${drafted ? "text-zinc-700" : "text-zinc-500"}`}>
        {props.rank}
      </span>
      <span className="truncate">{p.name}</span>
      {props.showPos && (
        <span className={`shrink-0 text-[10px] ${drafted ? "text-zinc-700" : "text-zinc-500"}`}>
          {p.pos}
          {p.posRank ?? ""}
        </span>
      )}
      {!drafted && p.tag === "target" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />}
      {!drafted && p.tag === "pass" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />}
      {!drafted && p.tag === "avoid" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
    </li>
  );
}
