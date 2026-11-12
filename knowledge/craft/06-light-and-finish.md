# Light, texture and finish

What makes a frame look expensive. Read at the moodboard stage and by scene builders.

## The stage

Every film has a stage: the world the product sits in. It is chosen per video at the moodboard and is free to change between videos.

| Stage family | Look | Suits |
|---|---|---|
| Paper | The brand's light page, soft shadows, almost no effects | Demos, tutorials, calm launches |
| Night | The brand's dark page with drifting pools of its accent and grain | Sales, big announcements |
| Glass | Layered translucent panels, light passing through | Feature launches, AI features |
| Colour field | One saturated brand colour edge to edge | Offers, hooks, endings |

Rules for any stage:

- It always moves: gradients drift, light breathes, waves travel. Slowly, and driven by real time so it keeps moving through holds.
- No dot grids, no generic mesh blobs, no stock patterns.
- It is quieter than the product. If the stage is the most interesting thing in the frame, turn it down.

## Light

- One light direction per film. Every shadow agrees with it.
- Shadows are soft and layered: a tight dark one under the edge, a wide faint one beyond.
- Light can be an event: a sweep across a card on a reveal, a glow that rises under the result. One light event per scene at most.
- Glow is for emitters only (a screen, a highlight). Text does not glow.

## Depth

- Three planes: stage, product, foreground. They separate by scale, softness and how far they slide when the camera moves.
- Soften the far plane slightly. A sharp background flattens the frame.
- A foreground element crossing the frame once (a soft shape, a card edge) sells depth better than any effect.

## Glass

Used for captions and occasional panels.

- The background behind glass is blurred and slightly magnified at the edges.
- A thin bright line on the top edge, a thin dark line on the bottom.
- Tint the glass with the scene's colour at low strength. Pure grey glass looks dead.
- Glass never sits on glass.

## Texture

- Fine grain over the whole frame, re-seeded every frame, at a strength you notice only when it is removed.
- A soft vignette, at most 15% darker at the corners.
- No scratches, dust, light leaks or chromatic split.

## Colour

- Brand colours live in `brands/<brand>/brand.json`, by role: page, ink, second, accent, warm, soft, line, each for a light and a dark page. What the brand rejects is listed there too.
- One accent at a time. If the accent is highlighting something, nothing else uses it.
- Blend colours through a perceptual space so the midpoint is not muddy.
- Product UI keeps its real colours. The stage is tuned around it.

## The finishing pass

Applied once to the joined film, never per scene, so every scene matches.

1. Grain.
2. Vignette.
3. A gentle contrast curve: blacks slightly lifted on paper stages, held deep on night stages.
4. Check the film as a strip of small frames: it should read as one piece.

## The freeze-frame test

Pause on any hero beat. The frame should work as a poster: one focal point, clear light, nothing cut off awkwardly, nothing half-way through a move. If it does not, the layout is wrong, not the animation.
