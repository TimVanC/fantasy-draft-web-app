import { useState } from "react";
import { STRATEGY } from "../lib/rankings";

/** What position a plan label expects, if it names one. */
function plannedPos(plan: string): string | null {
  const skill = plan.match(/\b(QB|RB|WR|TE)\b/)?.[1];
  if (skill) return skill;
  if (/D\/ST/i.test(plan)) return "DEF";
  if (/Kicker/i.test(plan)) return "K";
  return null; // BPA, handcuff, sleeper — anything goes
}

export default function StrategyPanel(props: {
  currentRound: number;
  rounds: number;
  myRoundsPicked: Set<number>;
  /** Position I actually drafted in each round. */
  myPosByRound: Map<number, string>;
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
          const actual = props.myPosByRound.get(round) ?? null;
          const expected = plannedPos(label);
          const offScript = actual !== null && expected !== null && actual !== expected;
          return (
            <li
              key={round}
              className={`flex items-center gap-1.5 rounded px-1 py-0.5 ${
                current ? "bg-emerald-950/60 font-semibold text-emerald-300" : ""
              } ${done ? "text-zinc-600 line-through" : "text-zinc-300"}`}
            >
              <span className="w-8 shrink-0 font-mono text-xs text-zinc-500">R{round}</span>
              <span className="truncate">{label}</span>
              {actual && (
                <span
                  className={`ml-auto shrink-0 rounded px-1 py-0.5 font-mono text-[10px] font-bold no-underline ${
                    offScript
                      ? "bg-orange-600/25 text-orange-300"
                      : "bg-emerald-950 text-emerald-400"
                  }`}
                  title={
                    offScript
                      ? `Plan said ${expected}, you drafted ${actual}`
                      : `You drafted ${actual}${expected ? " — on script" : ""}`
                  }
                >
                  {actual}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-zinc-600">{STRATEGY.note}</p>
    </section>
  );
}
