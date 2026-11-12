// Visual building blocks. Each one takes `at` (and often `out`) in seconds on the local clock and reads the
// time, the energy preset, the brand and the stage colours from context. Sizes are a percentage of frame height.
// Colours, typefaces, corner radii and logos all come from the brand in use (useBrand); none is named here.
import { createContext, Fragment, useContext, useRef, type CSSProperties, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion';
import { useBrand } from './brand';
import { arc, easing, EXIT_SHARE, progress, rng, useMotion, useRealTime, type Point } from './motion';
import { alpha, type StageName, type StagePalette, type Voice } from './tokens';

/** Converts a percentage of frame height to pixels, so sizes hold at any frame size. */
export const useVh = () => {
  const { height } = useVideoConfig();
  return (percent: number) => (height * percent) / 100;
};

/** Fade in on `at` and out (faster) on `out`, settling upwards into place. For labels, pills and windows. */
const useEntrance = (at: number, out?: number): CSSProperties => {
  const m = useMotion();
  const vh = useVh();
  const enter = progress(m.t, at, at + m.seconds('quick'));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  return { opacity: enter * (1 - exit), translate: `0 ${(1 - m.settle(at)) * vh(1.2)}px` };
};

// ---------------------------------------------------------------- stage

/** How far a light wanders from its place, as a percentage of frame height. Slow and small on purpose. */
const DRIFT = 2.5;

const StageContext = createContext<StageName | null>(null);

/** Colours by role for the stage this component sits on. */
export const useStage = (): StagePalette => {
  const brand = useBrand();
  const name = useContext(StageContext);
  if (!name) throw new Error('This component must be inside a <Stage> or a <Panel>.');
  return brand.stages[name];
};

/**
 * The page everything sits on: the brand's "light" page or its "dark" page. Its lights drift and its grain
 * changes on the film's real clock, so the stage stays alive through holds and does not restart at scene changes.
 */
export const Stage: FC<{ name: StageName; children?: ReactNode }> = ({ name, children }) => {
  const now = useRealTime();
  // Full grain unless a background drawn on this frame asks for less (useGrainShare). Reset on every render, so a
  // background that has left the screen no longer counts.
  const grainShare = useRef(1);
  grainShare.current = 1;
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const brand = useBrand();
  const look = brand.looks[name];
  const pools = look.lights.map((light, i) => {
    const x = light.x * width + vh(DRIFT) * (Math.sin(now * 0.11 + i * 2.1) + 0.4 * Math.sin(now * 0.23 + i * 0.7));
    const y = light.y * height + vh(DRIFT) * (Math.cos(now * 0.09 + i * 1.3) + 0.4 * Math.sin(now * 0.19 + i * 2.9));
    const radius = light.radius * height * (1 + 0.04 * Math.sin(now * 0.15 + i * 1.9));
    const stops = [1, 0.45, 0].map((share) => alpha(light.colour, light.opacity * share));
    return `radial-gradient(${radius}px ${radius}px at ${x}px ${y}px, ${stops[0]} 0%, ${stops[1]} 38%, ${stops[2]} 72%)`;
  });
  return (
    <StageContext.Provider value={name}>
      <GrainShareContext.Provider value={grainShare}>
        <AbsoluteFill style={{ backgroundColor: brand.stages[name].page, overflow: 'hidden' }}>
          <AbsoluteFill style={{ backgroundImage: pools.join(', ') }} />
          {children}
          <Vignette amount={look.vignette} />
          <Grain amount={look.grain} />
        </AbsoluteFill>
      </GrainShareContext.Provider>
    </StageContext.Provider>
  );
};

/**
 * A look's grain is set for its own page colour. Over a fill much nearer the middle of the range (a saturated
 * colour edge to edge), the same grain reads several times stronger. A background like that calls this as it
 * draws, with the share of the grain it can take. The stage's grain is drawn after the scene, on the same frame,
 * so it picks the share up without anyone setting it by hand.
 */
const GrainShareContext = createContext<{ current: number } | null>(null);
export const useGrainShare = (share: number) => {
  const shared = useContext(GrainShareContext);
  if (shared) shared.current = Math.min(shared.current, share);
};

/**
 * A box painted in one of the brand's pages, light or dark, whatever stage it sits on. Everything inside takes
 * its colours from that page. It has no lights or grain of its own. Size and place it with `style`.
 */
export const Panel: FC<{ name: StageName; style?: CSSProperties; children?: ReactNode }> = ({ name, style, children }) => {
  const page = useBrand().stages[name];
  return (
    <StageContext.Provider value={name}>
      <div style={{ backgroundColor: page.page, color: page.ink, ...style }}>{children}</div>
    </StageContext.Provider>
  );
};

/** Darkens the corners of the stage. */
export const Vignette: FC<{ amount: number }> = ({ amount }) => {
  const { shade } = useStage();
  if (amount <= 0) return null;
  const corners = `radial-gradient(120% 95% at 50% 50%, ${alpha(shade, 0)} 55%, ${alpha(shade, amount)} 100%)`;
  return <AbsoluteFill style={{ pointerEvents: 'none', background: corners }} />;
};

const GRAIN_TILE = 512;

/** Film grain: a noise tile moved to a new seeded place on every real frame (any slower rate reads as chatter). */
export const Grain: FC<{ amount: number }> = ({ amount }) => {
  const now = useRealTime();
  const { fps } = useVideoConfig();
  const share = useContext(GrainShareContext)?.current ?? 1;
  const random = rng(Math.round(now * fps));
  if (amount * share <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: amount * share,
        mixBlendMode: 'overlay',
        backgroundImage: `url(${staticFile('kit/grain.png')})`,
        backgroundSize: `${GRAIN_TILE}px ${GRAIN_TILE}px`,
        backgroundPosition: `${Math.floor(random() * GRAIN_TILE)}px ${Math.floor(random() * GRAIN_TILE)}px`,
      }}
    />
  );
};

// ---------------------------------------------------------------- type

/** "*word*." is the word in the accent voice, with any punctuation after it left in the headline voice. */
const ACCENT_WORD = /^\*(.+?)\*(.*)$/;

const em = (value: number | undefined) => (value === undefined ? undefined : `${value}em`);

/**
 * The starred word, inside a headline. A brand with an accent face gets it; a brand without one gets its headline
 * face, heavier or in italic (kit/tokens.ts), so the star never fails.
 */
const accentStyle = (accent: Voice): CSSProperties => ({
  fontFamily: accent.css,
  fontStyle: accent.style,
  fontWeight: accent.weight,
  fontSize: em(accent.scale),
  lineHeight: 0,
  letterSpacing: em(accent.tracking),
});

/** One word rising from behind a mask. */
const RisingWord: FC<{ text: string; at: number }> = ({ text, at }) => {
  const m = useMotion();
  const brand = useBrand();
  const below = 1 - progress(m.t, at, at + m.seconds('base'));
  const opacity = progress(m.t, at, at + m.seconds('quick'));
  const accent = ACCENT_WORD.exec(text);
  return (
    // The mask is a clip path, not overflow: hidden, so the word keeps its baseline. It leaves room for
    // descenders and for the overhang of an italic.
    <span style={{ display: 'inline-block', clipPath: 'inset(-0.2em -0.15em -0.1em)' }}>
      <span style={{ display: 'inline-block', opacity, translate: `0 ${below * 35}%` }}>
        {accent ? (
          <>
            <span style={accentStyle(brand.fonts.accent)}>{accent[1]}</span>
            {accent[2]}
          </>
        ) : (
          text
        )}
      </span>
    </span>
  );
};

/**
 * A headline of one or two clauses with word rise. The first clause is in ink, the second in the stage's
 * second colour. Wrap one word in asterisks to set it in the brand's accent voice: "Work, *finally* in one place".
 * `size` is a percentage of frame height: 6 to 8 for a headline, 8.5 to 12 for a hero line.
 */
export const Headline: FC<{
  lines: [string] | [string, string];
  at: number;
  out?: number;
  size?: number;
  align?: 'left' | 'center';
  style?: CSSProperties;
}> = ({ lines, at, out, size = 7, align = 'center', style }) => {
  const m = useMotion();
  const { headline } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  // Words rise 40 to 50 ms apart, whatever the preset's stagger for other groups.
  const gap = Math.min(50, Math.max(40, m.preset.staggerMs)) / 1000;
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  const words = lines.map((line) => line.split(' '));
  return (
    <div
      style={{
        fontFamily: headline.css,
        fontStyle: headline.style,
        fontWeight: headline.weight,
        fontSize: vh(size),
        lineHeight: headline.lineHeight,
        letterSpacing: em(headline.tracking),
        textAlign: align,
        opacity: 1 - exit,
        translate: `0 ${-exit * 0.12}em`,
        ...style,
      }}
    >
      {words.map((line, li) => {
        const wordsBefore = words.slice(0, li).flat().length;
        return (
          <div key={li} style={{ color: li === 0 ? stage.ink : stage.second }}>
            {line.map((word, wi) => (
              <Fragment key={wi}>
                {wi > 0 ? ' ' : null}
                <RisingWord text={word} at={at + (wordsBefore + wi) * gap} />
              </Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
};

/** A small label in sentence case, in the brand's label voice. Words only: no dots, no separators. */
export const Label: FC<{ children: ReactNode; at?: number; out?: number; size?: number; style?: CSSProperties }> = ({
  children,
  at = 0,
  out,
  size = 3,
  style,
}) => {
  const { label } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  const entrance = useEntrance(at, out);
  return (
    <div
      style={{
        fontFamily: label.css,
        fontStyle: label.style,
        fontWeight: label.weight,
        fontSize: vh(size),
        letterSpacing: em(label.tracking),
        fontVariantNumeric: 'tabular-nums',
        color: stage.second,
        ...entrance,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

type ChipProps = { children: ReactNode; at?: number; out?: number; emphasis?: boolean; style?: CSSProperties };

/** What a pill and a button share: ink with light text, or the accent colour when `emphasis` is set. */
const Chip: FC<ChipProps & { radius: number }> = ({ children, at = 0, out, emphasis = false, radius, style }) => {
  const { headline } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  const entrance = useEntrance(at, out);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: vh(1),
        padding: `${vh(1.5)}px ${vh(3)}px`,
        borderRadius: vh(radius),
        background: emphasis ? stage.accent : stage.ink,
        color: emphasis ? stage.onAccent : stage.onInk,
        fontFamily: headline.css,
        fontStyle: headline.style,
        fontWeight: headline.weight,
        fontSize: vh(2.6),
        boxShadow: `0 ${vh(1)}px ${vh(3)}px ${alpha(stage.shade, 0.25)}`,
        ...entrance,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A pill: ink with light text, or the accent colour when `emphasis` is set. */
export const Pill: FC<ChipProps> = (props) => <Chip {...props} radius={useBrand().shape.pill} />;

/** A button: the same fill as a pill, with the brand's corner radius for controls. */
export const Button: FC<ChipProps> = (props) => <Chip {...props} radius={useBrand().shape.control} />;

// ---------------------------------------------------------------- product

/**
 * A capture of real product UI as an app window: rounded, a line border, a long soft shadow, and on a dark
 * stage a faint glow at its edges. `src` is a file in public/. Place it with `style`.
 */
export const Screen: FC<{
  src: string;
  width: number;
  height?: number;
  at?: number;
  out?: number;
  style?: CSSProperties;
  children?: ReactNode;
}> = ({ src, width, height, at = 0, out, style, children }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const entrance = useEntrance(at, out);
  const shadow = `0 ${vh(4)}px ${vh(9)}px ${alpha(stage.shade, 0.3)}`;
  const glow = `0 0 ${vh(13)}px ${alpha(stage.accent, stage.screenGlow)}`;
  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        overflow: 'hidden',
        borderRadius: vh(brand.shape.window),
        background: brand.screen,
        boxShadow: `0 0 0 1px ${stage.line}, ${shadow}, ${glow}`,
        ...entrance,
        ...style,
      }}
    >
      <Img src={staticFile(src)} style={{ display: 'block', width: '100%', height: height ? '100%' : 'auto', objectFit: 'cover', objectPosition: 'top left' }} />
      {children}
    </div>
  );
};

/** One leg of a cursor's journey: it lands on `to` just before `at` seconds, and clicks on `at` if asked. */
export type CursorMove = { to: Point; at: number; click?: boolean };

/**
 * A large pointer that travels between points on arcs. It starts at `from`, and each move is timed by when
 * it lands, so a click can sit on a spoken word. Every click draws a ring.
 */
export const Cursor: FC<{ from: Point; moves: [CursorMove, ...CursorMove[]]; out?: number; bend?: number }> = ({
  from,
  moves,
  out,
  bend,
}) => {
  const m = useMotion();
  const pause = m.seconds('tick'); // the pointer rests this long before a click, and presses down during it
  const startOf = (move: CursorMove) => move.at - pause - m.seconds('scene');

  let tip = from;
  let press = 0;
  moves.forEach((move, i) => {
    if (m.t >= startOf(move)) {
      const origin = i === 0 ? from : moves[i - 1].to;
      tip = arc(origin, move.to, progress(m.t, startOf(move), move.at - pause, easing.travel), bend);
    }
    if (move.click) {
      const down = progress(m.t, move.at - pause, move.at, easing.travel);
      const up = progress(m.t, move.at, move.at + m.seconds('quick'));
      press = Math.max(press, down * (1 - up));
    }
  });

  const enter = progress(m.t, startOf(moves[0]) - m.seconds('quick'), startOf(moves[0]));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  return (
    <>
      {moves.map((move, i) => (move.click ? <ClickRing key={i} at={move.at} x={move.to.x} y={move.to.y} /> : null))}
      <Pointer tip={tip} press={press} opacity={enter * (1 - exit)} />
    </>
  );
};

/**
 * The brand's pointer drawn with its tip on `tip`. `press` (0 to 1) shrinks it a little while a click is down.
 * `Cursor` moves it on arcs; `CaptureClip` moves it along a recorded path.
 */
export const Pointer: FC<{ tip: Point; press?: number; opacity?: number; size?: number }> = ({ tip, press = 0, opacity = 1, size: sizeVh = 5 }) => {
  const { cursor } = useBrand();
  const vh = useVh();
  const size = vh(sizeVh);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        position: 'absolute',
        // The tip of the arrow sits at (4, 2.5) in the 24 unit drawing.
        left: tip.x - (size * 4) / 24,
        top: tip.y - (size * 2.5) / 24,
        overflow: 'visible',
        opacity,
        scale: `${1 - press * 0.12}`,
        filter: `drop-shadow(0 ${vh(0.4)}px ${vh(0.8)}px ${alpha(cursor.fill, 0.45)})`,
      }}
    >
      <path
        d="M4 2.5 L4 19.5 L8.6 15.4 L11.6 22 L14.6 20.7 L11.7 14.2 L18 14.2 Z"
        fill={cursor.fill}
        stroke={cursor.outline}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
};

/** A ring that opens from a point and fades. One per real click. */
export const ClickRing: FC<{ at: number; x: number; y: number; size?: number }> = ({ at, x, y, size = 10 }) => {
  const m = useMotion();
  const stage = useStage();
  const vh = useVh();
  const end = at + m.seconds('base');
  if (m.t < at || m.t >= end) return null;
  const diameter = vh(size);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - diameter / 2,
        top: y - diameter / 2,
        width: diameter,
        height: diameter,
        borderRadius: '50%',
        border: `${vh(0.3)}px solid ${stage.accent}`,
        opacity: 1 - progress(m.t, at, end, easing.travel),
        scale: `${0.2 + 0.8 * progress(m.t, at, end)}`,
      }}
    />
  );
};

// ---------------------------------------------------------------- finish

/**
 * The brand's wordmark for this stage (the file for a light page or for a dark page). It opens and closes a film.
 * With `mark`, the symbol alone.
 */
export const Wordmark: FC<{ at?: number; out?: number; height?: number; mark?: boolean; style?: CSSProperties }> = ({
  at = 0,
  out,
  height = 9,
  mark = false,
  style,
}) => {
  const stage = useStage();
  const vh = useVh();
  const entrance = useEntrance(at, out);
  return <Img src={staticFile(mark ? stage.mark : stage.wordmark)} style={{ height: vh(height), ...entrance, ...style }} />;
};

const CONFETTI_SECONDS = 3.2;

/** A burst of paper confetti fired upwards from a point at `at` seconds. It falls with drag, spin and flutter. */
export const Confetti: FC<{ at: number; x: number; y: number; count?: number; seed?: number }> = ({
  at,
  x,
  y,
  count = 90,
  seed = 1,
}) => {
  const { t } = useMotion();
  const colours = useBrand().confetti;
  const vh = useVh();
  const u = t - at;
  if (u < 0 || u > CONFETTI_SECONDS) return null;
  const random = rng(seed);
  const drag = 2.4;
  const reach = (1 - Math.exp(-drag * u)) / drag; // how far a piece has flown, per unit of launch speed
  const fade = Math.min(1, u * 8) * Math.min(1, (CONFETTI_SECONDS - u) / (CONFETTI_SECONDS * 0.4));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => {
        const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 1.25;
        const speed = vh(83 + random() * 139);
        const flutter = Math.sin(u * (3 + random() * 3) + i) * vh(2.4) * u;
        const width = vh(0.9 + random() * 1.3);
        const height = vh(0.55 + random() * 0.9);
        const spin = (random() - 0.5) * 900 * u;
        const flip = Math.abs(Math.cos(u * (6 + random() * 8) + i));
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.cos(angle) * speed * reach + flutter,
              top: y + Math.sin(angle) * speed * reach + vh(16.8) * u * u,
              width,
              height: height * (0.25 + 0.75 * flip),
              borderRadius: vh(0.2),
              background: colours[i % colours.length],
              rotate: `${spin}deg`,
              opacity: fade,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
