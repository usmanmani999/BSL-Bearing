"""Second-pass OCR for cells the first pass could not read as numbers.

The whole-table pass uses --psm 6 across a wide crop, which occasionally clips a
digit or picks up a grid line. Here each failing cell is re-cropped from its own
grid rectangle, upscaled, and read on its own with a digit-oriented config. A
cell is only replaced when the re-read is unambiguously numeric; otherwise the
original text is kept so the row still gets flagged downstream.
"""
import json
import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

SCRATCH = Path(__file__).parent
HUB_COLS = ["designation", "d", "D", "B", "C", "weight", "skf", "fag", "koyo"]
TAPER_COLS = ["designation", "d", "D", "T", "B", "C", "cr", "cor", "weight"]
NUMERIC = {"d", "D", "B", "C", "T", "cr", "cor", "weight"}

_pages = {}


def page(n):
    if n not in _pages:
        _pages[n] = np.array(Image.open(SCRATCH / f"pdf/page-{n}.png").convert("L"))
    return _pages[n]


def read_cell(pno, x0, x1, y0, y1, psm):
    arr = page(pno)
    pad = 2
    crop = arr[max(0, int(y0) - pad):int(y1) + pad, int(x0) + 3:int(x1) - 3]
    if crop.size == 0 or crop.shape[0] < 4 or crop.shape[1] < 4:
        return ""
    im = Image.fromarray(crop)
    im = im.resize((im.width * 5, im.height * 5), Image.LANCZOS)
    tmp = SCRATCH / "_cell.png"
    im.save(tmp)
    r = subprocess.run(
        ["tesseract", str(tmp), "stdout", "--psm", str(psm), "-c",
         "tessedit_char_whitelist=0123456789./"],
        capture_output=True, text=True,
    )
    return r.stdout.strip().replace("\n", " ").strip()


def numeric(t):
    t = (t or "").strip().replace(" ", "")
    return bool(re.fullmatch(r"\d*\.?\d+", t))


def main():
    total = fixed = 0
    for src, cols in [("raw-hub.json", HUB_COLS), ("raw-taper.json", TAPER_COLS)]:
        rows = json.loads((SCRATCH / src).read_text())
        for r in rows:
            rules = r.get("_rules")
            yb = r.get("_y")
            if not rules or not yb:
                continue
            for ci, name in enumerate(cols):
                if name not in NUMERIC:
                    continue
                cur = (r.get(name) or "").replace("|", " ").strip(" .,;:_~")
                if numeric(cur):
                    continue
                total += 1
                for psm in (7, 8, 13):
                    got = read_cell(r["_page"], rules[ci], rules[ci + 1],
                                    yb[0], yb[1], psm)
                    if numeric(got):
                        r[name] = got
                        fixed += 1
                        break
        (SCRATCH / src).write_text(json.dumps(rows, indent=1))
    print(f"re-read {total} unreadable numeric cells, recovered {fixed}")


if __name__ == "__main__":
    main()
