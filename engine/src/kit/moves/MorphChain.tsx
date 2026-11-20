// Morph chain: one interface component through many states with no cut, the way the most-liked product film in the
// motion study moves one pill through 13 states in 14 s. Size, corner radius, place and colour each follow a spring
// to every new target; the springs are summed, so a new target never makes the box jump. The content swaps as
// measured there (knowledge/craft/17-motion-graphics.md): the old content blurs out in about 0.12 s, the box
// resizes in about 0.15 s, and the new content is sharp by about 0.3 s.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { easing, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import { MotionBlur, useTravel } from './core';
import { mixColour, onFill, summed, useSnap, type FillRole } from './shape';

/** Measured in seconds at the confident preset; calm runs a quarter longer, hype a little shorter. */
const BLUR_OUT = 0.12;
const RESIZE = 0.15;
const SHARP = 0.3;
/** How soft the content is at the start and end of a swap, as a percentage of frame height. */
const SOFT = 1.2;
/** How far a clicked component dips before it changes: about 3%, so the click reads without a bounce. */
const DIP = 0.03;

/**
 * One state of the component. `at` is when the change starts (on the scene clock). Sizes are percentages of frame
 * height; `radius` is in the same units or "pill" for fully round ends. `x` and `y` place its middle in pixels of
 * the frame (the middle of the frame by default). `content` is laid out at the state's own size; text in it takes
 * the colour that reads on `fill`. `click` dips the component a tick before `at`, for a cursor that causes the change.
 */
export type ChainState = {
  at: number;
  width: number;
  height: number;
  radius?: number | 'pill';
  fill?: FillRole;
  content?: ReactNode;
  x?: number;
  y?: number;
  click?: boolean;
};

/**
 * One box through `states`, about one state a second (1 to 1.5 s a state reads best). With `loop` (seconds) the box
 * goes back to the first state then, so the last frame matches the first and the film can loop. Let a cursor cause
 * each change (CursorLead or the kit Cursor clicking on each `at`, with `click` set), and push the camera in so each
 * state fills the frame: the same chain fails when the component sits small in a still frame.
 */
export const MorphChain: FC<{ states: [ChainState, ...ChainState[]]; loop?: number; out?: number; style?: CSSProperties }> = ({
  states: given,
  loop,
  out,
  style,
}) => {
  const m = useMotion();
  const stage = useStage();
  const vh = useVh();
  const travel = useTravel();
  const { snap, snapAt, scale } = useSnap();
  const { width: frameW, height: frameH } = useVideoConfig();
  const states = loop === undefined ? given : [...given, { ...given[0], at: loop }];
  const resize = RESIZE * scale;

  const px = (s: ChainState) => {
    const [w, h] = [vh(s.width), vh(s.height)];
    const r = s.radius === 'pill' || s.radius === undefined ? Math.min(w, h) / 2 : vh(s.radius);
    return { w, h, r, x: s.x ?? frameW / 2, y: s.y ?? frameH / 2 };
  };
  const track = (pick: (p: ReturnType<typeof px>) => number) => (t: number) =>
    summed(snapAt, t, states.map((s) => ({ at: s.at, value: pick(px(s)) })), resize);
  const [wAt, hAt, rAt, xAt, yAt] = [track((p) => p.w), track((p) => p.h), track((p) => p.r), track((p) => p.x), track((p) => p.y)];
  const [w, h, x, y] = [wAt(m.t), hAt(m.t), xAt(m.t), yAt(m.t)];
  const r = Math.max(0, Math.min(rAt(m.t), w / 2, h / 2));

  // Colours change on the same spring as the size, each from wherever the last change had got to.
  let fill = stage[states[0].fill ?? 'ink'];
  let ink = onFill(stage, states[0].fill ?? 'ink');
  states.forEach((s, i) => {
    const u = i === 0 ? 0 : Math.min(1, snap(s.at, resize));
    if (u <= 0) return;
    const now = s.fill ?? 'ink';
    fill = mixColour(fill, stage[now], u);
    ink = mixColour(ink, onFill(stage, now), u);
  });

  // A click dips the box a tick before its change and lets it back as the change starts.
  const tick = m.seconds('tick');
  const down = states.reduce((most, s) => (s.click ? Math.max(most, progress(m.t, s.at - tick, s.at, easing.travel) * (1 - progress(m.t, s.at, s.at + tick, easing.travel))) : most), 0);

  const enter = snap(states[0].at, m.seconds('quick'));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick'), easing.leave);
  if (m.t < states[0].at || exit >= 1) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none', ...style }}>
      <MotionBlur fill x={travel(wAt) / 2 + travel(xAt)} y={travel(hAt) / 2 + travel(yAt)}>
        <div
          style={{
            position: 'absolute',
            left: x - w / 2,
            top: y - h / 2,
            width: w,
            height: h,
            borderRadius: r,
            overflow: 'hidden',
            background: fill,
            color: ink,
            boxShadow: `0 ${vh(1)}px ${vh(3)}px ${alpha(stage.shade, 0.22)}`,
            scale: `${enter * (1 - down * DIP) * (1 - exit * 0.3)}`,
            opacity: 1 - exit,
          }}
        >
          {states.map((s, i) => {
            const next = states[i + 1];
            const inU = i === 0 && s.at === states[0].at ? progress(m.t, s.at, s.at + SHARP * scale) : progress(m.t, s.at + BLUR_OUT * scale, s.at + SHARP * scale);
            const outU = next ? progress(m.t, next.at, next.at + BLUR_OUT * scale, easing.leave) : 0;
            const shown = inU * (1 - outU);
            if (shown <= 0.001 || !s.content) return null;
            const soft = vh(SOFT) * Math.max(1 - inU, outU);
            const p = px(s);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: (w - p.w) / 2,
                  top: (h - p.h) / 2,
                  width: p.w,
                  height: p.h,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: shown,
                  filter: soft > 0.2 ? `blur(${soft}px)` : undefined,
                }}
              >
                {s.content}
              </div>
            );
          })}
        </div>
      </MotionBlur>
    </AbsoluteFill>
  );
};
