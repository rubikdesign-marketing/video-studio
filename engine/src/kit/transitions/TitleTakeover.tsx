// Title takeover: one big word lands over the scene, then grows to fill the frame, and its letters become windows
// onto the next scene, opening until the next scene is all there is. For naming the next section as you enter it.
import { measureText } from '@remotion/layout-utils';
import { useId, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, lerp, progress, useMotion } from '../motion';
import { useFitSize } from '../type/split';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { usePagePaint } from './sheet';

/** The word lands this much smaller than its size and settles to it. */
const LANDS_FROM = 0.82;
/** The outgoing scene shrinks back this much and fades to this while the word is over it. */
const BEHIND = { scale: 0.94, opacity: 0.55 } as const;
/** Once the letters open, the frame outside them is shaded this much, so the windows read on a page of one colour. */
const DIM = 0.35;
/** The next scene, seen through the letters, settles from this much larger. */
const THROUGH = 0.12;
/** The letters fatten as they grow, so their gaps and counters close: stroke width at the end, in font sizes. */
const FATTEN = 0.45;

/**
 * The children are the outgoing scene; `next` is the incoming, with its clock starting at 0 when the letters
 * open. `word` is the title (one short word reads best; stars are ignored), `size` its size in percent of frame
 * height (shrunk to fit 86% of the width), in the brand's headline voice and ink.
 *
 * From `at` the word lands over a `base` length while the scene behind shrinks back and dims. From `at` plus a
 * `base` and a `tick` the letters turn into windows: the next scene shows through them, they grow around the
 * middle of one letter (`focus`, counted from 0, default the middle one) and fatten until they fill the frame,
 * over a `scene` and a `base` length (about 1.15 s); the frame outside the letters is shaded as they open, and the scene behind is pushed forward and goes as
 * they pass.
 * There is no swap frame: the next scene is in the letters from the frame they open on, and it moves (settling
 * from larger) all the way. Zoom is even in ratio and not blurred (a radial zoom has no direction to smear along).
 */
export const TitleTakeover: FC<{ children: ReactNode; next: ReactNode; at: number; word: string; size?: number; focus?: number }> = ({
  children,
  next,
  at,
  word,
  size = 24,
  focus,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const paint = usePagePaint();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const id = `title${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const text = word.replace(/\*/g, '');
  const fontSize = useFitSize([text], size, 0.86);
  const voice = brand.fonts.headline;
  const opens = at + m.seconds('base') + m.seconds('tick');
  const opensOn = Math.round(opens * fps);
  const length = m.seconds('scene') + m.seconds('base');
  const endsOn = Math.round((opens + length) * fps);
  const startsOn = Math.round(at * fps);
  const settle = progress(m.t, opens, opens + length + m.seconds('base'), easing.arrive);
  const incoming = (
    <Sequence from={opensOn} layout="none">
      <AbsoluteFill style={{ scale: `${1 + THROUGH * (1 - settle)}` }}>{next}</AbsoluteFill>
    </Sequence>
  );
  if (frame < startsOn) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (frame >= endsOn) return <AbsoluteFill>{incoming}</AbsoluteFill>;

  const widthOf = (s: string) =>
    measureText({ text: s, fontFamily: voice.css, fontSize, fontWeight: String(voice.weight), letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em` })
      .width;
  const letters = [...text];
  const which = Math.min(letters.length - 1, Math.max(0, focus ?? Math.floor((letters.length - 1) / 2)));
  const letter = widthOf(letters[which]);
  const baseline = height / 2 + fontSize * 0.35;
  const fx = width / 2 - widthOf(text) / 2 + widthOf(letters.slice(0, which).join('')) + letter / 2;
  const fy = baseline - fontSize * 0.35;
  // The scale at which the focus letter alone is bigger than the frame.
  const final = Math.max(width / Math.max(letter, 1), height / (fontSize * 0.72)) * 1.6;
  const grown = progress(m.t, opens, opens + length, easing.travel);
  const landed = m.settle(at, 'base');
  const scale = lerp(LANDS_FROM, 1, landed) * Math.exp(Math.log(final) * grown);
  // The point that grows in place drifts to the middle of the frame as the word grows.
  const cx = lerp(fx, width / 2, grown);
  const cy = lerp(fy, height / 2, grown);
  const placed = `translate(${cx} ${cy}) scale(${scale}) translate(${-fx} ${-fy})`;
  const stroke = FATTEN * fontSize * grown;
  const isOpen = frame >= opensOn;
  // The word fades up as it lands (no one-frame pop) and fades again to show the windows.
  const ink = progress(m.t, at, at + m.seconds('quick')) * (1 - progress(m.t, opens, opens + m.seconds('quick')));
  const behind = progress(m.t, at, at + m.seconds('base'));
  const passed = progress(m.t, opens, opens + length, easing.leave);
  const dimmed = progress(m.t, opens, opens + m.seconds('base')) * (1 - passed);
  const glyphs = (fill: string, strokeWidth: number) => (
    <text
      x={width / 2}
      y={baseline}
      textAnchor="middle"
      fill={fill}
      stroke={strokeWidth > 0 ? fill : undefined}
      strokeWidth={strokeWidth > 0 ? strokeWidth : undefined}
      strokeLinejoin="round"
      fontFamily={voice.css}
      fontStyle={voice.style}
      fontWeight={voice.weight}
      fontSize={fontSize}
      letterSpacing={voice.tracking === undefined ? undefined : `${voice.tracking}em`}
      style={{ whiteSpace: 'pre' }}
    >
      {text}
    </text>
  );
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          scale: `${lerp(1, BEHIND.scale, behind) * (1 + 0.25 * passed)}`,
          opacity: lerp(1, BEHIND.opacity, behind) * (1 - passed),
        }}
      >
        {children}
      </AbsoluteFill>
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
            <g transform={placed}>{glyphs('white', stroke)}</g>
          </mask>
        </defs>
      </svg>
      {isOpen ? <AbsoluteFill style={{ background: alpha(stage.shade, DIM * dimmed) }} /> : null}
      {isOpen ? (
        <AbsoluteFill style={{ maskImage: `url(#${id})`, WebkitMaskImage: `url(#${id})`, maskMode: 'luminance', ...paint }}>{incoming}</AbsoluteFill>
      ) : null}
      {ink > 0 ? (
        // The word in ink lies over the windows as they open, and fades to show the scene in them.
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0 }}>
          <g transform={placed} opacity={ink}>
            {glyphs(stage.ink, 0)}
          </g>
        </svg>
      ) : null}
    </AbsoluteFill>
  );
};
