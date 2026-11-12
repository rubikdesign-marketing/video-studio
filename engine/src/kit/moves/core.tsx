// What the moves share. A move is a small component driven by cues in seconds on the scene clock (`at`, `out`),
// like everything in ui.tsx: its lengths come from the motion tokens and the energy preset, its colours and
// type from the brand in use. Nothing here names a colour, a typeface or a length of its own.
import { useId, type CSSProperties, type FC, type ReactNode } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { clamp01, easing, EXIT_SHARE, progress, timing, useMotion, type Point, type Preset, type TimingToken } from '../motion';
import { contrast, type Brand, type StagePalette, type Voice } from '../tokens';

/** A place and a size in the frame, in pixels. */
export type Rect = { x: number; y: number; width: number; height: number };

/** A side of the frame, for moves that travel one way. */
export type Side = 'up' | 'down' | 'left' | 'right';

/** One step towards each side, as shares of the frame's width and height. */
export const towards: Record<Side, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export const centreOf = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

export const em = (value: number | undefined) => (value === undefined ? undefined : `${value}em`);

/** One of the brand's type voices at a size in pixels, ready for `style`. */
export const voiceStyle = (voice: Voice, size: number): CSSProperties => ({
  fontFamily: voice.css,
  fontStyle: voice.style,
  fontWeight: voice.weight,
  fontSize: size,
  lineHeight: voice.lineHeight,
  letterSpacing: em(voice.tracking),
});

/** Words of a line arrive 40 to 50 ms apart whatever the preset: 0.4 to 0.5 of a tick. Seconds. */
export const wordGap = (preset: Preset) => Math.min(timing.tick * 0.5, Math.max(timing.tick * 0.4, preset.staggerMs)) / 1000;

/**
 * The three parts of one cue. `enter` lands softly and `exit` speeds up over a shorter time: use them for
 * opacity, blur and colour. `settle` carries the preset's overshoot: position and scale only.
 */
export const useCue = (at: number, out?: number, token: TimingToken = 'base') => {
  const m = useMotion();
  const length = m.seconds(token);
  return {
    enter: progress(m.t, at, at + length),
    settle: m.settle(at, token),
    exit: out === undefined ? 0 : progress(m.t, out, out + length * EXIT_SHARE, easing.leave),
  };
};

/**
 * How far a count and its shape have grown, 0 to 1. A number, a bar, a ring and a line that share `at` and
 * `over` share this value, so they finish on the same frame. It starts from rest and slows into the final value.
 */
export const useGrowth = (at: number, over: TimingToken = 'scene') => {
  const m = useMotion();
  const end = at + m.seconds(over);
  return { grown: progress(m.t, at, end, easing.travel), done: m.t >= end, end };
};

/**
 * The value a count shows when it has `grown` this far, to the nearest step. The last step lands as the shape
 * comes to rest (within half a step of its end), not several frames after the shape has stopped moving.
 */
export const countAt = (from: number, value: number, grown: number, done: boolean, decimals = 0) => {
  if (done) return value;
  const step = 10 ** decimals;
  return from + Math.round((value - from) * clamp01(grown) * step) / step;
};

// ---------------------------------------------------------------- speed and motion blur

/** The shutter is open for half of each frame: a moving thing smears over half the distance it covers in a frame. */
const SHUTTER = 0.5;
/** An even smear that long is a Gaussian blur of this share of its length. */
const SMEAR = 1 / Math.sqrt(12);
/** Slower than this share of the frame width per frame, nothing blurs, so anything slow enough to read stays sharp. */
const SHARP_BELOW = 0.004;
/** A blur smaller than this many pixels is not worth a filter. */
const LEAST_BLUR = 0.3;

/**
 * How far a moving thing travels during the frame being drawn. Give the returned function the thing's place as a
 * function of scene time (seconds) and it gives the distance covered in one frame, centred on now. Moves use it
 * to match their blur to their speed.
 */
export const useTravel = () => {
  const m = useMotion();
  const { fps } = useVideoConfig();
  const half = 0.5 / fps;
  return (place: (t: number) => number) => place(m.t + half) - place(m.t - half);
};

/** The blur, in pixels, of something moving `perFrame` pixels in a frame of this width. Nothing below the reading speed. */
export const smear = (perFrame: number, frameWidth: number) => {
  const blur = Math.max(0, Math.abs(perFrame) - frameWidth * SHARP_BELOW) * SHUTTER * SMEAR;
  return blur < LEAST_BLUR ? 0 : blur;
};

const layer: CSSProperties = { position: 'absolute', inset: 0 };

/**
 * Shutter blur for whatever is inside, along the way it is moving. `x` and `y` are how far it travels this frame,
 * in pixels (from useTravel). The blur grows with the speed and is nothing at reading speed, so text at rest or
 * settling is never softened. With `fill` the blur is a layer the size of its parent; without it, an inline box.
 */
export const MotionBlur: FC<{ children: ReactNode; x?: number; y?: number; fill?: boolean; style?: CSSProperties }> = ({
  children,
  x = 0,
  y = 0,
  fill = false,
  style,
}) => {
  const { width } = useVideoConfig();
  const id = `blur${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const blur = smear(Math.hypot(x, y), width);
  // A move straight across or straight up and down blurs along its axis. Any other way, the layer is turned so
  // the blur runs along the move, and what is inside is turned back.
  const slanted = blur > 0 && Math.abs(x) > LEAST_BLUR && Math.abs(y) > LEAST_BLUR;
  const turn = slanted ? Math.atan2(y, x) : 0;
  const along = slanted || Math.abs(x) >= Math.abs(y) ? `${blur} 0` : `0 ${blur}`;
  const box: CSSProperties = fill ? layer : { display: 'inline-block' };
  return (
    <div style={{ ...box, rotate: slanted ? `${turn}rad` : undefined, ...style }}>
      <div style={{ ...box, filter: blur > 0 ? `url(#${id})` : undefined }}>
        <div style={{ ...box, rotate: slanted ? `${-turn}rad` : undefined }}>{children}</div>
      </div>
      {blur > 0 ? (
        <svg width={0} height={0} style={{ position: 'absolute' }}>
          {/* The filter reaches well past the box, so a smear is never cut off at its edge. */}
          <filter id={id} x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={along} />
          </filter>
        </svg>
      ) : null}
    </div>
  );
};

/** True on a page darker than its ink: there a shadow hardly shows, and height is read from light instead. */
export const isDarkPage = (stage: StagePalette) => contrast(stage.page, stage.shade) < contrast(stage.ink, stage.shade);

/** The lighter of the brand's two inks: the one written on its dark page. Light for sweeps and lit edges. */
export const lightOf = (brand: Brand) => brand.stages.dark.ink;

const xy = (p: Point) => `${p.x} ${p.y}`;

/** The path through the points: straight segments, or one smooth curve that passes through every point. */
export const pathThrough = (points: Point[], curve: boolean) =>
  points
    .map((point, i) => {
      if (i === 0) return `M ${xy(point)}`;
      if (!curve) return `L ${xy(point)}`;
      // A Catmull-Rom segment written as a cubic: each control point leans along the line between its neighbours.
      const [before, from, after] = [points[Math.max(0, i - 2)], points[i - 1], points[Math.min(points.length - 1, i + 1)]];
      const lean = (a: Point, b: Point, towards: Point, sign: number) => ({ x: towards.x + (sign * (b.x - a.x)) / 6, y: towards.y + (sign * (b.y - a.y)) / 6 });
      return `C ${xy(lean(before, point, from, 1))} ${xy(lean(from, after, point, -1))} ${xy(point)}`;
    })
    .join(' ');

/** A number as people write it: grouped thousands and a fixed count of decimals. */
export const written = (value: number, decimals = 0) =>
  value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const DIGIT = /\d/;
export const isDigit = (char: string) => DIGIT.test(char);

/** One figure wide, whatever the digit inside: a changing number never changes width. */
export const figureBox: CSSProperties = { display: 'inline-block', width: '1ch', textAlign: 'center', letterSpacing: 'normal' };

/** Text whose digits each sit in a box one figure wide. */
export const Figures: FC<{ text: string }> = ({ text }) => (
  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'pre' }}>
    {[...text].map((char, i) =>
      isDigit(char) ? (
        <span key={i} style={figureBox}>
          {char}
        </span>
      ) : (
        <span key={i}>{char}</span>
      ),
    )}
  </span>
);

/** "*word*." is the word in the brand's accent voice, with any punctuation after it left as it was. */
const STARRED = /^\*(.+?)\*(.*)$/;

/** One word of film type. A starred word is set in the accent voice, as in a kit Headline. */
export const Word: FC<{ text: string }> = ({ text }) => {
  const { accent } = useBrand().fonts;
  const starred = STARRED.exec(text);
  if (!starred) return <>{text}</>;
  return (
    <>
      <span
        style={{
          fontFamily: accent.css,
          fontStyle: accent.style,
          fontWeight: accent.weight,
          fontSize: em(accent.scale),
          lineHeight: 0,
          letterSpacing: em(accent.tracking),
        }}
      >
        {starred[1]}
      </span>
      {starred[2]}
    </>
  );
};
