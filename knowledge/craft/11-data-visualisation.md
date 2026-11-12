# Data visualisation in motion

Charts, numbers and dashboards. Two kinds appear in Tulvo videos: the product's own charts (shown truthfully) and film graphics made to explain a point.

## The product's charts

- They are product UI. Use the real chart from a capture or the faithful rebuild in `engine/src/products/tulvo/screens/home/` (KPI tile, status bar chart, status pie, trend line).
- Keep the product's own chart colours and type. Do not restyle them to the film's palette.
- The values come from the demo workspace and match what the voice says.
- It is fine to animate them better than the product does (bars growing, lines drawing). It is not fine to show a chart type the product does not have.

## Film graphics

Made in the film's own style, to make one point.

| Need | Use | Avoid |
|---|---|---|
| One number that matters | A hero number, counting up, with a short label | A chart |
| Before against after | Two bars or two numbers side by side | A table |
| Change over time | One line, drawn left to right | Several lines at once |
| Share of a whole | One ring or one bar split in two | A pie with more than three parts |
| Many things becoming one | Icons converging on a hub | A diagram with labels on every line |
| A price change | The old price struck through, the new one rolling in | Small print doing the work |

One chart, one point. If it needs a legend, it is too complex for a film.

## How data moves

| Element | Move | Timing |
|---|---|---|
| Hero number | Counts up, slowing into the final value; fixed-width figures | 600–900 ms |
| Bars | Grow from the baseline, one after another | 400–500 ms each, 50–70 ms apart |
| Line | Draws along its path; the end dot appears last and pulses once | 700–1000 ms |
| Ring | Sweeps clockwise from the top | 600–800 ms |
| Value labels | Appear as each shape finishes, in the accent, settling to ink | 150–250 ms |
| Axis and grid | Already present, faint, before the data arrives | — |
| Highlight | Everything except the point fades to 30–40%; the point keeps full colour | 250–350 ms |
| Update | The old value rolls out and the new one rolls in; the bar moves to its new height | 400–600 ms |

- A number and its shape finish on the same frame.
- After the data lands, hold for at least a second with nothing else moving.
- Count to the true final value. Never show intermediate values that could be read as claims.

## Colour

- The point being made is in the accent. Everything else is ink at reduced strength or muted grey.
- Warm peach marks the "before" or the old price; blue marks the "after".
- Two colours carrying meaning at most. No rainbow series.

## Type in charts

- Values and labels in Instrument Sans; changing values use fixed-width figures.
- Value labels at least 3% of frame height; hero numbers 12–20%.
- Units sit beside the number at about 60% of its size.
- Round for the viewer: "50%", "3×", "$6", not "49.7%".

## Honesty

- Bars start at zero. Axes are not cut to exaggerate a difference.
- Every figure has a source listed on the soul sheet under "facts that must be right".
- Demo data is clearly a customer story, never presented as Tulvo's own results.
- Comparisons with other tools use only facts that have been checked and dated.

## Dashboards

A dashboard on screen is too much to read at once.

1. Show the whole dashboard for at most 1.5 s so the viewer knows where they are.
2. Go to one tile. It builds: shell, title, value counting with its chart.
3. Hold.
4. Move to the next tile by a sideways camera move, never a cut. Three tiles at most.
5. Pull back to the whole dashboard, now alive, as the payoff.
