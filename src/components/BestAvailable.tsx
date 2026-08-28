import { useMemo, useState } from "react";
import type { MatchedPick, RankedPlayer, ScoringFormat } from "../types";
import type { Scarcity } from "../lib/scarcity";
import type { Overrides } from "../hooks/useDraft";
import type { MatchIndex } from "../lib/normalize";
import type { AdpMap } from "../lib/adp";
import { conditionalSurvival } from "../lib/advisor";
import { sheetSummary } from "../lib/cheatsheet";
import { playerKey } from "../lib/normalize";
import { boardRank } from "../lib/rankings";

const TAG_STYLE: Record<string, string> = {
  target: "bg-emerald-600/25 text-emerald-300 border-emerald-700",
  pass: "bg-amber-500/20 text-amber-300 border-amber-700",
  avoid: "bg-red-600/25 text-red-300 border-red-800",
};

const POS_STYLE: Record<string, string> = {
  QB: "bg-rose-900/60 text-rose-300",
  RB: "bg-sky-900/60 text-sky-300",
  WR: "bg-emerald-900/60 text-emerald-300",
  TE: "bg-orange-900/60 text-orange-300",
};

const FILTERS = ["ALL", "QB", "RB", "WR", "TE", "FLEX"] as const;

export default function BestAvailable(props: {
  available: RankedPlayer[];
  scarcity: Map<RankedPlayer, Scarcity>;
  format: ScoringFormat;
  overrides: Overrides;
  toggleOverride: (key: string, matchedDrafted: boolean) => void;
  matchIndex: MatchIndex;
  finalTwoRounds: boolean;
  unmatchedPicks: MatchedPick[];
  adpMap: AdpMap;
  myNextPickNo: number | null;
  currentPickNo: number;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [targetsOnly, setTargetsOnly] = useState(false);

  const list = useMemo(() => {
    let l = props.available;
    if (filter === "FLEX") l = l.filter((p) => ["RB", "WR", "TE"].includes(p.pos));
    else if (filter !== "ALL") l = l.filter((p) => p.pos === filter);
    if (targetsOnly) l = l.filter((p) => p.tag === "target");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      l = l.filter((p) => p.name.toLowerCase().includes(q));
    }
    return l;
  }, [props.available, filter, search, targetsOnly]);

  const removedManually = Object.entries(props.overrides).filter(([, v]) => v === "drafted");

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-2">
        <h2 className="px-1 text-sm font-black uppercase tracking-wide text-zinc-300">
          Best available
        </h2>
        <div className="flex overflow-hidden rounded-md border border-zinc-700 text-xs font-semibold">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 ${filter === f ? "bg-zinc-200 text-zinc-900" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => setTargetsOnly((v) => !v)}
          className={`rounded-md border px-2 py-1 text-xs font-semibold ${
            targetsOnly
              ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
              : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          ● targets
        </button>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-36 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-emerald-500"
        />
      </div>

      {props.finalTwoRounds && (
        <div className="border-b border-zinc-800 bg-violet-950/40 px-3 py-1.5 text-xs font-semibold text-violet-300">
          Final two rounds — grab your D/ST and kicker now (streamed weekly, so the guide
          ranks none; draft any and move on).
        </div>
      )}

      {props.unmatchedPicks.length > 0 && (
        <div className="border-b border-zinc-800 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-300">
          <span className="font-bold">
            {props.unmatchedPicks.length} pick{props.unmatchedPicks.length === 1 ? "" : "s"} didn't
            match the guide:
          </span>{" "}
          {props.unmatchedPicks
            .map(
              (m) =>
                `#${m.pick.pick_no} ${m.pick.metadata.first_name} ${m.pick.metadata.last_name} (${m.pick.metadata.position})`,
            )
            .join(", ")}
          <span className="text-amber-500"> — if one is on the board below, ✕ it manually.</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900 text-left text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-10 px-2 py-1.5 text-right">#</th>
              <th className="px-2 py-1.5">Player</th>
              <th className="w-12 px-1 py-1.5">Pos</th>
              <th className="w-16 px-1 py-1.5 text-right" title="2025 adjusted fantasy PPG from the guide">
                adjPPG
              </th>
              <th
                className="w-16 px-1 py-1.5 text-right"
                title="Live market ADP (Fantasy Football Calculator mocks) — comparison only, never affects ordering"
              >
                Mkt ADP
              </th>
              <th
                className="w-24 px-2 py-1.5"
                title="Odds he's still available at your next pick, from market ADP"
              >
                Outlook
              </th>
              <th className="w-8 px-1 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const key = playerKey(p);
              const rank = boardRank(p, props.format);
              const sc = props.scarcity.get(p) ?? null;
              const isExpanded = expanded === key;
              const hasDetail =
                p.notes.length > 0 ||
                p.adjPpgNote !== null ||
                p.ceiling !== null ||
                p.adp !== null ||
                p.sheet !== undefined;
              const adp = props.adpMap.get(key) ?? null;
              const survival =
                adp && props.myNextPickNo !== null
                  ? conditionalSurvival(adp.adp, props.currentPickNo, props.myNextPickNo)
                  : null;
              return (
                <FragmentRow
                  key={key}
                  p={p}
                  rank={rank}
                  sc={sc}
                  adpFormatted={adp?.formatted ?? null}
                  adpDelta={adp && rank !== null ? Math.round(adp.adp - rank) : null}
                  survival={survival}
                  myNextPickNo={props.myNextPickNo}
                  isExpanded={isExpanded}
                  hasDetail={hasDetail}
                  onExpand={() => setExpanded(isExpanded ? null : key)}
                  onRemove={() => props.toggleOverride(key, false)}
                />
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                  No available players match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {removedManually.length > 0 && (
        <div className="border-t border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-500">Manually removed:</span>{" "}
          {removedManually.map(([key]) => {
            const p = props.matchIndex.byKey.get(key);
            return (
              <button
                key={key}
                onClick={() => props.toggleOverride(key, false)}
                title="Restore to board"
                className="mr-1 rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700"
              >
                {p?.name ?? key} ↩
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FragmentRow(props: {
  p: RankedPlayer;
  rank: number | null;
  sc: Scarcity;
  adpFormatted: string | null;
  adpDelta: number | null;
  survival: number | null;
  myNextPickNo: number | null;
  isExpanded: boolean;
  hasDetail: boolean;
  onExpand: () => void;
  onRemove: () => void;
}) {
  const { p } = props;
  return (
    <>
      <tr
        className={`border-t border-zinc-800/60 hover:bg-zinc-800/40 ${props.hasDetail ? "cursor-pointer" : ""}`}
        onClick={props.hasDetail ? props.onExpand : undefined}
      >
        <td className="px-2 py-1.5 text-right font-mono text-zinc-500">
          {props.rank ?? (
            <span
              className="text-zinc-700"
              title="Not on Joel's board — cheat-sheet rank (deep pool)"
            >
              S{p.sheet?.rank ?? "—"}
            </span>
          )}
        </td>
        <td className="px-2 py-1.5">
          <span className="font-semibold">{p.name}</span>
          {p.team && <span className="ml-1.5 text-xs text-zinc-500">{p.team}</span>}
          {p.tag && (
            <span
              className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${TAG_STYLE[p.tag]}`}
            >
              {p.tag === "pass" ? "PASS" : p.tag === "avoid" ? "AVOID" : "TARGET"}
            </span>
          )}
          {p.value && (
            <span
              className="ml-1.5 rounded border border-cyan-700 bg-cyan-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300"
              title={`Cheat sheet: recent pt/wk rank beats his draft cost by ${p.valueGap} positional spots`}
            >
              VALUE
            </span>
          )}
          {p.trap && (
            <span
              className="ml-1.5 rounded border border-orange-700 bg-orange-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-300"
              title={`Cheat sheet: priced ${Math.abs(p.valueGap ?? 0)} positional spots above anything his recent production supports`}
            >
              TRAP
            </span>
          )}
          {((p.tag === "target" && p.trap) || (p.tag === "avoid" && p.value)) && (
            <span
              className="ml-1.5 rounded border border-violet-700 bg-violet-600/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-300"
              title={
                p.tag === "target"
                  ? "Sources disagree: Joel targets him, but the sheet says his price outruns his production"
                  : "Sources disagree: Joel is avoiding him, but the sheet says the market underprices his production"
              }
            >
              SPLIT
            </span>
          )}
          {props.hasDetail && (
            <span className="ml-1.5 text-[10px] text-zinc-600">{props.isExpanded ? "▲" : "▼"}</span>
          )}
        </td>
        <td className="px-1 py-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${POS_STYLE[p.pos] ?? "bg-zinc-800"}`}>
            {p.pos}
            {p.posRank ?? ""}
          </span>
        </td>
        <td className="px-1 py-1.5 text-right font-mono text-zinc-300">
          {p.adjPpg2025 ?? <span className="text-zinc-700">—</span>}
        </td>
        <td className="px-1 py-1.5 text-right font-mono text-xs">
          {props.adpFormatted ? (
            <span
              title={
                props.adpDelta !== null
                  ? `Market ADP minus his rank: ${props.adpDelta > 0 ? "+" : ""}${props.adpDelta} (positive = market sleeps on him)`
                  : undefined
              }
            >
              <span className="text-zinc-400">{props.adpFormatted}</span>
              {props.adpDelta !== null && Math.abs(props.adpDelta) >= 8 && (
                <span
                  className={`ml-1 ${props.adpDelta > 0 ? "text-emerald-400" : "text-amber-400"}`}
                >
                  {props.adpDelta > 0 ? `+${props.adpDelta}` : props.adpDelta}
                </span>
              )}
            </span>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </td>
        <td className="px-2 py-1.5">
          {props.survival !== null && props.myNextPickNo !== null ? (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                props.survival < 0.35
                  ? "bg-red-950 text-red-300"
                  : props.survival < 0.7
                    ? "bg-amber-950 text-amber-300"
                    : "bg-zinc-800 text-zinc-400"
              }`}
              title={`Odds he's still there at your pick #${props.myNextPickNo}, from market ADP`}
            >
              {Math.round(props.survival * 100)}% at #{props.myNextPickNo}
            </span>
          ) : (
            <>
              {props.sc === "likely-gone" && (
                <span className="rounded bg-red-950 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                  LIKELY GONE
                </span>
              )}
              {props.sc === "can-wait" && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                  can wait
                </span>
              )}
            </>
          )}
        </td>
        <td className="px-1 py-1.5 text-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onRemove();
            }}
            title="Mark drafted (manual override — survives sync)"
            className="rounded px-1.5 py-0.5 text-zinc-600 hover:bg-red-950 hover:text-red-300"
          >
            ✕
          </button>
        </td>
      </tr>
      {props.isExpanded && (
        <tr className="border-t border-zinc-800/40 bg-zinc-950/60">
          <td />
          <td colSpan={5} className="px-2 py-2 text-xs leading-relaxed text-zinc-400">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {p.adjPpgNote && (
                <span>
                  <span className="text-zinc-500">adjPPG context:</span> {p.adjPpgNote}
                </span>
              )}
              {p.adp !== null && (
                <span>
                  <span className="text-zinc-500">Guide ADP (Yahoo):</span> {p.adp}
                </span>
              )}
              {p.ceiling !== null && (
                <span>
                  <span className="text-zinc-500">Ceiling:</span> {p.ceiling}/10
                </span>
              )}
              {p.risk !== null && (
                <span>
                  <span className="text-zinc-500">Risk:</span> {p.risk}/10
                </span>
              )}
            </div>
            {p.sheet && (
              <p className="mt-1 border-l-2 border-cyan-800 pl-2 text-cyan-200/70">
                Cheat sheet: {sheetSummary(p.sheet)}
              </p>
            )}
            {p.notes.map((n, i) => (
              <p key={i} className="mt-1 border-l-2 border-zinc-700 pl-2">
                {n}
              </p>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}
