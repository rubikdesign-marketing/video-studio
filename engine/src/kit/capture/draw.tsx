// What a capture clip draws on top of the recording: the pointer in each style and shape, the click effects, the
// hover glow, the glow on a field being typed in, key caps for shortcuts and the "Sped up" label. Colours, type and
// corner radius come from the brand in use; nothing here names a colour or a typeface. Sizes are a percentage of
// frame height. The artwork is generic: no company's own pointer is copied, and nothing is hand drawn.
import type { CSSProperties, FC, ReactNode } from 'react';
import { useBrand } from '../brand';
import { clamp01, easing, EXIT_SHARE, lerp, type Point } from '../motion';
import { voiceStyle } from '../moves/core';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import type { CursorShape } from './data';
import { POINTER_BOX, type CursorStyle } from './looks';

// ---------------------------------------------------------------- pointer artwork (a 24 unit box)

/** Each shape's outline and the point of the box that is the hotspot. */
const ART: Record<CursorShape, { d: string; hot: Point; stroke?: boolean }> = {
  arrow: { d: 'M4 2.5 L4 19.5 L8.6 15.4 L11.6 22 L14.6 20.7 L11.7 14.2 L18 14.2 Z', hot: { x: 4, y: 2.5 } },
  hand: {
    d: 'M8 3.3 C8 2.4 8.7 1.8 9.5 1.8 C10.3 1.8 11 2.4 11 3.3 L11 9.7 C11.2 9.2 11.8 8.9 12.4 8.9 C13.2 8.9 13.8 9.5 13.8 10.3 L13.8 10.7 C14 10.2 14.6 9.9 15.2 9.9 C16 9.9 16.6 10.5 16.6 11.3 L16.6 11.9 C16.8 11.4 17.4 11.1 18 11.1 C18.8 11.1 19.4 11.7 19.4 12.5 L19.4 16.6 C19.4 19.8 17.2 22 14 22 L12.6 22 C10.6 22 9.2 21.2 8 19.6 L4.6 15.1 C4.1 14.4 4.3 13.5 5 13 C5.7 12.5 6.6 12.7 7.1 13.3 L8 14.5 Z',
    hot: { x: 9.5, y: 1.8 },
  },
  text: { d: 'M9.3 3.6 C10.9 3.6 12 4.3 12 5.6 L12 18.4 C12 19.7 10.9 20.4 9.3 20.4 M14.7 3.6 C13.1 3.6 12 4.3 12 5.6 M12 18.4 C12 19.7 13.1 20.4 14.7 20.4 M10.2 12 L13.8 12', hot: { x: 12, y: 12 }, stroke: true },
};

export type PointerLook = {
  style: CursorStyle;
  /** Size next to the style's own. */
  size: number;
  /** The name on a named pointer's tag. */
  name: string;
};

/** The size of each style's box, as a percentage of frame height, at size 1. About 1.5 times a real pointer. */
const BOX = POINTER_BOX;

/**
 * The pointer, drawn with its hotspot on `tip` (frame pixels of the region it sits in). `press` 0 to 1 scales it to
 * 90% (`squish` presses deeper); `grow` follows the camera a little so it holds its size against the zoomed screen.
 */
export const DrawnPointer: FC<{
  look: PointerLook;
  tip: Point;
  shape: CursorShape;
  press: number;
  opacity: number;
  grow: number;
  squish?: boolean;
}> = ({ look, tip, shape, press, opacity, grow, squish = false }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  if (look.style === 'hidden' || opacity <= 0.001) return null;
  const box = vh(BOX[look.style] * look.size) * grow;
  const pressed = 1 - press * (squish ? 0.18 : 0.1);
  const shadow = `drop-shadow(0 ${vh(0.35)}px ${vh(0.7)}px ${alpha(stage.shade, 0.35)})`;

  if (look.style === 'dot' || look.style === 'halo' || look.style === 'touch') {
    const ring = look.style === 'halo';
    const touch = look.style === 'touch';
    return (
      <div style={{ position: 'absolute', left: tip.x, top: tip.y, width: 0, height: 0, opacity }}>
        {ring ? (
          // A soft ring of light around the point, for dark stages.
          <div
            style={{
              position: 'absolute',
              left: -box * 2.6,
              top: -box * 2.6,
              width: box * 5.2,
              height: box * 5.2,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${alpha(stage.accent, 0)} 30%, ${alpha(stage.accent, 0.42)} 48%, ${alpha(stage.accent, 0.12)} 62%, ${alpha(stage.accent, 0)} 72%)`,
              scale: `${pressed}`,
            }}
          />
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: -box / 2,
            top: -box / 2,
            width: box,
            height: box,
            borderRadius: '50%',
            background: touch ? alpha(brand.cursor.fill, 0.22 + 0.18 * press) : ring ? stage.accent : brand.cursor.fill,
            boxShadow: touch
              ? `0 0 0 ${vh(0.25)}px ${alpha(brand.cursor.outline, 0.9)}, 0 ${vh(0.4)}px ${vh(1.2)}px ${alpha(stage.shade, 0.25)}`
              : `0 0 0 ${vh(0.22)}px ${brand.cursor.outline}, 0 ${vh(0.3)}px ${vh(0.8)}px ${alpha(stage.shade, 0.35)}`,
            scale: `${touch ? 1 - press * 0.18 : pressed}`,
          }}
        />
      </div>
    );
  }

  const art = ART[shape];
  const fill = look.style === 'brand' || look.style === 'named' ? stage.accent : brand.cursor.fill;
  const outline = brand.cursor.outline;
  const width = look.style === 'presenter' ? 2.4 : look.style === 'brand' ? 1.9 : 1.5;
  const k = box / 24;
  return (
    <div style={{ position: 'absolute', left: tip.x, top: tip.y, width: 0, height: 0, opacity }}>
      <svg
        width={box}
        height={box}
        viewBox="0 0 24 24"
        style={{ position: 'absolute', left: -art.hot.x * k, top: -art.hot.y * k, overflow: 'visible', filter: shadow, scale: `${pressed}`, transformOrigin: `${art.hot.x * k}px ${art.hot.y * k}px` }}
      >
        {art.stroke ? (
          <>
            <path d={art.d} fill="none" stroke={outline} strokeWidth={4.2} strokeLinecap="round" strokeLinejoin="round" />
            <path d={art.d} fill="none" stroke={fill} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <path d={art.d} fill={fill} stroke={outline} strokeWidth={width} strokeLinejoin="round" paintOrder="stroke" />
        )}
      </svg>
      {look.style === 'named' ? <NameTag name={look.name} at={{ x: (18 - art.hot.x) * k, y: (19 - art.hot.y) * k }} /> : null}
    </div>
  );
};

/** The name on a named pointer: a small tag in the accent colour, as in shared editors. */
const NameTag: FC<{ name: string; at: Point }> = ({ name, at }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  return (
    <div
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        padding: `${vh(0.45)}px ${vh(1.1)}px`,
        borderRadius: vh(brand.shape.pill),
        background: stage.accent,
        color: stage.onAccent,
        whiteSpace: 'pre',
        boxShadow: `0 ${vh(0.3)}px ${vh(0.9)}px ${alpha(stage.shade, 0.3)}`,
        ...voiceStyle(brand.fonts.label, vh(1.9)),
      }}
    >
      {name}
    </div>
  );
};

/** Spotlight: the pointer lights a soft circle and the rest of the screen dims slightly. */
export const Spotlight: FC<{ tip: Point; opacity: number; radius: number }> = ({ tip, opacity, radius }) => {
  const stage = useStage();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity,
        background: `radial-gradient(circle ${radius * 1.6}px at ${tip.x}px ${tip.y}px, ${alpha(stage.shade, 0)} 0%, ${alpha(stage.shade, 0)} 45%, ${alpha(stage.shade, 0.16)} 100%)`,
      }}
    />
  );
};

/** A short fading line behind a moving point (hype and touch only). `points` are newest last. */
export const TrailLine: FC<{ points: Point[] }> = ({ points }) => {
  const stage = useStage();
  const vh = useVh();
  if (points.length < 2) return null;
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
      {points.slice(1).map((p, i) => {
        const q = points[i];
        const share = (i + 1) / (points.length - 1);
        return <line key={i} x1={q.x} y1={q.y} x2={p.x} y2={p.y} stroke={stage.accent} strokeOpacity={0.75 * share * share} strokeWidth={vh(0.7) * (0.4 + 0.6 * share)} strokeLinecap="round" />;
      })}
    </svg>
  );
};

// ---------------------------------------------------------------- click effects

/** How long each click effect lasts, in seconds; all of them start on the button going down (within 120 ms). */
export const CLICK_SECONDS = { ring: 0.42, pulse: 0.5, burst: 0.32 };

/** A ring that spreads from the point and fades. */
export const RingEffect: FC<{ at: Point; age: number }> = ({ at, age }) => {
  const stage = useStage();
  const vh = useVh();
  const u = age / CLICK_SECONDS.ring;
  if (u < 0 || u >= 1) return null;
  const d = vh(7) * (0.25 + 0.75 * easing.arrive(u));
  return (
    <div
      style={{
        position: 'absolute',
        left: at.x - d / 2,
        top: at.y - d / 2,
        width: d,
        height: d,
        borderRadius: '50%',
        border: `${vh(0.32)}px solid ${stage.accent}`,
        opacity: 1 - easing.travel(u),
      }}
    />
  );
};

/** A soft pulse that fills the thing clicked (or a soft disc when the thing is not tracked). */
export const PulseEffect: FC<{ at: Point; box: { x: number; y: number; width: number; height: number } | null; age: number }> = ({ at, box, age }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const u = age / CLICK_SECONDS.pulse;
  if (u < 0 || u >= 1) return null;
  const rise = easing.arrive(clamp01(u / 0.3));
  const fade = 1 - easing.travel(clamp01((u - 0.3) / 0.7));
  const style: CSSProperties = box
    ? { left: box.x, top: box.y, width: box.width, height: box.height, borderRadius: vh(brand.shape.control) }
    : { left: at.x - vh(3.5), top: at.y - vh(3.5), width: vh(7), height: vh(7), borderRadius: '50%' };
  return (
    <div
      style={{
        position: 'absolute',
        ...style,
        background: alpha(stage.accent, 0.24),
        boxShadow: `0 0 ${vh(2.2)}px ${alpha(stage.accent, 0.35)}`,
        opacity: rise * fade,
        scale: `${1 + 0.04 * easing.arrive(u)}`,
      }}
    />
  );
};

/** A short burst of lines from the point. Hype films only. */
export const BurstEffect: FC<{ at: Point; age: number }> = ({ at, age }) => {
  const stage = useStage();
  const vh = useVh();
  const u = age / CLICK_SECONDS.burst;
  if (u < 0 || u >= 1) return null;
  const out = easing.arrive(u);
  const inner = vh(1.6) + vh(2.2) * out;
  const length = vh(1.6) * (1 - easing.travel(u)) + vh(0.3);
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const [c, s] = [Math.cos(a), Math.sin(a)];
        return <line key={i} x1={at.x + c * inner} y1={at.y + s * inner} x2={at.x + c * (inner + length)} y2={at.y + s * (inner + length)} stroke={stage.accent} strokeWidth={vh(0.38)} strokeLinecap="round" />;
      })}
    </svg>
  );
};

// ---------------------------------------------------------------- hover and typing

/** A soft glow around a thing on the screen: the thing under a resting pointer, or the field being typed in. */
export const ThingGlow: FC<{ box: { x: number; y: number; width: number; height: number }; amount: number; ring?: boolean }> = ({ box, amount, ring = false }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  if (amount <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x - vh(0.3),
        top: box.y - vh(0.3),
        width: box.width + vh(0.6),
        height: box.height + vh(0.6),
        borderRadius: vh(brand.shape.control) + vh(0.3),
        boxShadow: `${ring ? `0 0 0 ${vh(0.22)}px ${alpha(stage.accent, 0.7 * amount)}, ` : ''}0 0 ${vh(2.4)}px ${vh(0.2)}px ${alpha(stage.accent, 0.38 * amount)}`,
        pointerEvents: 'none',
      }}
    />
  );
};

/** Words for keys as a person would say them. */
const KEY_WORDS: Record<string, string> = {
  Meta: 'Cmd',
  Control: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Enter: 'Enter',
  Escape: 'Esc',
  Tab: 'Tab',
  Backspace: 'Delete',
  Delete: 'Delete',
  ' ': 'Space',
  Space: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};
export const keyWord = (key: string) => KEY_WORDS[key] ?? (key.length === 1 ? key.toUpperCase() : key);

/**
 * Key caps near the bottom of the screen, one per key of a shortcut, each pressing as its key goes down.
 * `age` is seconds since the last key went down; `downs` is when each key went down, in seconds before that.
 */
export const KeyCaps: FC<{ keys: string[]; age: number; downs: number[]; hold: number; enter: number }> = ({ keys, age, downs, hold, enter }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const exit = enter * EXIT_SHARE;
  const appear = easing.arrive(clamp01((age + enter + downs[0]) / enter));
  const leave = easing.leave(clamp01((age - hold) / exit));
  const opacity = appear * (1 - leave);
  if (opacity <= 0.001) return null;
  return (
    <div style={{ display: 'flex', gap: vh(1.1), opacity, translate: `0 ${(1 - appear) * vh(1.2)}px` }}>
      {keys.map((key, i) => {
        const pressed = easing.travel(clamp01((age + downs[i]) / 0.08)) * (1 - easing.arrive(clamp01((age - 0.25) / 0.2)));
        return (
          <div
            key={i}
            style={{
              minWidth: vh(6),
              padding: `${vh(1.1)}px ${vh(1.6)}px`,
              borderRadius: vh(brand.shape.control),
              background: stage.page,
              color: stage.ink,
              textAlign: 'center',
              boxShadow: `0 0 0 1px ${stage.line}, 0 ${vh(0.55 - 0.4 * pressed)}px 0 ${stage.line}, 0 ${vh(1)}px ${vh(2.4)}px ${alpha(stage.shade, 0.22)}`,
              translate: `0 ${vh(0.4) * pressed}px`,
              ...voiceStyle(brand.fonts.label, vh(2.8)),
            }}
          >
            {keyWord(key)}
          </div>
        );
      })}
    </div>
  );
};

/** The "Sped up" label, in the brand's label style, while a stretch plays faster. */
export const SpedUpLabel: FC<{ amount: number; children?: ReactNode }> = ({ amount, children = 'Sped up' }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  if (amount <= 0.001) return null;
  return (
    <div
      style={{
        padding: `${vh(0.7)}px ${vh(1.5)}px`,
        borderRadius: vh(brand.shape.pill),
        background: alpha(stage.page, 0.92),
        color: stage.ink,
        boxShadow: `0 0 0 1px ${stage.line}, 0 ${vh(0.5)}px ${vh(1.6)}px ${alpha(stage.shade, 0.18)}`,
        opacity: amount,
        translate: `0 ${lerp(vh(0.8), 0, amount)}px`,
        ...voiceStyle(brand.fonts.label, vh(2.2)),
      }}
    >
      {children}
    </div>
  );
};
