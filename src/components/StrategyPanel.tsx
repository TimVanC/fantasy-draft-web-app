import { useState } from "react";
import { STRATEGY } from "../lib/rankings";

export default function StrategyPanel(props: {
  currentRound: number;
  rounds: number;
  myRoundsPicked: Set<number>;
  draftDone: boolean;
}) {
  const [showRules, setShowRules] = useState(false);
  const plan = STRATEGY.roundPlan.filter((r) => r.round <= props.rounds);

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide text-zinc-300">Round plan</h2>
        <button
          onClick={() => setShowRules((v) => !v)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          {showRules ? "hide rules" : "his rules"}
        </button>
      </div>

      {showRules && (
        <ol className="mb-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-zinc-400">
          {STRATEGY.rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      )}

      <ul className="grid grid-cols-1 gap-x-3 gap-y-0.5 text-sm sm:grid-cols-2">
        {plan.map(({ round, plan: label }) => {
          const done = props.myRoundsPicked.has(round) || (!props.draftDone && round < props.currentRound);
          const current = !props.draftDone && round === props.currentRound;
          return (
            <li
              key={round}
              className={`flex items-center gap-1.5 rounded px-1 py-0.5 ${
                current ? "bg-emerald-950/60 font-semibold text-emerald-300" : ""
              } ${done ? "text-zinc-600 line-through" : "text-zinc-300"}`}
            >
              <span className="w-8 shrink-0 font-mono text-xs text-zinc-500">R{round}</span>
              {label}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-zinc-600">{STRATEGY.note}</p>
    </section>
  );
}
