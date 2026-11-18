// At the lens: a brand-coloured card flies straight at the camera and past it, and the hook line is pulled into
// focus behind it as it goes. The object-at-the-lens pattern interrupt, made in the engine.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, lerp, progress, useMotion } from '../motion';
import { MotionBlur, useTravel, voiceStyle } from '../moves/core';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { Centred, HookText, Opener, useHookLayout, type OpenerProps } from './core';

/**
 * A card (the product's tile: it carries `label`) starts small in the middle, speeds up, grows past the frame and
 * leaves over a corner, turning a little. The line sits behind it, soft and slightly large, and sharpens to rest as
 * the card clears. The card's own path is motion blurred; the line never moves while it is being read.
 * Sound: a rising whoosh that peaks as the card passes, a soft impact as the line lands.
 * Props: `line`, `label` (the card's words, in the label voice), `at`, `out`, `next`, `size`.
 */
export const AtTheLens: FC<OpenerProps & { line: string; label?: string }> = ({ line, label = 'Weekly report', at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const brand = useBrand();
  const travel = useTravel();
  const { width, height } = useVideoConfig();
  const short = Math.min(width, height);
  const layout = useHookLayout(line, { size });
  const t = m.t - at;
  const flight = m.seconds('hero') * 0.8;
  const place = (time: number) => {
    const e = Math.max(0, (time - at) / flight) ** 2.4;
    return { x: -width * 0.95 * e * e, y: -height * 0.32 * e * e, scale: 0.4 * Math.exp(Math.log(19) * Math.min(e, 1.2)), turn: -16 * Math.min(e, 1.2) };
  };
  const now = place(m.t);
  const gone = 1 - progress(t, flight * 1.0, flight * 1.12, easing.leave);
  const reveal = progress(m.t - at, flight * 0.62, flight + m.seconds('base'), easing.arrive);
  const cardW = short * 0.52;
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        <div style={{ filter: reveal < 1 ? `blur(${(1 - reveal) * short * 0.02}px)` : undefined, opacity: reveal, scale: String(lerp(1.12, 1, reveal)) }}>
          <HookText layout={layout} />
        </div>
      </Centred>
      <Centred>
        <MotionBlur x={travel((time) => place(time).x)} y={travel((time) => place(time).y)}>
          <div
            style={{
              width: cardW,
              height: cardW * 0.62,
              borderRadius: (short * brand.shape.window) / 100,
              background: stage.accent,
              color: stage.onAccent,
              boxShadow: `0 ${short * 0.02}px ${short * 0.06}px ${alpha(stage.shade, 0.35)}`,
              display: 'flex',
              alignItems: 'flex-end',
              padding: cardW * 0.08,
              boxSizing: 'border-box',
              ...voiceStyle(brand.fonts.label, cardW * 0.1),
              translate: `${now.x}px ${now.y}px`,
              scale: String(now.scale),
              rotate: `${now.turn}deg`,
              opacity: gone,
            }}
          >
            {label}
          </div>
        </MotionBlur>
      </Centred>
    </Opener>
  );
};
