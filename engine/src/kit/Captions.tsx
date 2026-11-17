// The fixed caption design (knowledge/craft/04-type-and-captions.md): a dark liquid-glass pill in the bottom
// safe area, with words arriving as they are spoken. Captions are their own layer: mount this over the film,
// outside the Stage, and pass enabled={false} to render the version without captions.
// The design is the same for every brand. A brand sets only the typeface (its headline voice), the weight, the
// text colour, the highlight colour and the two tints of the glass ("captions" in brand.json).
import { measureText } from '@remotion/layout-utils';
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { useBrand, useFontsLoaded } from './brand';
import { easing, EXIT_SHARE, lerp, progress, timing, useRealTime } from './motion';
import { isWide, sizedLayout } from './capture/relayout';
import { alpha } from './tokens';
import { useVh } from './ui';

/** The captions file: one entry per line, times in seconds from the start of the film. */
export const captionsSchema = z.object({
  lines: z.array(
    z.object({
      start: z.number(),
      end: z.number(),
      words: z
        .array(z.object({ text: z.string(), start: z.number(), end: z.number(), highlight: z.boolean().optional() }))
        .min(1),
      /** Where this line sits, when it differs from the film's (a line moved off a face). */
      position: z.enum(['bottom', 'top']).optional(),
    }),
  ),
});
export type CaptionsData = z.infer<typeof captionsSchema>;
type Line = CaptionsData['lines'][number];

const LEAD = 0.1; // a word may show up to 100 ms before it is spoken, never after
const MAX_GAP = 0.9; // a longer pause lets the pill go; it forms again with the next line
const HOLD = 0.4; // reading time after the last word, before the pill goes
const SPOKEN = 0.7; // opacity of words already spoken
// The design is the same in every film, so its timings are not scaled by the energy preset.
const QUICK = timing.quick / 1000;
const BASE = timing.base / 1000;

// Sizes, as percentages of frame height.
const TEXT = 4;
const HEIGHT = 8;
const SIDE_PADDING = 3.4;
const EDGE = 0.5; // the band at the rim where the glass bends the picture
const SAFE_MARGIN = 6;

const fill: CSSProperties = { position: 'absolute', inset: 0 };

/** First and last index of the highlighted phrase. A line carries one at most, so later ones are ignored. */
const highlightedPhrase = (words: Line['words']): [number, number] => {
  const first = words.findIndex((word) => word.highlight);
  let last = first;
  while (first >= 0 && words[last + 1]?.highlight) last++;
  return [first, last];
};

/** The glass of the caption bar, filling its parent. It has no text; `opacity` fades every layer together. */
const Glass: FC<{ opacity: number; round: number }> = ({ opacity, round }) => {
  const { captions } = useBrand();
  const vh = useVh();
  const opaque = captions.text; // any solid colour: a mask only uses its alpha
  return (
    <>
      {/* Shadow under the glass. */}
      <div style={{ ...fill, opacity, borderRadius: round, boxShadow: `0 ${vh(1.4)}px ${vh(3.6)}px ${alpha(captions.glassBottom, 0.35)}` }} />
      {/* The rim: the picture behind is less blurred and brighter here, as if bent by the edge of the glass. */}
      <div
        style={{
          ...fill,
          opacity,
          borderRadius: round,
          padding: vh(EDGE),
          // Dark enough to stay dark glass on a light page; a little of the picture still shows through.
          background: alpha(captions.glassTop, 0.78),
          backdropFilter: `blur(${vh(0.5)}px) brightness(1.1) saturate(170%)`,
          mask: `linear-gradient(${opaque}, ${opaque}) content-box exclude, linear-gradient(${opaque}, ${opaque})`,
        }}
      />
      {/* The body: dark glass over a blurred picture, with a soft highlight inside the top edge. */}
      <div
        style={{
          ...fill,
          inset: vh(EDGE),
          opacity,
          borderRadius: round,
          background: `linear-gradient(180deg, ${alpha(captions.glassTop, 0.84)}, ${alpha(captions.glassBottom, 0.92)})`,
          backdropFilter: `blur(${vh(2.4)}px) saturate(170%)`,
          boxShadow: [
            `inset 0 1px 0 ${alpha(captions.text, 0.3)}`,
            `inset 0 ${vh(0.9)}px ${vh(1.2)}px ${-vh(0.7)}px ${alpha(captions.text, 0.22)}`,
          ].join(', '),
        }}
      />
    </>
  );
};

/** The type of the caption bar: the brand's headline voice at the caption weight. */
const useCaptionType = (): CSSProperties => {
  const { captions, fonts } = useBrand();
  const vh = useVh();
  return { color: captions.text, fontFamily: fonts.headline.css, fontStyle: fonts.headline.style, fontWeight: captions.weight, fontSize: vh(TEXT) };
};

/**
 * A caption bar that stands still, as wide as its words: for brand sheets and moodboards, not for films.
 * Mark the highlighted phrase with <CaptionHighlight>.
 */
export const CaptionBar: FC<{ children: ReactNode; style?: CSSProperties }> = ({ children, style }) => {
  const vh = useVh();
  const type = useCaptionType();
  const height = vh(HEIGHT);
  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', height, padding: `0 ${vh(SIDE_PADDING)}px`, whiteSpace: 'pre', ...type, ...style }}>
      <Glass opacity={1} round={height / 2} />
      <span style={{ position: 'relative' }}>{children}</span>
    </div>
  );
};

/** The one highlighted phrase of a caption line, in the brand's highlight colour. */
export const CaptionHighlight: FC<{ children: ReactNode }> = ({ children }) => <span style={{ color: useBrand().captions.highlight }}>{children}</span>;

/** One line of words at time `t`: not yet spoken (hidden), being spoken (full strength), spoken (dimmed). */
const LineText: FC<{ line: Line; t: number; opacity: number }> = ({ line, t, opacity }) => {
  const { captions } = useBrand();
  const [first, last] = highlightedPhrase(line.words);
  return (
    <div style={{ ...fill, display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'pre', opacity }}>
      {line.words.map((word, i) => {
        const arrived = progress(t, word.start - LEAD, word.start + LEAD / 2);
        const nextStart = line.words[i + 1]?.start;
        const spoken = nextStart === undefined ? 0 : progress(t, nextStart, nextStart + QUICK, easing.travel);
        const highlighted = i >= first && i <= last;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              // The highlighted phrase keeps full strength after it is spoken; other words dim.
              opacity: arrived * (highlighted ? 1 : lerp(1, SPOKEN, spoken)),
              translate: `0 ${(1 - arrived) * 0.18}em`,
              color: highlighted ? captions.highlight : undefined,
            }}
          >
            {i > 0 ? ' ' : null}
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

const CaptionPill: FC<{ lines: Line[]; position: 'bottom' | 'top' }> = ({ lines, position }) => {
  const t = useRealTime();
  const vh = useVh();
  const frame = useVideoConfig();
  const { captions, fonts } = useBrand();
  const type = useCaptionType();
  const fontsLoaded = useFontsLoaded();

  const index = lines.findLastIndex((line) => t >= line.start - LEAD);
  if (!fontsLoaded || index < 0) return null;
  const line = lines[index];
  const next = lines.at(index + 1);
  // After a short pause the pill stays and changes width; after a long one it has gone and forms again.
  const where = line.position ?? position;
  // The pill stays between lines only when they sit in the same place; a line in the other slot forms its own pill.
  const samePlace = (other: Line | undefined) => other !== undefined && (other.position ?? position) === where;
  const previous = index > 0 && line.start - lines[index - 1].end <= MAX_GAP && samePlace(lines[index - 1]) ? lines[index - 1] : undefined;
  const staysForNext = next !== undefined && next.start - line.end <= MAX_GAP && samePlace(next);

  const enterAt = line.start - LEAD;
  const exitAt = line.end + HOLD;
  const enter = previous ? 1 : progress(t, enterAt, enterAt + QUICK);
  const settle = previous ? 1 : progress(t, enterAt, enterAt + BASE);
  const exit = staysForNext ? 0 : progress(t, exitAt, exitAt + QUICK * EXIT_SHARE, easing.leave);
  if (exit >= 1) return null;
  const opacity = enter * (1 - exit);
  const previousLeft = progress(t, enterAt, enterAt + QUICK * EXIT_SHARE, easing.leave); // the old line's text fades as the new one starts

  const fontSize = vh(TEXT);
  const widthOf = ({ words }: Line) => {
    const text = words.map((word) => word.text).join(' ');
    const measured = measureText({ text, fontFamily: fonts.headline.css, fontSize, fontWeight: captions.weight });
    return measured.width + vh(SIDE_PADDING) * 2;
  };
  const width = previous ? lerp(widthOf(previous), widthOf(line), progress(t, enterAt, enterAt + BASE)) : widthOf(line);
  const height = vh(HEIGHT);
  const round = height / 2;
  // A 9:16, 1:1 or 4:5 frame: the pill sits at the bottom (or top) of the band the platforms leave free (relayout.ts).
  const slot = isWide(frame.width, frame.height) ? null : sizedLayout(frame.width, frame.height).band;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* The pill itself has no opacity or filter, so the glass layers inside it can still see the film behind. */}
      <div
        style={{
          position: 'absolute',
          left: slot ? slot.x + (slot.width - width) / 2 : (frame.width - width) / 2,
          top: slot ? (where === 'top' ? slot.y : slot.y + slot.height - height) : where === 'top' ? vh(SAFE_MARGIN) : frame.height - vh(SAFE_MARGIN) - height,
          width,
          height,
          scale: `${lerp(0.94, 1, settle)}`,
          translate: `0 ${(1 - settle) * vh(1) + exit * vh(0.6)}px`,
        }}
      >
        <Glass opacity={opacity} round={round} />
        <div style={{ ...fill, overflow: 'hidden', borderRadius: round, opacity, ...type }}>
          {previous && previousLeft < 1 ? <LineText line={previous} t={t} opacity={1 - previousLeft} /> : null}
          <LineText line={line} t={t} opacity={1} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** Live captions from a captions file. `position="top"` is for shots whose focal point is low. */
export const Captions: FC<{ data: CaptionsData; enabled?: boolean; position?: 'bottom' | 'top' }> = ({
  data,
  enabled = true,
  position = 'bottom',
}) => (enabled ? <CaptionPill lines={data.lines} position={position} /> : null);
