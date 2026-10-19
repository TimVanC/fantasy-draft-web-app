import { useMemo, useState } from "react";
import type { Overrides } from "../hooks/useDraft";
import type { LiveEntry } from "./adp";
import { formatPick } from "../lib/snake";
import { NBA_FILE, NBA_INDEX, bestPosRank, flagLabel } from "./rankings";
import { nbaSurvival, type Scarcity } from "./scarcity";
import { NBA_POSITIONS, type NbaPlayer, type NbaPos } from "./types";

const POS_STYLE: Record<string, string> = {
  PG: "bg-sky-900/60 text-sky-300",
  SG: "bg-cyan-900/60 text-cyan-300",
  SF: "bg-emerald-900/60 text-emerald-300",
  PF: "bg-lime-900/60 text-lime-300",
  C: "bg-orange-900/60 text-orange-300",
};

const FLAG_STYLE = {
  good: "border-emerald-700 bg-emerald-600/20 text-emerald-300",
  bad: "border-amber-700 bg-amber-600/20 text-amber-300",
  warn: "border-zinc-700 bg-zinc-800 text-zinc-400",
};

const FILTERS = ["ALL", ...NBA_POSITIONS, "NEED", "VALUE"] as const;
type Filter = (typeof FILTERS)[number];

const STAT_LABELS: [string, string][] = [
  ["pts", "pts"],
  ["oreb", "oreb"],
  ["dreb", "dreb"],
  ["ast", "ast"],
  ["stl", "stl"],
  ["blk", "blk"],
  ["tpm", "3pm"],
  ["to", "to"],
  ["ftmi", "ft miss"],
  ["dd", "dd"],
  ["td", "td"],
];

export default function NbaBoard(props: {
  available: NbaPlayer[];
  scarcity: Map<string, Scarcity>;
  overrides: Overrides;
  toggleOverride: (key: string, matchedDrafted: boolean) => void;
  starred: Set<string>;
  toggleStar: (key: string) => void;
  adpOf: (id: string, fallback: number | null) => number | null;
  liveOf: (id: string) => LiveEntry | null;
  liveAdp: boolean;
  myNextPickNo: number | null;
  /** My pick after next: while I'm on the clock the question is whether a
   *  player makes it back to me, so odds are shown against this pick. */
  followingPickNo: number | null;
  onClock: boolean;
  currentPickNo: number;
  teams: number;
  /** Positions with an open starting slot on my roster; null until a slot is picked. */
  openPositions: NbaPos[] | null;
  draftDone: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewMyPick, setPreviewMyPick] = useState(false);
  // The pick the outlook column is about.
  const targetPick = props.onClock ? props.followingPickNo : props.myNextPickNo;

  const list = useMemo(() => {
    let l = props.available;
    if (filter === "NEED" && props.openPositions) {
      const open = props.openPositions;
      l = l.filter((p) => p.eligible.some((pos) => open.includes(pos)));
    } else if (filter === "VALUE") {
      l = l.filter((p) => p.flag === "underrated" || p.flag === "severely-underrated");
    } else if (filter !== "ALL" && filter !== "NEED") {
      l = l.filter((p) => p.eligible.includes(filter));
    }
    if (previewMyPick && targetPick !== null) {
      l = l.filter((p) => {
        const s = nbaSurvival(props.adpOf(p.id, p.adp), props.currentPickNo, targetPick);
        return s === null || s >= 0.5;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      l = l.filter((p) => p.name.toLowerCase().includes(q) || (p.team ?? "").toLowerCase() === q);
    }
    return l;
  }, [props.available, filter, search, previewMyPick, props.openPositions, props.adpOf, props.currentPickNo, targetPick]);

  const removedManually = Object.entries(props.overrides).filter(([, v]) => v === "drafted");

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-2">
        <h2 className="px-1 text-sm font-black uppercase tracking-wide text-zinc-300">Best available</h2>
        <div className="flex overflow-hidden rounded-md border border-zinc-700 text-xs font-semibold">
          {FILTERS.map((f) => {
            const disabled = f === "NEED" && !props.openPositions;
            return (
              <button
                key={f}
                disabled={disabled}
                title={
                  f === "NEED"
                    ? props.openPositions
                      ? `Eligible for an open starting slot (${props.openPositions.join("/") || "none"})`
                      : "Pick your draft slot to see who fills an open starter"
                    : f === "VALUE"
                      ? "Going well after where he finished last season"
                      : undefined
                }
                onClick={() => setFilter(f)}
                className={`px-2 py-1 disabled:opacity-40 ${
                  filter === f ? "bg-zinc-200 text-zinc-900" : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
        {targetPick !== null && (
          <button
            onClick={() => setPreviewMyPick((v) => !v)}
            title={`Preview the likely board at your ${props.onClock ? "following" : "next"} pick: hides players under 50% to still be there`}
            className={`rounded-md border px-2 py-1 text-xs font-semibold ${
              previewMyPick ? "border-sky-600 bg-sky-600/20 text-sky-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            @ {props.onClock ? "my next" : "my pick"} {formatPick(targetPick, props.teams)}
          </button>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or team…"
          className="ml-auto w-40 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs outline-none focus:border-emerald-500"
        />
      </div>

      <div className="border-b border-zinc-800 px-3 py-1 text-[11px] text-zinc-500">
        Ranked by {NBA_FILE.statsSeason} per-game production under this league's scoring (min {NBA_FILE.minGp} GP).
        ADP is Sleeper's{props.liveAdp ? ", live" : " snapshot"}; it never changes the order. VALUE / REACH compare the two.
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-900 text-left text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-10 px-2 py-1.5 text-right" title="Finish last season by per-game production">#</th>
              <th className="px-2 py-1.5">Player</th>
              <th className="w-28 px-1 py-1.5" title="Best position rank among your open slots, then every eligible slot">Pos</th>
              <th className="w-14 px-1 py-1.5 text-right" title="Fantasy points per game last season, this league's scoring">FPPG</th>
              <th className="hidden w-10 px-1 py-1.5 text-right md:table-cell" title="Games played last season">GP</th>
              <th className="hidden w-20 px-1 py-1.5 text-right md:table-cell" title="Sleeper ADP; green +N = going N picks after his finish">ADP</th>
              <th className="w-28 px-2 py-1.5" title={props.onClock ? "You're up — odds he's still there at your pick after this one" : "Odds he's still there at your next pick, from Sleeper ADP"}>
                {props.onClock ? "Back to you?" : "Outlook"}
              </th>
              <th className="w-8 px-1 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <Row
                key={p.id}
                p={p}
                adp={props.adpOf(p.id, p.adp)}
                live={props.liveOf(p.id)}
                sc={props.scarcity.get(p.id) ?? null}
                survival={nbaSurvival(props.adpOf(p.id, p.adp), props.currentPickNo, targetPick)}
                myNextPickNo={targetPick}
                teams={props.teams}
                openPositions={props.openPositions}
                starred={props.starred.has(p.id)}
                onStar={() => props.toggleStar(p.id)}
                isExpanded={expanded === p.id}
                onExpand={() => setExpanded(expanded === p.id ? null : p.id)}
                onRemove={() => props.toggleOverride(p.id, false)}
              />
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
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
          {removedManually.map(([id]) => (
            <button
              key={id}
              onClick={() => props.toggleOverride(id, false)}
              title="Restore to board"
              className="mr-1 rounded bg-zinc-800 px-1.5 py-0.5 hover:bg-zinc-700"
            >
              {NBA_INDEX.byId.get(id)?.name ?? id} ↩
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function Row(props: {
  p: NbaPlayer;
  adp: number | null;
  live: LiveEntry | null;
  sc: Scarcity;
  survival: number | null;
  myNextPickNo: number | null;
  teams: number;
  openPositions: NbaPos[] | null;
  starred: boolean;
  onStar: () => void;
  isExpanded: boolean;
  onExpand: () => void;
  onRemove: () => void;
}) {
  const { p } = props;
  const flag = flagLabel(p);
  // Position rank shown for the slot I can actually use him in, else his best.
  const needRank = props.openPositions ? bestPosRank(p, props.openPositions) : null;
  const shown = needRank ?? bestPosRank(p);
  const fillsNeed = needRank !== null;
  const adpDelta = props.adp !== null && p.rank !== null ? Math.round(props.adp - p.rank) : null;
  // Live status wins over the snapshot; DTD is background noise in the NBA.
  const status = props.live ? props.live.injury : p.injury;
  const injury = status && status !== "DTD" ? status : null;
  const team = props.live ? props.live.team : p.team;

  return (
    <>
      <tr className="cursor-pointer border-t border-zinc-800/60 hover:bg-zinc-800/40" onClick={props.onExpand}>
        <td className="px-2 py-1.5 text-right font-mono text-zinc-500">
          {p.rank ?? <span className="text-zinc-700" title="No rank: not enough games last season">—</span>}
        </td>
        <td className="px-2 py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onStar();
            }}
            title={props.starred ? "On your watchlist (click to remove)" : "Add to your watchlist"}
            className={`mr-1 text-xs ${props.starred ? "text-amber-300" : "text-zinc-700 hover:text-zinc-400"}`}
          >
            {props.starred ? "★" : "☆"}
          </button>
          <span className="font-semibold whitespace-nowrap">{p.name}</span>
          {team && <span className="ml-1.5 text-xs text-zinc-500">{team}</span>}
          {!team && <span className="ml-1.5 rounded bg-red-600/30 px-1.5 py-0.5 text-[10px] font-bold text-red-300">FA</span>}
          {injury && (
            <span className="ml-1.5 rounded bg-red-600/30 px-1.5 py-0.5 text-[10px] font-bold text-red-300" title={props.live ? "Sleeper injury status, live" : "Sleeper injury status at build time"}>
              {injury}
            </span>
          )}
          {flag && (
            <span
              className={`ml-2 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${FLAG_STYLE[flag.tone]}`}
              title={
                adpDelta !== null
                  ? `Finished ${p.rank}, going ${props.adp?.toFixed(1)} (${adpDelta > 0 ? "+" : ""}${adpDelta})`
                  : p.flag === "small-sample"
                    ? `Only ${p.gp} games last season — per-game numbers are real but the sample is thin`
                    : "No usable last-season line"
              }
            >
              {flag.text}
            </span>
          )}
          <span className="ml-1.5 text-[10px] text-zinc-600">{props.isExpanded ? "▲" : "▼"}</span>
        </td>
        <td className="px-1 py-1.5 whitespace-nowrap">
          {shown ? (
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${POS_STYLE[shown.pos]} ${fillsNeed ? "" : "opacity-60"}`}
              title={
                Object.entries(p.posRank)
                  .map(([k, v]) => `${k}${v}`)
                  .join(" · ") + (fillsNeed ? " — fills an open starter" : props.openPositions ? " — bench only right now" : "")
              }
            >
              {shown.pos}
              {shown.rank}
            </span>
          ) : (
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${POS_STYLE[p.eligible[0] ?? ""] ?? "bg-zinc-800"}`}>
              {p.eligible[0] ?? p.pos}
            </span>
          )}
          {p.eligible.length > 1 && (
            <span className="ml-1 text-[10px] text-zinc-500">{p.eligible.join("/")}</span>
          )}
        </td>
        <td className="px-1 py-1.5 text-right font-mono text-zinc-200">
          {p.fppg !== null ? p.fppg.toFixed(1) : <span className="text-zinc-700">—</span>}
        </td>
        <td className={`hidden px-1 py-1.5 text-right font-mono text-xs md:table-cell ${p.gp < 50 ? "text-amber-400" : "text-zinc-400"}`}>
          {p.gp || <span className="text-zinc-700">—</span>}
        </td>
        <td className="hidden px-1 py-1.5 text-right font-mono text-xs md:table-cell">
          {props.adp !== null ? (
            <span title={adpDelta !== null ? `ADP minus finish: ${adpDelta > 0 ? "+" : ""}${adpDelta} (positive = market sleeps on him)` : undefined}>
              <span className="text-zinc-400">{props.adp.toFixed(1)}</span>
              {adpDelta !== null && Math.abs(adpDelta) >= 10 && (
                <span className={`ml-1 ${adpDelta > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {adpDelta > 0 ? `+${adpDelta}` : adpDelta}
                </span>
              )}
            </span>
          ) : (
            <span className="text-zinc-700">—</span>
          )}
        </td>
        <td className="px-2 py-1.5 whitespace-nowrap">
          {props.survival !== null && props.myNextPickNo !== null ? (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                props.survival < 0.35 ? "bg-red-950 text-red-300" : props.survival < 0.7 ? "bg-amber-950 text-amber-300" : "bg-zinc-800 text-zinc-400"
              }`}
              title={`Odds he's still there at your pick ${formatPick(props.myNextPickNo, props.teams)}, from Sleeper ADP`}
            >
              {Math.round(props.survival * 100)}% at {formatPick(props.myNextPickNo, props.teams)}
            </span>
          ) : (
            <>
              {props.sc === "likely-gone" && (
                <span className="rounded bg-red-950 px-1.5 py-0.5 text-[10px] font-bold text-red-300">LIKELY GONE</span>
              )}
              {props.sc === "can-wait" && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">can wait</span>
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
          <td colSpan={7} className="px-2 py-2 text-xs leading-relaxed text-zinc-400">
            <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
              {STAT_LABELS.filter(([k]) => p.stats[k] !== undefined).map(([k, label]) => (
                <span key={k}>
                  <span className="text-zinc-500">{label}</span> {p.stats[k].toFixed(k === "dd" || k === "td" ? 2 : 1)}
                </span>
              ))}
              {p.gp > 0 && (
                <span>
                  <span className="text-zinc-500">total</span> {p.total?.toFixed(0)}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <span className="text-zinc-500">Position ranks:</span>{" "}
                {Object.entries(p.posRank).length
                  ? Object.entries(p.posRank)
                      .map(([k, v]) => `${k}${v}`)
                      .join(" · ")
                  : "—"}
              </span>
              {adpDelta !== null && p.rank !== null && (
                <span>
                  <span className="text-zinc-500">Finish vs ADP:</span> #{p.rank} vs {props.adp?.toFixed(1)}{" "}
                  <span className={adpDelta > 0 ? "text-emerald-400" : adpDelta < 0 ? "text-amber-400" : ""}>
                    ({adpDelta > 0 ? "+" : ""}
                    {adpDelta})
                  </span>
                </span>
              )}
              {p.yearsExp !== null && (
                <span>
                  <span className="text-zinc-500">Exp:</span> {p.yearsExp === 0 ? "rookie" : `${p.yearsExp} yr`}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
