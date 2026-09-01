# Vehicle fitment logos

These render in the fitment grids on `index.html` and `applications.html`.
`js/site.js` reads `manifest.json` and swaps the matching file into each card;
a brand with no entry keeps its initials badge instead.

## Adding or replacing a logo

1. Drop the file in here named after the brand's `data-logo` slug:
   `toyota.png`, `massey-ferguson.svg`, and so on. SVG is preferred.
2. Regenerate the manifest:

       python3 - <<'PY'
       import json, pathlib
       d = pathlib.Path("assets/logos")
       m = {f.stem: f.name for f in sorted(d.iterdir()) if f.suffix in ('.svg', '.png')}
       (d / "manifest.json").write_text(json.dumps(m, indent=1, sort_keys=True) + "\n")
       PY

Artwork should have a transparent background and be trimmed to the mark. The
card draws it into a 52px-tall box, so surrounding whitespace makes it look
small. Raster files are fine at ~240px on the long edge.

## Currently present: all 25

- 20 raster marks from the `filippofilip95/car-logos-dataset` collection,
  trimmed of transparent margin and downscaled to 240px on the long edge.
- Fuso, Massey Ferguson, Belarus and New Holland as SVG from the
  `detain/svg-logos` collection. Each of those shipped with a white
  full-canvas rect behind the mark and a viewBox to match, which made the
  artwork render tiny inside a contain-fitted box; the background rect has
  been removed and the viewBox tightened to the real artwork bounds.
- John Deere from Simple Icons, set to John Deere green rather than left as a
  black silhouette.

Cards show the logo only. The brand name is carried by the img `alt` and the
card's `title`, so it is still announced to screen readers and shown on hover.

## Trademarks

Every mark here belongs to its manufacturer, not to BSL Bearings. They are used
to state factually which vehicles these bearings fit. Confirm BSL is entitled to
display them: manufacturers commonly allow this for parts suppliers, but many
require written permission and forbid recolouring, distortion, or any suggestion
of endorsement or affiliation.

The trademark disclaimer that previously sat beneath the grid was removed at the
client's instruction.
