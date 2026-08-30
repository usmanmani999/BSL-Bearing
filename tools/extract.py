"""Extract the WHEEL HUB (DAC) and TAPER ROLLER tables from the scanned BSL brochure.

The PDF has no text layer, so pages are rendered at 300dpi and OCR'd with tesseract.
Column assignment uses the table's printed vertical rules (detected from the image)
rather than guessing at x-positions, so blank SKF/FAG/KOYO cells stay blank instead
of shifting later values into the wrong column.
"""
import csv
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

SCRATCH = Path(__file__).parent
PAGES = SCRATCH / "pdf"

HUB_COLS = ["designation", "d", "D", "B", "C", "weight", "skf", "fag", "koyo"]
TAPER_COLS = ["designation", "d", "D", "T", "B", "C", "cr", "cor", "weight"]

# Table regions (x0, x1) per page, established from vertical-rule detection and
# confirmed against the rendered page images.
REGIONS = [
    ("hub", 1, 1780, 3130),
    ("hub", 2, 230, 1580),
    ("hub", 2, 1830, 3180),
    ("hub", 3, 180, 1530),
    ("hub", 3, 1780, 3130),
    ("taper", 4, 1780, 3120),
    ("taper", 4, 180, 1520),
    ("taper", 5, 190, 1525),
    ("taper", 5, 1780, 3115),
]


def load(pno):
    return np.array(Image.open(PAGES / f"page-{pno}.png").convert("L"))


def longest_run(mask):
    """Return (start, length) of the longest contiguous True run."""
    best = (0, 0)
    start = None
    for i, v in enumerate(mask):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start > best[1]:
                best = (start, i - start)
            start = None
    if start is not None and len(mask) - start > best[1]:
        best = (start, len(mask) - start)
    return best


def _peaks(colsum, thresh):
    cand = np.where(colsum > thresh)[0]
    groups = []
    for x in cand:
        if groups and x - groups[-1][-1] <= 6:
            groups[-1].append(x)
        else:
            groups.append([x])
    return groups


def find_rules(arr, x0, x1, ncols):
    """Find the table's vertical rules and y extent within [x0,x1].

    Two passes: the first locates the table's outer border rules (which are
    unbroken) to fix the y range; the second scores every candidate by ink
    within that range, so internal dividers interrupted by merged interchange
    cells are still picked up.
    """
    dark = arr < 150
    sub = dark[:, x0:x1]

    # pass 1 - tall unbroken rules give us the table's vertical extent
    runs = []
    for g in _peaks(sub.sum(axis=0), max(400, 0.55 * sub.sum(axis=0).max())):
        cx = int(np.mean(g))
        ys, ln = longest_run(sub[:, cx])
        runs.append((cx, ys, ln))
    maxlen = max(r[2] for r in runs)
    tall = [r for r in runs if r[2] > 0.75 * maxlen]
    y0 = int(np.median([r[1] for r in tall]))
    y1 = int(np.median([r[1] + r[2] for r in tall]))

    # pass 2 - rank candidates by ink inside the table body
    band = sub[y0:y1, :]
    colsum = band.sum(axis=0)
    height = y1 - y0
    groups = _peaks(colsum, 0.35 * height)
    scored = [(int(np.mean(g)), int(colsum[g].max())) for g in groups]
    scored.sort(key=lambda t: -t[1])
    keep = sorted(cx for cx, _ in scored[: ncols + 1])
    return [cx + x0 for cx in keep], y0, y1


def ocr_words(arr, x0, x1, y0, y1):
    """OCR the crop, returning words with page-absolute boxes."""
    crop = Image.fromarray(arr[y0:y1, x0:x1])
    # upscale a little: helps tesseract on the small tabular digits
    crop = crop.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
    tmp = SCRATCH / "_crop.png"
    crop.save(tmp)
    out = subprocess.run(
        ["tesseract", str(tmp), "stdout", "--psm", "6", "-c",
         "tessedit_create_tsv=1", "tsv"],
        capture_output=True, text=True,
    ).stdout
    words = []
    rd = csv.DictReader(out.splitlines(), delimiter="\t", quoting=csv.QUOTE_NONE)
    for r in rd:
        try:
            conf = float(r["conf"])
        except (TypeError, ValueError):
            continue
        txt = (r["text"] or "").strip()
        if conf < 0 or not txt:
            continue
        left, top = int(r["left"]) / 2, int(r["top"]) / 2
        w, h = int(r["width"]) / 2, int(r["height"]) / 2
        words.append({
            "text": txt,
            "xc": x0 + left + w / 2,
            "yc": y0 + top + h / 2,
            "h": h,
        })
    return words


def build_rows(words, rules, cols):
    """Group words into table rows by y, then into cells by the vertical rules."""
    words = sorted(words, key=lambda w: w["yc"])
    rows, cur = [], []
    for w in words:
        if cur and w["yc"] - np.mean([c["yc"] for c in cur]) > 11:
            rows.append(cur)
            cur = []
        cur.append(w)
    if cur:
        rows.append(cur)

    out = []
    for row in rows:
        cells = [[] for _ in cols]
        for w in row:
            idx = np.searchsorted(rules, w["xc"]) - 1
            if 0 <= idx < len(cols):
                cells[idx].append(w)
        rec = {}
        for name, ws in zip(cols, cells):
            ws.sort(key=lambda w: w["xc"])
            rec[name] = " ".join(w["text"] for w in ws).strip()
        hs = [w["h"] for w in row]
        yc = float(np.mean([w["yc"] for w in row]))
        rec["_y"] = [yc - max(hs) / 2 - 2, yc + max(hs) / 2 + 2]
        out.append(rec)
    return out


def main():
    raw = {"hub": [], "taper": []}
    for kind, pno, x0, x1 in REGIONS:
        arr = load(pno)
        cols = HUB_COLS if kind == "hub" else TAPER_COLS
        rules, y0, y1 = find_rules(arr, x0, x1, len(cols))
        if len(rules) != len(cols) + 1:
            print(f"WARN p{pno} [{x0}:{x1}] {kind}: found {len(rules)} rules, "
                  f"expected {len(cols)+1} -> {rules}", file=sys.stderr)
        recs = build_rows(ocr_words(arr, x0, x1, y0, y1), rules, cols)
        for r in recs:
            r["_src"] = f"p{pno}:{x0}"
            r["_page"] = pno
            r["_rules"] = rules
        raw[kind] += recs
        print(f"p{pno} [{x0}:{x1}] {kind}: rules={len(rules)} y={y0}-{y1} rows={len(recs)}")

    (SCRATCH / "raw-hub.json").write_text(json.dumps(raw["hub"], indent=1))
    (SCRATCH / "raw-taper.json").write_text(json.dumps(raw["taper"], indent=1))


if __name__ == "__main__":
    main()
