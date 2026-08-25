import type { ScoringFormat, SleeperDraft } from "../types";
import type { Source } from "../hooks/useDraft";

interface Derived {
  teams: number;
  rounds: number;
  nextPickNo: number;
  currentRound: number;
  onClockSlot: number;
  draftDone: boolean;
  othersPicks: number | null;
  myNextPickNo: number | null;
}

export default function HeaderBar(props: {
  draft: SleeperDraft;
  source: Source;
  derived: Derived;
  mySlot: number | null;
  setMySlot: (slot: number | null) => void;
  format: ScoringFormat;
  setFormat: (f: ScoringFormat) => void;
  error: string | null;
  replay: { index: number; playing: boolean; speedMs: number; total: number };
  replayControls: {
    play: () => void;
    pause: () => void;
    step: (n: number) => void;
    reset: () => void;
    setSpeed: (ms: number) => void;
  };
  disconnect: () => void;
}) {
  const { derived: d, draft, mySlot } = props;
  const onTheClock = mySlot !== null && d.othersPicks === 0 && !d.draftDone;
  const status = d.draftDone
    ? "complete"
    : props.source.kind === "replay"
      ? "drafting"
      : draft.status;

  return (
    <header className="border-b border-zinc-800 bg-zinc-900 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-sm font-black tracking-tight">
          DRAFT <span className="text-emerald-400">WAR ROOM</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              status === "complete"
                ? "bg-zinc-500"
                : status === "drafting"
                  ? "bg-emerald-400"
                  : "bg-amber-400"
            }`}
          />
          <span className="capitalize text-zinc-400">{status.replace("_", " ")}</span>
        </div>

        {!d.draftDone ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="font-semibold">
              Rd {d.currentRound}
              <span className="text-zinc-500"> / {d.rounds}</span>
            </span>
            <span className="font-semibold">Pick #{d.nextPickNo}</span>
            <span className="text-zinc-400">Slot {d.onClockSlot} on the clock</span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-zinc-400">Draft complete</span>
        )}

        {mySlot !== null && !d.draftDone && (
          <div
            className={`rounded-md px-2.5 py-1 text-sm font-bold ${
              onTheClock
                ? "animate-pulse bg-red-600 text-white"
                : "bg-zinc-800 text-zinc-200"
            }`}
          >
            {onTheClock
              ? "YOU'RE ON THE CLOCK"
              : d.othersPicks === null
                ? "No picks left"
                : `${d.othersPicks} pick${d.othersPicks === 1 ? "" : "s"} until you (#${d.myNextPickNo})`}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-zinc-500">My slot</label>
          <select
            value={mySlot ?? ""}
            onChange={(e) => props.setMySlot(e.target.value ? Number(e.target.value) : null)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
          >
            <option value="">—</option>
            {Array.from({ length: d.teams }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-md border border-zinc-700 text-xs font-bold">
            {(["ppr", "half"] as const).map((f) => (
              <button
                key={f}
                onClick={() => props.setFormat(f)}
                className={`px-2.5 py-1.5 ${
                  props.format === f ? "bg-emerald-600 text-white" : "bg-zinc-900 text-zinc-400"
                }`}
              >
                {f === "ppr" ? "PPR" : "½ PPR"}
              </button>
            ))}
          </div>

          <button
            onClick={props.disconnect}
            className="rounded-md border border-zinc-700 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Exit
          </button>
        </div>
      </div>

      {props.source.kind === "replay" && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-indigo-900 bg-indigo-950/50 px-2 py-1.5 text-xs">
          <span className="font-bold text-indigo-300">REPLAY</span>
          <span className="text-zinc-400">
            {props.replay.index}/{props.replay.total} picks
          </span>
          <button onClick={() => props.replayControls.step(-1)} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">−1</button>
          {props.replay.playing ? (
            <button onClick={props.replayControls.pause} className="rounded bg-indigo-700 px-2 py-1 font-bold hover:bg-indigo-600">⏸ Pause</button>
          ) : (
            <button onClick={props.replayControls.play} className="rounded bg-indigo-700 px-2 py-1 font-bold hover:bg-indigo-600">▶ Play</button>
          )}
          <button onClick={() => props.replayControls.step(1)} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">+1</button>
          <button onClick={() => props.replayControls.step(10)} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">+10</button>
          <button onClick={props.replayControls.reset} className="rounded bg-zinc-800 px-2 py-1 hover:bg-zinc-700">Reset</button>
          <select
            value={props.replay.speedMs}
            onChange={(e) => props.replayControls.setSpeed(Number(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
          >
            <option value={3000}>slow</option>
            <option value={1500}>normal</option>
            <option value={500}>fast</option>
            <option value={150}>blitz</option>
          </select>
        </div>
      )}

      {props.error && (
        <div className="mt-2 rounded-md border border-amber-800 bg-amber-950/60 px-2 py-1 text-xs text-amber-300">
          {props.error} — picks may be stale; manual override (✕ on a row) keeps the board usable.
        </div>
      )}
    </header>
  );
}
