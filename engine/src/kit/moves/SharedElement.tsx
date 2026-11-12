// Shared element: one element moves from its place in one layout to its place in the next, changing size and
// corner radius on the way. Its text changes over only at the midpoint, and is never stretched.
import type { CSSProperties, FC, ReactNode } from 'react';
import { useBrand } from '../brand';
import { arc, clamp01, easing, lerp, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import { centreOf, MotionBlur, useTravel, type Rect } from './core';

/** The text changes over within this share of the move, either side of its midpoint. */
const CHANGEOVER = 0.1;
/** The shadow at rest and in flight: drop and blur as percentages of frame height, then strength. In flight the element is off the surface. */
const SHADOW = { rest: { drop: 1, blur: 3, strength: 0.25 }, flight: { drop: 2.6, blur: 5.5, strength: 0.22 } } as const;
/** How far the path bows, as a share of the distance: flying things travel on curves. */
const BEND = 0.1;

/**
 * A surface that is at `from` until `at` and then travels to `to` (both are pixels in the frame). The move takes
 * a `base` and a `tick` (450 to 650 ms). Its place sets off first, on a shallow arc; its size and corner radius
 * follow a stagger behind and land last. `radius` is the corner radius before and after, as percentages of frame
 * height (the brand's control and window radii if left out).
 *
 * `before` is what it holds in the first layout and `after` what it holds in the second. Each is laid out once,
 * at the size of its own layout, and held in the middle of the surface: the surface crops it, it is never scaled.
 * `before` goes and `after` comes within a tenth of the move either side of the midpoint, when the element is at
 * its fastest and is not being read.
 *
 * Do not draw the element in either layout yourself; this is it, in both. Move the rest of each layout with the
 * layout's own cues.
 */
export const SharedElement: FC<{
  from: Rect;
  to: Rect;
  at: number;
  before?: ReactNode;
  after?: ReactNode;
  radius?: [number, number];
  style?: CSSProperties;
}> = ({ from, to, at, before, after, radius, style }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const travel = useTravel();
  const length = m.seconds('base') + m.seconds('tick');
  const centreAt = (t: number) => arc(centreOf(from), centreOf(to), progress(t, at, at + length, easing.travel), BEND);
  const sized = progress(m.t, at + m.stagger, at + m.stagger + length, easing.travel);
  const centre = centreAt(m.t);
  const [width, height] = [lerp(from.width, to.width, sized), lerp(from.height, to.height, sized)];
  const [roundBefore, roundAfter] = radius ?? [brand.shape.control, brand.shape.window];
  // In flight the element is off the surface: its shadow drops and spreads at the middle of the move and comes back.
  const flight = Math.sin(Math.PI * progress(m.t, at, at + length + m.stagger, easing.travel));
  const { rest, flight: up } = SHADOW;
  const shadow = `0 ${vh(lerp(rest.drop, up.drop, flight))}px ${vh(lerp(rest.blur, up.blur, flight))}px ${alpha(stage.shade, lerp(rest.strength, up.strength, flight))}`;
  const held = (content: ReactNode, size: Rect, shown: number) =>
    shown <= 0 ? null : (
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size.width,
          height: size.height,
          translate: '-50% -50%',
          opacity: shown,
        }}
      >
        {content}
      </div>
    );
  return (
    <MotionBlur fill x={travel((t) => centreAt(t).x)} y={travel((t) => centreAt(t).y)}>
      <div
        style={{
          position: 'absolute',
          left: centre.x - width / 2,
          top: centre.y - height / 2,
          width,
          height,
          overflow: 'hidden',
          borderRadius: vh(lerp(roundBefore, roundAfter, sized)),
          background: stage.soft,
          boxShadow: `0 0 0 1px ${stage.line}, ${shadow}`,
          ...style,
        }}
      >
        {held(before, from, 1 - clamp01((sized - (0.5 - CHANGEOVER)) / CHANGEOVER))}
        {held(after, to, clamp01((sized - 0.5) / CHANGEOVER))}
      </div>
    </MotionBlur>
  );
};
