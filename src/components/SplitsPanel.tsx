import type { RankedPlayer, ScoringFormat } from "../types";
import { playerKey } from "../lib/normalize";
import { boardRank } from "../lib/rankings";

/**
 * Where the two sources agree hardest (TARGET + VALUE) and where they
 * directly disagree (TARGET + TRAP, AVOID + VALUE). Drafted players sink and
 * grey out.
 */
export default function SplitsPanel(props: {
  players: RankedPlayer[];
  draftedKeys: Set<string>;
  format: ScoringFormat;
}) {
  const byBoard = (a: RankedPlayer, b: RankedPlayer) =>
    (boardRank(a, props.format) ?? 999) - (boardRank(b, props.format) ?? 999);
  const consensus = props.players.filter((p) => p.tag === "target" && p.value).sort(byBoard);
  const splits = props.players
    .filter((p) => (p.tag === "target" && p.trap) || (p.tag === "avoid" && p.value))
    .sort(byBoard);
  if (consensus.length === 0 && splits.length === 0) return null;

  const order = (list: RankedPlayer[]) => [
    ...list.filter((p) => !props.draftedKeys.has(playerKey(p))),
    ...list.filter((p) => props.draftedKeys.has(playerKey(p))),
  ];

  return (
    <section className="rounded-xl border border-violet-900/70 bg-violet-950/20 p-3">
      {consensus.length > 0 && (
        <>
          <h2 className="text-sm font-black uppercase tracking-wide text-emerald-300">
            Both sources in
          </h2>
          <p className="mb-1.5 text-[11px] leading-snug text-zinc-500">
            Joel targets him and the market underprices his production.
          </p>
          <ul className="mb-3 space-y-1 text-sm">
            {order(consensus).map((p) => (
              <Row key={playerKey(p)} p={p} drafted={props.draftedKeys.has(playerKey(p))} format={props.format}>
                <span className="ml-auto shrink-0 rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                  Joel ✓ · sheet ✓
                </span>
              </Row>
            ))}
          </ul>
        </>
      )}
      {splits.length > 0 && (
        <>
          <h2 className="text-sm font-black uppercase tracking-wide text-violet-300">
            Sources disagree
          </h2>
          <p className="mb-1.5 text-[11px] leading-snug text-zinc-500">
            Joel and the cheat sheet point opposite ways — philosophy calls, not data gaps.
          </p>
          <ul className="space-y-1 text-sm">
            {order(splits).map((p) => {
              const joelIn = p.tag === "target";
              return (
                <Row key={playerKey(p)} p={p} drafted={props.draftedKeys.has(playerKey(p))} format={props.format}>
                  <span
                    className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      joelIn ? "bg-emerald-950 text-emerald-300" : "bg-cyan-950 text-cyan-300"
                    }`}
                    title={
                      joelIn
                        ? "Joel targets him; the sheet says his price outruns his production"
                        : "Joel avoids him; the sheet says the market underprices his production"
                    }
                  >
                    {joelIn ? "Joel ✓ · sheet ✗" : "Joel ✗ · sheet ✓"}
                  </span>
                </Row>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function Row(props: {
  p: RankedPlayer;
  drafted: boolean;
  format: ScoringFormat;
  children: React.ReactNode;
}) {
  const { p, drafted } = props;
  return (
    <li className={`flex items-center gap-2 ${drafted ? "text-zinc-600 line-through decoration-zinc-700" : ""}`}>
      <span className="w-7 shrink-0 text-right font-mono text-xs text-zinc-500">
        {boardRank(p, props.format) ?? "—"}
      </span>
      <span className="truncate">{p.name}</span>
      <span className="shrink-0 text-[10px] text-zinc-500">
        {p.pos}
        {p.posRank ?? ""}
      </span>
      {!drafted && props.children}
    </li>
  );
}
