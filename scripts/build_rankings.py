"""Merge all extracted guide data into data/rankings.json."""
import json, re, unicodedata, os

E = "scripts/extracted"
board_ppr = json.load(open(f"{E}/board_ppr.json"))
board_half = json.load(open(f"{E}/board_half.json"))
pos_ppr = json.load(open(f"{E}/positional_ppr.json"))
pos_half = json.load(open(f"{E}/positional_half.json"))
adj = json.load(open(f"{E}/adj_ppg.json"))
top50 = json.load(open(f"{E}/top50.json"))

SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

def norm(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z ]", "", s.lower().replace("-", " ").replace("'", ""))
    parts = [p for p in s.split() if p not in SUFFIXES]
    return " ".join(parts)

def lastname(name):
    p = norm(name).split()
    return p[-1] if p else ""

# ---- build universe keyed by (pos, normalized name) ----
players = {}   # key -> record
def get(pos, name):
    key = (pos, norm(name))
    if key not in players:
        players[key] = {"name": name, "pos": pos, "team": None, "pprRank": None,
                        "halfRank": None, "posRank": None, "tag": None, "adp": None,
                        "adjPpg2025": None, "adjPpgNote": None, "projPpg2026": None,
                        "ceiling": None, "risk": None, "notes": []}
    return players[key]

def find(pos, name):
    """Fuzzy find within a position: exact norm -> last+first-initial -> unique last name."""
    n = norm(name)
    key = (pos, n)
    if key in players:
        return players[key]
    ln = lastname(name)
    fi = n[0] if n else ""
    cands = [p for (pp, nn), p in players.items() if pp == pos and nn.split()[-1] == ln]
    if len(cands) == 1:
        return cands[0]
    cands2 = [p for p in cands if norm(p["name"])[0] == fi]
    if len(cands2) == 1:
        return cands2[0]
    return None

def find_any(name):
    """Find across all positions (for luck metric / stats)."""
    n = norm(name)
    exact = [p for (pp, nn), p in players.items() if nn == n]
    if len(exact) == 1:
        return exact[0]
    ln = lastname(name)
    cands = [p for (pp, nn), p in players.items() if nn.split()[-1] == ln]
    if len(cands) == 1:
        return cands[0]
    # first-initial disambiguation ("R. Stevenson")
    fi = n[0] if n else ""
    cands2 = [p for p in cands if norm(p["name"])[0] == fi]
    if len(cands2) == 1:
        return cands2[0]
    return None

# 1. boards define the universe + display names
for p in board_ppr:
    r = get(p["pos"], p["name"])
    r["pprRank"] = p["rank"]
    if p["tag"]:
        r["tag"] = r["tag"] or p["tag"]
for p in board_half:
    key = (p["pos"], norm(p["name"]))
    r = players.get(key) or get(p["pos"], p["name"])
    r["halfRank"] = p["rank"]
    if p["tag"]:
        r["tag"] = r["tag"] or p["tag"]

# 2. positional rankings: posRank (PPR) + authoritative tag.
# Positional pages use full names from the same source as the boards, so match
# exact-normalized only; a miss means a genuinely new player, never a variant.
for pos, rows in pos_ppr.items():
    for row in rows:
        r = get(pos, row["name"])
        r["posRank"] = row["posRank"]
        if row["tag"]:
            r["tag"] = row["tag"]   # positional page is the conviction signal - it wins
for pos, rows in pos_half.items():
    for row in rows:
        r = get(pos, row["name"])
        if row["tag"] and not r["tag"]:
            r["tag"] = row["tag"]

# 3. adjusted PPG
for pos, rows in adj.items():
    for row in rows:
        r = find(pos, row["name"])
        if r is None:
            r = get(pos, row["name"])
        r["adjPpg2025"] = row["adjPpg"]
        if row["note"]:
            r["adjPpgNote"] = row["note"]

# 4. player profiles (transcribed from p23-26 raster images)
PROFILES = [
    ("Trevor Lawrence", "QB", "JAX", 87.0, 20.48, 16.34, 9, 3, "QB9"),
    ("Lamar Jackson", "QB", "BAL", 33.7, 16.91, 17.23, 10, 7, "QB2"),
    ("Kyler Murray", "QB", "MIN", 108.5, 16.2, 15.17, 8, 8, "QB14"),
    ("Caleb Williams", "QB", "CHI", 72.6, 18.98, 16.44, 9, 3, "QB6"),
    ("Omarion Hampton", "RB", "LAC", 18.6, 13.3, 12.38, 9, 5, "RB8"),
    ("Ashton Jeanty", "RB", "LV", 13.2, 12.8, 12.51, 10, 6, "RB6"),
    ("Kenneth Walker III", "RB", "KC", 20.3, 10.38, 12.3, 9, 6, "RB11"),
    ("Jonathon Brooks", "RB", "CAR", 113.0, None, 5.47, 7, 10, "RB43"),
    ("A.J. Brown", "WR", "NE", 26.5, 12.09, 11.26, 10, 8, "WR10"),
    ("Luther Burden III", "WR", "CHI", 57.6, 6.96, 10.06, 8, 6, "WR23"),
    ("Marvin Harrison Jr.", "WR", "ARI", 78.8, 8.78, 8.23, 7, 7, "WR32"),
    ("Parker Washington", "WR", "JAX", 98.6, 8.98, 8.57, 8, 6, "WR31"),
    ("Brock Bowers", "TE", "LV", 19.9, 11.85, 10.52, 10, 5, "TE1"),
    ("Harold Fannin Jr.", "TE", "CLE", 71.2, 9.4, 8.27, 8, 6, "TE6"),
    ("Tyler Warren", "TE", "IND", 48.7, 8.85, 9.46, 9, 6, "TE4"),
    ("Travis Kelce", "TE", "KC", 95.8, 9.01, 7.66, 6, 9, "TE11"),
]
for name, pos, team, adp, ffpg25, proj26, ceil, risk, yrank in PROFILES:
    r = find(pos, name)
    if r is None:
        print("PROFILE UNMATCHED:", name); continue
    r["team"] = team
    r["adp"] = adp
    r["projPpg2026"] = proj26
    r["ceiling"] = ceil
    r["risk"] = risk
    note = f"Profile: Yahoo consensus {yrank}, ADP {adp}"
    if ffpg25 is not None:
        note += f", '25 FFPG {ffpg25}"
    note += f", '26 proj FPPG {proj26} (half-PPR), ceiling {ceil}/10, risk {risk}/10"
    r["notes"].append(note)

# 5. RB Volume (transcribed from p19 raster image; confidence pixel-sampled)
VOLUME = [
    ("Christian McCaffrey", 1, "1st", "high"), ("Jahmyr Gibbs", 2, "2nd", "high"),
    ("Bijan Robinson", 3, "3rd", "high"), ("Ashton Jeanty", 4, "T-11th", "good"),
    ("Jonathan Taylor", 5, "4th", "high"), ("De'Von Achane", 6, "7th", "good"),
    ("Chase Brown", 7, "6th", "good"), ("James Cook", 8, "T-14th", "good"),
    ("Saquon Barkley", 9, "13th", "good"), ("Kenneth Walker", 10, "8th", "good"),
    ("Josh Jacobs", 11, "9th", "good"), ("Javonte Williams", 12, "10th", "good"),
    ("Omarion Hampton", 13, "T-11th", "medium"), ("Derrick Henry", 14, "18th", "good"),
    ("Breece Hall", 15, "24th", "good"), ("Jeremiyah Love", 16, "X", "medium"),
    ("Cam Skattebo", 17, "5th", "medium"), ("Quinshon Judkins", 18, "17th", "good"),
    ("Travis Etienne", 19, "16th", "good"), ("Bucky Irving", 20, "T-14th", "low"),
    ("David Montgomery", 21, "35th", "good"), ("Kyren Williams", 22, "19th", "medium"),
    ("Chuba Hubbard", 23, "27th", "low"), ("Jaylen Warren", 24, "20th", "low"),
    ("Rico Dowdle", 25, "23rd", "low"), ("D'Andre Swift", 26, "22nd", "good"),
    ("Bhayshul Tuten", 27, "X", "medium"), ("Tony Pollard", 28, "26th", "medium"),
    ("Rhamondre Stevenson", 29, "25th", "good"), ("Jadarian Price", 30, "X", "low"),
    ("TreVeyon Henderson", 31, "34th", "medium"), ("RJ Harvey", 32, "28th", "medium"),
    ("J.K. Dobbins", 33, "29th", "medium"), ("Rachaad White", 34, "21st", "low"),
    ("Jordan Mason", 35, "38th", "medium"), ("Kenneth Gainwell", 36, "30th", "low"),
    ("Kyle Monangai", 37, "33rd", "low"), ("Jonathan Brooks", 38, "X", "low"),
    ("Jacory Croskey-Merritt", 39, "37th", "low"), ("Blake Corum", 40, "36th", "low"),
]
ORD = {1: "1st", 2: "2nd", 3: "3rd"}
for name, projRank, adjVol, conf in VOLUME:
    r = find("RB", name)
    if r is None:
        print("VOLUME UNMATCHED:", name); continue
    o = ORD.get(projRank, f"{projRank}th")
    adjtxt = "n/a ('25)" if adjVol == "X" else f"{adjVol} '25 adj"
    r["notes"].append(f"RB Volume: proj {o}, {adjtxt}, confidence {conf}")

# 6. Luck metric (transcribed from p20 raster image)
UNLUCKY = [("CeeDee Lamb", 35.49, 17.73), ("Chris Olave", 23.46, 8.73),
    ("Marvin Harrison Jr.", 23.40, 18.22), ("Ja'Marr Chase", 22.78, 7.87),
    ("Amon-Ra St. Brown", 22.19, 7.41), ("Lamar Jackson", 20.96, 10.78),
    ("Puka Nacua", 20.81, 5.95), ("R. Stevenson", 18.32, 12.81),
    ("Davante Adams", 17.50, 7.86), ("Alec Pierce", 17.25, 11.20),
    ("Jaylen Waddle", 17.06, 8.81), ("Joe Burrow", 16.32, 14.39),
    ("Tee Higgins", 14.70, 7.61), ("Jayden Higgins", 14.09, 11.74),
    ("Jaxson Dart", 14.06, 6.36), ("Josh Jacobs", 13.28, 5.60),
    ("Trevor Lawrence", 12.70, 4.03), ("Jayden Daniels", 12.45, 10.91),
    ("Zay Flowers", 12.16, 5.72), ("Michael Wilson", 11.49, 5.74),
    ("Brian Thomas Jr.", 11.14, 8.49), ("Jake Ferguson", 11.11, 5.93),
    ("De'Von Achane", 10.48, 3.24), ("DeVonta Smith", 10.14, 5.24),
    ("Ladd McConkey", 10.00, 5.53)]
LUCKY = [("D'Andre Swift", -5.06, -2.27), ("Josh Allen", -5.20, -1.43),
    ("Jalen Hurts", -5.25, -1.75), ("Chase Brown", -5.46, -2.07),
    ("Wan'Dale Robinson", -5.71, -2.62), ("Rico Dowdle", -6.49, -3.05),
    ("Bijan Robinson", -6.78, -1.87), ("Quinshon Judkins", -6.92, -4.08),
    ("Matthew Stafford", -7.42, -2.29), ("Tyler Warren", -9.84, -5.44),
    ("Baker Mayfield", -10.64, -4.11), ("Travis Kelce", -11.50, -6.09),
    ("Travis Etienne Jr.", -11.75, -4.71), ("Patrick Mahomes II", -12.38, -4.36),
    ("Luther Burden III", -13.38, -11.11), ("David Montgomery", -14.70, -9.19),
    ("DJ Moore", -16.22, -9.65), ("Dak Prescott", -16.41, -5.23),
    ("Bo Nix", -16.60, -5.64), ("Jonathan Taylor", -16.84, -4.72),
    ("RJ Harvey", -18.28, -9.07), ("Jahmyr Gibbs", -19.00, -5.47),
    ("Caleb Williams", -25.29, -8.41), ("Christian McCaffrey", -30.92, -7.64),
    ("Dallas Goedert", -35.09, -19.02)]
for i, (name, tot, pct) in enumerate(UNLUCKY):
    r = find_any(name)
    if r is None:
        print("LUCK UNMATCHED:", name); continue
    r["notes"].append(f"2025 Luck: #{i+1} unluckiest (lost {tot} pts, {pct}% of pts)")
for i, (name, tot, pct) in enumerate(LUCKY):
    r = find_any(name)
    if r is None:
        print("LUCK UNMATCHED:", name); continue
    r["notes"].append(f"2025 Luck: #{i+1} luckiest (gained {abs(tot)} pts, {abs(pct)}% of pts)")

# 7. Top 50 stats -> notes where a stat names a player
ALIASES = {"cmc": "christian mccaffrey", "dk metcalf": "dk metcalf"}
matched_stats = 0
for stat in top50:
    text = stat["text"]
    tnorm = " " + norm(text) + " "
    hits = []
    for (pos, nn), p in players.items():
        if len(nn.split()) < 2:
            continue
        if f" {nn} " in tnorm:
            hits.append(p)
    if " cmc " in tnorm:
        p = find_any("Christian McCaffrey")
        if p and p not in hits:
            hits.append(p)
    for p in hits:
        p["notes"].append(f"Stat #{stat['num']}: {text}")
    if hits:
        matched_stats += 1
print(f"top50: {matched_stats}/50 stats matched to at least one player")

# ---- output ----
out = sorted(players.values(), key=lambda p: (p["pprRank"] is None, p["pprRank"] or 0,
                                              p["pos"], p["posRank"] or 999))
os.makedirs(r"data", exist_ok=True)
with open(r"data\rankings.json", "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)

from collections import Counter
print("total players:", len(out))
print("by pos:", dict(Counter(p["pos"] for p in out)))
print("by tag:", dict(Counter(str(p["tag"]) for p in out)))
print("with pprRank:", sum(1 for p in out if p["pprRank"]))
print("with posRank:", sum(1 for p in out if p["posRank"]))
print("with adjPpg:", sum(1 for p in out if p["adjPpg2025"] is not None))
print("with adp:", sum(1 for p in out if p["adp"] is not None))
print("with notes:", sum(1 for p in out if p["notes"]))
