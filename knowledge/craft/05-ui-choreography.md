# Product UI choreography

How real Tulvo screens are shown and moved. Read by the product scout, the storyboarder and scene builders.

## Truth first

- Use the product before designing a shot of it. No shot is drawn until that part of Tulvo has been used in the demo workspace.
- Only real UI. Anything rebuilt for animation is compared against the real capture and must match.
- The data on screen is the data the voice is talking about. No codes, no repeated rows, no placeholder boxes, no missing logos.
- Capture at double resolution, in the current product theme, with a clean browser frame or none.
- Light UI is shown as light UI. It is staged, never recoloured.

## Staging a screen

| Choice | Guidance |
|---|---|
| Crop | Show the panel the beat is about, not the whole app. Hide navigation unless the beat is about navigating |
| Size | The subject fills 55–75% of the frame width |
| Surface | The screen sits on the film's stage as a card with a soft shadow and a 1.5–2% corner radius |
| Tilt | At most 10°, and only on wides. Never tilt a screen that must be read |
| Depth | A selected card may lift off the surface: scale 2–3%, deeper shadow |
| Density | Three to five readable things per shot. Blur, dim or crop the rest |

## The cursor

- Larger than life: about 1.5× the real size, so it reads on a phone.
- It moves on an arc, eases out of rest and into its target, and takes 350–600 ms per move.
- It arrives 100–150 ms before the click. It never clicks while still moving.
- A click shows three things within 120 ms: the cursor presses (scales to 90%), a ring expands from the point, and the target reacts.
- The cursor leaves or rests once its job is done. It never wanders.
- The camera follows the cursor with a delay of 100–200 ms, and moves less than the cursor does.

## Typing

- A human rhythm: bursts of three to six characters, 40–70 ms per character, a 120–250 ms pause at spaces and punctuation.
- Push in on the field while typing so the text is at least 4% of frame height.
- Highlight the key phrase in what was typed, after it is typed.
- Long text is typed at speed with a "Sped up" label, or the middle is skipped with a clean jump.

## Showing a result

The order is always the same: ask, wait, result, proof.

1. **Ask:** the action (a click, a prompt). `quick` length.
2. **Wait:** at most 0.6 s of honest progress. Longer real waits are sped up and labelled.
3. **Result:** the UI changes. Rows arrive staggered, charts draw, statuses change colour. `base` length.
4. **Proof:** hold 0.6–1.3 s on the result with only the background alive. This is the moment the viewer believes it.

## Emphasis without adding text

| Tool | What it does |
|---|---|
| Push in | The camera goes to the thing |
| Focus pull | Everything else dims and softens by 30–50% |
| Lift | The thing rises off the surface |
| Ring or underline | A drawn mark around or under it, in the accent colour, drawn on in `quick` |
| Colour arrival | The thing is the only colour in a muted frame |
| Count | A number rolls to its value |

Use one per beat. Two at once cancel out.

## Idealised, not invented

It is fine to make the product move better than it does: smoother state changes, staggered rows, a chart that draws. It is not fine to show a state, a field, a number or a page that the product does not have. When in doubt, check the capture.

## Recording walkthroughs (tutorials)

- Script the path first: every click and field, in order.
- Record with the scripted cursor at double resolution, at real speed.
- Speed ramps happen in the edit, never by recording fast.
- Each step is three shots: where to click (medium), the click and what it opens (macro), the result (medium).

## Product knowledge

After every job, anything learned about the product (a changed screen, a new feature, a limit found) is written to `brands/<brand>/product/` with the date and a screenshot.
