# Vehicle fitment logos

These render in the fitment grids on `index.html` and `applications.html`.
`js/site.js` reads `manifest.json` and swaps the matching file into each card;
a brand with no entry keeps its initials badge instead.

## Adding or replacing a logo

1. Drop the file in here named after the brand's `data-logo` slug —
   `toyota.png`, `massey-ferguson.svg`, and so on. SVG is preferred.
2. Regenerate the manifest:

       python3 - <<'PY'
       import json, pathlib
       d = pathlib.Path("assets/logos")
       m = {f.stem: f.name for f in sorted(d.iterdir()) if f.suffix in ('.svg', '.png')}
       (d / "manifest.json").write_text(json.dumps(m, indent=1, sort_keys=True) + "\n")
       PY

Artwork should have a transparent background and be trimmed to the mark — the
card draws it into a 52px-tall box, so surrounding whitespace makes it look
small. Raster files are fine at ~240px on the long edge.

## Currently present — 21 of 25

Sourced from the `filippofilip95/car-logos-dataset` collection (trimmed and
downscaled), except John Deere which comes from Simple Icons and has been set
to John Deere green rather than left as a black silhouette.

## Still needed — 4

| Brand | Why it is missing |
|---|---|
| Fuso | Only a Mitsubishi Motors file was available. That is a different company, and its wordmark reads "MITSUBISHI MOTORS", so it was not used. Mitsubishi Fuso artwork is needed. |
| Massey Ferguson | Not in any reachable collection. |
| Belarus (MTZ) | Not in any reachable collection. |
| New Holland | Not in any reachable collection. |

These four show their initials badge, which is a deliberate fallback rather
than a broken state. Supply the files and they appear on the next manifest run.

## Trademarks

Every mark here belongs to its manufacturer, not to BSL Bearings. They are used
to state factually which vehicles these bearings fit. Confirm BSL is entitled to
display them: manufacturers commonly allow this for parts suppliers, but many
require written permission and forbid recolouring, distortion, or any suggestion
of endorsement or affiliation.

The disclaimer beneath the grid must stay.
