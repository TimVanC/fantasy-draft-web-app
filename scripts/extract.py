"""Extract structured data from Joel Smyth's Draft Guide 2026 PDF text layers."""
import pymupdf, json, re, os, sys

PDF = r"Joel_Smyth_s_Draft_Guide_2026.pdf"
OUT = "scripts/extracted"
os.makedirs(OUT, exist_ok=True)
doc = pymupdf.open(PDF)

COLOR_TAG = {0x10911d: "target", 0xe1ad01: "pass", 0xc22d21: "avoid"}

def spans(pno):
    out = []
    for block in doc[pno - 1].get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            for sp in line["spans"]:
                t = sp["text"].strip()
                if not t:
                    continue
                x0, y0, x1, y1 = sp["bbox"]
                out.append({"text": t, "x": round(x0, 1), "y": round((y0 + y1) / 2, 1),
                            "x1": round(x1, 1), "color": sp["color"], "size": round(sp["size"], 1)})
    return out

def fix_liga(s):
    # PDF uses U+FB00-style ligature glyphs that extract oddly; normalize
    return (s.replace("\ufb00", "ff").replace("\ufb01", "fi").replace("\ufb02", "fl")
             .replace("\ufb03", "ffi").replace("\ufb04", "ffl").strip())

# ---------------- Big boards (p4 PPR, p6 half-PPR) ----------------
def big_board(pno):
    sps = spans(pno)
    nums = [s for s in sps if re.fullmatch(r"\d{1,3}", s["text"]) and s["size"] < 13]
    names = [s for s in sps if re.match(r"^(QB|RB|WR|TE|K|DEF|D/ST)\s+\S", s["text"]) and s["size"] < 13]
    players = []
    for nm in names:
        # nearest rank number to the left on the same visual row
        cands = [n for n in nums if n["x"] < nm["x"] and nm["x"] - n["x1"] < 30 and abs(n["y"] - nm["y"]) < 4]
        if not cands:
            print(f"  p{pno} NO RANK MATCH: {nm['text']!r} at ({nm['x']},{nm['y']})")
            continue
        rank = int(min(cands, key=lambda n: nm["x"] - n["x1"])["text"])
        pos, name = nm["text"].split(None, 1)
        players.append({"rank": rank, "pos": pos, "name": fix_liga(name),
                        "tag": COLOR_TAG.get(nm["color"])})
    players.sort(key=lambda p: p["rank"])
    ranks = [p["rank"] for p in players]
    dupes = {r for r in ranks if ranks.count(r) > 1}
    missing = set(range(1, max(ranks) + 1)) - set(ranks)
    print(f"  p{pno}: {len(players)} players, dupes={sorted(dupes)}, missing={sorted(missing)}")
    return players

# ---------------- Positional rankings (p5 PPR, p7 half-PPR) ----------------
def positional(pno):
    sps = spans(pno)
    nums = [s for s in sps if re.fullmatch(r"\d{1,2}", s["text"]) and s["size"] < 11]
    names = [s for s in sps if not re.fullmatch(r"\d{1,2}", s["text"]) and s["size"] < 11
             and re.search(r"[A-Za-z]", s["text"])
             and s["text"] not in ("PPR", "half-PPR", "Quarterbacks", "Running Backs", "Wide Receivers", "Tight Ends")]
    # cluster name columns by x
    cols = {}
    for nm in names:
        key = round(nm["x"] / 50)  # coarse cluster
        cols.setdefault(key, []).append(nm)
    # merge adjacent coarse keys
    keys = sorted(cols)
    merged = []
    for k in keys:
        if merged and k - merged[-1][-1] <= 1 and abs(cols[k][0]["x"] - cols[merged[-1][-1]][0]["x"]) < 60:
            merged[-1].append(k)
        else:
            merged.append([k])
    result = {}
    for grp in merged:
        col = sorted([n for k in grp for n in cols[k]], key=lambda n: n["y"])
        # rank via nearest number to the left, else positional order
        entries = []
        for i, nm in enumerate(col):
            cands = [n for n in nums if n["x"] < nm["x"] and nm["x"] - n["x1"] < 25 and abs(n["y"] - nm["y"]) < 4]
            rk = int(min(cands, key=lambda n: nm["x"] - n["x1"])["text"]) if cands else i + 1
            entries.append({"posRank": rk, "name": fix_liga(nm["text"]), "tag": COLOR_TAG.get(nm["color"])})
        result[round(col[0]["x"])] = entries
    # identify position of each column by size: QB=32, RB=60, WR=60, TE=32 (order on page: QB, RB, WR, TE by x)
    out = {}
    poss = ["QB", "RB", "WR", "TE"]
    for i, x in enumerate(sorted(result)):
        out[poss[i]] = result[x]
        print(f"  p{pno} col x={x} -> {poss[i]}: {len(result[x])} players")
    return out

# ---------------- Adjusted PPG (p12 QB+TE, p13 RB+WR) ----------------
def adj_ppg(pno, positions):
    """positions: (leftPos, rightPos). Tables anchored by 'Rk' spans in Alfarn font."""
    sps = spans(pno)
    anchors = sorted([s for s in sps if s["text"].startswith("Rk") and s["size"] > 12],
                     key=lambda s: s["x"])
    print(f"  p{pno} anchors: {[(a['text'], a['x'], a['y']) for a in anchors]}")
    split_x = anchors[1]["x"] - 12 if len(anchors) > 1 else 10000
    tables = {positions[0]: {"hy": anchors[0]["y"]}}
    bounds = [(-1, split_x, positions[0])]
    if len(anchors) > 1:
        tables[positions[1]] = {"hy": anchors[1]["y"]}
        bounds.append((split_x, 10000, positions[1]))
    out = {}
    HDR = {"adj", "PPG", "Reason...", "Rk", "PPG Reason..."}
    for x0, x1, pos in bounds:
        tsp = [s for s in sps if x0 <= s["x"] < x1 and s["y"] > tables[pos]["hy"] + 5
               and s["size"] <= 12.5 and s["text"] not in HDR]
        names, ppgs, reasons, ranks = [], [], [], []
        for s in tsp:
            t = s["text"]
            if re.fullmatch(r"\d{1,2}", t):
                ranks.append(s)
            elif re.fullmatch(r"\d{1,2}\.\d", t):
                ppgs.append(s)
            elif re.search(r"[A-Za-z]", t):
                names.append(s)
        # names: leftmost alpha cluster; reasons: alpha spans right of ppg column
        if not ppgs:
            continue
        ppg_x = min(p["x"] for p in ppgs)
        reasons = [n for n in names if n["x"] > ppg_x]
        names = [n for n in names if n["x"] <= ppg_x]
        rows = []
        for nm in sorted(names, key=lambda n: n["y"]):
            row = {"name": fix_liga(nm["text"]), "adjPpg": None, "note": None, "posRank": None}
            for p in ppgs:
                if abs(p["y"] - nm["y"]) < 4:
                    row["adjPpg"] = float(p["text"]); break
            for r in reasons:
                if abs(r["y"] - nm["y"]) < 4:
                    row["note"] = fix_liga(r["text"]); break
            for rk in ranks:
                if abs(rk["y"] - nm["y"]) < 4 and rk["x"] < nm["x"]:
                    row["posRank"] = int(rk["text"]); break
            rows.append(row)
        out[pos] = rows
        withppg = sum(1 for r in rows if r["adjPpg"] is not None)
        print(f"  p{pno} {pos}: {len(rows)} rows, {withppg} with ppg, {sum(1 for r in rows if r['note'])} with note")
    return out

# ---------------- Top 50 stats (p21, p22) ----------------
def top50():
    items = {}
    for pno in (21, 22):
        text = fix_liga(doc[pno - 1].get_text("text"))
        text = re.sub(r"TOP 50 STATS", "", text)
        # stats are numbered "50." down to "1."
        parts = re.split(r"\n\s*(\d{1,2})\.\s+", "\n" + text)
        for i in range(1, len(parts) - 1, 2):
            num = int(parts[i])
            body = re.sub(r"\s+", " ", parts[i + 1]).strip()
            items[num] = body
    print(f"  top50: {len(items)} stats ({min(items)}..{max(items)})")
    return [{"num": n, "text": items[n]} for n in sorted(items, reverse=True)]

print("Big boards:")
ppr = big_board(4)
half = big_board(6)
print("Positional:")
pos_ppr = positional(5)
pos_half = positional(7)
print("Adjusted PPG:")
ppg = adj_ppg(12, ("QB", "TE"))
ppg.update(adj_ppg(13, ("RB", "WR")))
print("Top 50:")
stats = top50()

json.dump(ppr, open(f"{OUT}/board_ppr.json", "w"), indent=1)
json.dump(half, open(f"{OUT}/board_half.json", "w"), indent=1)
json.dump(pos_ppr, open(f"{OUT}/positional_ppr.json", "w"), indent=1)
json.dump(pos_half, open(f"{OUT}/positional_half.json", "w"), indent=1)
json.dump(ppg, open(f"{OUT}/adj_ppg.json", "w"), indent=1)
json.dump(stats, open(f"{OUT}/top50.json", "w"), indent=1)
print("saved to", OUT)
