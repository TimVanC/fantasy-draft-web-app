"""Build data/nba-rankings.json from Sleeper's public NBA endpoints.

Usage:
    python scripts/build_nba_rankings.py <league_id> [--season 2025] [--top 200] [--min-gp 25]

Ranking basis: last season's per-game production rescored under the league's own
scoring_settings. No consensus rankings, no projections. Sleeper's ADP is attached
only so the gap between ADP and last-year finish can be flagged.

Everything needed to rescore is kept in the output (per-game raw categories plus the
scoring weights), so the UI can recompute if the scoring changes.
"""
import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

POSITIONS = ["PG", "SG", "SF", "PF", "C"]
STATS_URL = (
    "https://api.sleeper.com/stats/nba/{season}?season_type=regular"
    "&position[]=PG&position[]=SG&position[]=SF&position[]=PF&position[]=C&order_by=pts_std"
)
PROJ_URL = (
    "https://api.sleeper.com/projections/nba/{season}?season_type=regular"
    "&position[]=PG&position[]=SG&position[]=SF&position[]=PF&position[]=C&order_by=adp_std"
)
LEAGUE_URL = "https://api.sleeper.app/v1/league/{league_id}"


def get(url):
    # api.sleeper.com returns 403 to Python's default user agent
    req = urllib.request.Request(url, headers={"User-Agent": "draft-war-room/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def gap_flag(rank, adp, gp, min_gp):
    """Compare ADP (where he is being drafted) to rank (where he finished).

    Returns (flag, delta). delta is adp - rank: positive means he is going later
    than he finished (underrated), negative means earlier (overrated).
    Both an absolute and a ratio threshold are used so the flag means the same
    thing at pick 10 and pick 120.
    """
    if adp is None:
        return ("no-adp", None)
    if rank is None:
        return ("small-sample" if gp and gp < min_gp else "no-data", None)
    delta = round(adp - rank, 1)
    if adp >= rank * 2 and delta >= 15:
        return ("severely-underrated", delta)
    if adp >= rank * 1.5 and delta >= 10:
        return ("underrated", delta)
    if rank >= adp * 2 and -delta >= 15:
        return ("severely-overrated", delta)
    if rank >= adp * 1.5 and -delta >= 10:
        return ("overrated", delta)
    return ("fair", delta)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("league_id")
    ap.add_argument("--season", type=int, default=2025, help="stats season (2025 = the 2025-26 season)")
    ap.add_argument("--top", type=int, default=200)
    ap.add_argument("--min-gp", type=int, default=25, help="games needed to earn a rank")
    ap.add_argument("--out", default="data/nba-rankings.json")
    args = ap.parse_args()

    league = get(LEAGUE_URL.format(league_id=args.league_id))
    scoring = {k: v for k, v in league["scoring_settings"].items() if v}
    stats = get(STATS_URL.format(season=args.season))
    proj = get(PROJ_URL.format(season=args.season + 1))

    adp = {}
    proj_player = {}
    for row in proj:
        s = row.get("stats") or {}
        if s.get("adp_std") is not None:
            adp[row["player_id"]] = s["adp_std"]
        proj_player[row["player_id"]] = row["player"]

    players = {}
    for row in stats:
        s = row.get("stats") or {}
        gp = s.get("gp") or 0
        if not gp:
            continue
        per_game = {k: round(v / gp, 3) for k, v in s.items() if k in scoring}
        fppg = sum(scoring[k] * v for k, v in per_game.items())
        pl = proj_player.get(row["player_id"], row["player"])  # projections carry the current team
        players[row["player_id"]] = {
            "id": row["player_id"],
            "name": f"{pl['first_name']} {pl['last_name']}",
            "pos": pl.get("position"),
            "eligible": sorted(pl.get("fantasy_positions") or [], key=POSITIONS.index),
            "team": pl.get("team"),
            "gp": int(gp),
            "fppg": round(fppg, 1),
            "total": round(fppg * gp, 1),
            "stats": per_game,
            "adp": adp.get(row["player_id"]),
            "injury": pl.get("injury_status"),
            "yearsExp": pl.get("years_exp"),
        }

    # ADP-relevant players with no stat line last season (rookies, missed the year)
    for pid, a in adp.items():
        if pid in players or a > args.top:
            continue
        pl = proj_player[pid]
        players[pid] = {
            "id": pid,
            "name": f"{pl['first_name']} {pl['last_name']}",
            "pos": pl.get("position"),
            "eligible": sorted(pl.get("fantasy_positions") or [], key=POSITIONS.index),
            "team": pl.get("team"),
            "gp": 0,
            "fppg": None,
            "total": None,
            "stats": {},
            "adp": a,
            "injury": pl.get("injury_status"),
            "yearsExp": pl.get("years_exp"),
        }

    qualifiers = sorted(
        (p for p in players.values() if p["gp"] >= args.min_gp), key=lambda p: -p["fppg"]
    )
    for i, p in enumerate(qualifiers, 1):
        p["rank"] = i
    for p in players.values():
        p.setdefault("rank", None)

    # position rank at every eligible slot, among qualifiers
    for pos in POSITIONS:
        n = 0
        for p in qualifiers:
            if pos in p["eligible"]:
                n += 1
                p.setdefault("posRank", {})[pos] = n
    for p in players.values():
        p.setdefault("posRank", {})

    for p in players.values():
        p["flag"], p["adpDelta"] = gap_flag(p["rank"], p["adp"], p["gp"], args.min_gp)

    keep = [p for p in players.values() if (p["rank"] and p["rank"] <= args.top) or (p["adp"] and p["adp"] <= args.top)]
    keep.sort(key=lambda p: (p["rank"] is None, p["rank"] or 0, p["adp"] or 999))

    out = {
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "leagueId": args.league_id,
        "leagueName": league.get("name"),
        "statsSeason": f"{args.season}-{str(args.season + 1)[2:]}",
        "adpSeason": str(args.season + 1),
        "minGp": args.min_gp,
        "scoring": scoring,
        "rosterPositions": league.get("roster_positions"),
        "players": keep,
    }
    Path(args.out).write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {len(keep)} players to {args.out} ({len(qualifiers)} qualifiers with gp >= {args.min_gp})", file=sys.stderr)


if __name__ == "__main__":
    main()
