# Motion: how things move

Read by scene builders. Numbers are in milliseconds so they hold at any frame rate. Masters are 60 fps.

## Timing tokens

| Token | Length | Use |
|---|---|---|
| tick | 80–120 | State changes: a tick, a colour change, a pressed button |
| quick | 180–240 | Small UI: chips, tooltips, cursor clicks |
| base | 320–480 | Cards, panels, lines of type |
| scene | 600–900 | Camera moves, hand-offs between scenes |
| hero | 1200–2000 | The signature move, once or twice per film |

Nothing is linear except a constant drift. Nothing important is shorter than `quick`.

## Easing tokens

| Token | Curve | Feel | Use |
|---|---|---|---|
| arrive | cubic-bezier(0.22, 1, 0.36, 1) | Fast in, long soft landing | Anything entering or settling |
| travel | cubic-bezier(0.4, 0, 0.2, 1) | Even in and out | Camera moves, things crossing the frame |
| leave | cubic-bezier(0.4, 0, 1, 1) | Speeds up and goes | Exits. Exits are 60–70% of the matching entry |
| settle | spring, damping ratio 0.7–0.85 | A small overshoot, one bounce at most | Position and scale only. Never opacity |
| pop | spring, damping ratio 0.5–0.6 | Playful bounce | At most four times in a film |

## Energy presets

One setting changes the feel of the whole film. It is chosen at the idea stage and stored in `job.json`.

| | calm | confident | hype |
|---|---|---|---|
| Suits | Tutorials, demos | Feature launches | Sales, big announcements |
| Length multiplier on tokens | 1.25 | 1.0 | 0.85 |
| Overshoot | none | 2–3% | 4–6% |
| Stagger between items | 60 ms | 45 ms | 30 ms |
| Camera drift per shot | 2–3% | 3–5% | 5–8% |
| Hard cuts | rare | some, on the beat | on the beat, still motivated |
| Sound effects | sparse | each has a cause on screen | dense, layered at peaks |

Hype is not faster cutting. It is bigger contrast between rest and peak.

## Secondary motion

What separates designed motion from moved objects.

- **Anticipation:** before a big move, 60–100 ms of a small move the other way (2–3% of the distance).
- **Follow-through:** the main object lands first. What it carries (labels, shadows, badges) lands 40–80 ms later.
- **Overlap:** items in a group start 30–60 ms apart. The whole stagger stays under 400 ms.
- **Arcs:** cursors and flying objects travel on curves, never straight lines.
- **Squash of time, not shape:** UI does not stretch. Speed carries the weight.
- **Offset the properties:** position finishes first, then scale, then colour. Starting and ending everything on the same frame looks mechanical.

## Camera

- One direction per shot. Never in, out, in.
- Every camera move has a cause: a click, a word, a reveal.
- Finish the move, then land the number or word it was heading for.
- Drift: a slow constant push through a shot, sized by the preset. It never stops dead; it eases into the next move.
- Hero push: up to 2.5× scale, `scene` to `hero` length, `travel` easing.
- Depth: put layers at different distances so they slide at different speeds as the camera moves. Three layers is enough: background, product, foreground detail.
- Focus: when one thing matters, soften and dim the rest by 30–50%. It is a focus pull, not a blur effect.

## Motion blur

- Use real shutter blur (half the frame interval) on anything moving more than about 1.5% of the frame width per frame.
- No blur on text while it is being read.
- A whip between scenes is blur plus direction. The direction continues across the join.

## Known causes of jitter (all found the hard way)

| Cause | Fix |
|---|---|
| Scaling a whole frame of fine text by sub-pixel amounts | Move a camera over a double-resolution capture; keep text on whole pixels at rest |
| Grain updating at a rate that does not divide the frame rate | Re-seed grain every real frame |
| Fast shakes | Remove them. A shake above a few cycles per second aliases into jitter |
| Rolling numbers changing width | Fixed-width figures |
| Fast moves at 30 fps | Render at 60 |
| A footage clip as a background on a warped clock | Drive backgrounds from real time, not story time |
| Spring on opacity | Never. Opacity uses `arrive` or `leave` |

## Stillness

A hold is a move. Proof moments hold 0.6–1.3 s with only the background alive. Nothing else in the film stands still: if the foreground rests, light, grain or drift keeps going.
