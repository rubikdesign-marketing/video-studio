// Shared drawing for the ugc-01 scenes (hand-written; scaffold.mjs never touches this file).
// A 16:9 product still shown in a tall 9:16 window with a camera (centre in page pixels, zoom), a pointer and rings
// in page coordinates, the caption pill in the 82-93% band, and (from kit/ugc) the comment card and the screen-recording marks. Times are film seconds from
// events.json, so the scenes, the captions and the sound cues all read one list.
import { measureText } from '@remotion/layout-utils';
import { type CSSProperties, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand, useFontsLoaded } from '../../kit/brand';
import { alpha } from '../../kit/tokens';
import { captionsSchema } from '../../kit/Captions';
import { ClickRing, Pointer } from '../../kit/ui';
import captionsJson from '../../../public/jobs/ugc-01/ugc-captions.json';
import eventsJson from '../../../public/jobs/ugc-01/events.json';
import type { SceneData } from '../_film';

export const events = eventsJson;
const captions = captionsSchema.parse(captionsJson);

/** Film time in seconds, from the scene's own clock (a scene's <Sequence> restarts the frame count). */
export const useFilmTime = (scene: SceneData) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return scene.start + frame / fps;
};

// The window the product sits in (frame pixels, 1080 x 1920): inside 54 px sides and 96 px top, above the caption band (y 1574).
export const WIN = { x: 54, y: 190, w: 972, h: 1290, radius: 30 };
export const PAGE = { w: 1920, h: 1080 };

export type Cam = { cx: number; cy: number; z: number };
const travel = Easing.bezier(0.4, 0, 0.2, 1);

/** The camera at time t from keyframes [t, cx, cy, z]: held before the first, held after the last, eased between. */
export const camAt = (keys: [number, number, number, number][], t: number): Cam => {
  const times = keys.map((k) => k[0]);
  const at = (i: number) => interpolate(t, times, keys.map((k) => k[i]), { easing: travel, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const z = at(3);
  // never show beyond the page: keep the window inside the 1920 x 1080 picture (when the zoom is high enough to fill it)
  const half = (len: number, total: number) => Math.min(total / 2, len / 2);
  const visW = PAGE.w / z;
  const visH = WIN.h / ((z * WIN.w) / PAGE.w);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  return { cx: clamp(at(1), half(visW, PAGE.w), PAGE.w - half(visW, PAGE.w)), cy: clamp(at(2), half(visH, PAGE.h), PAGE.h - half(visH, PAGE.h)), z };
};

/** Page pixels to window pixels for a camera. */
export const project = (cam: Cam, x: number, y: number) => {
  const s = (cam.z * WIN.w) / PAGE.w;
  return { x: WIN.w / 2 + (x - cam.cx) * s, y: WIN.h / 2 + (y - cam.cy) * s, s };
};

/** A graded still in the window under a camera. Children are drawn in window pixels (clipped by the window). */
export const Window: FC<{ src: string; cam: Cam; children?: ReactNode }> = ({ src, cam, children }) => {
  const { s } = project(cam, 0, 0);
  const left = WIN.w / 2 - cam.cx * s;
  const top = WIN.h / 2 - cam.cy * s;
  return (
    <div style={{ position: 'absolute', left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, borderRadius: WIN.radius, overflow: 'hidden', background: '#fff', boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.10)' }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left, top, width: PAGE.w * s, height: PAGE.h * s, maxWidth: 'none' }} />
      {children}
    </div>
  );
};

/** The pointer in page pixels under a camera, inside the window. `press` 0..1 while a click is down. */
export const PagePointer: FC<{ cam: Cam; x: number; y: number; press?: number; opacity?: number }> = ({ cam, x, y, press = 0, opacity = 1 }) => {
  const p = project(cam, x, y);
  return <Pointer tip={{ x: p.x, y: p.y }} press={press} opacity={opacity} size={3.4} />;
};

/** A click ring at a page point; `at` is on the scene's own clock (seconds). */
export const PageRing: FC<{ cam: Cam; x: number; y: number; at: number }> = ({ cam, x, y, at }) => {
  const p = project(cam, x, y);
  return <ClickRing at={at} x={p.x} y={p.y} size={5.2} />;
};

/** A rounded outline around a page rectangle that grows in from `at` (film seconds) and then holds. */
export const PageOutline: FC<{ cam: Cam; rect: [number, number, number, number]; t: number; at: number; grow?: number; label?: string }> = ({ cam, rect, t, at, grow = 0.25 }) => {
  const { captions: c } = useBrand();
  const u = interpolate(t, [at - 1 / 30, at + grow], [0, 1], { easing: Easing.bezier(0.22, 1, 0.36, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (t < at - 1e-6) return null;
  const a = project(cam, rect[0], rect[1]);
  const pad = 14 * (1 - u) + 10;
  const w = rect[2] * a.s + pad * 2;
  const h = rect[3] * a.s + pad * 2;
  return (
    <div style={{ position: 'absolute', left: a.x - pad, top: a.y - pad, width: w, height: h, borderRadius: 18, border: `6px solid ${c.highlight}`, boxShadow: `0 0 0 6px ${alpha(c.highlight, 0.18)}`, opacity: u, scale: `${1 + (1 - u) * 0.12}` }} />
  );
};

const HOLD_AFTER = 0.3;
// The caption pill: a dark glass pill in the band 82% to 93% of the frame height (y 1574 to 1786), the brand's headline type.
const BAND = { top: 0.82, bottom: 0.93 };

export const UgcCaptions: FC<{ t: number }> = ({ t }) => {
  const { height, width } = useVideoConfig();
  const { captions: c, fonts } = useBrand();
  const loaded = useFontsLoaded();
  const line = captions.lines.find((l) => t >= l.start && t < l.end + HOLD_AFTER);
  if (!loaded || !line) return null;
  const bandH = height * (BAND.bottom - BAND.top);
  const pillH = bandH * 0.78;
  const text = line.words.map((w) => w.text).join(' ');
  const maxPill = width * 0.9;
  const baseSize = pillH * 0.5;
  const atBase = measureText({ text, fontFamily: fonts.headline.css, fontSize: baseSize, fontWeight: c.weight + 150 }).width;
  // the line is set as large as the band allows, and smaller when it would not fit the frame's width
  const fontSize = Math.min(baseSize, (baseSize * (maxPill - pillH * 0.9)) / atBase);
  const measured = atBase * (fontSize / baseSize);
  const pillW = Math.min(maxPill, measured + pillH * 0.9);
  const enter = interpolate(t, [line.start - 1 / 30, line.start + 0.21], [0, 1], { easing: Easing.bezier(0.22, 1, 0.36, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exit = interpolate(t, [line.end + 0.12, line.end + HOLD_AFTER], [0, 1], { easing: Easing.bezier(0.4, 0, 1, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = enter * (1 - exit);
  const base: CSSProperties = { fontFamily: fonts.headline.css, fontWeight: c.weight, fontSize, lineHeight: 1, whiteSpace: 'pre' };
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: (width - pillW) / 2,
          top: height * BAND.top + (bandH - pillH) / 2,
          width: pillW,
          height: pillH,
          borderRadius: pillH / 2,
          background: `linear-gradient(180deg, ${alpha(c.glassTop, 0.92)}, ${alpha(c.glassBottom, 0.92)})`,
          boxShadow: `0 0 0 2px ${alpha('#FFFFFF', 0.14)}, 0 18px 50px ${alpha(c.glassBottom, 0.4)}`,
          opacity,
          scale: `${0.94 + 0.06 * enter}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: fontSize * 0.28,
        }}
      >
        {line.words.map((w, i) => {
          const spoken = t >= w.start;
          return (
            <span key={i} style={{ ...base, color: w.highlight ? c.highlight : c.text, opacity: spoken ? 1 : 0.4, fontWeight: w.highlight ? Math.min(900, c.weight + 150) : c.weight }}>
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
