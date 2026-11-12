# Tulvo brand, for video

The numbers are in `brand.json`, by role. This file says how to use them. After editing `brand.json`, run `node tools/brand/sync.mjs` and `node tools/brand/check.mjs tulvo`.

## Where the brand comes from

| Source | What it settles |
|---|---|
| `Desktop/Tulvo/DESIGN.md` | The marketing site's design system: colours, Instrument Sans, 12 px corners, ink buttons |
| Product Hunt launch kit (social posts and hand-off) | The social style: warm paper, two-part headlines, app windows, the offer ticket |
| Live app, captured 20 Oct 2026 | Product UI: Inter, neutral greys, 8 px corners, status colours |
| Black Friday film feedback, 10–11 Nov 2026 | Film partners (ice blue, warm peach), and what was rejected |

When these disagree, the marketing design system wins for brand, and the live app wins for product UI.

## Fixed in every video

- **Logo:** files in `logo/`. It opens and closes a film and is not on the frames between. Use the white wordmark on dark stages.
- **Typeface:** Instrument Sans for all film type.
- **Caption style:** `knowledge/craft/04-type-and-captions.md`.

## Type system

| Voice | Family | Use | Limit |
|---|---|---|---|
| Brand | Instrument Sans, semibold, tight tracking | Headlines, titles, captions | Always |
| Accent | Instrument Serif, italic | The one word that carries the feeling: "*finally*", "*one*" | Once per line, three times per film |
| Label | Instrument Sans, medium, sentence case | Small labels, prices, counters, timers. Changing numbers use fixed-width figures | Never a coding-style typeface |
| Product | Inter | Inside product UI only | Never for film type |

Why these go together: Instrument Serif was drawn as a companion to Instrument Sans, so the italic sits naturally inside a sans headline. Inter is the product's own typeface, so screens stay true.

The two-part headline from the social style carries into film: first clause in ink, second in muted grey. On a dark stage: white, then ice blue.

## Colour

The first column is the role name used in `brand.json` and in the engine (`page`, `ink`, `second`, `accent`, `warm`, `soft`, `line`). Colours with no role yet are kept in `brand.json` under `colours.other`.

| Role | Light stage | Dark stage |
|---|---|---|
| Page | Paper `#FFFFFF` (the default, like tulvo.io; warm paper `#F5F3EF` is for social posts only) | Night `#060608` |
| Ink | `#101113` | `#FFFFFF` |
| Second clause, supporting text | Muted `#8A8F98`, body `#626670` | Ice blue `#A9C8FF` |
| The accent | Action blue `#2B5CE6` | Bright blue `#4D8DFF` |
| Warm partner (old prices, deadlines, one warm note) | Warm peach `#F7A878` | Warm peach `#F7A878` |
| Soft fill | Blue surface `#E7EFFD` | Deep blue `#10235E` |
| Lines | `#D9DDE5` (warm `#E4E2DE` only with warm paper) | White at 14% |

- One accent at a time. If blue is highlighting, nothing else in the frame is blue.
- Peach appears at most once per scene.
- No purple, pink or ash grey on stages, type or effects. The social kit's lilac and orchid gradient is not used in film.
- No dot grids or generic mesh blobs.

## Product UI

- Shown in its real colours, real typeface and current theme. It is staged, never restyled.
- Status chips keep the product's colours, including its violet and pink.
- The demo workspace's chip colours are in `brand.json` under `product_ui`, read from the Tulvo connector.
- Rebuilt screens come from `engine/src/products/tulvo/` and are compared with a real capture before use.
- The capture the kit was built from is dated 20 Oct 2026. Re-capture and re-compare before the first new video; note changes in `product/`.

## Shapes

- App windows: white, about 1.5% of frame height corner radius, a 1 px line border, a soft long shadow, a thin top bar.
- Controls and cards: about 1.1% corner radius.
- Buttons: ink pills with white text. Blue on emphasis.
- The offer ticket (a tilted card with a tear line and a coloured stub) is Tulvo's own device for offers.

## Voice

Default Ray (ElevenLabs); any other voice by name from `voices.json`. See `pronunciation.md`.

## Decided

- No coding-style typeface anywhere. Labels and numbers are Instrument Sans (owner, 11 Nov 2026).
- No dots as decoration or punctuation furniture: not in backgrounds, not inside pills, not between words (owner, 11 Nov 2026).
- Nothing on screen or in the voice reads as if a machine wrote it. See `knowledge/craft/04-type-and-captions.md`, "Human wording" (owner, 11 Nov 2026).
- Instrument Serif italic is the accent face (owner, 11 Nov 2026).

## Still to confirm with the owner

- Whether warm paper or pure white is the default light page.
