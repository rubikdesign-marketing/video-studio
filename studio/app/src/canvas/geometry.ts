import type { Box } from '../contracts/review';
import { TITLE_SAFE_MARGIN, type SafeZone } from './safe-zones';

export interface Size { w: number; h: number }
export interface Point { x: number; y: number }
export interface Rect extends Point, Size {}

/** The width of the "phone size" view, as on the old review page. */
export const PHONE_WIDTH = 390;
/** A dragged area smaller than this share of the frame is a slip of the hand, not an area. */
export const MIN_BOX = 0.01;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** The largest frame of the film's shape that fits the area, centred. `phone` caps its width. Whole pixels. */
export function fitFrame(area: Size, film: Size, options: { phone?: boolean } = {}): Rect {
  const shape = film.w / film.h;
  let w = Math.min(area.w, area.h * shape);
  if (options.phone) w = Math.min(w, PHONE_WIDTH);
  w = Math.max(0, Math.floor(w));
  const h = Math.max(0, Math.round(w / shape));
  return { x: Math.round((area.w - w) / 2), y: Math.round((area.h - h) / 2), w, h };
}

/** Two frames of the film's shape next to each other, for comparing versions. */
export function sideBySide(area: Size, film: Size, gap = 8): [Rect, Rect] {
  const half = { w: Math.max(0, (area.w - gap) / 2), h: area.h };
  const frame = fitFrame(half, film);
  const left = Math.round((area.w - gap - frame.w * 2) / 2);
  return [{ ...frame, x: left }, { ...frame, x: left + frame.w + gap }];
}

/** True for a tall 9:16 film, the only shape the app safe zones apply to. */
export const isTall = (film: Size): boolean => Math.abs(film.w / film.h - 9 / 16) < 0.01;

/** The frame with a share taken off every side. */
export function inset(frame: Size, share: number): Rect {
  return { x: frame.w * share, y: frame.h * share, w: frame.w * (1 - share * 2), h: frame.h * (1 - share * 2) };
}

/** The title-safe box, in pixels from the frame's top left corner. */
export const titleSafe = (frame: Size): Rect => inset(frame, TITLE_SAFE_MARGIN);

/** The rule-of-thirds lines: two across and two down, in pixels from the frame's top left corner. */
export function thirds(frame: Size): { down: [number, number]; across: [number, number] } {
  return { down: [frame.w / 3, (frame.w * 2) / 3], across: [frame.h / 3, (frame.h * 2) / 3] };
}

/** What an app covers and what it leaves clear, in pixels from the frame's top left corner. */
export function zoneRects(frame: Size, zone: SafeZone): { safe: Rect; covered: Rect[] } {
  const top = frame.h * zone.top;
  const bottom = frame.h * zone.bottom;
  const left = frame.w * zone.left;
  const right = frame.w * zone.right;
  const middle = frame.h - top - bottom;
  const covered: Rect[] = [
    { x: 0, y: 0, w: frame.w, h: top },
    { x: 0, y: frame.h - bottom, w: frame.w, h: bottom },
    { x: 0, y: top, w: left, h: middle },
    { x: frame.w - right, y: top, w: right, h: middle },
  ];
  if (zone.buttons) {
    const from = frame.h * zone.buttons.from;
    const wide = frame.w * zone.buttons.right;
    covered.push({ x: frame.w - wide, y: from, w: wide - right, h: frame.h - bottom - from });
  }
  return { safe: { x: left, y: top, w: frame.w - left - right, h: middle }, covered };
}

/** A box stored as shares of the frame, in pixels. */
export const boxToRect = (frame: Size, box: Box): Rect => ({ x: box.x * frame.w, y: box.y * frame.h, w: box.w * frame.w, h: box.h * frame.h });

/**
 * The area between where a drag began and where it is now, as shares of the frame.
 * `frame` is where the picture sits; the points are in the same pixels. Kept inside the picture.
 * Null when it is too small to be meant.
 */
export function boxFromDrag(frame: Rect, from: Point, to: Point): Box | null {
  if (frame.w <= 0 || frame.h <= 0) return null;
  const x0 = clamp01((from.x - frame.x) / frame.w);
  const y0 = clamp01((from.y - frame.y) / frame.h);
  const x1 = clamp01((to.x - frame.x) / frame.w);
  const y1 = clamp01((to.y - frame.y) / frame.h);
  const box = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  return box.w < MIN_BOX || box.h < MIN_BOX ? null : box;
}
