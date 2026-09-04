import { useState } from "react";
import { loadRecentDrafts } from "../hooks/useDraft";

export default function SetupScreen(props: {
  connectLive: (input: string) => void;
  startReplay: () => void;
  connecting: boolean;
  error: string | null;
}) {
  const [input, setInput] = useState("");
  const recent = loadRecentDrafts();

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Draft <span className="text-emerald-400">War Room</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Live Sleeper sync, recommendations from Joel Smyth's 2026 draft guide.
          </p>
        </div>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) props.connectLive(input);
          }}
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Sleeper draft URL, draft ID, or league ID
          </label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://sleeper.com/draft/nfl/123456789…"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-emerald-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={props.connecting || !input.trim()}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {props.connecting ? "Connecting…" : "Connect to draft"}
          </button>
        </form>

        {recent.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Recent drafts
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button
                  key={r.draftId}
                  onClick={() => props.connectLive(r.draftId)}
                  disabled={props.connecting}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-emerald-600 hover:text-zinc-100 disabled:opacity-40"
                  title={r.draftId}
                >
                  {r.name} <span className="text-zinc-500">· {r.teams}-team</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {props.error && (
          <div className="rounded-lg border border-red-800 bg-red-950/60 px-3 py-2 text-sm text-red-300">
            {props.error}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-zinc-600">
          <div className="h-px flex-1 bg-zinc-800" />
          or
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        <button
          onClick={props.startReplay}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2.5 text-sm font-semibold text-zinc-300 hover:border-zinc-500"
        >
          ▶ Replay a completed 2025 draft (test mode)
        </button>
        <p className="text-xs leading-relaxed text-zinc-600">
          Replay feeds a saved 180-pick fixture through the app one pick at a time so every
          feature can be exercised without a live draft. Pick your slot, hit play, and watch
          the board update.
        </p>
      </div>
    </div>
  );
}
