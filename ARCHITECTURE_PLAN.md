# Review studio upgrade: architecture plan

Status: **draft for owner approval**, 18 Nov 2026. Nothing is built. No worker starts until this is approved.

Direction (owner, 18 Nov): upgrade the review studio into a light editor. Do not build a full editor from scratch. Claude still makes the film. The studio becomes the place where a person sees it, adjusts the safe things directly, and sends the rest as notes.

## 0. Decisions

Settled 18 Nov 2026. The owner left these five to the studio ("you decide on the best things"), so the recommendations stand. Any of them can still be changed before the workers start.

| # | Decision | Chosen | Why |
|---|---|---|---|
| D1 | Which look the studio takes | **Night workspace by default, paper as the light theme.** Night values from the video engine page (`#03050a`, `#010b24`, lime `#bbfc9e`). Paper values from today's review page (`#F5F3EF`, ink `#101113`, blue `#2B5CE6`). | A dark surround makes the film easier to judge. Both sets already exist, so no colour is invented. |
| D2 | Typeface | **Instrument Sans**, already bundled in `studio/fonts/`. Onest and Chakra Petch stay on the marketing page. | No new font licence. Chakra Petch is close to a coding face, which studio rule 20 rules out for the product. |
| D3 | Stack | **React 19, TypeScript, Vite, Zustand**, in a new `studio/app/`. The release ships the built files, so a customer never runs a build. | Resizable panels, undo and a typed inspector are painful in one HTML file. React 19 and TypeScript 5.9 are already pinned by the engine. |
| D4 | What the page may change directly | **Only on-screen text and its timing inside a scene.** Everything else stays a note for Claude. | Scene lengths come from the voice. Moving them by hand would break sync with sound and captions. |
| D5 | Base branch | **A new `studio-editor` branch from `main`**, workers in their own worktrees. | The working copy is on `rubik-ep1-v3` with uncommitted work that must not be touched. |

## 1. What exists today

- `studio/review.html` (354 lines) and `studio/paper.html` (333 lines): single files, inline CSS, plain JavaScript, no build.
- `studio/server.mjs` (224 lines): Node HTTP on port 4317, JSON files on disk. Endpoints: `/api/jobs`, `/api/review`, `/api/draft`, `/api/send`, `/api/paper*`, `/media/`, `/frames/`, `/clip-media/`.
- The film's shape lives in `engine/src/jobs/<slug>/film.json`: scenes with `start`, `end`, `energy`, voice `lines`, and `texts` (each with `lines`, `at`, `out`).
- Notes leave the page as `jobs/<job>/review/batch-NNN.json`. A waiting Claude session picks them up (`studio/wait-for-notes.mjs`).
- This repo is the source. `projects/damex-video-engine` is a release build made from it through `release/`.

Gaps: fixed two-column layout, no dark theme, a scene strip with no zoom or snapping, no loading or rendering state, manual reload for new versions, four shortcuts in a line of text, no undo, two pages with duplicated styles.

## 2. Principles

1. **The file on disk stays the truth.** The page never holds the only copy of anything.
2. **Non-destructive.** Direct edits are saved as a list of changes beside the film, not written over it. Applying them is a separate, checked step.
3. **Old pages keep working** at `/` and `/paper` until the new app reaches parity. The new app lives at `/editor`.
4. **Studio rules apply to the app itself:** no coding typeface, no dot grids, plain wording for marketers.
5. **No promise the data cannot keep.** No drag handles on a flat video. No track mute without separate sound files.

## 3. Workstream A: look, layout and polish

### 3.1 Tokens

One file, `studio/app/src/theme/tokens.css`. Two tiers, the same pattern as the marketing page: raw values, then roles. Components use roles only.

| Role | Night | Paper |
|---|---|---|
| `--surface-page` | `#03050a` | `#F5F3EF` |
| `--surface-panel` | `#010b24` | `#FFFFFF` |
| `--surface-raised` | white at 6% | `#FFFFFF` with a hairline |
| `--surface-canvas` | `#000000` | `#0B0C10` |
| `--text-strong` | white at 96% | `#101113` |
| `--text-body` | white at 70% | `#626670` |
| `--text-quiet` | white at 55% | `#8A8F98` |
| `--line` | white at 12% | `#E4E2DE` |
| `--accent` | `#bbfc9e` | `#2B5CE6` |
| `--on-accent` | `#050b14` | `#FFFFFF` |
| `--good` / `--warn` | `#63a65e` / `#ffa724` | `#1F8A4C` / `#F7A878` |

- Type: Instrument Sans 400 to 700. Sizes 12, 13, 15, 18, 24. Tabular numbers for every time.
- Radii: 4px controls, 8px panels, full pills for chips. The 14px card radius retires.
- Motion: `--ease: cubic-bezier(0.2, 0, 0, 1)`, 150ms for controls, 250ms for panels. Everything respects `prefers-reduced-motion`.
- Glass: floating toolbars and the shortcut sheet only (panel colour at 80% with a 16px blur). Never behind body text.
- Contrast: every text role meets WCAG 2.2 AA on its surface. Worker 1 proves it with a check.

### 3.2 Workspace layout

```
┌ top bar: film, version, reviewer, theme, render status ───────────────┐
│ left panel      │ canvas (film, overlays,        │ right panel         │
│ scenes, notes,  │ floating toolbar)              │ inspector, note     │
│ versions        │                                │ editor              │
├─────────────────┴────────────────────────────────┴─────────────────────┤
│ timeline: ruler, scenes, voice, on-screen text, notes, energy          │
└────────────────────────────────────────────────────────────────────────┘
```

- Left, right and timeline resize by dragging and collapse with a key. Sizes are remembered per browser.
- Under 1080px wide, the side panels become drawers and the timeline stays.
- Modes in one shell: **Review** (today's review page) and **Paper edit** (today's transcript page).

### 3.3 Polish

- Shortcut sheet on `?`, and a command menu on `Cmd+K`, both built from one shortcut table.
- Timeline zoom with pinch or `Cmd+scroll`, fit-to-width on `Shift+Z`, scrubbing that follows the pointer at 60 frames a second.
- Visible states: loading skeletons, "rendering scene 4 of 9", snap guides, unsaved and saved, sent.

## 4. Workstream B: features

Six features, each backed by data the engine already writes.

| # | Feature | What the user gets | Backed by |
|---|---|---|---|
| F1 | Timeline with lanes | Scenes, voice lines, on-screen text, note pins and energy on separate lanes. Zoom, scrub, snap to scene edges, line starts and the playhead. Lanes can be hidden or locked. | `film.json` |
| F2 | Inspector and direct text edits | Select a scene or a text cue. Change its words or drag its start and end within the scene. The seven-word rule is checked as you type. | `film.json` `texts` |
| F3 | History | Undo and redo for every note and edit, autosave, and "restore the draft from before". | `/api/draft`, new `/api/edits` |
| F4 | Canvas overlays | Safe zones for Reels, TikTok and Shorts, title-safe, thirds, phone size, and the existing "point at an area" box. | Film width and height |
| F5 | Version compare | Two versions side by side or with a wipe, locked to the same frame. | `jobs/<job>/out/*.mp4` |
| F6 | Live status and export requests | Render progress without reloading, new versions appear by themselves, and an export request (ratio, size, quality) that Claude picks up like a batch of notes. | Per-job run log, `review/` folder |

Left out on purpose: drag, scale and rotate handles; keyframe curves; ripple delete; track solo and mute. The film is rendered flat and scene times come from the voice, so these would be controls that do nothing true.

**Later, behind a spike:** live preview with Remotion Player in place of the rendered file. It would make F2 edits visible at once. It needs the engine's films to load inside the Vite build, which is unproven. One day to test, after the four tickets merge.

## 5. Contracts

The Conductor writes these files first (ticket 0), before any worker starts. Workers import them and may not change them without a Conductor review.

`studio/app/src/contracts/film.ts`

```ts
export type Seconds = number;
export interface VoiceLine { id: string; start: Seconds; end: Seconds; text: string }
/** `at` and `out` are seconds from the start of the scene. */
export interface TextCue { lines: string[]; at: Seconds; out: Seconds }
export interface Scene {
  id: string; title: string; start: Seconds; end: Seconds; energy: number;
  lines: VoiceLine[]; texts: TextCue[];
}
export interface Film {
  job: string; slug: string; fps: number; width: number; height: number;
  brand: string; stage: 'light' | 'dark'; duration: Seconds; scenes: Scene[];
}
export interface VideoVersion { file: string; modified: number }
```

`studio/app/src/contracts/review.ts`

```ts
export type NoteKind = 'change' | 'keep';
export interface Box { x: number; y: number; w: number; h: number } // shares of the frame, 0 to 1
export interface DraftNote {
  localId: string; time: Seconds; kind: NoteKind; topic: string | null;
  must: boolean; text: string; box: Box | null;
}
export type Edit =
  | { op: 'text.words'; scene: string; cue: number; lines: string[] }
  | { op: 'text.time'; scene: string; cue: number; at: Seconds; out: Seconds };
export interface EditList { film_modified: number; edits: Edit[] }
export interface ExportRequest {
  ratio: '16:9' | '9:16' | '1:1'; height: 720 | 1080 | 2160; quality: 'preview' | 'master';
}
```

`studio/app/src/contracts/store.ts`

```ts
export interface Command { label: string; do(): void; undo(): void }
export interface History {
  run(c: Command): void; undo(): void; redo(): void;
  canUndo: boolean; canRedo: boolean; labels: { undo?: string; redo?: string };
}
export interface Playback {
  time: Seconds; playing: boolean; rate: 0.25 | 0.5 | 1; loop: [Seconds, Seconds] | null;
  seek(t: Seconds): void; step(frames: number): void; toggle(): void;
}
export type Selection =
  | { kind: 'scene'; scene: string } | { kind: 'cue'; scene: string; cue: number }
  | { kind: 'note'; localId: string } | null;
export interface SnapPoint { time: Seconds; source: 'scene' | 'line' | 'cue' | 'note' | 'playhead' }
/** Pure. `tolerance` is in seconds, already converted from pixels by the caller. */
export type Snap = (t: Seconds, points: SnapPoint[], tolerance: Seconds) => { time: Seconds; hit: SnapPoint | null };
export interface Shortcut { id: string; keys: string; label: string; group: string; run(): void }
```

New server endpoints (all under the existing job check and `safeName`):

| Endpoint | Returns or accepts |
|---|---|
| `GET /api/film?job=` | `{ film: Film, videos: VideoVersion[] }`, including `texts` |
| `GET /api/edits?job=` · `POST /api/edits?job=` | `EditList`, stored at `jobs/<job>/review/edits.json`. A post whose `film_modified` is stale is refused with 409. |
| `POST /api/export?job=` | `ExportRequest`, stored as `jobs/<job>/review/export-NNN.json` |
| `GET /api/events?job=` | Server-sent events: `{ type: 'render', scene, of }`, `{ type: 'version', file }`, `{ type: 'batch', n, status }` |
| `GET /editor` and `/editor/*` | The built app from `studio/app/dist/` |

Existing endpoints and file shapes do not change.

## 6. Worker tickets

Each worker owns its folder and touches nothing outside it. Shared files (`contracts/`, `package.json`, `server.mjs` outside Worker 4's block) change only through the Conductor.

### Ticket 0: scaffold and contracts (Conductor)

- `studio/app/` with Vite, React 19, TypeScript strict, Zustand, Vitest; the three contract files; a fixture film copied from `jobs/_sample`.
- Done when `npm run typecheck`, `npm test` and `npm run build` pass on an empty shell.

### Worker 1: design system and shell

- Owns `studio/app/src/theme/`, `studio/app/src/shell/`, `studio/app/src/ui/`.
- Builds `tokens.css`, both themes, the theme switch, the resizable and collapsible panel grid, the top bar, and the base controls (Button, Chip, Segmented, Select, Field, Tooltip, Toast, Sheet).
- Accept: both themes pass an automated AA contrast check on every text role. Panels resize, collapse and restore after reload. Layout holds at 1440, 1080 and 768 wide. No literal colour outside `tokens.css` (checked by a lint rule). Reduced motion removes every transition.

### Worker 2: timeline and playback

- Owns `studio/app/src/timeline/`, `studio/app/src/playback/`.
- Builds the `Playback` store around the video element, the ruler, the five lanes, zoom and fit, scrubbing, the `Snap` function with guides, lane hide and lock, scene loop, previous and next scene.
- Accept: the playhead stays within one frame of the video at 60 fps. `Snap` has unit tests for every source and for ties. A 50-second, 9-scene film scrubs with no dropped frame in a recorded trace. Every lane control works by keyboard. Dragging a cue calls `History.run` and never writes state directly.

### Worker 3: canvas and inspector

- Owns `studio/app/src/canvas/`, `studio/app/src/inspector/`, `studio/app/src/notes/`.
- Builds the stage with phone size, the overlay set (F4), the area box, version compare (F5), the scene and cue inspector (F2) with the seven-word check, and the note editor with topics, must-fix and frame capture.
- Accept: overlays are correct to the pixel for 16:9, 9:16 and 1:1 against reference images. Compare keeps both videos within one frame. Every inspector change goes through `History.run` and produces a valid `Edit`. A note made here produces a batch file identical in shape to one from the old page.

### Worker 4: state, history, server and shortcuts

- Owns `studio/app/src/store/`, `studio/app/src/shortcuts/`, `studio/app/src/api/`, `studio/app/src/modes/paper/`, and the new endpoints in `studio/server.mjs`.
- Builds the `History` stack, autosave, the API client, live events and status (F6), export requests, the shortcut table with the `?` sheet and `Cmd+K` menu, and the paper edit mode ported onto the new shell.
- Accept: undo then redo returns the store to a deep-equal state for every command type. Autosave survives a reload mid-edit. A stale edit post gets 409 and a clear message. Old `/` and `/paper` behave exactly as before (existing server behaviour covered by new tests first). The server still listens on 127.0.0.1 only and adds no dependency.

### Order

1. Ticket 0.
2. Workers 1 and 4 in parallel.
3. Workers 2 and 3 in parallel, on the merged shell and store.
4. Conductor: integration pass, then the release step below.

## 7. Review and release

For every worker branch the Conductor checks, before merging:

- Typecheck, unit tests and build pass. No file outside the worker's folders changed.
- A browser pass in both themes at three widths, with screenshots against the tokens.
- The old pages still load the sample job, pin a note and send a batch.
- A code review for correctness.

After the last merge: add `studio/app/dist/` to `release/manifest.json`, apply the Damex naming through `release/overrides`, build a release candidate, and run it on the sample job from a clean folder. `/editor` becomes the default page only after the owner signs off on a real film.

## 8. Not checked yet

- Whether Remotion Player can load the engine's films inside Vite (the spike in section 4).
- Whether the per-job run log carries enough detail for a scene-by-scene progress count. Worker 4 confirms before building F6 and falls back to "rendering" with elapsed time.
- How `release/overrides` renames the studio for Damex. Read before the release step.
