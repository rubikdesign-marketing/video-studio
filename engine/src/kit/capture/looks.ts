// Look presets for captures (CAPTURE-PLAN 7.9, first table). One word sets the pointer, the click, the camera and
// the pace together; any single setting can still be given on its own and wins. Colours, type and corner radius
// always come from the brand in use, and the energy of everything else from the film's preset.
//
// Each look also says where the screen sits (staging, CaptureShot in staging.tsx) and which marks it adds on its own
// (tutorial: a numbered badge on each step), and which transitions join its shots (joins.ts, CaptureJoin).
import type { CameraOptions } from './camera';
import type { Pace } from './pointer';

export const cursorStyles = ['classic', 'brand', 'dot', 'halo', 'spotlight', 'presenter', 'named', 'touch', 'hidden'] as const;
export type CursorStyle = (typeof cursorStyles)[number];

/** The drawn pointer's size for each style, as a share of frame height before the look's size (DrawnPointer, draw.tsx). */
export const POINTER_BOX: Record<CursorStyle, number> = { classic: 3.2, brand: 3.2, presenter: 4.6, named: 3.2, spotlight: 3.2, dot: 1.7, halo: 1.3, touch: 4.8, hidden: 0 };

export const clickEffects = ['ring', 'pulse', 'burst', 'squish', 'none'] as const;
export type ClickEffect = (typeof clickEffects)[number];

export const trails = ['none', 'blur', 'line'] as const;
export type Trail = (typeof trails)[number];

export const keyCapModes = ['shortcuts', 'all', 'none'] as const;
export type KeyCapMode = (typeof keyCapModes)[number];

export const lookNames = ['calm-explainer', 'product-demo', 'launch', 'tutorial', 'social-vertical', 'feature-montage', 'documentary', 'two-people'] as const;
export type LookName = (typeof lookNames)[number];

/** Where the screen sits (CAPTURE-PLAN 7.6 and the 7.9 staging list). Each is drawn by CaptureShot (staging.tsx). */
export const stagingNames = [
  'card',
  'browser',
  'browser-dark',
  'frameless',
  'float',
  'isometric',
  'laptop',
  'monitor',
  'tablet',
  'phone',
  'phone-crop',
  'stacked',
  'split',
  'split-three',
  'pip',
  'grid',
  'wall',
  'before-after',
  'email',
  'terminal',
] as const;
export type StagingName = (typeof stagingNames)[number];

/**
 * Transitions between two captures, or two parts of one (CAPTURE-PLAN 7.5 and the 7.9 transitions table). Each is
 * drawn by CaptureJoin (transitions.tsx) from the plan in joins.ts. Left out on purpose: page curls, glitches, light
 * leaks and spinning cube turns.
 */
export const transitionNames = [
  'cut',
  'match-cut',
  'snap-cut',
  'zoom-through',
  'shared-element',
  'container-grow',
  'push',
  'slide',
  'depth-push',
  'circle-reveal',
  'card-flip',
  'stack-shuffle',
  'grid-zoom',
  'scroll-relay',
  'cursor-drag',
  'whip',
  'window-split',
  'device-swap',
  'blur-dissolve',
  'cross-dissolve',
] as const;
export type TransitionName = (typeof transitionNames)[number];

export type Look = {
  /** The pointer's style, and its size next to the style's own (1 is about 1.5 times a real pointer). */
  cursor: CursorStyle;
  cursorSize: number;
  /** One click effect per film. A burst of lines is for hype films only: elsewhere it becomes a ring. */
  click: ClickEffect;
  /** Hover: the pointer is pulled onto its target in the last frames; the thing under it glows softly. */
  magnet: boolean;
  glow: boolean;
  /** Blur on fast moves, or a short fading line (hype and touch only). */
  trail: Trail;
  /** The field being typed in glows; shortcuts (or every key) show as key caps near the bottom. */
  caretGlow: boolean;
  keyCaps: KeyCapMode;
  /** Draw the engine's own path between actions (true), or the real recorded path (documentary). */
  repath: boolean;
  camera: Omit<CameraOptions, 'moves' | 'holds'> & { drift?: number };
  /** The pace of the capture's own timings: pointer moves, zoom lengths. */
  pace: Pace;
  /** Speed up real waits and typing longer than this many seconds, with the label. */
  speedUp: { waits: boolean; typing: number | false };
  /** Where the screen sits. */
  staging: StagingName;
  /**
   * Marks the look adds by itself, next to the one emphasis a scene gives: "steps" puts a numbered badge on the thing
   * of each click (tutorials). The camera's push in is already the emphasis of each action, so no look adds a ring.
   */
  marks: 'none' | 'steps';
  /**
   * The transitions that join this look's shots, in the order a film uses them (CAPTURE-PLAN 7.9, looks table). No
   * two neighbouring joins use the same one (pickTransition in joins.ts).
   */
  transitions: TransitionName[];
};

const base: Look = {
  cursor: 'classic',
  cursorSize: 1,
  click: 'ring',
  magnet: true,
  glow: false,
  trail: 'blur',
  caretGlow: true,
  keyCaps: 'shortcuts',
  repath: true,
  camera: { auto: true, follow: true, spring: false, float: false, most: 2, over: 'scene', holdAfter: 0.8 },
  pace: 'confident',
  speedUp: { waits: true, typing: 4 },
  staging: 'card',
  marks: 'none',
  transitions: ['zoom-through', 'match-cut', 'push'],
};

export const looks: Record<LookName, Look> = {
  /** Unhurried and premium: slow arcs, slow eased zooms that go less far, long holds, no tilt. */
  'calm-explainer': {
    ...base,
    magnet: false,
    glow: true,
    trail: 'none',
    camera: { auto: true, follow: true, spring: false, float: false, most: 1.6, over: 'hero', holdAfter: 1.2 },
    pace: 'calm',
    transitions: ['cross-dissolve', 'container-grow'],
  },
  /** The default. Clear and confident: auto-zoom on each action, gentle follow. */
  'product-demo': base,
  /** Big and cinematic: the brand's arrow, a soft pulse, zooms that land with a spring, and a slow float. */
  launch: {
    ...base,
    cursor: 'brand',
    cursorSize: 1.1,
    click: 'pulse',
    glow: true,
    camera: { auto: true, follow: true, spring: true, float: true, most: 1.8, over: 'scene', holdAfter: 0.7 },
    pace: 'hype',
    staging: 'float',
    transitions: ['shared-element', 'depth-push', 'whip'],
  },
  /** Patient and precise: a large pointer, rings, every key as a cap, a steady zoom on every click. */
  tutorial: {
    ...base,
    cursorSize: 1.3,
    magnet: false,
    trail: 'none',
    keyCaps: 'all',
    camera: { auto: true, follow: false, spring: false, float: false, everyAction: true, most: 2, over: 'scene', holdAfter: 1.1 },
    pace: 'calm',
    speedUp: { waits: true, typing: 6 },
    staging: 'browser',
    marks: 'steps',
    transitions: ['cut', 'slide'],
  },
  /** Fast, bold, sound-off: a large brand arrow, a bold click, tight following shots that snap in. */
  'social-vertical': {
    ...base,
    cursor: 'brand',
    cursorSize: 1.35,
    click: 'burst',
    camera: { auto: true, follow: true, spring: true, float: false, most: 2, over: 'base', holdAfter: 0.6 },
    pace: 'hype',
    speedUp: { waits: true, typing: 2 },
    staging: 'phone-crop',
    transitions: ['snap-cut', 'whip'],
  },
  /** Many things quickly: a small dot and a slow push through each screen, no zooms. */
  'feature-montage': {
    ...base,
    cursor: 'dot',
    magnet: false,
    trail: 'none',
    keyCaps: 'none',
    camera: { auto: false, follow: false, spring: false, float: false, drift: 0.06 },
    pace: 'hype',
    speedUp: { waits: true, typing: 2 },
    staging: 'grid',
    transitions: ['grid-zoom', 'stack-shuffle'],
  },
  /** Honest and raw: the real recorded path, no click effect, an almost still camera. */
  documentary: {
    ...base,
    click: 'none',
    magnet: false,
    trail: 'none',
    caretGlow: false,
    keyCaps: 'none',
    repath: false,
    camera: { auto: false, follow: false, spring: false, float: false, drift: 0.02 },
    speedUp: { waits: true, typing: false },
    staging: 'frameless',
    transitions: ['cut'],
  },
  /** Collaboration: a named pointer on each of two takes, side by side on one clock. */
  'two-people': {
    ...base,
    cursor: 'named',
    magnet: false,
    trail: 'none',
    staging: 'split',
    transitions: ['window-split'],
  },
};

/** Overrides a person can give on top of a look. Every key is optional. */
export type LookOverrides = Partial<Omit<Look, 'camera' | 'speedUp'>> & { camera?: Partial<Look['camera']>; speedUp?: Partial<Look['speedUp']> };

/** The look a clip uses: the named preset with any single setting overridden. */
export const resolveLook = (name: LookName = 'product-demo', overrides: LookOverrides = {}): Look => {
  const look = looks[name];
  const defined = <T extends object>(o: T | undefined) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;
  return {
    ...look,
    ...defined(overrides),
    camera: { ...look.camera, ...defined(overrides.camera) },
    speedUp: { ...look.speedUp, ...defined(overrides.speedUp) },
  } as Look;
};
