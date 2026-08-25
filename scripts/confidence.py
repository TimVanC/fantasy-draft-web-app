"""Sample the Confidence column colors from the RB Volume table images."""
from PIL import Image
import colorsys, json

def bands(img_path, x_frac):
    im = Image.open(img_path).convert("RGB")
    w, h = im.size
    x = int(w * x_frac)
    runs = []
    cur = None
    for y in range(h):
        r, g, b = im.getpixel((x, y))
        # classify pixel
        mx, mn = max(r, g, b), min(r, g, b)
        if mx < 90:
            cls = "dark"   # gridline / background
        elif mx - mn < 25 and mx > 180:
            cls = "white"
        elif mx - mn < 25:
            cls = "gray"
        else:
            hue = colorsys.rgb_to_hsv(r/255, g/255, b/255)[0] * 360
            if hue < 25 or hue > 330:
                cls = "red"
            elif hue < 70:
                cls = "yellow"
            elif hue < 170:
                cls = "green"
            else:
                cls = "other"
        if cur and cur["cls"] == cls:
            cur["end"] = y
        else:
            if cur:
                runs.append(cur)
            cur = {"cls": cls, "start": y, "end": y, "rgb": (r, g, b)}
    runs.append(cur)
    return [r for r in runs if r["end"] - r["start"] > 30 and r["cls"] in ("red", "yellow", "green", "gray", "white")]

# confidence column is the rightmost; in both halves it spans ~ x 1490-1790 of 2160
for f in ["page19_h1.png", "page19_h2.png"]:
    print(f)
    for r in bands(f, 0.755):
        print(f"  y {r['start']}-{r['end']} {r['cls']} rgb={r['rgb']}")
