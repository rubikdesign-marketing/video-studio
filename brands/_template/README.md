# Start a new brand here

This folder is the empty starting point for a brand. Do not edit it; copy it:

```
node tools/brand/new.mjs my-brand
```

That makes `brands/my-brand/`. Everything that belongs to the brand lives in that one folder, and nobody needs to touch engine code.

## What is in a brand folder

| File or folder | What it is | Who reads it |
|---|---|---|
| `brand.json` | The look, as values: colours, typefaces, logo files, corner shapes, caption settings | The engine |
| `brand.md` | How to use those values: where the brand comes from, what is fixed, what was decided | People and Claude |
| `logo/` | The wordmark and the mark, for light and for dark pages | The engine |
| `fonts/` | The brand's font files | The engine |
| `voices.json` | The named voices this brand may use, and the default one | `tools/audio/voice.mjs` |
| `pronunciation.md` | How to write product words in voice scripts so they are said correctly | `tools/film/captions.mjs`, people |
| `heard-as.json` | Words the transcriber mishears, so the voice check does not raise false alarms | `tools/audio/voice_check.py` |
| `rules.md` | This brand's own rules | People and Claude |
| `product/` | What the studio has learned about the brand's product | People and Claude |
| `ledger.json` | Every finished video: hook, look, signature move, results | People and Claude |
| `lessons/` | Dated lessons from feedback, before they become rules | People and Claude |

## Fill in `brand.json`

Open it. Every value has a note beside it (a key that starts with an underscore) saying what it is. The values it ships with are neutral placeholders that already work, so you can change one group, look at the result, and go on.

1. **name**: the brand's name as shown.
2. **colours**: seven roles, once for a light page and once for a dark page.

   | Role | What it is for |
   |---|---|
   | `page` | The background |
   | `ink` | Main text and button fills |
   | `second` | Quieter text: the second half of a headline, labels |
   | `accent` | The one colour that draws the eye |
   | `warm` | A second, warmer note, used sparingly |
   | `soft` | A soft fill behind things |
   | `line` | Thin borders |

3. **stages**: how each page is lit (soft pools of colour, grain, darker corners).
4. **fonts**: one typeface per voice: `headline`, `accent` (or `null`), `label`, `product` (or `null`). Put font files in `fonts/` and name them, or name a file of an installed npm package.
5. **logo**: put the files in `logo/` and name them: a wordmark and a mark for each page.
6. **shape**: corner radii, as shares of frame height.
7. **captions**: the five caption values a brand may change.
8. **product_ui**: the product's own colours, or `null`.
9. **rejected**: colours, patterns and type the owner has said no to.

## Then

```
node tools/brand/sync.mjs            # tells the engine about the brand; run it after every edit
node tools/brand/check.mjs my-brand  # finds missing values and files, and measures contrast
cd engine && npx remotion still BrandSheet out/brand-sheet-my-brand.png --props='{"brand":"my-brand"}'
```

Look at the brand sheet, get it approved, and fill in `brand.md`, `voices.json` and `pronunciation.md`.

To make a video with the brand, write `"brand": "my-brand"` in the job's `job.json`. To make it the brand used when a job names none, change `default_brand` in `studio.json`.
