# Advanced motion techniques

The moves that separate a designed film from animated slides. Each has a job, settings, and a known way to go wrong. Use two or three per film, chosen at the storyboard; more reads as a showreel.

Timings assume the `confident` preset; scale them with the preset in `02-motion.md`.

## Camera and depth

| Technique | What it is | Settings | Goes wrong when |
|---|---|---|---|
| Layered camera | Background, product and foreground sit at different depths and slide at different speeds as the camera moves | Three planes. The far plane moves 30–40% as far as the product, the near plane 140–160% | Planes move the same amount (flat) or the near plane crosses the focal point |
| Focus pull | Sharpness moves from one plane to another to move the viewer's attention | 350–500 ms; blur the plane being left by 6–12 px at 1080p and dim it 30–40% | Both planes are soft at once |
| Lead and follow | The pointer or subject moves first, the camera follows late and travels less | Camera starts 170–330 ms after, covers 60–80% of the distance, lands with the click | The camera leads or matches the subject exactly |
| Push through | The camera enters an element until its colour fills the frame, which becomes the next scene | 550–900 ms, accelerating | The element has fine detail that smears on the way in |
| Orbit of a card | A UI card turns a few degrees as the camera passes, with the light moving across it | At most 10° on wides, 4° on anything read; highlight sweeps once | Text is read while it is turning |
| Speed ramp | Time slows into the important moment and speeds through the rest | Ramp over 200–300 ms, never a step change | Used on the voice (never ramp sound) |

## Shape and layout

| Technique | What it is | Settings | Goes wrong when |
|---|---|---|---|
| Layout-to-layout | An element moves from its place in one layout to its place in the next, changing size and corner radius on the way | 450–650 ms, `travel` easing; text inside cross-fades at the midpoint, not throughout | Text is stretched during the move |
| Shape morph | One shape becomes another with matched points (a button becomes a card, a dot becomes a logo) | 350–500 ms; keep the same corner count where possible | The shapes fight and collapse mid-way |
| Container transform | A small element expands to become the whole screen, or the reverse | 500–700 ms; content appears in the last third | Content is visible and distorted during growth |
| Mask reveal | Content is uncovered by a moving edge that has a shape and direction with meaning | Edge follows the reading direction; 300–450 ms | A plain rectangular wipe with no source |
| Line draw | A line draws itself to connect two things, then the second thing reacts | 250–400 ms, with a small head start before the reaction | The line is drawn before the viewer has seen both ends |

## Groups

| Technique | What it is | Settings | Goes wrong when |
|---|---|---|---|
| Stagger with a source | Items arrive in order from a point: left to right, centre out, or from where the cursor clicked | 30–60 ms apart, total under 400 ms; distance to the source sets the delay | Order is random or the total runs long |
| Chain | Items are linked so each follows the one before with a small delay and a softer spring | Delay 40–70 ms, damping rises down the chain | Every item overshoots equally |
| Sort and settle | Rows reorder by sliding past each other to their new places | 400–550 ms; moving rows lift 2–3% | Rows jump or cross-fade |
| Count with its bar | A number counts while its bar, ring or line grows, ending on the same frame | 600–900 ms, slowing into the final value | The number finishes before or after the shape |

## Type

| Technique | What it is | Settings | Goes wrong when |
|---|---|---|---|
| Variable weight | The key word thickens from regular to semibold as it is spoken | 200–300 ms | Applied to more than one word a line |
| Serif swap | One word changes from the sans to the italic serif accent at the moment of emphasis | Cross through a 120 ms blur of 4 px | Used more than three times in a film |
| Word-by-word with the voice | Each word arrives on its spoken time | Up to 100 ms early, never late | Words arrive on a fixed timer instead of the voice |
| Rotating word | One word in a line swaps for another inside a box that resizes to fit; the rest of the line holds still | Swap in 120 ms, hold 450–550 ms per word | The rest of the line shifts |
| Text along a path | A short label follows a moving line or curve | Labels only, two or three words | Used for anything that must be read at length |

## Light and material

| Technique | What it is | Settings | Goes wrong when |
|---|---|---|---|
| Light sweep | A soft band of light crosses a surface once | 500–700 ms, 15–25% brightness, on a reveal only | It loops |
| Glow on arrival | A result glows briefly as it lands, then settles | Rise 120 ms, fall 400 ms | The glow stays |
| Glass refraction | Content behind glass is blurred and slightly magnified at the edges | Blur 18–26 px at 1080p, edge magnification 2–4% | Glass sits on glass |
| Shadow follows height | A lifting element's shadow grows, softens and moves away from the light | Height change 2–3% scale; shadow blur doubles | The shadow stays fixed |
| Accent settle | Anything new appears in the accent colour and settles to ink | 120–250 ms | Old content also uses the accent |

## Particles and physics (rare)

| Technique | What it is | Settings | Goes wrong when |
|---|---|---|---|
| Burst with a cause | Confetti or sparks from a point at the moment of an announcement | One burst, 600–900 ms, gravity and spin, in brand colours | It repeats or covers the message |
| Icon swarm | Many icons travel together and resolve into an order | Each has slightly different speed and delay; they land on a grid | They overlap the focal point |
| Throw and settle | An element is flung by the cursor and lands with weight | Arc path, one soft bounce | It bounces more than once |

## Choosing

- At the storyboard, name at most three advanced techniques for the film and say what each one means.
- One of them is the signature move on the soul sheet.
- Each technique used must end up in `library/motion/` with a working example, so the next video can reuse it or avoid repeating it.
