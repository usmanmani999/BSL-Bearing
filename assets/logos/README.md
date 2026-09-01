# Vehicle fitment logos

Drop a manufacturer logo in here and it appears automatically on the Applications
and Home fitment grids — no code change needed.

## Naming

The file must match the `data-logo` slug on the chip:

    assets/logos/toyota.svg
    assets/logos/massey-ferguson.svg
    assets/logos/cnhtc.svg

`.svg` is tried first, then `.png`. If neither exists the card falls back to the
brand's initials in the tile, which is the current state.

Full slug list: hino, ud, fuso, isuzu, faw, cnhtc, ford, volvo, peterbilt,
kenworth, freightliner, daf, toyota, honda, suzuki, nissan, hyundai, kia,
land-rover, lexus, massey-ferguson, fiat, belarus, john-deere, new-holland.

## What the files should be

- Square-ish artwork; it is drawn into a 52px circular tile with padding.
- SVG preferred, transparent background, dark or full-colour mark.
- Trim surrounding whitespace or the mark will look small.

## Licensing — read before adding files

These are third-party trademarks. BSL Bearings does not own them. Before
publishing real logos, confirm you have the right to display them: manufacturer
brand guidelines usually permit factual "fits these vehicles" use by parts
suppliers, but many require specific written permission, forbid alteration or
recolouring, and prohibit any implication of endorsement or affiliation.

The trademark disclaimer under the grid must stay in place either way.
