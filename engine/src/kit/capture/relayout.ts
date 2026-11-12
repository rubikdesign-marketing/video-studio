// Other sizes from the same take (CAPTURE-PLAN 7.7, phase 8): a wide capture shown in a 9:16, 1:1 or 4:5 frame, with
// a camera that follows the action inside the wide recording; a phone-size take placed full-frame; and where the
// platforms draw their own buttons and captions over a vertical film.
//
// The follow camera keeps to the wide camera's rules (camera.ts): it moves one way per move, sets off 150 ms after
// the pointer and so always trails it, lands softly (a spring with no wobble, only for energies that spring), never
// moves during a reading hold, and never goes past the recording's double sharpness. What it adds is a hard promise:
// the thing being acted on, and the pointer, stay inside the frame's safe area with a margin on every frame. When the
// pointer is about to travel further than one close view can hold, the camera first pulls back (while the pointer
// still rests) to a view that holds its whole way, then follows it in to the next thing. Every view is a rectangle of
// the page tweened as a rectangle, so anything inside both ends of a move stays inside all through it.
//
// Places: page pixels of the recorded window; frame pixels of the film; region pixels of the clip's own box. Times:
// film seconds on the clip's clock. Pure: no React, no Remotion, so the checks measure what is drawn.
import { clamp01, easing, lerp, presets, timing, type Point, type TimingToken } from '../motion';
import { type CameraMove, type CameraOptions, type CameraPlan, type CameraState, type Target } from './camera';
import { boxAround, rectAt, thingAt, union, type CaptureCursor, type CaptureTracks, type Rect } from './data';
import { POINTER_BOX, type CursorStyle, type StagingName } from './looks';
import type { Pace, PointerPlan } from './pointer';
import type { TimeMap } from './timemap';

// ---------------------------------------------------------------- sizes

export const sizeNames = ['16:9', '9:16', '1:1', '4:5'] as const;
export type SizeName = (typeof sizeNames)[number];
/** The film sizes of tools/film/scaffold.mjs. */
export const SIZES: Record<SizeName, [number, number]> = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };

/** The size a frame is closest to. */
export const sizeOf = (width: number, height: number): SizeName => {
  const r = width / height;
  let best: SizeName = '16:9';
  for (const name of sizeNames) if (Math.abs(Math.log(r / (SIZES[name][0] / SIZES[name][1]))) < Math.abs(Math.log(r / (SIZES[best][0] / SIZES[best][1])))) best = name;
  return best;
};

/** A wide frame keeps the stagings of staging.tsx; the others are re-laid out here. */
export const isWide = (width: number, height: number) => width / height > 1.4;

// ---------------------------------------------------------------- the platforms' own buttons and captions

export const platformNames = ['instagram', 'tiktok', 'shorts'] as const;
export type PlatformName = (typeof platformNames)[number];

export type Zone = { name: string; rect: Rect };

/**
 * Where each app draws over a 9:16 film, on a 1080 x 1920 frame (scaled to the frame in use). Approximate, from each
 * platform's published guidance and its app as of November 2026; apps change, so this is a preview aid and a check,
 * not a promise. Instagram's numbers are Meta's own (14% top, 35% bottom, 6% sides for text and logos).
 */
export const PLATFORM_ZONES: Record<PlatformName, { label: string; zones: Zone[] }> = {
  instagram: {
    label: 'Instagram Reels',
    zones: [
      { name: 'top bar', rect: { x: 0, y: 0, width: 1080, height: 269 } },
      { name: 'caption, sound and account', rect: { x: 0, y: 1248, width: 1080, height: 672 } },
      { name: 'like, comment and share', rect: { x: 950, y: 860, width: 130, height: 388 } },
      { name: 'side margin', rect: { x: 0, y: 269, width: 65, height: 979 } },
      { name: 'side margin', rect: { x: 1015, y: 269, width: 65, height: 591 } },
    ],
  },
  tiktok: {
    label: 'TikTok',
    zones: [
      { name: 'tabs and search', rect: { x: 0, y: 0, width: 1080, height: 150 } },
      { name: 'caption, sound and tab bar', rect: { x: 0, y: 1480, width: 1080, height: 440 } },
      { name: 'like, comment, share and profile', rect: { x: 960, y: 640, width: 120, height: 840 } },
      { name: 'side margin', rect: { x: 0, y: 150, width: 60, height: 1330 } },
    ],
  },
  shorts: {
    label: 'YouTube Shorts',
    zones: [
      { name: 'search and menu', rect: { x: 0, y: 0, width: 1080, height: 150 } },
      { name: 'title, channel and subscribe', rect: { x: 0, y: 1440, width: 1080, height: 480 } },
      { name: 'like, comment, share and remix', rect: { x: 950, y: 760, width: 130, height: 680 } },
      { name: 'side margin', rect: { x: 0, y: 150, width: 48, height: 1290 } },
    ],
  },
};

const scaleRect = (r: Rect, sx: number, sy: number): Rect => ({ x: r.x * sx, y: r.y * sy, width: r.width * sx, height: r.height * sy });

/** A platform's zones on a frame (9:16 only: the other sizes are feed posts with nothing drawn over them). */
export const zonesFor = (platform: PlatformName, width: number, height: number): Zone[] =>
  sizeOf(width, height) === '9:16' ? PLATFORM_ZONES[platform].zones.map((z) => ({ name: z.name, rect: scaleRect(z.rect, width / 1080, height / 1920) })) : [];

// ---------------------------------------------------------------- the layout of a re-laid frame

/** Room kept between the acted-on thing (or the pointer) and the safe area's edge, as a share of the region's narrower side. */
export const MARGIN_SHARE = 0.035;
export const marginOf = (region: { width: number; height: number }) => Math.round(MARGIN_SHARE * Math.min(region.width, region.height));

export type SizedLayoutOptions = { captions?: boolean; title?: boolean };

export type SizedLayout = {
  size: SizeName;
  /** Where every word and the action may sit (frame pixels): clear of all three platforms' buttons on 9:16. */
  band: Rect;
  /** The caption pill's slot (frame pixels), when the film has captions; on-screen text's slot, when it has a title. */
  captions: Rect | null;
  title: Rect | null;
  /** The band less the caption and title slots: where the action stays (frame pixels). */
  content: Rect;
};

const inter = (a: Rect, b: Rect): Rect => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return { x, y, width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x), height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y) };
};

/** The caption pill's height, as a share of frame height (Captions.tsx, HEIGHT). */
export const CAPTION_HEIGHT = 0.08;

/**
 * The band, caption slot, title slot and content area of a re-laid frame. On 9:16 the band is what all three
 * platforms leave free (Instagram's top and bottom, the right-hand buttons of all three); captions sit at its bottom
 * (vertical.md) and a title at its top. Square and 4:5 frames keep a plain edge margin.
 */
export const sizedLayout = (width: number, height: number, options: SizedLayoutOptions = {}): SizedLayout => {
  const size = sizeOf(width, height);
  const sx = width / 1080;
  const sy = height / 1920;
  const band: Rect =
    size === '9:16'
      ? { x: 65 * sx, y: 269 * sy, width: 885 * sx, height: 979 * sy }
      : { x: width * 0.05, y: height * 0.05, width: width * 0.9, height: height * 0.89 };
  const gap = height * 0.012;
  const pill = height * CAPTION_HEIGHT;
  const captions = options.captions ? { x: band.x, y: band.y + band.height - pill, width: band.width, height: pill } : null;
  const titleHeight = height * (size === '9:16' ? 0.1 : 0.12);
  const title = options.title ? { x: band.x, y: band.y, width: band.width, height: titleHeight } : null;
  const top = band.y + (title ? titleHeight + gap : 0);
  const bottom = band.y + band.height - (captions ? pill + gap : 0);
  return { size, band, captions, title, content: { x: band.x, y: top, width: band.width, height: bottom - top } };
};

/** What a CaptureClip is given to follow the action in a region whose shape is not the page's (CaptureClip, `relayout`). */
export type Relayout = {
  /** The region's size in frame pixels (the clip's width and height). */
  width: number;
  height: number;
  /** Where the acted-on thing and the pointer stay, in region pixels (the margin is kept inside it). */
  safe: Rect;
  /** The film frame's height, which sets the pointer's drawn size. */
  frameHeight: number;
  /** The closest the camera goes, in frame pixels per page pixel (default: the recording's sharpness). */
  most?: number;
};

/** Where a staging sits in a re-laid frame, and what its screen region is. */
export type SizedStaging = {
  /** The staging drawn: full bleed, a card, a browser window or a phone. */
  kind: 'full' | 'card' | 'window' | 'phone';
  /** The outer box (frame pixels): the window with its bar, the phone with its edge. */
  outer: Rect;
  /** The screen region the capture plays in (frame pixels). */
  region: Rect;
  bar: number;
  /** The phone's edge, frame pixels. */
  bezel: number;
  relayout: Relayout;
};

/** A take recorded at phone size (taller than wide), from its cursor.json. */
export const isPhoneTake = (page: { width: number; height: number }) => page.height > page.width * 1.2;

/**
 * Each staging's version in a re-laid frame. Full bleed for the social look and the full screen; a card, a browser
 * window or a phone frame for the others. The 3D and device stagings become a flat card: a screen that must be read
 * is never tilted, and a laptop or monitor drawn inside a phone-shaped film would leave the product too small to read.
 */
export const sizedStagingKind = (staging: StagingName, phone: boolean): SizedStaging['kind'] => {
  if (staging === 'phone') return 'phone';
  if (staging === 'phone-crop' || staging === 'frameless' || staging === 'wall') return 'full';
  if (staging === 'browser' || staging === 'browser-dark' || staging === 'email' || staging === 'terminal') return 'window';
  return phone ? 'full' : 'card';
};

/** The safe part of a region (region pixels): the region inside the layout's content area. */
const safeIn = (region: Rect, content: Rect): Rect => {
  const s = inter(region, content);
  return { x: s.x - region.x, y: s.y - region.y, width: s.width, height: s.height };
};

export const sizedStaging = (
  staging: StagingName,
  frame: { width: number; height: number },
  page: { width: number; height: number; scale?: number },
  options: SizedLayoutOptions = {},
): SizedStaging => {
  const { width: W, height: H } = frame;
  const layout = sizedLayout(W, H, options);
  const phone = isPhoneTake(page);
  const kind = sizedStagingKind(staging, phone);
  const c = layout.content;
  const side = W * 0.045;
  const sharp = page.scale ?? 2;
  let outer: Rect;
  let region: Rect;
  let bar = 0;
  let bezel = 0;
  let most: number | undefined;
  if (kind === 'full') {
    outer = region = { x: 0, y: 0, width: W, height: H };
    // A phone take is never cropped at its sides: the closest view shows its whole width.
    if (phone) most = Math.min(sharp, W / page.width);
  } else if (kind === 'phone') {
    // A generic phone (no company's shape): screen 9:19.5 for a wide take, the take's own shape for a phone take,
    // as tall as the band lets it be.
    const aspect = phone ? page.height / page.width : 19.5 / 9;
    bezel = W * 0.022;
    // From near the top of the frame down to the action's area's bottom: the phone may reach under the apps' top
    // bars (it is only its frame and screen there), never over the caption slot.
    const top = Math.min(c.y, H * 0.07);
    const bottom = c.y + c.height;
    const h = Math.min(bottom - top - bezel * 2, (W * 0.9 - bezel * 2) * aspect);
    const w = h / aspect;
    region = { x: (W - w) / 2, y: bottom - bezel - h, width: w, height: h };
    outer = { x: region.x - bezel, y: region.y - bezel, width: w + bezel * 2, height: h + bezel * 2 };
  } else {
    const w = W - side * 2;
    bar = kind === 'window' ? Math.round(W * 0.055) : 0;
    // A card or window reaches up under the apps' top bars (its edge only; the action stays below them) and down to
    // the caption slot, so a tall frame is not left mostly empty.
    const top = Math.min(c.y, H * 0.09);
    outer = { x: side, y: top, width: w, height: c.y + c.height - top };
    region = { x: side, y: top + bar, width: w, height: outer.height - bar };
  }
  const safe = safeIn(region, c);
  return { kind, outer, region, bar, bezel, relayout: { width: region.width, height: region.height, safe, frameHeight: H, most } };
};

/** Stacked tiles for several takes at once (split, grid) in a re-laid frame: one column, each its own follow camera. */
export const sizedTiles = (count: number, frame: { width: number; height: number }, options: SizedLayoutOptions = {}): { rect: Rect; relayout: Relayout }[] => {
  const { width: W, height: H } = frame;
  const c = sizedLayout(W, H, options).content;
  const gap = H * 0.014;
  const side = W * 0.045;
  const h = (c.height - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => {
    const rect = { x: side, y: c.y + i * (h + gap), width: W - side * 2, height: h };
    return { rect, relayout: { width: rect.width, height: rect.height, safe: safeIn(rect, c), frameHeight: H } };
  });
};

// ---------------------------------------------------------------- the pointer's own size

/**
 * The page box the drawn pointer covers around its tip (DrawnPointer in draw.tsx): an arrow hangs down and to the
 * right of its tip, a dot or touch ring sits round it. `box` is the art's size in frame pixels.
 */
export const pointerExtent = (tip: Point, style: CursorStyle, box: number, scale: number): Rect => {
  const b = box / scale;
  if (style === 'dot' || style === 'halo' || style === 'touch') return { x: tip.x - 0.6 * b, y: tip.y - 0.6 * b, width: 1.2 * b, height: 1.2 * b };
  return { x: tip.x - 0.3 * b, y: tip.y - 0.3 * b, width: 1.05 * b, height: 1.25 * b };
};

/** The pointer art's size in frame pixels at a zoom, for a look's style and size (as DrawnPointer draws it). */
export const pointerBoxOf = (style: CursorStyle, size: number, frameHeight: number, grow: number) => (frameHeight * POINTER_BOX[style] * size * grow) / 100;

// ---------------------------------------------------------------- the follow camera

/** The view as the part of the page inside the safe area: tweened as a rectangle, so containment holds through moves. */
type Q = { x: number; y: number; w: number; h: number };

export type FollowStop = { t0: number; t1: number; tip: Point; thing: Rect | null; subject: Rect; scale: number };
export type FollowMove = { kind: 'pull-back' | 'lead' | 'follow' | 'push-in' | 'hand'; t0: number; t1: number; pointer?: [number, number]; spring: boolean };
export type FollowInfo = {
  stops: FollowStop[];
  moves: FollowMove[];
  /** The safe area less the margin (region pixels), the margin, page-to-region scale at zoom 1, and the region. */
  inner: Rect;
  margin: number;
  k: number;
  region: { width: number; height: number };
  /** Frame pixels per page pixel the camera never goes past. */
  most: number;
  /** The film times the camera follows the pointer of a move, for the checks. */
  delay: number;
};

const FOLLOW_DELAY = 0.15;
/** A pause between a pull-back and the pointer setting off. */
const SET_OFF = 0.05;

const qFromState = (s: { cx: number; cy: number; zoom: number }, k: number, inner: Rect, W: number, H: number): Q => {
  const sc = s.zoom * k;
  return { x: s.cx + (inner.x - W / 2) / sc, y: s.cy + (inner.y - H / 2) / sc, w: inner.width / sc, h: inner.height / sc };
};

export type FollowOptions = CameraOptions & {
  pace: Pace;
  energy: Pace;
  region: Relayout;
  /** The look's pointer, for the room it takes. */
  cursorStyle: CursorStyle;
  cursorSize: number;
};

export const planFollow = (cursor: CaptureCursor, tracks: CaptureTracks | undefined, map: TimeMap, pointer: PointerPlan, options: FollowOptions): CameraPlan & { follow: FollowInfo } => {
  const page = cursor.page;
  const { width: W, height: H } = options.region;
  const k = W / page.width;
  const margin = marginOf(options.region);
  const safe = options.region.safe;
  const inner: Rect = { x: safe.x + margin, y: safe.y + margin, width: Math.max(1, safe.width - 2 * margin), height: Math.max(1, safe.height - 2 * margin) };
  const lengthOf = (token: TimingToken) => (timing[token] * presets[options.pace].length) / 1000;
  const zoomLength = lengthOf(options.over ?? 'scene');
  const overshoot = options.spring ? presets[options.energy].overshoot : 0;
  const sharp = cursor.scale ?? 2;
  // The look's limit is given for a 16:9 frame at 2x sharpness (`most: 2` is the sharpest); scaled to the take's.
  const most = Math.min(sharp, options.region.most ?? Infinity, (sharp * (options.most ?? 2)) / 2);
  const least = Math.min(inner.width / page.width, inner.height / page.height, most);
  // The zoom at which the page's height fills the region: the pointer is drawn at its own size there.
  const base = (H / page.height) / k;
  const growAt = (scale: number) => Math.sqrt(Math.max(1e-6, scale / k / base));
  // A little more than the drawn pointer: its page size changes with the zoom during a move.
  const boxAt = (scale: number) => 1.15 * pointerBoxOf(options.cursorStyle, options.cursorSize, options.region.frameHeight, growAt(scale));
  const room = 1 + 2.2 * overshoot;

  const clampAxis = (q: number, size: number, off: number, regionSize: number, lo: number, hi: number, pageSize: number) => {
    // Prefer the page covering the whole region, then the whole safe area; the subject always wins.
    let v = q;
    if (regionSize <= pageSize) v = Math.min(pageSize - regionSize + off, Math.max(off, v));
    else if (size <= pageSize) v = Math.min(pageSize - size, Math.max(0, v));
    else v = (pageSize - size) / 2;
    if (hi - size <= lo) v = Math.min(lo, Math.max(hi - size, v));
    else v = (lo + hi - size) / 2;
    return v;
  };
  /** The view that holds a subject (page pixels) inside the safe area, as close as the sharpness and the room allow. */
  const viewFor = (subject: Rect, scale?: number): Q => {
    const fit = Math.min(inner.width / (subject.width * room), inner.height / (subject.height * room));
    // Never wider than the page needs, unless the pointer reaches past the page's edge.
    const s = Math.max(Math.min(least * 0.999, fit), Math.min(most, scale ?? fit));
    const w = inner.width / s;
    const h = inner.height / s;
    const cx = subject.x + subject.width / 2;
    const cy = subject.y + subject.height / 2;
    return {
      x: clampAxis(cx - w / 2, w, inner.x / s, W / s, subject.x, subject.x + subject.width, page.width),
      y: clampAxis(cy - h / 2, h, inner.y / s, H / s, subject.y, subject.y + subject.height, page.height),
      w,
      h,
    };
  };
  const scaleOf = (q: Q) => inner.width / q.w;
  const contains = (q: Q, r: Rect) => r.x >= q.x - 0.5 && r.y >= q.y - 0.5 && r.x + r.width <= q.x + q.w + 0.5 && r.y + r.height <= q.y + q.h + 0.5;

  // ------------------------------------------------ what is acted on at each stop of the pointer

  const clipFrom = map.recAt(0);
  const clipTo = map.recAt(map.duration);
  const moves = pointer.moves.filter((m) => m.end > clipFrom + 1e-6 && m.start < clipTo - 1e-6).sort((a, b) => a.start - b.start);
  const thingsOver = (name: string | undefined, r0: number, r1: number): Rect | null => {
    if (!name || !tracks) return null;
    let box: Rect | null = null;
    for (let r = r0; r <= r1 + 1e-6; r += 1 / 30) {
      const rect = rectAt(tracks, name, r);
      if (rect) box = box ? union(box, rect) : rect;
    }
    return box;
  };
  const clipToPage = (r: Rect): Rect => inter(r, { x: 0, y: 0, width: page.width, height: page.height });
  const pathBox = (r0: number, r1: number, scale: number): Rect => {
    let box: Rect | null = null;
    for (let r = r0; r <= r1 + 1e-6; r += 1 / 120) box = box ? union(box, pointerExtent(pointer.at(r), options.cursorStyle, boxAt(scale), scale)) : pointerExtent(pointer.at(r), options.cursorStyle, boxAt(scale), scale);
    return box!;
  };
  const stops: FollowStop[] = [];
  const recStops = [{ r0: clipFrom, r1: moves[0]?.start ?? clipTo }, ...moves.map((m, i) => ({ r0: m.end, r1: moves[i + 1]?.start ?? clipTo }))];
  for (const { r0, r1 } of recStops) {
    const tip = pointer.at(Math.max(r0, Math.min(r1, r0 + 1e-3)));
    let thing: Rect | null = null;
    const under = thingAt(tracks, tip, Math.min(r1, r0 + 0.05));
    thing = thingsOver(under?.name, Math.max(r0, clipFrom), Math.min(r1, clipTo));
    for (const c of pointer.clicks) {
      if (c.t < r0 - 1e-6 || c.t > r1 + 1e-6) continue;
      const t = thingAt(tracks, c, c.t);
      const box = thingsOver(t?.name, c.arrive, c.up) ?? boxAround(c, 200, 80);
      thing = thing ? union(thing, box) : box;
    }
    for (const e of cursor.events) {
      if ((e.type !== 'type' && e.type !== 'paste') || e.t < r0 || e.t > r1) continue;
      const click = [...pointer.clicks].reverse().find((c) => c.t <= e.t && e.t - c.t < 1.5);
      const t = click ? thingAt(tracks, click, e.t) : null;
      const box = thingsOver(t?.name, e.t, e.end ?? e.t + 0.3) ?? (click ? boxAround(click, 420, 120) : null);
      if (box) thing = thing ? union(thing, box) : box;
    }
    const tipBox = (scale: number) => pointerExtent(tip, options.cursorStyle, boxAt(scale), scale);
    let scale = most;
    let subject = clipToPage(thing ? union(thing, tipBox(scale)) : union(boxAround(tip, 160, 90), tipBox(scale)));
    for (let i = 0; i < 2; i++) {
      scale = scaleOf(viewFor(subject));
      subject = clipToPage(thing ? union(thing, tipBox(scale)) : union(boxAround(tip, 160, 90), tipBox(scale)));
    }
    stops.push({ t0: map.filmAt(Math.max(r0, clipFrom)), t1: map.filmAt(Math.min(r1, clipTo)), tip, thing: thing ? clipToPage(thing) : null, subject, scale });
  }

  /**
   * The pointer's whole way on move i with the next thing, and the view that holds it with the last thing too. The
   * pointer's page size grows as the camera pulls back, so its way is measured again at the wider view's scale.
   */
  const travelOf = (i: number, scale: number, fixedScale?: number) => {
    const m = moves[i];
    let sc = scale;
    let travel = union(pathBox(m.start, m.end, sc), stops[i + 1].subject);
    let bridge = viewFor(union(travel, stops[i].subject), fixedScale);
    for (let n = 0; n < 3 && scaleOf(bridge) < sc - 1e-6; n++) {
      sc = scaleOf(bridge);
      travel = union(pathBox(m.start, m.end, sc), stops[i + 1].subject);
      bridge = viewFor(union(travel, stops[i].subject), fixedScale);
    }
    return { travel, bridge };
  };

  // A camera that does not zoom by itself (documentary, montage) holds one scale: the widest any stop or travel needs.
  const auto = options.auto ?? true;
  let fixed: number | undefined;
  if (!auto) {
    let sc = most;
    stops.forEach((s) => (sc = Math.min(sc, scaleOf(viewFor(s.subject)))));
    moves.forEach((_, i) => (sc = Math.min(sc, scaleOf(travelOf(i, sc).bridge))));
    // Held still only when one scale still reads; in a tall frame that would mean the whole page as a thin strip,
    // so the camera follows after all, without springs.
    fixed = sc >= 0.75 * most ? sc : undefined;
  }
  const views = stops.map((s) => viewFor(s.subject, fixed));

  // ------------------------------------------------ the moves

  type Tween = { t0: number; t1: number; from: Q | null; to: Q; spring: boolean; anchor?: Rect; kind: FollowMove['kind']; pointer?: [number, number]; share?: { place: number; size: number }; progress?: (f: number) => number };
  const tweens: Tween[] = [];
  const lerpQ = (a: Q, b: Q, u: number): Q => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), w: lerp(a.w, b.w, u), h: lerp(a.h, b.h, u) });
  // The spring lands a little past the view and settles back along the same line: one turn, no wobble. It rises
  // to its peak with the travel curve and eases back from it, both ends at rest, so its speed never jumps. The
  // overshoot is scaled down when the full one would let the subject slip out or go past the sharpness.
  const reach = 1.6 * overshoot;
  const PEAK = 0.78;
  const landing = (u: number, amount: number) => (u <= PEAK ? (1 + amount) * easing.travel(u / PEAK) : 1 + amount * (1 - easing.travel((u - PEAK) / (1 - PEAK))));
  /** Between two views with the place and the size each at their own progress. */
  const lerpQ2 = (a: Q, b: Q, uPlace: number, uSize: number): Q => {
    const w = lerp(a.w, b.w, uSize);
    const h = lerp(a.h, b.h, uSize);
    // The place is the view's centre: a size change alone closes in about the middle.
    const cx = lerp(a.x + a.w / 2, b.x + b.w / 2, uPlace);
    const cy = lerp(a.y + a.h / 2, b.y + b.h / 2, uPlace);
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  };
  /** How far past the view the landing may go: in place while the subject stays in, in size while still sharp. */
  const overshootOf = (tr: Tween, from: Q): { place: number; size: number } => {
    if (tr.share) return tr.share;
    const search = (fine: (x: number) => boolean) => {
      if (reach <= 1e-6) return 0;
      if (fine(reach)) return reach;
      let lo = 0;
      let hi = reach;
      for (let n = 0; n < 24; n++) {
        const mid = (lo + hi) / 2;
        if (fine(mid)) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    const anchor = tr.anchor;
    const size = search((x) => scaleOf(lerpQ2(from, tr.to, 1, 1 + x)) <= most + 1e-9 && (!anchor || contains(lerpQ2(from, tr.to, 1, 1 + x), anchor)));
    const place = search((x) => !anchor || contains(lerpQ2(from, tr.to, 1 + x, 1 + size), anchor));
    tr.share = { place, size };
    return tr.share;
  };
  const evaluate = (list: Tween[], f: number, first: Q): Q => {
    let q = first;
    for (const tr of list) {
      if (f < tr.t0) break;
      const from = tr.from ?? q;
      const u = clamp01((f - tr.t0) / Math.max(1e-6, tr.t1 - tr.t0));
      if (tr.spring) {
        const o = overshootOf(tr, from);
        q = lerpQ2(from, tr.to, landing(u, o.place), landing(u, o.size));
      } else q = lerpQ(from, tr.to, tr.progress ? tr.progress(f) : easing.travel(u));
    }
    return q;
  };

  const holds = [...(options.holds ?? [])].sort((a, b) => a[0] - b[0]);
  const outOfHolds = (t: number) => {
    for (const [h0, h1] of holds) if (t > h0 && t < h1) return h1;
    return t;
  };
  let start = views[0];
  let busyUntil = 0;
  // A long pull-back takes longer (up to the scene length): distance scales duration.
  const pullLengthOf = (from: Q, to: Q) => Math.max(zoomLength, lengthOf('scene') * Math.min(1, Math.abs(Math.log(to.w / from.w)) / Math.log(3)));
  /** A stop's subject with the pointer drawn at a given scale. */
  const subjectAt = (stop: FollowStop, scale: number) => {
    const tip = pointerExtent(stop.tip, options.cursorStyle, boxAt(scale), scale);
    return clipToPage(stop.thing ? union(stop.thing, tip) : union(boxAround(stop.tip, 160, 90), tip));
  };
  /** The view at a scale that holds a subject, pushed as far as it can go the way the pointer is about to travel. */
  const aheadOf = (subject: Rect, scale: number, dx: number, dy: number): Q => {
    const centred = viewFor(subject, scale);
    const s = scaleOf(centred);
    const lead = (q: number, size: number, lo: number, hi: number, d: number) => (d > 0 ? lo : d < 0 ? hi - size : q);
    const x = lead(centred.x, centred.w, subject.x, subject.x + subject.width, Math.abs(dx) > 40 ? dx : 0);
    const y = lead(centred.y, centred.h, subject.y, subject.y + subject.height, Math.abs(dy) > 40 ? dy : 0);
    return {
      x: clampAxis(x, centred.w, inner.x / s, W / s, subject.x, subject.x + subject.width, page.width),
      y: clampAxis(y, centred.h, inner.y / s, H / s, subject.y, subject.y + subject.height, page.height),
      w: centred.w,
      h: centred.h,
    };
  };
  /** How far through move m the pointer is at film time f, from 0 to 1, by its own easing. */
  const progressOf = (m: (typeof moves)[number]) => (f: number) => easing.travel(clamp01((map.recAt(Math.max(0, f)) - m.start) / Math.max(1e-6, m.end - m.start)));
  /**
   * A long move tracked at one scale: the camera sets off ahead (the pointer at the trailing side, the last thing
   * still in view), then runs with the pointer's own progress 150 ms behind it, so the pointer leads but never
   * reaches the edge. Returns the closest scale for which every frame keeps the pointer inside, or null.
   */
  const trackOf = (i: number, current: Q, floor: number) => {
    const m = moves[i];
    const a = map.filmAt(m.start);
    const e = map.filmAt(m.end);
    const p0 = pointer.at(m.start);
    const p1 = pointer.at(m.end);
    const progress = progressOf(m);
    const hi = Math.min(scaleOf(current), scaleOf(views[i + 1]));
    for (let sc = hi; sc >= floor * 1.04; sc *= 0.96) {
      const from = aheadOf(subjectAt(stops[i], sc), sc, p1.x - p0.x, p1.y - p0.y);
      const to = viewFor(subjectAt(stops[i + 1], sc), sc);
      if (Math.abs(scaleOf(from) - sc) > 1e-6 || Math.abs(scaleOf(to) - sc) > 1e-6 || !contains(to, subjectAt(stops[i + 1], sc))) continue;
      // The pointer inside on every frame, and from its arrival the next thing too.
      const next = subjectAt(stops[i + 1], sc);
      let fine = true;
      for (let f = a; f <= e + FOLLOW_DELAY + 1e-6 && fine; f += 1 / 120) {
        const q = lerpQ(from, to, progress(f - FOLLOW_DELAY));
        fine = contains(q, pointerExtent(pointer.at(map.recAt(f)), options.cursorStyle, boxAt(sc), sc)) && (f < e - 1e-6 || contains(q, next));
      }
      if (fine) return { from, to, scale: sc, progress, a, e };
    }
    return null;
  };

  moves.forEach((m, i) => {
    const a = map.filmAt(m.start);
    const e = map.filmAt(m.end);
    const fromStop = stops[i];
    const toStop = stops[i + 1];
    const current = i === 0 ? start : views[i];
    const proof = (options.holdAfter ?? 0.8) * 0.75;
    /** A move made while the pointer still rests: after the last action's proof moment, never in a reading hold. */
    const beforeMove = (to: Q, kind: FollowMove['kind']) => {
      if (i === 0 && a < 1.4) {
        // A first move this early: the clip opens on that view.
        start = to;
        return;
      }
      let t0 = outOfHolds(Math.max(busyUntil, fromStop.t0 + proof, a + SET_OFF - pullLengthOf(current, to)));
      const t1 = a + SET_OFF;
      if (t1 - t0 < lengthOf('quick')) t0 = t1 - lengthOf('quick');
      tweens.push({ t0, t1, from: null, to, spring: false, kind });
    };
    const { travel, bridge } = travelOf(i, Math.min(scaleOf(current), scaleOf(views[i + 1])), fixed);
    if (!contains(current, travel)) {
      // Too far for the view the camera is in. Track it at the closest scale that keeps the pointer in (a pan
      // that trails the pointer); failing that, pull back to a view that holds its whole way.
      const track = fixed === undefined ? trackOf(i, current, scaleOf(bridge)) : null;
      if (track) {
        beforeMove(track.from, 'lead');
        const t0 = a + FOLLOW_DELAY;
        const t1 = e + FOLLOW_DELAY;
        tweens.push({ t0, t1, from: track.from, to: track.to, spring: false, kind: 'follow', pointer: [a, e], progress: (f: number) => track.progress(f - FOLLOW_DELAY) });
        const t2 = t1 + pullLengthOf(track.to, views[i + 1]);
        tweens.push({ t0: t1, t1: t2, from: track.to, to: views[i + 1], spring: auto && Boolean(options.spring), anchor: toStop.subject, kind: 'push-in' });
        busyUntil = t2;
        return;
      }
      beforeMove(bridge, 'pull-back');
    }
    // A follow lasts the zoom's length for a big change, less for a small one, and never ends before the pointer has.
    const t0 = a + FOLLOW_DELAY;
    const before = evaluate(tweens, t0, start);
    const change = Math.min(1, Math.max(Math.abs(Math.log(views[i + 1].w / before.w)) / Math.log(3), Math.hypot(views[i + 1].x - before.x, views[i + 1].y - before.y) / before.w));
    const t1 = Math.max(e + FOLLOW_DELAY + 0.1, t0 + Math.max(lengthOf('quick'), zoomLength * change));
    tweens.push({ t0, t1, from: null, to: views[i + 1], spring: auto && Boolean(options.spring), anchor: toStop.subject, kind: 'follow', pointer: [a, e] });
    busyUntil = t1;
  });

  // ------------------------------------------------ hand-set moves

  const stateQ = (s: { cx: number; cy: number; zoom: number }) => qFromState(s, k, inner, W, H);
  const targetQ = (target: Target, f: number, zoom?: number): Q => {
    if (target === 'page') return viewFor({ x: 0, y: 0, width: page.width, height: page.height });
    const r = map.recAt(f);
    if ('thing' in target) {
      const rect = rectAt(tracks, target.thing, r);
      if (!rect) throw new Error(`The camera was asked to go to "${target.thing}", but that thing is not tracked (or not on the page) at ${f.toFixed(2)} s.`);
      return viewFor(rect, zoom ? zoom * k : undefined);
    }
    if ('click' in target) {
      const click = pointer.clicks[target.click - 1];
      if (!click) throw new Error(`The camera was asked to go to click ${target.click}, but the capture has ${pointer.clicks.length} clicks.`);
      return viewFor(thingAt(tracks, click, click.t)?.rect ?? boxAround(click, 360, 200), zoom ? zoom * k : undefined);
    }
    if ('width' in target) return viewFor(target, zoom ? zoom * k : undefined);
    return stateQ({ cx: target.x, cy: target.y, zoom: target.zoom ?? zoom ?? (most * 0.8) / k });
  };
  const hand = [...(options.moves ?? [])].filter((m) => m.move !== 'dolly-tilt' && m.move !== 'orbit' && m.move !== 'rack-focus').sort((a, b) => a.at - b.at);
  const startsSomewhere = (m: CameraMove) => m.move === 'pull-out' || m.move === 'pan-across' || m.move === 'crane-reveal';
  const handFrom = hand.length ? (startsSomewhere(hand[0]) ? 0 : hand[0].at) : Infinity;
  const handTweens: Tween[] = [];
  let releaseAt = Infinity;
  let releaseLength = zoomLength;
  for (const m of hand) {
    const length = lengthOf(('over' in m && m.over) || (m.move === 'snap-zoom' ? 'quick' : m.move === 'pan-across' || m.move === 'crane-reveal' ? 'hero' : 'scene'));
    if (m.move === 'release') {
      releaseAt = m.at;
      releaseLength = length;
      break;
    }
    if (m.move === 'push-in' || m.move === 'key' || m.move === 'snap-zoom') {
      handTweens.push({ t0: m.at, t1: m.at + length, from: null, to: targetQ(m.to, m.at, 'zoom' in m ? m.zoom : undefined), spring: false, kind: 'hand' });
    } else if (m.move === 'pull-out' || m.move === 'crane-reveal') {
      const from = targetQ(m.from, m.at, m.move === 'pull-out' ? m.zoom : undefined);
      handTweens.push({ t0: handTweens.length ? m.at - 1e-3 : -1, t1: handTweens.length ? m.at : 0, from: null, to: from, spring: false, kind: 'hand' });
      handTweens.push({ t0: m.at, t1: m.at + length, from, to: autoAtLater(m.at + length), spring: false, kind: 'hand' });
    } else if (m.move === 'pan-across') {
      const a = targetQ(m.from, m.at, m.zoom ?? 1.6);
      const b = targetQ(m.to, m.at, m.zoom ?? 1.6);
      handTweens.push({ t0: handTweens.length ? m.at - 1e-3 : -1, t1: handTweens.length ? m.at : 0, from: null, to: a, spring: false, kind: 'hand' });
      handTweens.push({ t0: m.at, t1: m.at + length, from: a, to: b, spring: false, kind: 'hand' });
    }
  }
  function autoAtLater(f: number): Q {
    return evaluate(tweens, f, start);
  }

  const autoAt = (f: number) => evaluate(tweens, f, start);
  const framed = (f: number): Q => {
    const autoQ = autoAt(f);
    if (f < handFrom) return autoQ;
    const handQ = evaluate(handTweens, f, autoAt(handFrom));
    if (f < releaseAt) return handQ;
    return lerpQ(evaluate(handTweens, releaseAt, autoAt(handFrom)), autoQ, easing.travel(clamp01((f - releaseAt) / releaseLength)));
  };
  const held = (f: number): Q => {
    for (const [h0, h1] of holds) {
      if (f >= h0 && f <= h1) return framed(h0);
      if (f > h1 && f < h1 + zoomLength) return lerpQ(framed(h0), framed(f), easing.travel((f - h1) / zoomLength));
    }
    return framed(f);
  };
  const loopLength = Math.min(map.duration / 3, lengthOf('hero'));

  const at = (f: number): CameraState => {
    let q = held(f);
    if (map.loop) {
      const back = easing.travel(clamp01((f - (map.duration - loopLength)) / loopLength));
      if (back > 0) q = lerpQ(q, held(0), back);
    }
    const s = scaleOf(q);
    return { cx: q.x - (inner.x - W / 2) / s, cy: q.y - (inner.y - H / 2) / s, zoom: s / k, turnX: 0, turnY: 0, focus: null };
  };

  const followMoves: FollowMove[] = [...tweens, ...handTweens].map((t) => ({ kind: t.kind, t0: t.t0, t1: t.t1, pointer: t.pointer, spring: t.spring }));
  return { at, shots: [], base, follow: { stops, moves: followMoves, inner, margin, k, region: { width: W, height: H }, most, delay: FOLLOW_DELAY } };
};

/** True when a region's shape differs from the page's enough to need the follow camera. */
export const needsFollow = (region: { width: number; height: number } | undefined, page: { width: number; height: number }) =>
  Boolean(region) && Math.abs(Math.log(region!.width / region!.height / (page.width / page.height))) > 0.02;
