// Live controls on springs, authored rather than recorded: a toggle that flips, a slider dragged past its end that
// rubber-bands back, and a tab indicator whose leading edge runs ahead of its trailing edge. Capture moves can only
// replay what was recorded; these make the same moments for a film with no capture. Timings are the ones measured
// in liked product films (knowledge/craft/17-motion-graphics.md); overshoot stays under 2%.
import type { CSSProperties, FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { useBrand } from '../brand';
import { easing, progress, useMotion, type Point } from '../motion';
import { alpha } from '../tokens';
import { Pointer, useStage, useVh } from '../ui';
import { Figures, voiceStyle, type Rect } from './core';
import { mixColour, useSnap } from './shape';

const shadowOf = (shade: string, vh: (n: number) => number) => `0 ${vh(0.4)}px ${vh(1.2)}px ${alpha(shade, 0.3)}`;

// ---------------------------------------------------------------- toggle

/** The knob crosses in about 0.18 s (revid:15). */
const FLIP = 0.18;
/** Track length as a share of its height, and the gap round the knob. */
const TRACK = 1.8;
const INSET = 0.12;

/**
 * Where a toggle's knob sits, in pixels of the frame, for a toggle centred on `x`, `y` and `height` pixels tall.
 * A Flood or a Carrier starts from this rect.
 */
export const toggleKnob = (x: number, y: number, height: number, on: boolean): Rect => {
  const side = height * (1 - 2 * INSET);
  const travel = height * TRACK - height;
  const left = x - (height * TRACK) / 2 + height * INSET + (on ? travel : 0);
  return { x: left, y: y - side / 2, width: side, height: side };
};

/**
 * A toggle centred on `x`, `y` (pixels), `size` per cent of frame height tall. It starts `on` or off and flips at
 * each time in `flips`: the knob travels in about 0.18 s on a snap, the track fills with the accent as it goes.
 * Click it with a cursor a tick before each flip. Its knob's place is toggleKnob(), for a flood that starts there.
 * `hideKnob` leaves the knob to a Carrier standing in for it.
 */
export const ToggleFlip: FC<{ x: number; y: number; size?: number; on?: boolean; flips: number[]; at?: number; hideKnob?: boolean; style?: CSSProperties }> = ({
  x,
  y,
  size = 7,
  on = false,
  flips,
  at = 0,
  hideKnob = false,
  style,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const { snap, scale } = useSnap();
  const h = vh(size);
  // Each flip springs the state the other way; summed, so a quick second flip carries on from where it is.
  const state = flips.reduce((v, t, i) => v + (on === (i % 2 === 0) ? -1 : 1) * snap(t, FLIP * scale), on ? 1 : 0);
  const radius = Math.min(h / 2, vh(brand.shape.pill));
  const off = toggleKnob(x, y, h, false);
  const knobX = off.x + (h * TRACK - h) * state;
  const appear = progress(m.t, at, at + m.seconds('quick'));
  if (m.t < at) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: appear, ...style }}>
      <div
        style={{
          position: 'absolute',
          left: x - (h * TRACK) / 2,
          top: y - h / 2,
          width: h * TRACK,
          height: h,
          borderRadius: radius,
          background: mixColour(stage.line, stage.accent, state),
        }}
      />
      {hideKnob ? null : (
        <div
          style={{
            position: 'absolute',
            left: knobX,
            top: off.y,
            width: off.width,
            height: off.height,
            borderRadius: radius * (1 - 2 * INSET),
            background: mixColour(stage.page, stage.onAccent, state),
            boxShadow: shadowOf(stage.shade, vh),
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- slider

/** Past its end the thumb follows the hand by this share of the overshoot (the rubber band). */
const STRETCH = 0.3;
/** The hand lets go this long after it lands past the end, and the thumb springs back over this long. */
const LET_GO = 0.1;
const SPRING_BACK = 0.35;

/** Where the hand has taken the slider: 0 is the start, 1 the end, above 1 pulled past the end. */
export type SliderKey = { at: number; value: number };

/**
 * A slider from `x` (its left end, pixels) at height `y`, `length` per cent of frame height long. The hand drags
 * the thumb to each key's value, arriving at its `at` after a `scene` length of travel. A value above 1 pulls past
 * the end: the thumb follows by only 30% of the overshoot, and when the hand lets go it springs back to the end.
 * `size` scales the track, thumb and readout together (1 is a 4.4% thumb).
 * `pointer` draws the brand's pointer on the hand, so the stretch reads (the hand goes further than the thumb).
 * `readout` shows the value above the thumb as a percentage that always matches the thumb.
 */
export const SliderDrag: FC<{ x: number; y: number; length?: number; size?: number; keys: [SliderKey, ...SliderKey[]]; start?: number; at?: number; pointer?: boolean; readout?: boolean; style?: CSSProperties }> = ({
  x,
  y,
  length = 60,
  size = 1,
  keys,
  start = 0,
  at = 0,
  pointer = true,
  readout = true,
  style,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const { snap, scale } = useSnap();
  const w = vh(length);
  const thick = vh(1 * size);
  const thumb = vh(4.4 * size);
  const drag = m.seconds('scene');

  // The hand: from the last value to each key's value over a `scene`, landing on the key.
  let hand = start;
  keys.forEach((k, i) => {
    const from = i === 0 ? start : keys[i - 1].value;
    if (m.t >= k.at - drag) hand = from + (k.value - from) * progress(m.t, k.at - drag, k.at, easing.travel);
  });
  // The thumb follows the hand, stretched past the end; once the hand lets go of an overshoot it springs to the end.
  const banded = (v: number) => (v <= 1 ? Math.max(0, v) : 1 + (v - 1) * STRETCH);
  let value = banded(hand);
  let released = false;
  keys.forEach((k, i) => {
    const next = keys[i + 1];
    if (k.value <= 1 || m.t < k.at + LET_GO || (next && m.t >= next.at - drag)) return;
    released = true;
    value = banded(k.value) + (1 - banded(k.value)) * snap(k.at + LET_GO, SPRING_BACK * scale);
  });
  const appear = progress(m.t, at, at + m.seconds('quick'));
  if (m.t < at) return null;
  const thumbX = x + w * value;
  const tip: Point = { x: x + w * Math.max(0, hand) + thumb * 0.15, y: y + thumb * 0.1 };
  const lastOver = keys.filter((k) => k.value > 1).at(-1);
  const handFade = released && lastOver ? 1 - progress(m.t, lastOver.at + LET_GO, lastOver.at + LET_GO + m.seconds('quick')) : 1;
  const percent = Math.round(Math.min(1, value) * 100);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: appear, ...style }}>
      <div style={{ position: 'absolute', left: x, top: y - thick / 2, width: w, height: thick, borderRadius: thick / 2, background: stage.line }} />
      <div style={{ position: 'absolute', left: x, top: y - thick / 2, width: Math.max(0, thumbX - x), height: thick, borderRadius: thick / 2, background: stage.accent }} />
      <div
        style={{
          position: 'absolute',
          left: thumbX - thumb / 2,
          top: y - thumb / 2,
          width: thumb,
          height: thumb,
          borderRadius: Math.min(thumb / 2, vh(brand.shape.pill)),
          background: stage.page,
          boxShadow: `0 0 0 ${vh(0.25)}px ${stage.accent}, ${shadowOf(stage.shade, vh)}`,
        }}
      />
      {readout ? (
        <div style={{ position: 'absolute', left: thumbX, top: y - thumb * 1.55, translate: '-50% -50%', ...voiceStyle(brand.fonts.label, vh(3 * size)), color: stage.ink }}>
          <Figures text={`${percent}%`} />
        </div>
      ) : null}
      {pointer ? <Pointer tip={tip} size={5 * Math.max(1, size * 0.8)} opacity={handFade * progress(m.t, keys[0].at - drag - m.seconds('quick'), keys[0].at - drag)} /> : null}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- tab indicator

/** The edge in front runs on a quick spring, the edge behind on a slower one: the pill stretches, then catches up. */
const LEAD = 0.16;
const TRAIL = 0.32;

/** The indicator moves to tab `index` from `at`. */
export type TabKey = { at: number; index: number };

/**
 * A row of tabs centred on `x`, `y` (pixels), each `tabWidth` per cent of frame height wide. The indicator sits
 * under `keys[0]`'s tab from its `at` and moves at each later key: its leading edge on a quick spring, its trailing
 * edge on a slower one, so it stretches towards the new tab and then catches up. Each label turns to the colour
 * that reads on the indicator as the indicator covers it.
 */
export const TabIndicator: FC<{ tabs: string[]; keys: [TabKey, ...TabKey[]]; x: number; y: number; tabWidth?: number; height?: number; at?: number; style?: CSSProperties }> = ({
  tabs,
  keys,
  x,
  y,
  tabWidth = 22,
  height = 7,
  at = 0,
  style,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const { snapAt, scale } = useSnap();
  const [tw, th] = [vh(tabWidth), vh(height)];
  const pad = vh(0.7);
  const left0 = x - (tw * tabs.length) / 2;
  // Each edge is a sum of springs, one a move; which edge leads depends on the way the indicator is going.
  const edge = (side: 'left' | 'right') =>
    keys.reduce((v, k, i) => {
      if (i === 0) return v;
      const step = k.index - keys[i - 1].index;
      const leads = (step > 0 && side === 'right') || (step < 0 && side === 'left');
      return v + step * tw * snapAt(m.t, k.at, (leads ? LEAD : TRAIL) * scale);
    }, left0 + keys[0].index * tw + (side === 'right' ? tw : 0));
  const [l, r] = [edge('left'), edge('right')];
  const appear = progress(m.t, at, at + m.seconds('quick'));
  if (m.t < at) return null;
  const radius = Math.min(th / 2, vh(brand.shape.pill));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', opacity: appear, ...style }}>
      <div
        style={{
          position: 'absolute',
          left: left0 - pad,
          top: y - th / 2 - pad,
          width: tw * tabs.length + pad * 2,
          height: th + pad * 2,
          borderRadius: radius + pad,
          background: stage.soft,
          boxShadow: `0 0 0 1px ${stage.line}`,
        }}
      />
      <div style={{ position: 'absolute', left: l, top: y - th / 2, width: r - l, height: th, borderRadius: radius, background: stage.ink }} />
      {tabs.map((tab, i) => {
        const [a, b] = [left0 + i * tw, left0 + (i + 1) * tw];
        const covered = Math.max(0, Math.min(b, r) - Math.max(a, l)) / tw;
        return (
          <div
            key={tab}
            style={{
              position: 'absolute',
              left: a,
              top: y - th / 2,
              width: tw,
              height: th,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...voiceStyle(brand.fonts.label, th * 0.42),
              color: mixColour(stage.ink, stage.onInk, covered),
            }}
          >
            {tab}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
