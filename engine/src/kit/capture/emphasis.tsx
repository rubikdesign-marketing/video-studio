// The animations on the product (CAPTURE-PLAN 7.4 and the 7.9 table), drawn by CaptureClip over the recording.
// Every one takes its place from `anchorOf` (glue.ts): the tracked rectangle at the recording moment on screen,
// through the camera the picture uses, so it stays on the real thing while the page scrolls and the camera moves.
//
// Truth rules: lift, isolate, fly out, magnifier, toast, typed again, blur reveal and privacy show the recording's
// own pixels at the tracked rectangle (a "layer" cut from the frame), never a redrawing; nothing here draws a word
// or a number the capture does not have (a callout's few words are the film's, like a caption). Marks are clean
// geometry in the accent colour, never hand drawn (craft file 00, "Not to copy"). One emphasis per beat
// (emphasisClashes). Colours, type and radius come from the brand; lengths from the motion tokens and the energy.
import type { CSSProperties, FC, ReactNode } from 'react';
import { useBrand } from '../brand';
import { clamp01, easing, EXIT_SHARE, lerp, useMotion, type Point } from '../motion';
import { lightOf, voiceStyle } from '../moves/core';
import { alpha } from '../tokens';
import { Confetti, useStage, useVh } from '../ui';
import type { CaptureCursor, CaptureTracks, Rect } from './data';
import { ThingGlow } from './draw';
import { amountOf, anchorOf, outOf, targetRect, type Emphasis, type RegionView } from './glue';
import type { TimeMap } from './timemap';

/** A piece of the recording: page rectangle `src` at recording time `rec`, drawn into `dst` (region pixels). */
export type LayerSpec = { src: Rect; rec: number; dst: Rect; radius: number; style?: CSSProperties; filter?: string };

export type EmphasisContext = {
  /** Clip time, and the recording time it shows. */
  f: number;
  rec: number;
  view: RegionView;
  cursor: CaptureCursor;
  tracks: CaptureTracks | undefined;
  map: TimeMap;
  /** The clip's length in seconds. */
  seconds: number;
  /** Draws a piece of the recording (CaptureClip's picture, cut and placed). */
  layer: (spec: LayerSpec) => ReactNode;
  /** A success moment is for hype and launch films only. */
  allowSuccess: boolean;
};

type Seconds = (token: 'tick' | 'quick' | 'base' | 'scene' | 'hero') => number;

/** How long each kind takes to arrive. */
const ENTER: Record<Emphasis['kind'], 'tick' | 'quick' | 'base' | 'scene' | 'hero'> = {
  lift: 'base',
  isolate: 'scene',
  'fly-out': 'scene',
  focus: 'scene',
  outline: 'base',
  underline: 'base',
  ring: 'base',
  sweep: 'hero',
  magnifier: 'base',
  callout: 'base',
  arrow: 'base',
  connect: 'scene',
  steps: 'quick',
  retype: 'quick',
  toast: 'base',
  success: 'base',
  'blur-reveal': 'scene',
  privacy: 'tick',
};

/** The emphasis with its real cue: a toast given a negative `at` pops when it appears. */
const effective = (e: Emphasis, ctx: EmphasisContext): Emphasis => (e.kind === 'toast' && e.at < 0 ? { ...e, at: toastAppears(e, ctx) ?? 0 } : e);

/** When a tracked thing first appears in the clip (film seconds). */
const toastAppears = (e: Emphasis, ctx: EmphasisContext): number | null => {
  const fps = ctx.tracks?.fps ?? 60;
  const start = ctx.map.recAt(0);
  const end = ctx.map.recAt(ctx.seconds);
  for (let r = start; r <= end; r += 1 / fps) {
    if (targetRect(ctx.tracks, e.target, r)) return ctx.map.filmAt(r);
  }
  return null;
};

export const amountFor = (raw: Emphasis, ctx: EmphasisContext, secs: Seconds) => {
  const e = effective(raw, ctx);
  const enter = secs(ENTER[e.kind]);
  if (e.kind === 'privacy') return ctx.f >= e.at && ctx.f <= outOf(e, ctx.seconds) ? 1 : 0;
  return amountOf(ctx.f, e.at, outOf(e, ctx.seconds), enter, secs('quick') * EXIT_SHARE, easing.arrive, easing.leave);
};

/** 1 until the emphasis's `out`, then 0 over its exit: for marks whose entrance is their drawing on. */
const leavingOf = (e: Emphasis, ctx: EmphasisContext, secs: Seconds) => 1 - easing.leave(clamp01((ctx.f - outOf(e, ctx.seconds)) / (secs('quick') * EXIT_SHARE)));

/** What the emphases do to the rest of the picture: blur (frame pixels), dimming and a fade to the stage. */
export type Rest = { blur: number; dim: number; fade: number };

export const restOf = (list: Emphasis[], ctx: EmphasisContext, secs: Seconds, vh: (n: number) => number): Rest => {
  const rest: Rest = { blur: 0, dim: 0, fade: 0 };
  for (const raw of list) {
    const e = effective(raw, ctx);
    const a = amountFor(e, ctx, secs);
    if (a <= 0 || !anchorOf(ctx.tracks, e.target, ctx.rec, ctx.view)) continue;
    if (e.kind === 'focus') {
      rest.blur = Math.max(rest.blur, vh(0.42) * a);
      rest.dim = Math.max(rest.dim, 0.38 * a);
    }
    if (e.kind === 'fly-out') {
      rest.blur = Math.max(rest.blur, vh(0.8) * a);
      rest.dim = Math.max(rest.dim, 0.22 * a);
    }
    if (e.kind === 'isolate') rest.fade = Math.max(rest.fade, 0.9 * a);
  }
  return rest;
};

const scaleAbout = (box: Rect, s: number, dx = 0, dy = 0): Rect => ({
  x: box.x + box.width / 2 - (box.width * s) / 2 + dx,
  y: box.y + box.height / 2 - (box.height * s) / 2 + dy,
  width: box.width * s,
  height: box.height * s,
});

const grown = (box: Rect, by: number): Rect => ({ x: box.x - by, y: box.y - by, width: box.width + 2 * by, height: box.height + 2 * by });

/** Where the line from a box's centre towards a point leaves the box. */
const edgeToward = (box: Rect, p: Point, gap: number): Point => {
  const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const tx = dx === 0 ? Infinity : (box.width / 2 + gap) / Math.abs(dx);
  const ty = dy === 0 ? Infinity : (box.height / 2 + gap) / Math.abs(dy);
  const u = Math.min(tx, ty, 1);
  return { x: c.x + dx * u, y: c.y + dy * u };
};

const svgFill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' };

/** A gentle curve from a to b, bent to one side by `bend` of its length. Returns the path and its end direction. */
const curve = (a: Point, b: Point, bend: number) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const c = { x: mx - dy * bend, y: my + dx * bend };
  return { d: `M ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`, angle: Math.atan2(b.y - c.y, b.x - c.x) };
};

/** All the emphases of a clip, drawn in its region over the picture and under the pointer. */
export const EmphasisLayer: FC<{ list: Emphasis[]; ctx: EmphasisContext }> = ({ list, ctx }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const secs: Seconds = (token) => m.seconds(token);
  const { view, rec, f } = ctx;
  const pageToScreen = view.zoom * view.k;
  const control = vh(brand.shape.control);
  const stroke = vh(0.36);
  const out: ReactNode[] = [];
  let stepCount = 0;

  list.forEach((raw, i) => {
    const e = effective(raw, ctx);
    if (e.kind === 'steps') stepCount += 1;
    const number = e.number ?? stepCount;
    const a = amountFor(e, ctx, secs);
    const at = e.at;
    const leave = leavingOf(e, ctx, secs);
    const box = anchorOf(ctx.tracks, e.target, rec, view);
    const key = `${e.kind}-${i}`;
    if (!box) return;
    const src = targetRect(ctx.tracks, e.target, rec)!;
    const radius = (e.radius ?? 8) * pageToScreen;
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

    switch (e.kind) {
      case 'lift':
      case 'isolate':
      case 'focus': {
        if (a <= 0) return;
        const lift = e.kind === 'lift' ? a : e.kind === 'isolate' ? 0.6 * a : 0;
        // It rises by less than it grows on each side, so the thing itself never shows below its own lifted layer.
        const dst = scaleAbout(box, 1 + 0.028 * lift, 0, -Math.min(vh(0.5), 0.012 * box.height) * lift);
        const shadow = lift > 0 ? `0 ${vh(0.6 + 1.6 * lift)}px ${vh(1.2 + 3.2 * lift)}px ${alpha(stage.shade, 0.16 + 0.18 * lift)}` : undefined;
        out.push(<div key={key}>{ctx.layer({ src, rec, dst, radius, style: { boxShadow: shadow } })}</div>);
        return;
      }
      case 'fly-out': {
        if (a <= 0) return;
        // Enlarged no further than the recording's sharpness allows, and to at most 62% of the region's width.
        const sharp = ctx.cursor.scale / pageToScreen;
        const s = Math.max(1, Math.min(sharp, (0.62 * view.width) / box.width, (0.7 * view.height) / box.height));
        const target = { x: view.width / 2, y: view.height / 2 };
        const p = easing.travel(clamp01(a));
        const dst = scaleAbout(box, lerp(1, s, p), lerp(0, target.x - centre.x, p), lerp(0, target.y - centre.y, p));
        const shadow = `0 ${vh(1 + 2.4 * p)}px ${vh(2 + 5 * p)}px ${alpha(stage.shade, 0.2 + 0.2 * p)}`;
        out.push(<div key={key}>{ctx.layer({ src, rec, dst, radius: radius * lerp(1, s, p), style: { boxShadow: shadow } })}</div>);
        return;
      }
      case 'outline':
      case 'underline':
      case 'ring': {
        if (a <= 0) return;
        const pad = vh(0.7);
        const drawn = easing.travel(clamp01((f - at) / secs('base')));
        const opacity = leave;
        let shape: ReactNode;
        if (e.kind === 'outline') {
          const r = grown(box, pad);
          shape = <rect x={r.x} y={r.y} width={r.width} height={r.height} rx={control + pad} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} />;
        } else if (e.kind === 'underline') {
          const y = box.y + box.height + pad;
          shape = <line x1={box.x} y1={y} x2={box.x + box.width} y2={y} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} />;
        } else {
          const rx = box.width / 2 + pad + vh(1.2);
          const ry = box.height / 2 + pad + vh(1);
          // Drawn from its top left, clockwise, all the way round.
          const p = (a: number) => `${centre.x + rx * Math.cos(a)} ${centre.y + ry * Math.sin(a)}`;
          const a0 = (-3 * Math.PI) / 4;
          shape = <path d={`M ${p(a0)} A ${rx} ${ry} 0 1 1 ${p(a0 + Math.PI)} A ${rx} ${ry} 0 1 1 ${p(a0)}`} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} />;
        }
        out.push(
          <svg key={key} style={{ ...svgFill, opacity }}>
            <g fill="none" stroke={stage.accent} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
              {shape}
            </g>
          </svg>,
        );
        return;
      }
      case 'sweep': {
        const u = clamp01((f - at) / secs('hero'));
        if (u <= 0 || u >= 1) return;
        const crossed = easing.travel(u);
        const light = lightOf(brand);
        const bell = (colour: string, strength: number, from: number, to: number) =>
          `linear-gradient(90deg, ${alpha(colour, 0)} ${from}%, ${alpha(colour, strength * 0.5)} ${lerp(from, to, 0.28)}%, ${alpha(colour, strength)} 50%, ${alpha(colour, strength * 0.5)} ${lerp(from, to, 0.72)}%, ${alpha(colour, 0)} ${to}%)`;
        out.push(
          <div key={key} style={{ position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height, overflow: 'hidden', borderRadius: radius, pointerEvents: 'none' }}>
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '45%',
                left: `${lerp(-65, 120, crossed)}%`,
                background: `${bell(light, 0.3, 22, 78)}, ${bell(stage.accent, 0.16, 0, 100)}`,
                transform: 'skewX(-18deg)',
              }}
            />
          </div>,
        );
        return;
      }
      case 'magnifier': {
        if (a <= 0) return;
        const diameter = vh(22);
        const sharp = ctx.cursor.scale / pageToScreen;
        const z = Math.max(1.25, Math.min(e.zoom ?? 1.8, sharp));
        const side = diameter / (pageToScreen * z);
        const c = { x: src.x + src.width / 2, y: src.y + src.height / 2 };
        const lensSrc = { x: c.x - side / 2, y: c.y - side / 2, width: side, height: side };
        const grow = lerp(0.7, 1, a);
        const dst = { x: centre.x - (diameter * grow) / 2, y: centre.y - (diameter * grow) / 2, width: diameter * grow, height: diameter * grow };
        out.push(
          <div key={key} style={{ opacity: clamp01(a * 1.4) }}>
            {ctx.layer({
              src: lensSrc,
              rec,
              dst,
              radius: dst.width / 2,
              style: { boxShadow: `0 0 0 ${vh(0.45)}px ${stage.page}, 0 0 0 ${vh(0.6)}px ${alpha(stage.ink, 0.12)}, 0 ${vh(1.4)}px ${vh(3.6)}px ${alpha(stage.shade, 0.35)}` },
            })}
          </div>,
        );
        return;
      }
      case 'callout': {
        if (a <= 0 || !e.label) return;
        const size = vh(2.3);
        const gap = vh(5.2);
        const textWidth = e.label.length * size * 0.56 + vh(3.2);
        let side = e.side ?? 'above';
        if (side === 'above' && box.y - gap - vh(4.4) < vh(1.5)) side = 'below';
        if (side === 'below' && box.y + box.height + gap + vh(4.4) > view.height - vh(1.5)) side = 'above';
        const anchor =
          side === 'above'
            ? { x: centre.x, y: box.y - gap }
            : side === 'below'
              ? { x: centre.x, y: box.y + box.height + gap }
              : side === 'left'
                ? { x: box.x - gap - textWidth / 2, y: centre.y }
                : { x: box.x + box.width + gap + textWidth / 2, y: centre.y };
        anchor.x = Math.max(textWidth / 2 + vh(1.5), Math.min(view.width - textWidth / 2 - vh(1.5), anchor.x));
        const end = edgeToward(box, anchor, vh(0.5));
        const start = side === 'above' ? { x: anchor.x, y: anchor.y + vh(2.2) } : side === 'below' ? { x: anchor.x, y: anchor.y - vh(2.2) } : anchor;
        const drawn = easing.travel(clamp01((f - at) / secs('quick')));
        const label = easing.arrive(clamp01((f - at - secs('quick') * 0.5) / secs('base')));
        out.push(
          <div key={key} style={{ position: 'absolute', inset: 0, opacity: leave, pointerEvents: 'none' }}>
            <svg style={svgFill}>
              <line x1={start.x} y1={start.y} x2={lerp(start.x, end.x, drawn)} y2={lerp(start.y, end.y, drawn)} stroke={stage.ink} strokeWidth={vh(0.22)} strokeLinecap="round" />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: anchor.x,
                top: anchor.y,
                translate: `-50% ${lerp(-50 + 18, -50, label)}%`,
                padding: `${vh(0.9)}px ${vh(1.6)}px`,
                borderRadius: vh(brand.shape.pill),
                background: stage.ink,
                color: stage.onInk,
                whiteSpace: 'nowrap',
                opacity: label,
                boxShadow: `0 ${vh(0.6)}px ${vh(1.8)}px ${alpha(stage.shade, 0.25)}`,
                ...voiceStyle(brand.fonts.label, size),
              }}
            >
              {e.label}
            </div>
          </div>,
        );
        return;
      }
      case 'arrow':
      case 'connect': {
        if (a <= 0 || !e.to) return;
        const other = anchorOf(ctx.tracks, e.to, rec, view);
        if (!other) return;
        const otherCentre = { x: other.x + other.width / 2, y: other.y + other.height / 2 };
        const gap = vh(e.kind === 'arrow' ? 1.2 : 0.4);
        const p0 = edgeToward(box, otherCentre, gap);
        const p1 = edgeToward(other, centre, gap + (e.kind === 'arrow' ? vh(0.6) : 0));
        const { d, angle } = curve(p0, p1, 0.16);
        const drawn = easing.travel(clamp01((f - at) / secs(e.kind === 'arrow' ? 'base' : 'scene')));
        const head = vh(1.7);
        const headIn = easing.arrive(clamp01((drawn - 0.82) / 0.18));
        // The connection line carries a short bright stretch from the first thing to the second, once a second.
        const travel = ((f - at - secs('scene')) % 1.1) / 1.1;
        out.push(
          <svg key={key} style={{ ...svgFill, opacity: leave }}>
            <path d={d} fill="none" stroke={stage.accent} strokeWidth={stroke} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} opacity={e.kind === 'connect' ? 0.55 : 1} />
            {e.kind === 'arrow' && headIn > 0 ? (
              <path
                d={`M 0 0 L ${-head} ${-head * 0.55} L ${-head * 0.78} 0 L ${-head} ${head * 0.55} Z`}
                fill={stage.accent}
                transform={`translate(${p1.x} ${p1.y}) rotate(${(angle * 180) / Math.PI}) scale(${headIn})`}
              />
            ) : null}
            {e.kind === 'connect' && f > at + secs('scene') ? (
              <path d={d} fill="none" stroke={stage.accent} strokeWidth={stroke * 1.4} strokeLinecap="round" pathLength={1} strokeDasharray="0.14 1.2" strokeDashoffset={0.14 - travel * 1.14} />
            ) : null}
          </svg>,
        );
        return;
      }
      case 'steps': {
        if (a <= 0) return;
        const d = vh(4.2);
        const x = Math.max(vh(0.6), Math.min(view.width - d - vh(0.6), box.x - d * 0.45));
        const y = Math.max(vh(0.6), Math.min(view.height - d - vh(0.6), box.y - d * 0.45));
        const pop = m.settle(at, 'quick');
        out.push(
          <div
            key={key}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: d,
              height: d,
              borderRadius: '50%',
              background: stage.accent,
              color: stage.onAccent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              scale: `${lerp(0.5, 1, pop)}`,
              opacity: a,
              boxShadow: `0 0 0 ${vh(0.3)}px ${stage.page}, 0 ${vh(0.5)}px ${vh(1.4)}px ${alpha(stage.shade, 0.3)}`,
              ...voiceStyle(brand.fonts.label, vh(2.3)),
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {number}
          </div>,
        );
        return;
      }
      case 'retype': {
        // The field's own typing, from the recording, played again from the cue at any speed.
        const typings = ctx.cursor.events.filter((x) => x.type === 'type' && x.end !== undefined);
        const typing = typings[(e.typing ?? 1) - 1];
        if (!typing) return;
        const speed = e.speed ?? 1;
        const length = (typing.end! - typing.t) / speed;
        const u = (f - at) / length;
        const glowOn = amountOf(f, at - 0.15, at + length + 0.4, 0.15, 0.4, easing.arrive, easing.leave);
        if (u >= 0 && u <= 1) {
          const r = typing.t + (typing.end! - typing.t) * u;
          const fieldThen = targetRect(ctx.tracks, e.target, r) ?? src;
          out.push(<div key={key}>{ctx.layer({ src: fieldThen, rec: r, dst: box, radius, style: { opacity: easing.arrive(clamp01((f - at) / secs('tick'))) } })}</div>);
          const keys = (typing.keys ?? []) as number[];
          const beat = keys.reduce((most, t) => (r >= t ? Math.max(most, Math.exp(-(r - t) / 0.12)) : most), 0);
          out.push(<ThingGlow key={`${key}-glow`} box={box} amount={glowOn * (0.65 + 0.35 * beat)} ring />);
        } else if (glowOn > 0) out.push(<ThingGlow key={`${key}-glow`} box={box} amount={glowOn * 0.65} ring />);
        return;
      }
      case 'toast': {
        if (a <= 0) return;
        const u = clamp01((f - at) / (secs('quick') + secs('base')));
        const bump = Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * 0.35);
        const dst = scaleAbout(box, 1 + 0.055 * Math.max(0, bump));
        out.push(<div key={key}>{ctx.layer({ src, rec, dst, radius, style: { boxShadow: `0 ${vh(0.8 + 1.2 * bump)}px ${vh(2 + 2.4 * bump)}px ${alpha(stage.shade, 0.18 + 0.14 * bump)}` } })}</div>);
        return;
      }
      case 'success': {
        if (!ctx.allowSuccess || a <= 0) return;
        if (e.style === 'confetti') {
          out.push(<Confetti key={key} at={at} x={centre.x} y={centre.y} count={70} seed={i + 3} />);
          return;
        }
        // On the thing's top right corner, kept inside the screen.
        const d = vh(7);
        const x = Math.max(vh(1), Math.min(view.width - d - vh(1), box.x + box.width - d * 0.55));
        const y = Math.max(vh(1), Math.min(view.height - d - vh(1), box.y - d * 0.45));
        const pop = m.settle(at, 'base');
        const tick = easing.travel(clamp01((f - at - secs('quick')) / secs('base')));
        out.push(
          <div key={key} style={{ position: 'absolute', left: x, top: y, width: d, height: d, borderRadius: '50%', background: stage.accent, scale: `${lerp(0.4, 1, pop)}`, opacity: a, boxShadow: `0 ${vh(0.8)}px ${vh(2.4)}px ${alpha(stage.accent, 0.4)}` }}>
            <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%' }}>
              <path d="M7 12.4 L10.4 15.6 L17 8.8" fill="none" stroke={stage.onAccent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - tick} />
            </svg>
          </div>,
        );
        return;
      }
      case 'blur-reveal': {
        const u = easing.arrive(clamp01((f - at) / secs('scene')));
        if (u >= 1 || f > outOf(e, ctx.seconds)) return;
        const blur = Math.max(vh(1.3), 10 * pageToScreen) * (1 - u);
        out.push(<div key={key}>{ctx.layer({ src: grown(src, 4), rec, dst: grown(box, 4 * pageToScreen), radius, filter: `blur(${blur}px)` })}</div>);
        return;
      }
      case 'privacy': {
        if (a <= 0) return;
        const blur = Math.max(vh(1.2), 11 * pageToScreen);
        out.push(<div key={key}>{ctx.layer({ src: grown(src, 6), rec, dst: grown(box, 6 * pageToScreen), radius, filter: `blur(${blur}px) saturate(0.7)` })}</div>);
        return;
      }
    }
  });
  return <>{out}</>;
};

/** The isolate fade: the stage's page colour over the rest of the picture. */
export const RestFade: FC<{ amount: number }> = ({ amount }) => {
  const stage = useStage();
  if (amount <= 0.001) return null;
  return <div style={{ position: 'absolute', inset: 0, background: stage.page, opacity: amount }} />;
};
