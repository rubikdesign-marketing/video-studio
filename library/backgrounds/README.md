# Backgrounds

Twelve animated backgrounds a film can stand on. Each is built only from the colours of the brand in use, keeps moving through holds, and stays quieter than whatever sits on it. All twelve were watched moving and measured on 11 Nov 2026, for the brands tulvo and demo.

`index.json` is the catalogue: what each one looks like, which pages it is made for, which style families and kinds of video it suits, and its props. `measured.json` says how much each one moves at each energy. The components are in `engine/src/kit/backgrounds/`.

| Stages of the six style families | Moving treatments, for any family |
|---|---|
| Paper, Night, Glass, Colour field, Editorial, Blueprint | Aurora, Horizon, Waves, Spotlight, Perspective lines, Soft shapes |

## Which page

Ten work on the light page and the dark page and are the same design on both. Two are made for one page each, because they are the two halves of one idea:

- **Paper** is the light page's own stage: one soft light and almost nothing else. On a dark page that is only a dimmer Night, so use Night there.
- **Night** is the dark page's own stage: pools of light in the dark. On a light page the pools are only a pale wash, so use Paper there.

Either still draws on the other page, so a film never breaks, but the catalogue, the reel and the previews show each on its own page only.

## Energy

Every background takes `energy`. Choose one per film.

| Energy | What it looks like | What `tools/study/profile.py` says |
|---|---|---|
| `rest` (the default) | Drifts so slowly that it reads as still: a soft light moves two to seven pixels a second | Still: no quarter-second counts as moving |
| `alive` | A drift the eye can follow when it looks for it: soft lights at 15 to 60 pixels a second, anything with an edge under 25 | About twice the movement of rest; see below |
| `peak` | About twice alive. The most a background may move while staying quieter than the content | A little more again |

Soft, low-contrast drift measures far lower than it looks. `profile.py` calls a quarter-second "moving" when the average pixel changes by about four and a half levels of 255 a second; a soft wash would have to turn over every few seconds to reach that, which is no longer a slow drift. So most backgrounds stay under that line even at `peak`, and a hold on them still counts as rest. The figures for each background, page and energy are in `measured.json`: compare `mean_movement` across the three energies.

Bands of light, waves, floor lines and the blueprint path travel one way only: a band that went and came back over the same ground read as a loop. Lights wander on paths that do not repeat for minutes. No single turn is shorter than 10 seconds at `peak`.

## See them

In `engine/`:

```
npx remotion render Backgrounds out/backgrounds-tulvo.mp4 --props='{"brand":"tulvo","energy":"alive"}'
npx remotion render Backgrounds out/backgrounds-demo.mp4 --props='{"brand":"demo","energy":"alive"}'
```

The reel shows every background made for the light page for three seconds each, then every one made for the dark page, with a sample headline and card in the middle. Set `energy` to `rest` or `peak` to see the other levels. `backgrounds-tulvo.mp4` here is that reel at half size.

One background alone is the composition `bg-<name>` (props `brand`, `page`, `energy`; four seconds, or `seconds` for longer, to watch for a loop or a pulse).

The preview pictures here (`<name>-light.jpg`, `<name>-dark.jpg`) are frames of the reel at `alive`: the middle of each background's three seconds. The shot numbered `n` in the reel, counting from 0, has its middle at frame `n * 180 + 90`:

```
npx remotion still Backgrounds ../library/backgrounds/glass-light.jpg --frame=270 --image-format=jpeg --scale=0.5 --props='{"brand":"tulvo","energy":"alive"}'
```

`all-backgrounds.jpg` is every preview on one sheet: the light page in the top two rows, the dark page below.

## Use one in a scene

Put it first inside the film's one `Stage`, outside the `<Sequence>`s, so it runs on the film's real clock and does not restart at scene changes. The Stage lays the brand's vignette and grain over it.

```tsx
import { Aurora } from '../../kit/backgrounds';

<Stage name="dark">
  <Aurora energy="alive" />
  <Sequence from={0} durationInFrames={210}><Opening /></Sequence>
</Stage>
```

- `energy` is `rest` (the default), `alive` or `peak`. If it must change, change it on a cut: each level runs its clock at a different rate, so a change in the middle of a shot would show as a jump.
- `seed` (a number) changes where everything starts, so two films with the same background do not match.
- A moving treatment takes `over` to lie on top of another background without its own page colour: `<Night /><Horizon over rise={rise} />`.
- `Spotlight` follows `point` (frame pixels, the same places a `Cursor` uses). `Horizon` comes up with `rise` from 0 to 1. Move both with the scene's own motion tokens.
- On `Colour field` the frame is the accent colour, so type takes the stage's `onAccent` colour, not its ink.

## Grain over a strong colour

The Stage's grain is set for each page's own colour. Over a fill near the middle of the range, such as the accent colour edge to edge, the same grain reads several times stronger and alone measures as movement. A background like that calls `useGrainShare(share)` from `engine/src/kit/ui.tsx` as it draws, and the Stage's grain takes only that share on those frames. `Colour field` takes a fifth on the light page (since 11 Nov); on the dark page it keeps the full grain, which is already light. Do the same in any new background that fills the frame with a strong colour.

## Add one

1. Write `engine/src/kit/backgrounds/<Name>.tsx`. Start from `useBackdrop(energy, seed)` in `shared.tsx`: it gives the real-time clock scaled by the energy (`t`), the stage colours, `drift` and `sway` for a slow wander, `travel` for steady one-way movement, and the helpers `pool`, `surround`, `band`, `mix`, `smoothPath` and `quietCentre`. Return a `<Fill>`.
2. Keep to the rules: colours only from the stage's roles; no dots of any kind and only solid lines; nothing sharp in the middle of the frame; no `Math.random` or `Date`; every value a smooth function of `t`; gradients, SVG and transforms first, and at most one blurred layer.
3. Tune it at `alive`, then check the other two. Soft things may travel; anything with an edge moves much less. Nothing goes back and forth along one line.
4. Export it from `engine/src/kit/backgrounds/index.ts` and list it in `components` in `engine/src/library/backgrounds/catalogue.ts`.
5. Add its entry to `index.json` here, with the `pages` it is made for. The reel and its `bg-<name>` composition then appear on their own.
6. Run `npm run typecheck` in `engine/`, render the reel for two brands, measure a `bg-<name>` clip at each energy with `tools/study/profile.py` and `tools/checks/smoothness.py`, add the figures to `measured.json`, and save its preview pictures here.
