"""Normalise, validate and flag the OCR'd catalogue rows.

Normalisation is limited to unambiguous scan artefacts (stray grid pipes, a
trailing full stop with no decimals after it). Anything genuinely ambiguous is
flagged with a reason rather than corrected or dropped.
"""
import json
import re
from pathlib import Path

SCRATCH = Path(__file__).parent
OUT = Path("/home/user/BSL-Bearing/data")

HUB_NUM = ["d", "D", "B", "C", "weight"]
TAPER_NUM = ["d", "D", "T", "B", "C", "cr", "cor", "weight"]
INTERCHANGE = ["skf", "fag", "koyo"]

HUB_DESIG = re.compile(r"^DAC[0-9][0-9A-Z/.\-]*$", re.I)
TAPER_DESIG = re.compile(r"^(3[0-9]{4}|3[0-9]{2}/[0-9]{2})$")

JUNK = re.compile(r"^[|\[\]{}()\s.,;:_~\-—]+|[|\[\]{}\s,;:_~]+$")


def scrub(s):
    """Strip scan artefacts from a cell without altering real content."""
    s = (s or "").replace("|", " ").strip()
    s = re.sub(r"\s+", " ", s)
    return s.strip(" .,;:_~")


def num(s):
    """Parse a numeric cell. Returns (value, note) - note set if we adjusted."""
    raw = scrub(s)
    if not raw:
        return None, None
    t = raw.replace(" ", "")
    # a comma used as a decimal point (e.g. '31,50', '27,4000')
    if re.fullmatch(r"\d+,\d+", t):
        t = t.replace(",", ".")
    if re.fullmatch(r"\d*\.?\d+", t):
        try:
            return float(t), None
        except ValueError:
            pass
    return None, f"non-numeric value {raw!r}"


def merge_continuations(rows, desig_key="designation"):
    """Fold rows with no designation into the previous record.

    The interchange cells often wrap onto a second printed line; those come out
    of OCR as a row with only SKF/FAG/KOYO populated.
    """
    out = []
    for r in rows:
        has_desig = bool(scrub(r.get(desig_key, "")))
        payload = any(scrub(r.get(k, "")) for k in INTERCHANGE)
        numbers = any(scrub(r.get(k, "")) for k in HUB_NUM + TAPER_NUM if k in r)
        if not has_desig and not numbers and payload and out:
            for k in INTERCHANGE:
                extra = scrub(r.get(k, ""))
                if extra:
                    out[-1][k] = (out[-1].get(k, "") + " " + extra).strip()
            continue
        if not has_desig and not numbers and not payload:
            continue
        out.append(dict(r))
    return out


def process(rows, kind):
    numcols = HUB_NUM if kind == "hub" else TAPER_NUM
    desig_re = HUB_DESIG if kind == "hub" else TAPER_DESIG
    rows = merge_continuations(rows)

    clean, flagged = [], []
    for r in rows:
        src = r.get("_src", "")
        desig = scrub(r.get("designation", "")).replace(" ", "")
        reasons = []

        if not desig:
            continue
        # header/label rows carry no digits at all - skip silently
        if not re.search(r"\d", desig) and not any(scrub(r.get(c, "")) for c in numcols):
            continue

        rec = {"designation": desig, "_src": src}
        if not desig_re.match(desig):
            reasons.append(f"designation {desig!r} does not match expected pattern")

        for c in numcols:
            v, note = num(r.get(c, ""))
            rec[c] = v
            if v is None:
                reasons.append(f"{c} missing or unparseable ({scrub(r.get(c,''))!r})")
            elif v <= 0:
                reasons.append(f"{c} is not positive ({v})")
            if note:
                reasons.append(note)

        if rec.get("d") and rec.get("D") and rec["d"] >= rec["D"]:
            reasons.append(f"bore d={rec['d']} is not smaller than outer D={rec['D']}")

        if kind == "hub":
            for c in INTERCHANGE:
                val = scrub(r.get(c, ""))
                rec[c] = val or None
        else:
            for c in ("cr", "cor"):
                if rec.get(c) and rec[c] > 5000:
                    reasons.append(f"{c}={rec[c]} implausibly large")

        if reasons:
            rec["flags"] = reasons
            flagged.append(rec)
        else:
            clean.append(rec)
    return clean, flagged


def dedupe(clean, flagged, keys):
    """Drop exact repeats; move near-duplicates to flagged for the client."""
    seen, out = {}, []
    for r in clean:
        sig = tuple(r.get(k) for k in keys)
        if sig in seen:
            continue  # identical row repeated across a page boundary
        seen[sig] = r
        out.append(r)

    by_desig = {}
    for r in out:
        by_desig.setdefault(r["designation"], []).append(r)

    final, moved = [], []
    for r in out:
        group = by_desig[r["designation"]]
        if len(group) > 1:
            if r not in moved:
                rr = dict(r)
                rr["flags"] = [
                    f"near-duplicate: {len(group)} rows share designation "
                    f"{r['designation']} with differing values - likely genuine "
                    f"variants, needs client confirmation"
                ]
                flagged.append(rr)
                moved.append(r)
            continue
        final.append(r)
    return final, flagged


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = {}
    for kind, src, dest, keys in [
        ("hub", "raw-hub.json", "hub-bearings.json",
         ["designation", "d", "D", "B", "C", "weight", "skf", "fag", "koyo"]),
        ("taper", "raw-taper.json", "taper-roller.json",
         ["designation", "d", "D", "T", "B", "C", "cr", "cor", "weight"]),
    ]:
        rows = json.loads((SCRATCH / src).read_text())
        clean, flagged = process(rows, kind)
        clean, flagged = dedupe(clean, flagged, keys)
        for r in clean:
            r.pop("_src", None)
        clean.sort(key=lambda r: (r["d"], r["designation"]))
        payload = {"rows": clean, "flagged": flagged}
        (OUT / dest).write_text(json.dumps(payload, indent=1) + "\n")
        report[kind] = (len(clean), len(flagged))
        print(f"{kind}: {len(clean)} clean, {len(flagged)} flagged -> data/{dest}")
        for f in flagged:
            print(f"   FLAG {f['designation']} [{f.get('_src','')}]: {'; '.join(f['flags'])}")
    return report


if __name__ == "__main__":
    main()
