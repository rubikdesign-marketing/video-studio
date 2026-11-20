// Carrier: one object carried through every scene of a film, becoming the next element each time (a square, then a
// toggle's knob, then the highlighted bar of a chart, and last the full stop of the closing line). The study of
// liked motion films names this the strongest pattern they share (knowledge/craft/17-motion-graphics.md): joins are
// morphs of 0.1 to 0.17 s with reading holds of about 0.4 s between them. It is a layer above the scenes, on the
// film clock, so it never restarts at a cut.
import { useMemo, type CSSProperties, type FC } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useBrand, useFontsLoaded } from '../brand';
import { arc, easing, EXIT_SHARE, progress, useMotion, type Point } from '../motion';
import type { Voice } from '../tokens';
import { useStage } from '../ui';
import { MotionBlur, useTravel, type Rect } from './core';
import { alignTo, blend, middleOf, mixFill, outline, pathOf, shift, useSnap, type FillRole, type Shape } from './shape';

/** The measured join: 0.1 to 0.17 s. */
const JOIN = 0.15;
/** How far the carrier's path bows between two places, as a share of the distance. */
const BEND = 0.12;

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;
/** A shape without its box: the box comes from the key's anchor or rect. */
export type CarriedShape = DistributiveOmit<Shape, 'rect'>;

/**
 * Where the carrier is at `at` seconds on the film clock: in a named anchor of a scene or in a rect (pixels), as
 * a shape, in a stage colour. `join` overrides the length of the morph that brings it here.
 */
export type CarrierKey = { at: number; anchor?: string; rect?: Rect; shape: CarriedShape; fill?: FillRole; join?: number };

/**
 * The carrier. Put it in the film after (above) the scenes, outside every <Sequence>, so it runs on the film clock.
 * Each key is where it has landed by `at`: it leaves the place before a `join` earlier (0.15 s by default), travels
 * on an arc and reshapes on the way, blurring only while it is fast. The first key is where it arrives, from its
 * middle. Scenes give their places as `anchors` (pixels of the frame), named for what the carrier becomes there;
 * the scene leaves that thing out and the carrier stands in for it. Use a square or the brand's mark, never a dot:
 * the house rules keep dots out (a full stop that ends a sentence is punctuation and is allowed).
 */
export const Carrier: FC<{
  keys: [CarrierKey, ...CarrierKey[]];
  anchors?: Record<string, Rect>;
  fill?: FillRole;
  out?: number;
  style?: CSSProperties;
}> = ({ keys, anchors = {}, fill = 'accent', out, style }) => {
  const m = useMotion();
  const stage = useStage();
  const travel = useTravel();
  const { snap, scale } = useSnap();
  const { width, height } = useVideoConfig();

  const placed = keys.map((key) => {
    const rect = key.rect ?? (key.anchor ? anchors[key.anchor] : undefined);
    if (!rect) throw new Error(`Carrier: the key at ${key.at} s names no rect and no known anchor ("${key.anchor ?? ''}").`);
    return { ...key, points: outline({ ...key.shape, rect } as Shape), fill: key.fill ?? fill };
  });

  const at = (t: number) => {
    let i = 0;
    while (i + 1 < placed.length && t >= placed[i + 1].at - (placed[i + 1].join ?? JOIN) * scale) i++;
    const here = placed[i];
    if (i === 0) return { points: here.points, from: 0, to: 0, u: 1 };
    const before = placed[i - 1];
    const join = (here.join ?? JOIN) * scale;
    const u = progress(t, here.at - join, here.at, easing.travel);
    const [a, b] = [middleOf(before.points), middleOf(here.points)];
    const fromLocal = shift(before.points, { x: -a.x, y: -a.y });
    const toLocal = alignTo(shift(here.points, { x: -b.x, y: -b.y }), fromLocal);
    const c: Point = arc(a, b, u, BEND);
    return { points: shift(blend(fromLocal, toLocal, u), c), from: i - 1, to: i, u };
  };

  const now = at(m.t);
  const enter = snap(placed[0].at, m.seconds('quick'));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  if (m.t < placed[0].at || exit >= 1) return null;
  const c = middleOf(now.points);
  const colour = mixFill(stage, placed[now.from].fill, placed[now.to].fill, now.u);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', ...style }}>
      <MotionBlur fill x={travel((t) => middleOf(at(t).points).x)} y={travel((t) => middleOf(at(t).points).y)}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <path d={pathOf(now.points)} fill={colour} style={{ transformOrigin: `${c.x}px ${c.y}px`, scale: `${enter}`, opacity: 1 - exit }} />
        </svg>
      </MotionBlur>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- anchors measured from text

const fontOf = (voice: Voice, size: number) => `${voice.style} ${voice.weight} ${size}px ${voice.css}`;

/**
 * The box of the ink of the full stop that ends `text`, set on one line in one of the brand's voices at `size`
 * pixels with the top of its line box at `top`, and `x` its left edge (or its middle, with `align` "center").
 * Measured on a canvas in the brand's own font once its fonts are in, so the carrier lands exactly where the
 * closing line's full stop is drawn. Set the line at `left` with the same voice and size and leave its full stop
 * transparent. Null until the fonts are in.
 */
export const useFullStop = (
  text: string,
  voiceName: 'headline' | 'label' | 'product',
  size: number,
  x: number,
  top: number,
  align: 'left' | 'center' = 'left',
): { stop: Rect; left: number } | null => {
  const brand = useBrand();
  const loaded = useFontsLoaded();
  const voice = brand.fonts[voiceName];
  return useMemo(() => {
    if (!loaded || typeof document === 'undefined') return null;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    ctx.font = fontOf(voice, size);
    ctx.letterSpacing = `${(voice.tracking ?? 0) * size}px`;
    const stop = text.lastIndexOf('.');
    if (stop < 0) throw new Error(`useFullStop: "${text}" has no full stop.`);
    const left = align === 'center' ? x - ctx.measureText(text).width / 2 : x;
    const pen = ctx.measureText(text.slice(0, stop)).width;
    const dot = ctx.measureText('.');
    // CSS sets the baseline half the leftover line height below the top of the font's own box.
    const lineHeight = (voice.lineHeight ?? 1.2) * size;
    const fontHeight = dot.fontBoundingBoxAscent + dot.fontBoundingBoxDescent;
    const baseline = top + (lineHeight - fontHeight) / 2 + dot.fontBoundingBoxAscent;
    const [x0, x1] = [left + pen - dot.actualBoundingBoxLeft, left + pen + dot.actualBoundingBoxRight];
    const [y0, y1] = [baseline - dot.actualBoundingBoxAscent, baseline + dot.actualBoundingBoxDescent];
    return { stop: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, left };
  }, [loaded, voice, size, text, x, top, align]);
};
