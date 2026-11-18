# Text moves, transitions, hook openers and shader backgrounds (LIBRARY-PLAN phases 4 and 5): the builders' brief

Every builder reads this first, then `LIBRARY-PLAN.md` sections 4 (phases 4, 5) and 6, `library/motion/README.md`, and the reference files named below. The studio is a public repository written for marketers: plain words, and every claim about a move says what was and was not checked.

## The engine and its rules

- Remotion 4.0.543, React 19, TypeScript, in `engine/`. Every move is a **pure function of the frame**: no `useState`, no `useEffect`, no random without a seed (`rng(seed)` from `kit/motion`), no `Math.random`, no `Date`.
- Time is seconds on the scene clock: `const m = useMotion(); m.t`. Cues are `at` (start) and `out` (leave, optional). Lengths come from the timing tokens through `m.seconds('tick' | 'quick' | 'base' | 'scene' | 'hero')`, scaled by the energy preset (calm, confident, hype). Never write a length in milliseconds of your own; a count of pieces times the shared gap is fine. Easing: `easing.arrive` (entering, settling), `easing.travel` (crossing), `easing.leave` (exits, shorter: `EXIT_SHARE`). Overshoot only through `m.settle(at, token)` and only on position or scale, never opacity.
- Colours only from the brand and stage: `useStage()` gives `page, ink, second, accent, onAccent, soft, line, shade…`; `useBrand()` gives fonts (`headline`, `label`, `product`, `accent` voices), shapes, logos. Never write a hex colour or a font name. Sizes are per cent of frame height (`useVh()`), places are pixels of the frame (`useVideoConfig()` width and height).
- **All four sizes.** Every move must look right at 16:9 (1920×1080), 9:16 (1080×1920), 1:1 (1080×1080) and 4:5 (1080×1350). Text sizes go through the shared splitter's `useFitSize`, which shrinks a line that would not fit 86% of the width. A move that travels across the frame uses the frame's own width and height, not fixed numbers.
- Flash safety (`tools/checks/flashes.py`): no more than three flashes a second over a quarter of the frame; a full-frame flash or invert is one frame-pair at most, and the move's note says so.
- Motion blur on anything fast: `MotionBlur` and `useTravel` from `kit/moves/core`. Nothing at reading speed is blurred.
- One emphasis per beat; text holds long enough to read (words ÷ 3 + 0.4 s) before it leaves, in the demo.

## Text moves (`engine/src/kit/type/`)

- Use the shared splitter: `SplitText`, `splitText`, `useFitSize`, `rankOf` (orders: start, end, centre, edges, random) from `kit/type/split.tsx`, and `useTextClock`, `asLines`, `TextMoveProps` from `kit/type/core.ts`. Read `kit/type/MaskRise.tsx` (the reference move) and `src/library/motion/text/batch0.tsx` (the reference demo batch).
- Every move takes `TextMoveProps` (`lines`, `at`, `out`, `size`, `align`, `colours`, `style`) plus its own few props. A starred word (`*word*`) is in the accent voice. If the splitter lacks something you need, **do not edit it**: write a helper in your own file and report what you would add.
- One move per file, `engine/src/kit/type/<Name>.tsx`, with a header comment in the studio's style (what it is for, in one line; credit if after a source) and a doc comment on the component (what it does, its props).

## Transitions, openers, shaders

- Transitions take `children` (outgoing), `next` (incoming, its clock starts at 0 when it takes over: wrap it in `<Sequence from={…}>`), `at`; read `kit/moves/PushThrough.tsx` and `kit/moves/MomentumCut.tsx` for the house pattern. Files in `engine/src/kit/transitions/<Name>.tsx`. Remotion's `@remotion/transitions` (installed, 4.0.543) may be used inside a move where it helps; its presentations are fine to use. Ports from gl-transitions (MIT) carry a per-file credit line naming the original transition, its author and `gl-transitions (MIT)`. A shader transition is drawn on a `<canvas>` with WebGL inside the move, rendered per frame from `m.t` only.
- Hook openers (first two seconds, pattern interrupts made in the engine): `engine/src/kit/openers/<Name>.tsx`. Each takes `at` and its content (`lines`, or `children`), and hands over to the film (an `out` or a `next`).
- Shader backgrounds: `engine/src/kit/shaders/<Name>.tsx`, built on `@paper-design/shaders-react` (0.0.82, Apache-2.0, installed), coloured from the brand only, slow, frame-driven (pass the shader's time/frame from `m.t` or the real clock so a render is the same every time: check the package's props for a `frame` or `speed: 0` + `frame`), with a `reduced` grain/contrast so text on top stays readable.

## Your batch's files (no one else touches them)

- The move files you create (listed in your task).
- `engine/src/library/motion/<family>/<batch>.tsx`: export `const <batch>: SizedDemo[]` (it exists, empty). Each demo: `{ name, title, seconds (3 to 6), Scene }`; `Scene` gets `{ page, format }`. Shader demos set `bare: true`. A demo shows the move once, in a small realistic setup (a product headline, an offer, a number), centred with `Centre` from `../parts`. Cue the exit so the text is read first.
- `library/motion/_parts/<family>-<batch>.json`: your catalogue entries, an array, each:
  ```json
  { "name": "mask-rise", "family": "type", "component": "MaskRise", "file": "engine/src/kit/type/MaskRise.tsx",
    "does": "…", "use_when": "…", "avoid_when": "…", "technique": null,
    "props": { "lines": "…", "at": "…" },
    "sound": { "group": "swish", "feel": ["soft", "short"], "when": "each line | start | land | each letter", "note": "…" },
    "sizes": ["16:9", "9:16", "1:1", "4:5"],
    "credit": "After Leonxlnx/cinetic, \"mask reveal\" (MIT)",
    "composition": "move-mask-rise", "preview": "library/motion/mask-rise.mp4",
    "reviewed": true, "reviewed_on": "2026-11-18", "planned_instant_changes": [], "planned_note": "only when there are planned instant changes" }
  ```
  `family` is `type` for text arrivals and typing, `emphasis` for text emphasis (`type-emphasis` is not a family), `caption` for caption styles, `transition` for transitions, `opener` for hook openers, `shader` for shader backgrounds. Sound groups: click, interface, pop, swish, whoosh, riser, impact, glitch, transition, ambience, foley, chime. Feel words: soft, hard, bright, dark, warm, cold, airy, heavy, light, short, long, tight, wide, deep, high, low, clean, gritty, digital, organic, metallic, glassy, wooden, paper, plastic, subtle, bold, playful, premium, calm, tense, fast, slow, rising, falling, rhythmic. `null` sound for moves that should be silent.
- The previews `library/motion/<name>.mp4`.
- Do **not** edit `kit/type/index.ts`, `kit/type/split.tsx`, `kit/type/core.ts`, any `index.ts` in the gallery, `library/motion/index.json`, `Root.tsx`, `kit/backgrounds/*`, anything under `brands/`, `jobs/`, `engine/public/`, or `package.json`. Import your moves in your batch file straight from their files (`../../../kit/type/FadeUp`). Do not `git add` or commit.

## Build, look, check (every move)

1. Typecheck: `cd engine && npx tsc --noEmit 2>&1 | grep -v "trust settings" | grep -E "kit/(type|transitions|openers|shaders)|library/motion/(text|transitions|openers|shaders)"` (other people's files may have errors of their own; yours must have none).
2. Stills in all four sizes. Renders need the browser, which cannot start inside the command sandbox: run render commands with the sandbox off. Use `--concurrency=2` and `--public-dir=out/lib-public` (a 1 MB copy of the brands, kit and capture lists: `engine/public` holds 14 GB of job footage, which every bundle would otherwise copy). For each move, stills at three moments (mid-entry, landed, mid-exit) in each size:
   `npx remotion still move-<name> out/lib/<name>-<fmt>-<frame>.png --frame=<f> --props='{"format":"9:16","fps":30}' --scale=0.5`
   (frames are at the fps you pass; 16:9 default is 60 fps). Look at every still yourself (Read the PNG). Fix anything cut off, crowded at the edges, overlapping, unreadable, or off-centre.
3. Preview: `npx remotion render move-<name> ../library/motion/<name>.mp4 --scale=0.5 --concurrency=2` (16:9, 60 fps, 960×540, like the existing previews).
4. Checks on the preview, from the studio folder: `python3 tools/checks/smoothness.py library/motion/<name>.mp4 --planned-cuts <comma list or omit>` and `python3 tools/checks/flashes.py library/motion/<name>.mp4`. Typing, decoding, split-flap and other stepped changes are planned instant changes: list their times in `planned_instant_changes` (seconds of the preview) and pass them as `--planned-cuts`. Both checks must pass (exit 0) or the move's entry must say exactly what was flagged and why it is meant.
5. Keep the previews small (the existing ones are 20 to 300 KB).

## Report back (short)

Per move: name, one line on what it does, the sizes checked by eye, smoothness and flashes results, anything you are unsure of. Then anything you wanted from the shared splitter. Then total MB of previews.
