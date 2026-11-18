# Transitions: getting from one scene to the next

Read at the storyboard stage and by scene builders. Every scene change in the shot list names one technique from this file.

## The rule

Things change shape; they do not fade. A change of scene is carried by something the viewer is already watching.

## Catalogue

| # | Technique | What happens | Use it when | Avoid when |
|---|---|---|---|---|
| 1 | Hand-off object | An element of scene A becomes an element of scene B (card → row, button → header) | Default for product scenes | The two scenes share nothing |
| 2 | Container transform | The whole screen shrinks into a rounded card, or a card grows to fill the frame | Going from a detail to the bigger picture, or into a detail | Used twice in a row |
| 3 | Camera carry | The camera keeps moving in one direction and the next scene is already there | Two places in the same world | The move would pass through empty space for more than 0.4 s |
| 4 | Macro push-through | Push into one element until it fills the frame; its colour or shape is the next scene's background | Entering a new world (product → brand, light → dark) | The element is too detailed to read as a shape |
| 5 | Match cut | Hard cut between two frames with the same shape, position or movement | On a strong beat; energy 4–5 | Shapes differ by more than a quarter of the frame |
| 6 | Motion-matched cut | Hard cut while both sides move the same way at the same speed | Hype films, on the beat | Calm films |
| 7 | Cursor lead | The cursor travels; the camera follows it into the next area | Tutorials and demos | No interaction is happening |
| 8 | Mask by object | A moving object wipes the frame as it passes | One per film at most | It draws attention to itself |
| 9 | Type bridge | A word stays on screen while the scene behind it changes | The line of voice spans two ideas | The word is small |
| 10 | Light sweep | A band of light crosses and the scene is different behind it | Reveals: before → after | More than once per film |
| 11 | Whip | Fast move with blur in one direction; continues on the other side | Energy 5 only, once or twice | Text needs reading within 0.3 s |
| 12 | Hard cut | Plain cut | On a musical downbeat, with a sound, when the next frame is strong enough to stand alone | As a default |

### Added from the Claude study (11 Nov 2026)

Seen and timed in the study cards in `library/references/claude/`. Techniques 13 (momentum cut) and 16 (the icon is a door) have working examples in `library/motion/`; the rest are still to be built.

| # | Technique | What happens | Use it when |
|---|---|---|---|
| 13 | Momentum cut | The outgoing shot starts moving (120–580 ms, speeding up), hard cut, the incoming shot is already moving the same way and settles in 250–350 ms. Same background colour both sides | Joining two zoom levels of the same UI without zooming across small text |
| 14 | Relay scroll | Outgoing content speeds up and off (400–750 ms), is swapped in one frame, incoming content starts 10–14% low and slows to rest. No fade | Moving to the next step in a sequence |
| 15 | Zoom-through swap | The outgoing group shrinks to about 78% in 250 ms; the next card arrives at about 158% and settles over 500 ms. Reads as one pull-back | A full change of content inside one world |
| 16 | The icon is a door | An icon sits in front of a miniature of the live screen; the camera pushes through in about 580 ms while the icon slides away. Reversed (about 880 ms) to come back | Entering and leaving an app or feature |
| 17 | Slide-off reveal | Finished UI accelerates off one side (650–830 ms) while the next title, already in place beneath, fades up in 120–170 ms | Ending a section and naming the next |
| 18 | Pull back, slide, push in | The window shrinks to a card at about 78% width, slides to a neighbour with a long soft landing, then pushes in. The three moves overlap | "Meanwhile, somewhere else in the same product" |
| 19 | Shape becomes object | A disc in a content colour fills the frame in about 330 ms, becomes a large chart ring on the cut, then collapses to an icon | The move into the closing line |

### The transition library (18 Nov 2026)

`library/motion/index.json`, family `transition`, holds 29 more, each built in the engine (`engine/src/kit/transitions/`), shown in all four frame sizes and passing the flash check: wipes (push, feather, iris, clock, door split, colour panel, dip to the brand's colour), optical and camera moves (blur-through, exposure bloom, whip pan, zoom blur, spin whip, parallax push, match cut), turns and tiles (cube, card flip, page turn, tile reveal, pixelate, luma dissolve), and two brand moves (a title that becomes the window, the logo as a mask). Each names its sound. They are tools for the techniques above, not new meanings: a whip pan is technique 11, a match cut technique 5, an iris from a button a hand-off (1). The rules below still hold: at most five techniques a film, never the same one twice in a row.

Six of them are banned by default (below): blinds, invert flash, glitch cut, film burn, the glitch-in text move and the glitch hook opener. Each is marked `house_rule` in the catalogue. A film uses one only when the owner says yes for that film, written in `job.json`; the light leak, ripple and ink bleed are allowed but marked "use sparingly".

## Rules

- No two neighbouring scene changes use the same technique.
- Each technique carries one meaning within a film and is not reused for another.
- A film uses at most five techniques. More reads as a showreel.
- The transition lasts `scene` length (600–900 ms) unless it is a cut.
- A sound leads every transition: it starts 150–200 ms before and peaks on the change.
- The voice does not start during a transition. It starts within 0.8 s after.
- A transition never crosses a proof moment.

## Banned

- Fade to or from black. Crossfade between two worlds.
- Slash, slat, blind and other generic wipes.
- Zoom in, zoom out, zoom in.
- Flashes and screen shakes.
- Any transition from a template pack look: glitch, RGB split, film burn.
- More than three brightness jumps in one second (also a safety limit for photosensitive viewers).
- The library's moves in this list (blinds, invert flash, glitch cut, film burn, glitch-in, the glitch opener, the number-slam shake) are allowed only with the owner's yes for that film, recorded in `job.json`. The flash limit is never waived.

## Adding to this file

A new technique enters from a study card. It gets a number, a row, and a working example in `library/motion/`. A technique with no working example stays out.
