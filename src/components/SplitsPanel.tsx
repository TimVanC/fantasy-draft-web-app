import type { RankedPlayer, ScoringFormat } from "../types";
import { playerKey } from "../lib/normalize";
import { boardRank } from "../lib/rankings";

/** Players where Joel and the cheat sheet directly disagree. */
export default function SplitsPanel(props: {
  players: RankedPlayer[];
  draftedKeys: Set<string>;
  format: ScoringFormat;
}) {
  const splits = props.players
    .filter((p) => (p.tag === "target" && p.trap) || (p.tag === "avoid" && p.value))
    .sort((a, b) => (boardRank(a, props.format) ?? 999) - (boardRank(b, props.format) ?? 999));
  if (splits.length === 0) return null;

  const open = splits.filter((p) => !props.draftedKeys.has(playerKey(p)));
  const gone = splits.filter((p) => props.draftedKeys.has(playerKey(p)));

  return (
    <section className="rounded-xl border border-violet-900/70 bg-violet-950/20 p-3">
      <h2 className="mb-1 text-sm font-black uppercase tracking-wide text-violet-300">
        Sources disagree
      </h2>
      <p className="mb-2 text-[11px] leading-snug text-zinc-500">
        Joel and the cheat sheet point opposite ways — philosophy calls, not data gaps.
      </p>
      <ul className="space-y-1 text-sm">
        {[...open, ...gone].map((p) => {
          const drafted = props.draftedKeys.has(playerKey(p));
          const joelIn = p.tag === "target";
          return (
            <li
              key={playerKey(p)}
              className={`flex items-center gap-2 ${drafted ? "text-zinc-600 line-through decoration-zinc-700" : ""}`}
            >
              <span className="w-7 shrink-0 text-right font-mono text-xs text-zinc-500">
                {boardRank(p, props.format) ?? "—"}
              </span>
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 text-[10px] text-zinc-500">{p.pos}{p.posRank ?? ""}</span>
              {!drafted && (
                <span
                  className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    joelIn
                      ? "bg-emerald-950 text-emerald-300"
                      : "bg-cyan-950 text-cyan-300"
                  }`}
                  title={
                    joelIn
                      ? "Joel targets him; the sheet says his price outruns his production"
                      : "Joel avoids him; the sheet says the market underprices his production"
                  }
                >
                  {joelIn ? "Joel ✓ · sheet ✗" : "Joel ✗ · sheet ✓"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
