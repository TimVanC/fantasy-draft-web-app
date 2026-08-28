"""Convert the half-PPR cheat sheet CSV into data/cheatsheet.json.

Usage: python scripts/build_cheatsheet.py "path/to/Cheat Sheet.csv"

Keeps QB/RB/WR/TE only (K/DST are streamed). The "Rk" columns in the CSV are
positional ranks. The app computes the VALUE tag at runtime from posAdpRank vs
points-per-week ranks.
"""
import csv, io, json, sys

src = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\timmy\Downloads\Cheat Sheet (Preview) 26-27 half ppr(All Stats).csv"
rows = list(csv.reader(io.open(src, encoding="utf-8-sig")))[2:]

def num(s, f=float):
    s = (s or "").strip()
    if not s or s == "#N/A":
        return None
    try:
        return f(s)
    except ValueError:
        return None

out = []
for r in rows:
    if len(r) < 28:
        continue
    name = r[0].strip()
    pos = r[4].strip()
    if not name or name == "#N/A" or pos not in ("QB", "RB", "WR", "TE"):
        continue
    out.append({
        "name": name,
        "team": r[2].strip() or None,
        "age": num(r[1], int),
        "pos": pos,
        "posAdpRank": num(r[5], int),          # current cost as positional rank
        "rank": len(out) + 1,                   # ordinal on the sheet (skill only)
        "adp": r[6].strip() or None,            # round.pick string
        "adpHistory": {"y25": r[7].strip() or None, "y24": r[8].strip() or None, "y23": r[9].strip() or None},
        "ptw": {"y25": num(r[19]), "y24": num(r[20]), "y23": num(r[21])},
        "ptwRank": {"y25": num(r[22], int), "y24": num(r[23], int), "y23": num(r[24], int)},
        "gms": {"y25": num(r[25], int), "y24": num(r[26], int), "y23": num(r[27], int)},
    })

with open("data/cheatsheet.json", "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)

from collections import Counter
print("entries:", len(out), dict(Counter(e["pos"] for e in out)))
# sanity: show a known row to eyeball positional ranks
for e in out:
    if e["name"] in ("Josh Allen", "Dalton Kincaid"):
        print(e["name"], "cost", e["posAdpRank"], "ptwRank", e["ptwRank"], "gms", e["gms"])
