import { create } from 'zustand';
import type { Seconds } from '../contracts/film';

export const LANES = [
  { id: 'scenes', name: 'Scenes' },
  { id: 'voice', name: 'Voice' },
  { id: 'text', name: 'Text' },
  { id: 'notes', name: 'Notes' },
  { id: 'energy', name: 'Energy' },
] as const;
export type LaneId = (typeof LANES)[number]['id'];
export interface LaneState { hidden: boolean; locked: boolean }

/** Width of the column of lane names, in pixels. The film starts to its right. */
export const HEAD = 156;
/** Space kept free after the end of the film when it is fitted, in pixels. */
const END_SPACE = 24;
export const MAX_PPS = 600;
const DEFAULT_PPS = 80;
const LANES_KEY = 'studio-editor:timeline-lanes';

/** How many pixels a second gets when the whole film fits the width. */
export function fitPps(width: number, duration: Seconds): number {
  if (!(width > 0) || !(duration > 0)) return DEFAULT_PPS;
  return Math.max(1, (width - HEAD - END_SPACE) / duration);
}
/** Never smaller than fitted (there is nothing to see beyond the film), never absurdly large. */
export const clampPps = (pps: number, width: number, duration: Seconds) => Math.min(MAX_PPS, Math.max(fitPps(width, duration), pps));

/** Where to scroll so the moment under the pointer stays under the pointer after a zoom. `pointerX` is from the left edge of the scrolling area. */
export function scrollAfterZoom(oldPps: number, newPps: number, scrollLeft: number, pointerX: number): number {
  const time = (scrollLeft + pointerX - HEAD) / oldPps;
  return Math.max(0, time * newPps + HEAD - pointerX);
}

const STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
/** The gap between ruler marks, in seconds: the smallest that leaves room for its label. */
export const tickStep = (pps: number): Seconds => STEPS.find((s) => s * pps >= 64) ?? 600;
export function ticks(duration: Seconds, step: Seconds): Seconds[] {
  const out: Seconds[] = [];
  for (let i = 0; i * step <= duration + 1e-9; i++) out.push(Math.round(i * step * 1000) / 1000);
  return out;
}
/** A time as a person reads it: 0:04, or 0:04.5 when the marks are closer than a second. */
export function clock(t: Seconds, step: Seconds = 1): string {
  const whole = Math.floor(t + 1e-9); const base = `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  return step < 1 ? `${base}.${Math.round((t - whole) * 10) % 10}` : base;
}
/** A time to the hundredth of a second, for the readout: 0:04.20. */
export function clockExact(t: Seconds): string {
  const hundredths = Math.round(Math.max(0, t) * 100); const whole = Math.floor(hundredths / 100);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}.${String(hundredths % 100).padStart(2, '0')}`;
}

const freshLanes = (): Record<LaneId, LaneState> => ({
  scenes: { hidden: false, locked: false }, voice: { hidden: false, locked: false }, text: { hidden: false, locked: false },
  notes: { hidden: false, locked: false }, energy: { hidden: false, locked: false },
});
function storedLanes(): Record<LaneId, LaneState> {
  const lanes = freshLanes();
  try {
    const saved = JSON.parse((typeof localStorage === 'undefined' ? null : localStorage.getItem(LANES_KEY)) ?? '{}') as Partial<Record<LaneId, Partial<LaneState>>>;
    for (const { id } of LANES) lanes[id] = { hidden: saved[id]?.hidden === true, locked: saved[id]?.locked === true };
  } catch { /* nothing remembered, or the browser will not say */ }
  return lanes;
}
const remember = (lanes: Record<LaneId, LaneState>) => { try { localStorage.setItem(LANES_KEY, JSON.stringify(lanes)); } catch { /* not remembered, still works */ } };

export interface TimelineView {
  /** Zoom: pixels per second of film. */
  pps: number;
  /** True while the film is kept fitted to the width (until the person zooms). */
  fitted: boolean;
  /** Width of the scrolling area, in pixels. 0 until measured. */
  width: number;
  lanes: Record<LaneId, LaneState>;
  /** Film time of the snap guide line, while a drag is snapped. */
  guide: Seconds | null;
  measure(width: number, duration: Seconds): void;
  fit(duration: Seconds): void;
  /** Sets the zoom and returns what it became after the limits. */
  zoomTo(pps: number, duration: Seconds): number;
  toggleHidden(lane: LaneId): void;
  toggleLocked(lane: LaneId): void;
  setGuide(time: Seconds | null): void;
}

export const useTimelineView = create<TimelineView>((set, get) => ({
  pps: DEFAULT_PPS, fitted: true, width: 0, lanes: storedLanes(), guide: null,
  measure(width, duration) {
    const s = get();
    set({ width, pps: s.fitted ? fitPps(width, duration) : clampPps(s.pps, width, duration) });
  },
  fit(duration) { set({ fitted: true, pps: fitPps(get().width, duration) }); },
  zoomTo(pps, duration) {
    const next = clampPps(pps, get().width, duration);
    set({ pps: next, fitted: get().width > 0 && next <= fitPps(get().width, duration) + 1e-6 });
    return next;
  },
  toggleHidden(lane) { const lanes = { ...get().lanes, [lane]: { ...get().lanes[lane], hidden: !get().lanes[lane].hidden } }; set({ lanes }); remember(lanes); },
  toggleLocked(lane) { const lanes = { ...get().lanes, [lane]: { ...get().lanes[lane], locked: !get().lanes[lane].locked } }; set({ lanes }); remember(lanes); },
  setGuide(guide) { if (guide !== get().guide) set({ guide }); },
}));
