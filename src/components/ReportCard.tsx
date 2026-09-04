import type { Report } from "../lib/report";
import { formatPick } from "../lib/snake";

export default function ReportCard(props: { report: Report; teams: number }) {
  const { report } = props;
  const delta = report.avgDelta;
  return (
    <section className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-emerald-300">
        Draft report card
      </h2>
      <p className="mb-2 text-[11px] text-zinc-500">
        How your picks line up against Joel's board and plan. No new opinions — just the tally.
      </p>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="His targets" value={report.targets} tone="emerald" />
        <Stat label="Sheet values" value={report.values} tone="cyan" />
        <Stat label="His avoids" value={report.avoids} tone={report.avoids ? "red" : "zinc"} />
        <Stat label="Sheet traps" value={report.traps} tone={report.traps ? "orange" : "zinc"} />
        <Stat
          label="Avg board delta"
          value={delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
          tone={delta !== null && delta > 0 ? "emerald" : "zinc"}
          hint="Picks later than his rank = value (positive)"
        />
        <Stat
          label="On his script"
          value={`${report.onScriptRounds}/${report.scriptedRounds}`}
          tone="zinc"
          hint="Rounds where you took the position his plan named"
        />
        <Stat
          label="Positions"
          value={Object.entries(report.posCounts)
            .map(([pos, n]) => `${n} ${pos}`)
            .join(" · ")}
          tone="zinc"
        />
        <Stat label="Splits taken" value={report.splits} tone="violet" hint="Joel and the sheet disagreed" />
      </div>

      <ul className="mt-3 space-y-0.5 text-xs">
        {report.picks.map(({ pick, player, boardDelta }) => (
          <li key={pick.pick_no} className="flex items-center gap-2">
            <span className="w-10 shrink-0 font-mono text-zinc-500">
              {formatPick(pick.pick_no, props.teams)}
            </span>
            <span className="truncate">
              {pick.metadata.first_name} {pick.metadata.last_name}
              <span className="ml-1 text-zinc-500">{pick.metadata.position}</span>
            </span>
            {player?.tag === "target" && <Chip tone="emerald">TARGET</Chip>}
            {player?.value && <Chip tone="cyan">VALUE</Chip>}
            {player?.tag === "avoid" && <Chip tone="red">AVOID</Chip>}
            {player?.trap && <Chip tone="orange">TRAP</Chip>}
            <span
              className={`ml-auto shrink-0 font-mono ${
                boardDelta === null ? "text-zinc-700" : boardDelta > 0 ? "text-emerald-400" : "text-zinc-500"
              }`}
              title="Pick number minus his board rank"
            >
              {boardDelta === null ? "—" : `${boardDelta > 0 ? "+" : ""}${boardDelta}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TONES: Record<string, string> = {
  emerald: "text-emerald-300",
  cyan: "text-cyan-300",
  red: "text-red-300",
  orange: "text-orange-300",
  violet: "text-violet-300",
  zinc: "text-zinc-200",
};

function Stat(props: { label: string; value: string | number; tone: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1.5" title={props.hint}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{props.label}</div>
      <div className={`text-sm font-bold ${TONES[props.tone]}`}>{props.value}</div>
    </div>
  );
}

function Chip(props: { tone: string; children: string }) {
  const bg: Record<string, string> = {
    emerald: "bg-emerald-600/25 text-emerald-300",
    cyan: "bg-cyan-600/20 text-cyan-300",
    red: "bg-red-600/25 text-red-300",
    orange: "bg-orange-600/20 text-orange-300",
  };
  return <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${bg[props.tone]}`}>{props.children}</span>;
}
