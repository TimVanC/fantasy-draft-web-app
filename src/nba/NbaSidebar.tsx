import { useState } from "react";
import { NBA_BOARD } from "./rankings";
import { NBA_POSITIONS, type NbaPlayer, type NbaPos } from "./types";

const TABS = ["ALL", ...NBA_POSITIONS] as const;
const SHOW = 15;

/** Top players overall or by position; drafted ones grey out and sink. */
export default function NbaSidebar(props: {
  available: NbaPlayer[];
  draftedIds: Set<string>;
  openPositions: NbaPos[] | null;
  adpOf: (id: string, fallback: number | null) => number | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("ALL");
  const isAll = tab === "ALL";
  const list = isAll
    ? NBA_BOARD.filter((p) => p.rank !== null).slice(0, SHOW + 5)
    : NBA_BOARD.filter((p) => p.posRank[tab] !== undefined)
        .sort((a, b) => (a.posRank[tab] ?? 999) - (b.posRank[tab] ?? 999))
        .slice(0, SHOW);
  const open = list.filter((p) => !props.draftedIds.has(p.id));
  const gone = list.filter((p) => props.draftedIds.has(p.id));
  const rankOf = (p: NbaPlayer) => (isAll ? p.rank : (p.posRank[tab as NbaPos] ?? null));

  // Value watch: still-available players going well after their finish.
  const value = props.available
    .filter((p) => (p.flag === "severely-underrated" || p.flag === "underrated") && p.rank !== null && p.rank <= 120)
    .slice(0, 8);

  return (
    <>
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">
            {isAll ? "Last-year board" : `Top ${tab}s`}
          </h2>
          <div className="flex overflow-hidden rounded-md border border-zinc-700 text-xs font-semibold">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-1.5 py-1 ${
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
            <Row key={p.id} p={p} drafted={false} rank={rankOf(p)} showPos={isAll} />
          ))}
          {gone.length > 0 && <li className="my-1 border-t border-zinc-800" />}
          {gone.map((p) => (
            <Row key={p.id} p={p} drafted rank={rankOf(p)} showPos={isAll} />
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
        <h2 className="mb-1 text-sm font-black uppercase tracking-wide text-zinc-300">Value watch</h2>
        <p className="mb-2 text-[11px] text-zinc-500">Still available and going well after where they finished.</p>
        {value.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing left that fits.</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {value.map((p) => {
              const adp = props.adpOf(p.id, p.adp);
              return (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="w-7 shrink-0 text-right font-mono text-xs text-zinc-500">{p.rank}</span>
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500">{p.eligible.join("/")}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-emerald-400">
                    ADP {adp?.toFixed(0) ?? "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Row(props: { p: NbaPlayer; drafted: boolean; rank: number | null; showPos: boolean }) {
  const { p, drafted } = props;
  return (
    <li className={`flex items-center gap-2 ${drafted ? "text-zinc-600 line-through decoration-zinc-700" : "text-zinc-200"}`}>
      <span className={`w-7 shrink-0 text-right font-mono text-xs ${drafted ? "text-zinc-700" : "text-zinc-500"}`}>{props.rank}</span>
      <span className="truncate">{p.name}</span>
      {props.showPos && (
        <span className={`shrink-0 text-[10px] ${drafted ? "text-zinc-700" : "text-zinc-500"}`}>{p.eligible.join("/")}</span>
      )}
      {!drafted && p.fppg !== null && (
        <span className="ml-auto shrink-0 font-mono text-xs text-zinc-500">{p.fppg.toFixed(1)}</span>
      )}
      {!drafted && (p.flag === "severely-underrated" || p.flag === "underrated") && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="Going well after his finish" />
      )}
      {!drafted && (p.flag === "severely-overrated" || p.flag === "overrated") && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Going well before his finish" />
      )}
    </li>
  );
}
