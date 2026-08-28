import type { Advice } from "../lib/advisor";
import { boardRank } from "../lib/rankings";
import type { ScoringFormat } from "../types";

const POS_STYLE: Record<string, string> = {
  QB: "bg-rose-900/60 text-rose-300",
  RB: "bg-sky-900/60 text-sky-300",
  WR: "bg-emerald-900/60 text-emerald-300",
  TE: "bg-orange-900/60 text-orange-300",
};

export default function PickAdvisor(props: {
  advice: Advice;
  myPick: number | null;
  onClock: boolean;
  format: ScoringFormat;
  adpLoaded: boolean;
}) {
  const { advice, myPick } = props;
  if (myPick === null || advice.suggestions.length === 0) return null;

  return (
    <section className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-2.5">
      <div className="mb-1.5 flex items-baseline gap-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-emerald-300">
          {props.onClock ? "Take now" : `Plan for your pick #${myPick}`}
        </h2>
        <span className="text-[11px] text-zinc-500">
          value = his board · survival odds = market ADP
          {!props.adpLoaded && " (ADP feed down — using his ranks for odds)"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        {advice.suggestions.map((s, i) => {
          const rank = boardRank(s.player, props.format);
          return (
            <div
              key={s.player.name}
              className={`rounded-lg border p-2 ${
                i === 0
                  ? "border-emerald-600 bg-emerald-900/30"
                  : "border-zinc-800 bg-zinc-900/60"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-zinc-500">{i + 1}.</span>
                <span className="truncate text-sm font-bold">{s.player.name}</span>
                <span
                  className={`rounded px-1 py-0.5 text-[10px] font-bold ${POS_STYLE[s.player.pos] ?? "bg-zinc-800"}`}
                >
                  {s.player.pos}
                  {s.player.posRank ?? ""}
                </span>
                {s.player.tag === "target" && (
                  <span className="rounded border border-emerald-700 bg-emerald-600/25 px-1 py-0.5 text-[9px] font-bold text-emerald-300">
                    TARGET
                  </span>
                )}
                {s.player.value && (
                  <span className="rounded border border-cyan-700 bg-cyan-600/20 px-1 py-0.5 text-[9px] font-bold text-cyan-300">
                    VALUE
                  </span>
                )}
                {s.player.trap && (
                  <span className="rounded border border-orange-700 bg-orange-600/20 px-1 py-0.5 text-[9px] font-bold text-orange-300">
                    TRAP
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-400">
                <span>
                  {rank !== null
                    ? `#${rank} his board`
                    : `sheet #${s.player.sheet?.rank ?? "?"} (not on his board)`}
                </span>
                <span>{s.adpFormatted ? `mkt ${s.adpFormatted}` : "no mkt ADP"}</span>
              </div>
              {s.reasons.length > 0 && (
                <div className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                  {s.reasons.join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {advice.canWait.length > 0 && (
        <div className="mt-1.5 text-[11px] text-zinc-400">
          <span className="font-bold text-zinc-500">Can wait:</span>{" "}
          {advice.canWait
            .map(
              (s) =>
                `${s.player.name} (${Math.round((s.pSurviveNext ?? 0) * 100)}%)`,
            )
            .join(" · ")}
        </div>
      )}
    </section>
  );
}
