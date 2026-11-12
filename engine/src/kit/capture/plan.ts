// Everything a capture clip needs, worked out once: the look, the pointer, the time map and the camera. The clip
// draws from this plan, and the checks (tools/checks/capture_motion.mjs) measure the same plan, so what is checked
// is what is drawn. Pure: no React, no Remotion.
import type { PresetName } from '../motion';
import { planCamera, type CameraMove, type CameraPlan } from './camera';
import { thingAt, type CaptureCursor, type CaptureTracks } from './data';
import type { Emphasis } from './glue';
import { resolveLook, type Look, type LookName, type LookOverrides } from './looks';
import { planPointer, type PointerPlan } from './pointer';
import { needsFollow, planFollow, type Relayout } from './relayout';
import { buildTimeMap, openingStart, type TimeMap, type TimeSpec } from './timemap';

export type CaptureOptions = {
  /** Seconds of the recording to play. */
  from?: number;
  to?: number;
  look?: LookName;
  /** Any single setting of the look. */
  overrides?: LookOverrides;
  time?: TimeSpec;
  /** Hand-set camera moves (film seconds); they override the automatic camera from their cue on. */
  moves?: CameraMove[];
  /** Film-time spans that must be read: the camera holds still. */
  holds?: [number, number][];
  /** The film's energy preset. */
  energy?: PresetName;
  /**
   * A clip that carries straight on from an earlier shot (a transition joining them): the recording time from which
   * its pointer is shown and rests as after an action, instead of starting hidden as if the clip had just begun.
   */
  pointerFrom?: number;
  /**
   * The clip's region when its shape is not the page's (a 9:16, 1:1 or 4:5 frame, a tall crop): the camera then
   * follows the action and keeps it inside the region's safe area (relayout.ts).
   */
  region?: Relayout;
};

export type CapturePlan = { look: Look; pointer: PointerPlan; map: TimeMap; camera: CameraPlan; from: number; to: number; marks: Emphasis[] };

/**
 * The marks a look adds by itself. "steps": a numbered badge on the thing of each click (or on the click's place when
 * nothing there is tracked), arriving with the pointer and leaving as the next step's arrives.
 */
const lookMarks = (look: Look, pointer: PointerPlan, map: TimeMap, tracks: CaptureTracks | undefined, from: number, to: number): Emphasis[] => {
  if (look.marks !== 'steps') return [];
  const clicks = pointer.clicks.filter((c) => c.t >= from && c.t <= to);
  const times = clicks.map((c) => Math.max(0, map.filmAt(Math.max(from, c.arrive))));
  return clicks.map((c, i) => {
    const thing = thingAt(tracks, c, c.t);
    return { kind: 'steps', target: thing ? thing.name : { x: c.x, y: c.y, size: 36 }, at: times[i], out: i + 1 < times.length ? times[i + 1] + 0.9 : undefined, number: i + 1 };
  });
};

const cache = new WeakMap<object, Map<string, CapturePlan>>();
const ids = new WeakMap<object, number>();
let nextId = 1;
const idOf = (o: object | undefined) => {
  if (!o) return 0;
  if (!ids.has(o)) ids.set(o, nextId++);
  return ids.get(o)!;
};

export const planCapture = (cursor: CaptureCursor, tracks: CaptureTracks | undefined, options: CaptureOptions = {}): CapturePlan => {
  const key = `${idOf(tracks)}|${JSON.stringify(options)}`;
  let plans = cache.get(cursor);
  if (!plans) cache.set(cursor, (plans = new Map()));
  const known = plans.get(key);
  if (known) return known;

  const look = resolveLook(options.look, options.overrides);
  const energy = options.energy ?? 'confident';
  // A burst of lines is for hype films only.
  if (look.click === 'burst' && energy !== 'hype' && look.pace !== 'hype') look.click = 'ring';
  const asked = Math.max(0, options.from ?? 0);
  const to = Math.min(cursor.seconds, options.to && options.to > asked ? options.to : cursor.seconds);
  const time: TimeSpec = { ...options.time, speedUp: { ...look.speedUp, ...options.time?.speedUp } };
  // A clip asked to play from the recording's start begins after the first page load (timemap.ts, openingStart).
  const from = openingStart(cursor, asked, to, time);
  const pointer = planPointer(cursor, options.pointerFrom ?? from, { carried: options.pointerFrom !== undefined, pace: look.pace, repath: look.repath, magnet: look.magnet });
  const map = buildTimeMap(cursor, from, to, time, pointer.busy);
  const cameraOptions = { ...look.camera, moves: options.moves, holds: options.holds, pace: look.pace, energy };
  const camera = needsFollow(options.region, cursor.page)
    ? planFollow(cursor, tracks, map, pointer, { ...cameraOptions, region: options.region!, cursorStyle: look.cursor, cursorSize: look.cursorSize })
    : planCamera(cursor, tracks, map, pointer, cameraOptions);
  const plan = { look, pointer, map, camera, from, to, marks: lookMarks(look, pointer, map, tracks, from, to) };
  plans.set(key, plan);
  return plan;
};
