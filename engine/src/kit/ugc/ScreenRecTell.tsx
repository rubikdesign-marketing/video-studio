// Screen-recording tell: the small marks that say "I recorded my own screen". A REC dot with a running timer, a tap
// ripple wherever a finger touches, and (optionally) a phone drawn around the screen. The phone is an original,
// anonymous shape (a rounded body, a pill camera cut-out, two side keys): it looks like no company's device.
// Plain 2D only (HTML and SVG), driven by the scene clock in seconds: the same frame always renders the same.
import type { CSSProperties, FC, ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { voiceStyle } from '../moves/core';
import { alpha, contrast } from '../tokens';
import { useStage } from '../ui';

export type Tap = {
  /** Seconds on the scene clock when the finger lands. */
  at: number;
  /** Where, as shares (0..1) of the screen it sits on (the phone's screen when framed, else the frame). */
  x: number;
  y: number;
};

export type RecBadgeProps = {
  /** Seconds when the badge appears. */
  at?: number;
  out?: number;
  /** "rec" shows a REC dot and a label; the timer runs beside it. */
  label?: string;
  /** Show the running timer (m:ss). */
  timer?: boolean;
  /** Seconds already on the timer at `at`, for a recording that began before this scene. */
  timerFrom?: number;
  /** Where its middle-left sits, as shares of the screen it is drawn in. */
  x?: number;
  y?: number;
  /** The dot's colour; the brand's warm colour by default. */
  dot?: string;
  /** The badge's size as a per cent of the screen's short side (default 3.6). */
  size?: number;
};

const RING_LENGTH = 0.55;

/** The REC pill's own colours: a dark pill and the text colour with the better contrast against it, so the label reads on a light and on a dark stage (4.5:1 at the least, even over a white picture). */
export const RECBADGE_PILL_ALPHA = 0.78;
export const recBadgeColours = (stage: { shade: string; ink: string; onInk: string }) => ({
  background: alpha(stage.shade, RECBADGE_PILL_ALPHA),
  text: contrast(stage.onInk, stage.shade) >= contrast(stage.ink, stage.shade) ? stage.onInk : stage.ink,
});

/** The finger's touch: a soft disc that shrinks onto the glass and a ring that opens and fades. Size is per cent of the short side. */
export const TapRipple: FC<{ at: number; x: number; y: number; width: number; height: number; size?: number; colour?: string }> = ({ at, x, y, width, height, size = 11, colour }) => {
  const m = useMotion();
  const stage = useStage();
  const c = colour ?? stage.accent;
  const d = (Math.min(width, height) * size) / 100;
  const end = at + RING_LENGTH;
  if (m.t < at || m.t >= end) return null;
  const open = progress(m.t, at, end, easing.arrive);
  const touch = progress(m.t, at, at + 0.14, easing.arrive) * (1 - progress(m.t, at + 0.14, at + 0.4, easing.leave));
  return (
    <div style={{ position: 'absolute', left: width * x - d / 2, top: height * y - d / 2, width: d, height: d, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: alpha(c, 0.34), opacity: touch, scale: `${0.55 + 0.25 * touch}` }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${Math.max(2, d * 0.05)}px solid ${c}`, opacity: 1 - open, scale: `${0.35 + 0.95 * open}` }} />
    </div>
  );
};

/** The REC mark: a dot that breathes (a smooth pulse of the clock, never random) and a timer that counts whole seconds. */
export const RecBadge: FC<RecBadgeProps & { width: number; height: number }> = ({ at = 0, out, label = 'REC', timer = true, timerFrom = 0, x = 0.06, y = 0.045, dot, size = 3.6, width, height }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const px = (Math.min(width, height) * size) / 100;
  const enter = progress(m.t, at, at + m.seconds('quick'));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  if (m.t < at - 1e-6 || exit >= 1) return null;
  const secs = Math.floor(Math.max(0, m.t - at) + timerFrom + 1e-6);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const pulse = 0.72 + 0.28 * Math.cos(2 * Math.PI * ((m.t - at) / 1.2));
  const red = dot ?? stage.warm;
  const voice = voiceStyle(brand.fonts.label, px);
  const pill = recBadgeColours(stage);
  return (
    <div
      style={{
        position: 'absolute',
        left: width * x,
        top: height * y - px * 0.95,
        display: 'flex',
        alignItems: 'center',
        gap: px * 0.5,
        padding: `${px * 0.38}px ${px * 0.75}px ${px * 0.38}px ${px * 0.6}px`,
        borderRadius: px * 1.2,
        background: pill.background,
        color: pill.text,
        opacity: enter * (1 - exit),
        translate: `0 ${(1 - enter) * -px * 0.5}px`,
        whiteSpace: 'pre',
        ...voice,
        lineHeight: 1,
      }}
    >
      <span style={{ width: px * 0.7, height: px * 0.7, borderRadius: '50%', background: red, opacity: pulse, boxShadow: `0 0 ${px * 0.6}px ${alpha(red, 0.5 * pulse)}` }} />
      <span style={{ letterSpacing: '0.08em', fontWeight: 700 }}>{label}</span>
      {timer ? <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.92 }}>{clock}</span> : null}
    </div>
  );
};

export type ScreenRecTellProps = RecBadgeProps & {
  /** Finger touches, in order. */
  taps?: Tap[];
  /** Draw a phone around the children. Without it, the marks sit on the whole frame and the children fill it. */
  frame?: boolean;
  /** What the phone's screen shows. */
  children?: ReactNode;
  /** The phone's body colour; the stage's shade by default. */
  body?: string;
  /** The ripple's colour; the brand accent by default. */
  tapColour?: string;
  style?: CSSProperties;
};

const PHONE_RATIO = 19.5 / 9;

/**
 * The phone's footprint in a frame: as tall as the frame allows (92%), but never wider than `maxShare` of the frame's
 * width. In 16:9 it stands in the middle at the frame's height; in 9:16 it is as wide as the frame allows.
 */
export const phoneBox = (width: number, height: number, maxShare = 0.9) => {
  const h = Math.min(height * 0.92, ((width * maxShare) / 9) * 19.5);
  const w = h / PHONE_RATIO;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
};

export const ScreenRecTell: FC<ScreenRecTellProps> = ({ taps = [], frame = true, children, body, tapColour, style, ...rec }) => {
  const stage = useStage();
  const { width, height } = useVideoConfig();
  const box = frame ? phoneBox(width, height) : { x: 0, y: 0, w: width, h: height };
  const bezel = frame ? box.w * 0.035 : 0;
  const screen = { w: box.w - bezel * 2, h: box.h - bezel * 2 };
  const corner = frame ? box.w * 0.14 : 0;
  const bodyColour = body ?? stage.shade;
  return (
    <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: corner, background: frame ? bodyColour : undefined, boxShadow: frame ? `0 0 0 ${Math.max(2, box.w * 0.006)}px ${alpha(stage.onInk, 0.16)}, 0 ${box.h * 0.02}px ${box.h * 0.06}px ${alpha(stage.shade, 0.5)}` : undefined, ...style }}>
      {frame ? (
        <>
          <div style={{ position: 'absolute', left: -box.w * 0.012, top: box.h * 0.2, width: box.w * 0.012, height: box.h * 0.06, background: bodyColour, borderRadius: '3px 0 0 3px' }} />
          <div style={{ position: 'absolute', right: -box.w * 0.012, top: box.h * 0.26, width: box.w * 0.012, height: box.h * 0.1, background: bodyColour, borderRadius: '0 3px 3px 0' }} />
        </>
      ) : null}
      <div style={{ position: 'absolute', left: bezel, top: bezel, width: screen.w, height: screen.h, borderRadius: Math.max(0, corner - bezel), overflow: 'hidden', background: stage.page }}>
        {children}
        {frame ? <div style={{ position: 'absolute', left: screen.w * 0.5 - screen.w * 0.13, top: screen.h * 0.012, width: screen.w * 0.26, height: screen.w * 0.07, borderRadius: screen.w * 0.04, background: bodyColour }} /> : null}
        <RecBadge {...rec} width={screen.w} height={screen.h} x={rec.x ?? 0.06} y={rec.y ?? (frame ? 0.075 : 0.045)} />
        {taps.map((tap, i) => (
          <TapRipple key={i} at={tap.at} x={tap.x} y={tap.y} width={screen.w} height={screen.h} colour={tapColour} />
        ))}
      </div>
    </div>
  );
};
