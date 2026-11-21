# Stage 3: moodboard

Ends with the **Moodboard** approval. Built on a design canvas, the same kind the storyboard uses, so the look and the storyboard sit side by side for the people approving them.

The moodboard is where the look is explored and chosen. Its frames are designs. The storyboard that follows is rendered by the engine, and those frames are the ones that bind the film.

## Read first

- `jobs/<job>/job.json`, the soul sheet, the locked script
- `knowledge/craft/13-design-styles.md` (the chosen style family)
- `knowledge/craft/06-light-and-finish.md`
- `knowledge/craft/04-type-and-captions.md` (type scale; the caption design is fixed)
- `knowledge/craft/12-frame-quality.md` (grid, spacing, composition)
- `brands/<brand>/brand.md` and `brand.json`
- `library/backgrounds/index.json` and the preview stills beside it
- The study cards named on the soul sheet
- `jobs/<job>/recipe.md` when the job has one (its style, energy and avoid list)
- Skills to load (see "Skills the studio uses" in `SKILL.md`): `impeccable` while choosing type, colour and layout; `style-sampling` when a reference sets the look; `hallmark` and `impeccable` critique before the board goes to a person

## Figma or the design canvas

Before building, check whether Figma is connected with a harmless read: call `whoami` on the Figma connector.
- **Connected:** build the moodboard in Figma instead of the design canvas, with the same contents. One frame per artboard, each with the same notes. Record the file as `figma_file` in `job.json`.
- **Not connected:** use the design canvas below, as always.

The brand's rule still wins: a brand whose designers want Figma uses Figma whether or not this check would have chosen it (see the last section).

## Build the canvas

1. Start a new design canvas with the Artifact tool (the Design type), titled "<video name> moodboard". Follow that type's own instructions for how its files are written.
2. Upload what the artboards need: the real product captures for this video, the brand's logo files, and the preview stills of any library background being proposed.
3. Use the brand's exact colours and typefaces from `brand.json` on every artboard. If the brand's typeface cannot be loaded on the canvas, say so on the hand-over and name the stand-in.

## What the moodboard contains

One artboard each, laid out in rows by group:

1. **The stage.** The world the product sits in, shown with a real capture placed on it. Choose from the ready backgrounds in the library, or propose a new one and say what it would need.
2. **Palette.** Page, ink, second, accent and the warm note, with where each is allowed. One accent, one warm note at most.
3. **Type.** Hero line, headline and label sizes shown on a real frame, in the brand's type voices, with the emphasis word in the accent face if the brand has one.
4. **Three style frames at full polish.** The opening, the signature moment and the ending, at 16:9.
5. **Colour script.** One small frame per beat showing only colour and light, in a single row.
6. **Motion references.** For each planned technique, its name from `library/motion/index.json` or `knowledge/craft/09-advanced-motion.md`, a frame from its study card or library preview, and one line on how it will be used here. Technique, not look. Then the film's **motion signature** in one line (how things enter, how the camera moves, how scenes join, the one special moment) and its **restraint level** from the energy preset (`knowledge/craft/14-motion-systems.md` sections 3 and 8). `bang-motion`'s style brief is a useful checklist for these; the brand's palette, typeface and look stay.
7. **Sound mood.** Tempo range, instruments, the energy preset, and what the signature moment sounds like, in words. If real recorded sounds will carry part of it (a room, a foley moment, a hero impact), name the searches for `tools/media/openverse.mjs` (CC0, public domain or CC BY only) and let earshot pick between candidates by the description (`node tools/audio/earshot.mjs rank <folder> "<description>"`); a person listens to the shortlist.

Offer two directions when the brief is open: lay the second set of style frames out as a second row, and recommend one.

## Rules

- Fixed for the brand: logo, typeface, caption style. Do not redesign them here.
- Stay inside the brand's colours and its rejected list.
- Real captures only in the style frames. Never invent a screen.
- The look must differ from the brand's last five videos in its ledger; say how, in a note on the canvas.
- Sentence case, no dots as separators or in pills, no coding-style typeface, wording a person would use.
- Check each style frame against `knowledge/craft/12-frame-quality.md` before handing over.

## Hand-over

Give the canvas link and say which direction you recommend and why, in two lines. The canvas is private until the maker shares it from its Share menu; say so. Comments left on the canvas are feedback: read them, log them in `knowledge/feedback-log/`, and change the artboards they touch. Stop for approval.

After approval, record the chosen style family, background, palette roles and type sizes in `job.json`, and save the three approved style frames into `jobs/<job>/look/` as the target the storyboard's key frames must match.

## If a brand's designers want to edit by hand

Use Figma instead of the design canvas for that brand, with the same contents, and note the choice in the brand's `rules.md`. Hand edits made in Figma are carried back into the scene files and the job's look notes, so the engine stays the source.
