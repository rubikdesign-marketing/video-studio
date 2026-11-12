# Video engine

The Remotion project every video is built on, for any brand in `brands/`. Remotion 4.0.542, React 19, 60 fps masters.

The engine knows no brand by name. Each brand is a folder in `brands/` with a `brand.json`; `tools/brand/sync.mjs` tells the engine which brands exist and copies their fonts and logos here. **Run `node tools/brand/sync.mjs` after editing anything in a brand folder** (the scaffold and every render run it for you).

## What is here

| Path | What |
|---|---|
| `src/brands/index.ts` | The list of brands. Written by `tools/brand/sync.mjs`; never edit it. |
| `src/kit/brand.tsx` | `BrandProvider` and `useBrand()`: the brand in use, and its fonts (a render waits for them). `brandNames` and `defaultBrand` for props. |
| `src/kit/tokens.ts` | The shape of `brand.json`, and how it becomes colours by stage and role, type voices, shapes and logo files. The two stages are `light` and `dark`. |
| `src/kit/motion.ts` | Timing tokens (`tick`, `quick`, `base`, `scene`, `hero`), easings (`arrive`, `travel`, `leave`), springs (`settle`, `pop`), the energy presets (`calm`, `confident`, `hype`), and the `useMotion()` and `useRealTime()` hooks. |
| `src/kit/fonts.ts` | Loads the fonts of the brand in use, from local files only. |
| `src/kit/ui.tsx` | `Stage`, `Panel`, `Grain`, `Vignette`, `Headline`, `Label`, `Pill`, `Button`, `Screen`, `Cursor`, `Pointer`, `ClickRing`, `Wordmark`, `Confetti`. |
| `src/kit/CaptureClip.tsx` | `CaptureClip`: plays a product capture made by `tools/capture/capture.mjs` inside a frame region with the engine's own motion on top: the pointer re-pathed between the recorded clicks in a chosen style, click, hover and typing effects, a camera that zooms in on each action from `tracks.json` and follows the pointer, and speed ramps, freezes, jumps, rewinds, pins and loops. `look` sets all of it in one word; any single setting can be given on its own. By default it hides the product loading: a clip that plays from the recording's start begins 0.2 s before the first page load ends (or at the first mark, if that is earlier), and every later load longer than 0.6 s plays faster, from the end of the step to the settled moment, so it lasts 0.6 s with the "Sped up" label; loads of 0.6 s or less play as they are. `trimLoads={false}` turns this off, and a clip given its own start or a hand-set time effect over a load keeps what it was given. `pointerAt`, `markAt` and `clicksOf` read a capture's timings. |
| `src/kit/capture/` | What `CaptureClip` is made of, as pure functions of time so the checks can measure them: `data.ts` (reading `cursor.json` and `tracks.json`), `timemap.ts` (film time to recording time), `pointer.ts` (the re-pathed pointer), `camera.ts` (auto-zoom, follow and the hand-set moves), `looks.ts` (the eight look presets), `plan.ts` (all of it worked out once) and `draw.tsx` (the pointer styles and effects). |
| `src/kit/capture/staging.tsx`, `glue.ts`, `emphasis.tsx`, `sound.ts` | Phase 4 part B. `CaptureShot` places a capture in one of twenty stagings (card, browser frame light or dark, full screen, floating, isometric, laptop, monitor, tablet, phone, tall crop, stacked, split of two or three takes on one clock, picture in picture, grid, wall, before and after, mail, terminal); a look picks one by itself. `emphasis` on `CaptureClip` or `CaptureShot` adds the animations on the product (lift, isolate, fly out, focus, outline, underline, ring, sweep, magnifier, callout, arrow, connection line, step badges, typed again, toast pop, success moment, blur reveal, privacy blur), all placed by `anchorOf` in `glue.ts` from the tracked rectangle through the same camera as the picture, and cut from the recording's own pixels where they move or enlarge the thing. `things` gives fixed places to a take that tracked nothing; `seenTracks` moves tracked things to where the picture really scrolled (`seen.json`, from `tools/film/seen_scroll.mjs`). `planSounds` places the brand's sound slots from the event log (`tools/audio/capture_sounds.mjs` writes them for `mix.py`). `GlueProbe` is a measuring composition for `tools/checks/capture_glue.mjs`. |
| `src/kit/capture/joins.ts`, `transitions.tsx` | Phase 5. `CaptureJoin` joins two captures, or two parts of one (`splitAtClick`), with one of twenty transitions on one film clock: cut, match cut on the click, snap cut, zoom through, shared element, container grow, push, soft slide, depth push, circle reveal, card flip, stack shuffle, grid zoom, scroll relay, cursor drag, whip, window split, device swap, blur dissolve, cross-dissolve. The plan (`planJoin`, pure) hangs the join on the click in `cursor.json`, enters or flies the clicked thing (tracked, or a page rectangle), pushes the way the pointer last moved, starts a scroll relay at the take's own scroll speed, carries one pointer across the join, and starts shot B on shot A's camera view where the join passes through the click. Every join that is not a cut lasts the `scene` token for the film's energy (600 to 900 ms); whip and snap cut are hype only. Each look names its transitions (`pickTransition`). `tools/checks/capture_transitions.mjs` measures the plan. |
| `src/capture/` | `CapturePreview`: watch a capture with its motion in Remotion Studio, with a look, a pointer style, a click effect and any other setting as JSON. Empty `capture` means the newest one. `load.ts` finds and loads a capture. |
| `src/kit/Captions.tsx` | The fixed caption design, driven by a captions file. `CaptionBar` is the same bar standing still, for sheets. |
| `src/smoke/` | `Smoke`, a six second composition that proves a brand's fonts, colours and logo, the presets and the captions work. |
| `src/sheet/` | `BrandSheet`, one still frame for approving a brand: palette, logo, type, button, pill and captions on both pages. |
| `src/Root.tsx` | Registers the compositions. |
| `public/brands/<name>/` | Each brand's fonts and logos, copied by `tools/brand/sync.mjs`. Never edit; edit the brand folder. |
| `public/jobs/<job>/capture/<id>/` | A capture's recording, `cursor.json` and `tracks.json`, put here by `capture.mjs run` (never synced). `public/captures.json` lists them, newest first. |
| `public/kit/` | Files the kit itself needs (the grain tile). |
| `src/products/` | Real product screens rebuilt from captures, one folder per brand. `src/products/tulvo/` is Tulvo's web app (`TulvoUi-<id>` compositions, `<AppStage>` to place a screen in a scene); its README says how to use it. |

## Commands

```
npm install            # once
npm run dev            # Remotion Studio: change brand, preset, stage and captions in the props panel
npm run typecheck
npm run smoke          # renders out/smoke.mp4 in the default brand

# another brand: every composition takes a "brand" prop (a folder name in brands/)
npx remotion render Smoke out/smoke-demo.mp4 --props='{"brand":"demo"}'
npx remotion still BrandSheet out/brand-sheet-demo.png --props='{"brand":"demo"}'
```

The first render downloads Chrome Headless Shell (`npx remotion browser ensure`). After that a render needs no network.

## Add a scene

1. Create `src/scenes/<Name>.tsx`. Build it from the kit, and give each piece its cue in seconds:

   ```tsx
   export const Opening: FC = () => (
     <>
       <Headline lines={['Work, *finally*', 'in one place.']} at={0.3} out={3.2} />
       <Label at={1.1} out={3.2}>New this week</Label>
     </>
   );
   ```

   `at` and `out` are seconds on the scene's own clock, which starts at 0 where its `<Sequence>` starts. Take them from the voice timings: the picture is fitted to the voice, and there is no time warp.

2. Mount it in a composition, inside one `BrandProvider`, one `MotionProvider` and one `Stage`, with `Captions` as the top layer:

   ```tsx
   <BrandProvider brand={brand}>
     <MotionProvider preset={preset}>
       <Stage name="dark">
         <Sequence from={0} durationInFrames={210}><Opening /></Sequence>
       </Stage>
       <Captions data={captions} enabled={showCaptions} />
     </MotionProvider>
   </BrandProvider>
   ```

   A scaffolded job gets this for free: `tools/film/scaffold.mjs` writes the job's brand (`job.json` "brand", else `default_brand` in `studio.json`) into `film.json` and wraps `Film.tsx` in the `BrandProvider`.

3. Register the composition in `src/Root.tsx` with a zod schema for its props, including `brand: z.enum(brandNames)`. `src/smoke/Smoke.tsx` is the pattern to copy.

A captions file is `{ "lines": [{ "start", "end", "words": [{ "text", "start", "end", "highlight"? }] }] }`, with times in seconds from the start of the film. Check it with `captionsSchema.parse()`.

## Rules

- **Colours, fonts, shapes and logos come only from the brand in use.** No hex or rgb value, no typeface name and no brand name anywhere in `src` (outside `src/brands/index.ts`, which is generated, and `src/products/<brand>/`, where a rebuilt product screen must match the real product exactly). Inside a `Stage` or a `Panel`, use `useStage()` to get colours by role: `page`, `ink`, `second`, `accent`, `warm`, `soft`, `line`, plus `onInk`, `onAccent` and `shade`. For type voices, shapes and caption settings use `useBrand()`. To change a colour, change `brands/<name>/brand.json` and run `node tools/brand/sync.mjs`.
- **Timings come only from the motion tokens.** Use `useMotion()`: `seconds('base')`, `stagger`, `settle(at)`, with `easing.arrive`, `easing.travel` and `easing.leave`. No hand-picked durations. Exits use `EXIT_SHARE`. Springs are for position and scale, never opacity.
- **Backgrounds run on real time.** `Stage` and `Grain` use `useRealTime()`, so they keep moving through holds and do not restart at scene changes. Keep one `Stage` per film, outside the `<Sequence>`s. Grain is re-seeded every frame.
- **One preset per film.** Set it once on `MotionProvider`. Do not scale timings by hand.
- **Sizes are a percentage of frame height** (`useVh()`), so a scene holds at any frame size.
- **Type:** four voices, each set by the brand: headline (film type and captions), accent (one *starred* word per line at most), label (labels and numbers), product (only inside product UI). A brand without an accent typeface still takes a starred word: it is set in the headline typeface, heavier, or in italic if the file has no heavier weight. No coding-style typeface, and no dots as separators or inside pills.
- **No network at render time.** A brand's fonts are local files: in its `fonts/` folder, or in an installed npm package named in its `brand.json`.

## Not ported yet

- Sound inside Remotion: voice, music, sound effects and ducking. `@remotion/media` is not installed; sound is mixed outside the engine (`tools/audio/mix.py`, with capture sounds placed by `tools/audio/capture_sounds.mjs`).
- The camera for drawn scenes: depth layers and focus pulls (`Camera` has drift, push and follow; captures have their own camera in `CaptureClip`).
- Transitions between scenes, and motion blur.
- Type moves other than word rise: number roll, type-on, swap, letter stagger, weight shift, tracking settle.
- The other four style families (Glass, Colour field, Editorial, Blueprint).
- The offer ticket.
- Lint and formatting settings.

From the Black Friday film, the time warp, the scenes and their data were left behind on purpose.
