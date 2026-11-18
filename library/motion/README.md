# Motion library

Reusable animations ("moves") for any brand. Each move is a small component in `engine/src/kit/moves/`. It is driven by cues in seconds, takes its lengths from the motion tokens and the energy preset, and takes its colours and type from the brand in use.

- `index.json` is the catalogue: what each move does, when to use it, when not to, its props, and the number of the matching technique in `knowledge/craft/03-transitions.md` where there is one.
- `<name>.mp4` is the preview of one move. `motion-<brand>.mp4` is the reel of all of them in one brand.
- Every move in the catalogue is marked `reviewed` with the date it was last watched frame by frame, and lists its `planned_instant_changes`: the cuts and swaps that are meant to happen in one frame, in seconds of its preview.
- The working examples are in `engine/src/library/motion/demos/`.

## Use a move in a scene

1. Pick the move from `index.json`. Read "use_when" and "avoid_when" first. A film uses two or three advanced moves and at most five transition techniques.
2. Import it from the kit and give it its cue, taken from the voice timings:

   ```tsx
   import { CountWithBar, RelayScroll } from '../../kit/moves';

   export const S02: FC = () => (
     <RelayScroll at={4.2} next={<Result />}>
       <CountWithBar label="Orders packed today" value={128} max={160} at={0.6} />
     </RelayScroll>
   );
   ```

3. `at` and `out` are seconds on the scene's own clock, as for everything else in the kit. Sizes are percentages of frame height. Places (`to`, `from`, `target`, `points`) are pixels in the frame.
4. In a transition, the children are the outgoing content and `next` is the incoming content. The clock of `next` starts at 0 when it takes over.
5. Do not set a length, a colour or a typeface yourself. Change the preset or the brand instead.

Things to know:

- One emphasis per beat. A lift, a focus pull and a drawn mark cancel each other out.
- A number and its shape finish on the same frame when they share `at` and `over`. `CountWithBar` does this for you; for a ring, put a `Count` inside a `RingSweep` with the same `at`.
- `RotatingWord` and `SwapWord` change the last word of a line, so the words before it never move.
- A transition that cuts or swaps (`RelayScroll`, `MomentumCut`) does it while both sides are moving the same way. Give `RelayScroll` a `reach` of about 0.6 when the outgoing content sits in the middle of the frame, so the swap lands as it clears the edge and the page is never left empty.
- `SharedElement` is the element in both layouts: do not also draw it yourself. `IconDoor` holds the screen behind the tile from the start: do not swap it in.
- In a `CursorLead`, nothing on the screen changes until the click, and the result shows one frame after it.
- Keep the `Stage` outside a `Camera` and outside every transition, so the page stays still.

## See the moves

In `engine/`, once `<MotionCompositions />` is registered in `src/Root.tsx`:

```
npm run dev                                                      # every move is in the "moves" folder; "Motion" is the reel
npx remotion render Motion ../library/motion/motion-tulvo.mp4    # the reel, in the default brand
npx remotion render move-blur-in ../library/motion/blur-in.mp4   # one move
```

Another brand, preset or page: add `--props='{"brand":"demo","preset":"calm","page":"dark"}'`.

## Text moves, transitions, hook openers and shader backgrounds (18 Nov 2026)

The library plan's phases 4 and 5 added 100 moves, each built to work in all four sizes a film ships in:

| Family | Moves | Code |
|---|---|---|
| `type` and `emphasis` (text) | 45 moves, 59 gallery entries: soft and bold arrivals, typing and decode, emphasis marks, layout and exits | `engine/src/kit/type/` |
| `caption` | Two short-form caption styles a brand may choose for 9:16 (highlight box, spoken word enlarged); the fixed pill stays the default | `engine/src/kit/type/CaptionBox.tsx`, `CaptionPop.tsx` |
| `transition` | 29: wipes, optical and camera moves, turns and tiles, the logo and title as windows, and a stylised five marked "use sparingly" | `engine/src/kit/transitions/` |
| `opener` | 12 hook openers for the first two seconds | `engine/src/kit/openers/` |
| `shader` | 8 brand-coloured shader backgrounds on Paper Shaders, frame-accurate | `engine/src/kit/shaders/` |

- Every text move shares one splitter (`kit/type/split.tsx`): lines, words and letters, a starred word or phrase in the accent voice (`*in one place*`), and a size that shrinks to fit narrow frames. A move never measures text itself.
- Each entry says the sound it wants (`sound`: a library group and feel words, `library/sounds/`), its `sizes` and its `credit`. Entries marked `house_rule` (blinds, invert flash, glitch cut, film burn, glitch-in, the glitch opener) are banned by default in `knowledge/craft/03-transitions.md` and need the owner's yes for the film.
- In the gallery, each is the composition `move-<name>` in the folder of its family, with a `format` prop:

  ```
  npx remotion render move-mask-rise ../library/motion/mask-rise.mp4 --scale=0.5 --public-dir=out/lib-public
  npx remotion still move-mask-rise out/mask-rise-9x16.png --frame=60 --props='{"format":"9:16","fps":30}' --public-dir=out/lib-public
  ```

  `--public-dir=out/lib-public` points at a 1 MB copy of the brands and kit (`cp -R public/brands public/kit public/captures.json public/footage-cuts.json out/lib-public/`): `engine/public` holds many gigabytes of job footage, which every bundle would otherwise copy. Shaders need `--gl=angle` (set in `remotion.config.ts`).
- Checked: every preview passes `smoothness.py` and `flashes.py`; each move was looked at in all four sizes by its builder, and a fresh-eyes review of one settled frame of all 100 in 9:16, 1:1 and 4:5 found 24 problems, all fixed and looked at again. `tools/checks/tests/motion_library.test.mjs` keeps the catalogue and the gallery in step.
- Not checked: each move on brands other than Tulvo and on the dark page (most were looked at on the light page only); the calm and hype presets (the confident preset was used throughout); moves inside real films beyond the library's proof film (`jobs/2026-11-18-library-proof/`).

## Moves for product captures

The capture families in `index.json` (`capture-pointer`, `capture-effect`, `capture-camera`, `capture-time`, `capture-look`) are settings of `CaptureClip` (`engine/src/kit/CaptureClip.tsx`), not components of their own. Each has a composition `move-<name>` in the "capture" folder of Remotion Studio that plays a fitting stretch of a real capture, found from its own events: the newest capture, or the one named in its `capture` prop. Their previews here were rendered at half size from a practice capture.

```tsx
<CaptureClip src={src} cursor={cursor} tracks={tracks} from={2} to={16} width={vh(150)} look="launch" click="ring"
  time={{ pins: [{ event: { click: 3 }, at: 6.2 }] }} moves={[{ move: 'push-in', to: { thing: 'save' }, at: 8 }]} />
```

Every capture hides the product loading by default, through the same time map the pointer, tracked things and camera use. A clip that plays from the recording's start begins 0.2 s before the first page load ends, or at the first mark if that is earlier, so the film never opens on a blank or loading page. After a step, a load longer than 0.6 s plays faster, easing in and out of the speed, so the stretch from the end of the step to the settled moment lasts 0.6 s with the "Sped up" label (craft file 05, "Showing a result"). If the next action comes within half a second of the settled moment, the speed-up runs on to it, because the recording can still show the old picture just after the capture judged the page settled. Loads of 0.6 s or less play as they are. Turn it off with `trimLoads={false}` (or `"time": {"trimLoads": false}`); a clip given its own start, or a hand-set ramp, jump, freeze, rewind or pin over a load, keeps what it was given.

Check a capture's motion with `node tools/checks/capture_motion.mjs <capture folder> --options '<the same settings as JSON>'` as well as `smoothness.py`. It reports when the pointer arrives before each click, how long each move takes, any jump of the pointer or the camera, the room left around the tracked thing in every zoomed frame, and where each pinned event lands.

## Staging, animations on the product and sounds

`CaptureShot` (`engine/src/kit/capture/staging.tsx`) places a capture in the frame in one of twenty stagings (`staging` prop, or the look's own): flat card, browser frame light or dark (the address from the take's `capture.json`, or none), full screen, floating screen, isometric, laptop, monitor, tablet and phone that look like no company's device, a tall crop of the action, stacked windows, two or three takes side by side, picture in picture, a grid and a wall of screens, before and after, a mail window and a terminal window. Takes shown together run on one clock; `align: "marks"` also pins each extra take's marks to the film frames of the first take's (where its pauses allow).

```tsx
<CaptureShot src={src} cursor={cursor} tracks={tracks} look="tutorial" address="app.example.com"
  emphasis={[{ kind: 'outline', target: 'save', at: 2.1, out: 4.4 }]} />
```

Animations on the product are `emphasis` on `CaptureClip` or `CaptureShot`: lift, isolate, fly out, focus pull, outline, underline, ring, highlight sweep, magnifier, callout (`label`, `side`), arrow and connection line (`target` to `to`), step badges (`number`), typed again (`typing`, `speed`), toast pop (`at: -1` pops it when it appears), success moment (`style: "check"` or `"confetti"`, hype and launch only), blur reveal and privacy blur. Each is glued to a tracked thing through `anchorOf` in `glue.ts`, so it follows the page through scrolls and camera moves. Those that move or enlarge the thing show the recording's own pixels cut at its tracked rectangle; nothing draws a word or a number the capture does not have. One per beat: `emphasisClashes` lists two on screen at once (privacy, step badges, toast pops and typing again may sit beside one).

- A take that tracked nothing (the Tulvo boards take) can be given `things`: `{ "card": { "rect": [273, 143, 394, 162], "from": 5.8 } }`, measured from a mark's still in page pixels.
- Before glueing anything to a take with scrolls, run `node tools/film/seen_scroll.mjs <capture folder>`: Chrome's pictures of a scroll arrive a frame or a few after the page moves, unevenly, and `seen.json` moves the tracked things to where the picture shows them (the engine's loader reads it; it is ignored once the take is replaced).
- Check the glue on a render: render `GlueProbe` with the clip's settings at full size, then `node tools/checks/capture_glue.mjs <render> --capture <folder> --target <thing> --kind outline --colour '#rrggbb' --brand <brand> --clip '<json>'`. It measures, every frame, the real thing in the picture against its tracked rectangle and the drawn line (or the lifted layer) against the real thing.

Sounds: `node tools/audio/capture_sounds.mjs <capture folder> --brand <brand> --options '<clip settings>' --offset <film seconds> --job jobs/<job> --write` places the brand's sound slots from the event log through the time map and adds them to the job's `audio/sfx.json` for `tools/audio/mix.py`. The slots are files in `brands/<brand>/sounds/<slot>.mp3`: soft-click, crisp-click, soft-keyboard, crisp-keyboard, small-whoosh, large-whoosh, success-chime, toast-pop, drag-lift, drag-drop. A missing slot is placed nowhere and listed; the tool never fetches or makes a sound (the kit is a paid call, asked for first).

The previews (`move-stage-<name>`, `move-product-<name>`) take `capture`, `second`, `things`, `roles` (which tracked thing is the main card, the link, the field, the toast, the list...) and `address`. `product-sheet.jpg` is one still of each.

## Motion blur

Fast things carry shutter blur matched to their speed and their direction, and nothing slow enough to read is ever softened.

- `MotionBlur` (from `kit/moves`) wraps what moves and takes `x` and `y`, the pixels it travels in this frame. `useTravel()` gives that distance for any place written as a function of scene time: `travel((t) => placeAt(t))`.
- The blur is half a frame of travel (a half-frame shutter) and starts above 0.4% of the frame width per frame, so a settle, a drift and anything at rest stay sharp.
- The moves that leave or cross at speed already use it: relay scroll, slide-off reveal, momentum cut, the shared element, the door's tile, the cursor, the near plane of a parallax camera and the wheels of a number roll. Moves that change size at speed (push through, zoom-through swap) soften with their speed in the same way.
- Do not wrap text that is being read. If it must move while it is read, it is moving too fast.

## What to check when a move is added or changed

Render it at 60 frames a second and look at every frame where it starts, where it is fastest and where it lands (`tools/study/sheets.sh window`). A move passes when:

- it leaves speeding up and arrives slowing down, and nothing is at a constant speed, pops in, strobes or steps;
- its last frames get closer together, and no text bounces by a pixel (the browser places text on whole pixels from top to bottom, so overshoot is for boxes, not for small moves of type);
- two words, two numbers or two scenes are never printed over each other unless it is a dissolve one tick long under movement;
- a number and its shape come to rest together;
- nothing with detail is enlarged enough to smear, and nothing readable is blurred;
- the page is never left empty for more than a frame or two inside a transition;
- `python3 -I tools/checks/smoothness.py <clip> --planned-cuts <its planned instant changes>` reports nothing.

## Add a move

A move enters the library only with a working example and a catalogue entry.

1. Write the component in `engine/src/kit/moves/<Name>.tsx` and export it from `engine/src/kit/moves/index.ts`. Follow the moves already there: cues in seconds, lengths from `useMotion()`, colours from `useStage()`, type from `useBrand()`, sizes from `useVh()`.
2. Keep to the rules in `knowledge/craft/02-motion.md`: springs on position and scale only, exits shorter than entries, nothing at a constant speed except a drift, no text scaled while it is read, fixed-width figures for numbers that change, nothing random.
3. Add a scene that shows it once in a small realistic setup to `engine/src/library/motion/demos/`, and add it to the list in `demos/index.ts`. That gives it a composition named `move-<name>` and a place in the reel.
4. Add its entry to `index.json` with the same `name`. Mark it `reviewed` only after the checks above, with the date and its planned instant changes.
5. Run `npm run typecheck` in `engine/`, render its preview here as `<name>.mp4`, and watch it at full speed and frame by frame before anyone uses it.
6. If it is a new way of changing scene, give it a number and a row in `knowledge/craft/03-transitions.md`. Techniques 1, 2, 4, 7, 10, 13, 14, 15, 16 and 17 have working examples here.

A move that cannot be made to look right stays out.

## Transitions between captures

The `capture-transition` family in `index.json` is `CaptureJoin` (`engine/src/kit/capture/transitions.tsx`) with one transition name. It joins shot A to shot B on one film clock: two takes, or two parts of one take split at the click that opens the next page.

```tsx
const parts = splitAtClick({ src, cursor, tracks, look: 'product-demo' });
<CaptureJoin a={parts.a} b={parts.b} transition="zoom-through" from={{ x: 12, y: 381, width: 223, height: 33 }} />
```

Leave `transition` out to take the look's own (`pickTransition` gives a film's n-th join, never the same twice in a row). The join hangs on shot A's last click; `click` picks another, `at` gives a film time for a take with no click. `from` and `to` are the thing that is entered, grows or flies, and where it lands (a tracked name or a page rectangle measured from a mark's still). Compositions are `move-join-<name>` in the "capture-transition" folder; their `options` prop takes `{"join": {...}, "a": {...}, "b": {...}}`. Check a join with `node tools/checks/capture_transitions.mjs <capture folder> [--second <folder>] --transition <name> --options '<json>'`.

## Other sizes: 9:16, 1:1 and 4:5

The `capture-relayout` family is the same `CaptureShot` in a 9:16, 1:1 or 4:5 frame. Re-lay a film only when asked, after the 16:9 master is approved (`DESIGN.md` section 1). Nothing changes in the scene: a composition at another size re-lays each staging for its frame (`engine/src/kit/capture/relayout.ts`): full bleed for the social vertical look, a card, a browser window or a phone frame for the others, stacked takes for two people and the montage. The camera follows the action inside the wide recording: it keeps the acted-on thing and the pointer inside the safe area with a margin on every frame, sets off 150 ms after the pointer and trails it, pulls back while the pointer rests when its next move is longer than a close view holds, holds still during reading holds, and never goes past the recording's sharpness. On 9:16 the safe area is the band Instagram, TikTok and YouTube Shorts all leave free, less the caption slot (captions sit at the band's bottom in a tall frame). A take recorded at phone size fills the 9:16 frame with the touch pointer.

`<SafeAreaOverlay platform="all" />` (`engine/src/kit/capture/safeareas.tsx`) draws the platforms' buttons and captions over a preview. It is a preview aid: never put it in a film. Compositions are `move-relayout-<name>` in the "capture-relayout" folder (props `capture`, `things`, `options`, `safeAreas`). Check a re-layout with `node tools/checks/capture_relayout.mjs <capture folder> --size 9:16 --options '{"look": "social-vertical", "things": {...}}' [--text-rect x,y,w,h] [--render <mp4>]`, a join with `capture_transitions.mjs ... --size 9:16`. `relayout-sheet.jpg` is one still of each.
