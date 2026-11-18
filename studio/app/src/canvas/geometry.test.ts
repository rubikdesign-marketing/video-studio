import { describe, expect, it } from 'vitest';
import { boxFromDrag, boxToRect, fitFrame, isTall, sideBySide, thirds, titleSafe, zoneRects, type Rect, type Size } from './geometry';
import { SAFE_ZONES } from './safe-zones';

const wide: Size = { w: 1920, h: 1080 };
const tall: Size = { w: 1080, h: 1920 };
const square: Size = { w: 1080, h: 1080 };
const area = (r: Rect) => r.w * r.h;
const round = (r: Rect) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });

describe('fitting the film into the canvas', () => {
  it.each([
    ['16:9 in a large area', wide, { w: 1280, h: 800 }, { x: 0, y: 40, w: 1280, h: 720 }],
    ['16:9 in a small area', wide, { w: 640, h: 500 }, { x: 0, y: 70, w: 640, h: 360 }],
    ['9:16 in a large area', tall, { w: 1280, h: 800 }, { x: 415, y: 0, w: 450, h: 800 }],
    ['9:16 in a small area', tall, { w: 640, h: 400 }, { x: 208, y: 0, w: 225, h: 400 }],
    ['1:1 in a large area', square, { w: 1280, h: 800 }, { x: 240, y: 0, w: 800, h: 800 }],
    ['1:1 in a small area', square, { w: 300, h: 500 }, { x: 0, y: 100, w: 300, h: 300 }],
  ])('%s', (_name, film, room, expected) => {
    expect(fitFrame(room, film)).toEqual(expected);
  });

  it('caps the width at phone size and keeps the shape', () => {
    expect(fitFrame({ w: 1280, h: 800 }, wide, { phone: true })).toEqual({ x: 445, y: 291, w: 390, h: 219 });
    expect(fitFrame({ w: 1280, h: 800 }, tall, { phone: true })).toEqual({ x: 445, y: 54, w: 390, h: 693 });
    expect(fitFrame({ w: 300, h: 800 }, wide, { phone: true }).w).toBe(300);
  });

  it('puts two versions side by side at the same size', () => {
    const [a, b] = sideBySide({ w: 1288, h: 800 }, wide, 8);
    expect(a).toEqual({ x: 0, y: 220, w: 640, h: 360 });
    expect(b).toEqual({ x: 648, y: 220, w: 640, h: 360 });
    const [c, d] = sideBySide({ w: 1288, h: 800 }, tall, 8);
    expect(c.w).toBe(d.w);
    expect(d.x - c.x).toBe(c.w + 8);
    expect(c.x).toBe(1288 - (d.x + d.w));
  });
});

// Every guide is worked out from the size of the picture on screen, so each is checked at two display sizes.
describe.each([
  ['16:9', { w: 1280, h: 720 }, { w: 640, h: 360 }],
  ['9:16', { w: 1080, h: 1920 }, { w: 540, h: 960 }],
  ['1:1', { w: 800, h: 800 }, { w: 400, h: 400 }],
])('guides on a %s frame', (_name, large, small) => {
  it('title-safe is the middle 90%, at both sizes', () => {
    expect(titleSafe(large)).toEqual({ x: large.w * 0.05, y: large.h * 0.05, w: large.w * 0.9, h: large.h * 0.9 });
    const half = titleSafe(small);
    const full = titleSafe(large);
    expect(half.x).toBeCloseTo(full.x / 2, 6);
    expect(half.y).toBeCloseTo(full.y / 2, 6);
    expect(half.w).toBeCloseTo(full.w / 2, 6);
    expect(half.h).toBeCloseTo(full.h / 2, 6);
  });

  it('thirds cut the frame in three each way, at both sizes', () => {
    for (const frame of [large, small]) {
      const lines = thirds(frame);
      expect(lines.down[0]).toBeCloseTo(frame.w / 3, 6);
      expect(lines.down[1]).toBeCloseTo((frame.w * 2) / 3, 6);
      expect(lines.across[0]).toBeCloseTo(frame.h / 3, 6);
      expect(lines.across[1]).toBeCloseTo((frame.h * 2) / 3, 6);
    }
  });

  it('a marked area keeps its place when the picture changes size', () => {
    const box = { x: 0.25, y: 0.1, w: 0.5, h: 0.3 };
    expect(boxToRect(large, box)).toEqual({ x: large.w * 0.25, y: large.h * 0.1, w: large.w * 0.5, h: large.h * 0.3 });
    expect(boxToRect(small, box)).toEqual({ x: small.w * 0.25, y: small.h * 0.1, w: small.w * 0.5, h: small.h * 0.3 });
    // Drawn at either size, the same drag gives the same shares.
    for (const frame of [large, small]) {
      const on: Rect = { x: 100, y: 50, ...frame };
      const drawn = boxFromDrag(on, { x: 100 + frame.w * 0.75, y: 50 + frame.h * 0.4 }, { x: 100 + frame.w * 0.25, y: 50 + frame.h * 0.1 });
      expect(drawn?.x).toBeCloseTo(0.25, 6);
      expect(drawn?.y).toBeCloseTo(0.1, 6);
      expect(drawn?.w).toBeCloseTo(0.5, 6);
      expect(drawn?.h).toBeCloseTo(0.3, 6);
    }
  });
});

describe('the area box', () => {
  const frame: Rect = { x: 0, y: 0, w: 1000, h: 500 };
  it('stays inside the picture', () => {
    expect(boxFromDrag(frame, { x: 500, y: 250 }, { x: 5000, y: -90 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });
  it('is dropped when it is too small to be meant', () => {
    expect(boxFromDrag(frame, { x: 500, y: 250 }, { x: 505, y: 400 })).toBeNull();
    expect(boxFromDrag({ ...frame, w: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 })).toBeNull();
  });
});

describe('app safe zones on a tall film', () => {
  const full: Size = { w: 1080, h: 1920 };
  const half: Size = { w: 540, h: 960 };

  it('are only for 9:16', () => {
    expect(isTall(tall)).toBe(true);
    expect(isTall({ w: 720, h: 1280 })).toBe(true);
    expect(isTall(wide)).toBe(false);
    expect(isTall(square)).toBe(false);
  });

  it.each([
    ['reels', { x: 65, y: 269, w: 950, h: 979 }],
    ['tiktok', { x: 120, y: 240, w: 840, h: 1020 }],
    ['shorts', { x: 48, y: 288, w: 840, h: 960 }],
  ] as const)('%s leaves the published area clear at 1080 x 1920, and half of it at half size', (platform, clear) => {
    const atFull = zoneRects(full, SAFE_ZONES[platform]);
    expect(round(atFull.safe)).toEqual(clear);
    const atHalf = zoneRects(half, SAFE_ZONES[platform]);
    expect(atHalf.safe.x).toBeCloseTo(atFull.safe.x / 2, 6);
    expect(atHalf.safe.y).toBeCloseTo(atFull.safe.y / 2, 6);
    expect(atHalf.safe.w).toBeCloseTo(atFull.safe.w / 2, 6);
    expect(atHalf.safe.h).toBeCloseTo(atFull.safe.h / 2, 6);
  });

  it('covers the rest of the frame exactly once', () => {
    for (const platform of ['reels', 'shorts'] as const) {
      const { safe, covered } = zoneRects(full, SAFE_ZONES[platform]);
      expect(covered.reduce((sum, r) => sum + area(r), 0) + area(safe)).toBeCloseTo(1080 * 1920, 3);
    }
  });

  it("TikTok's button column is the wider strip down the right from 840 pixels", () => {
    const { covered, safe } = zoneRects(full, SAFE_ZONES.tiktok);
    const column = covered[covered.length - 1] as Rect;
    expect(round(column)).toEqual({ x: 780, y: 840, w: 180, h: 420 });
    // It sits inside the plain clear box, against its right edge, down to the bottom margin.
    expect(column.x + column.w).toBeCloseTo(safe.x + safe.w, 6);
    expect(column.y + column.h).toBeCloseTo(safe.y + safe.h, 6);
  });
});
