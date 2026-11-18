// Exit set: text that is already on screen leaves in a chosen way. One component for the six exits, so a film
// can pick the one that fits the beat. Each is shorter than the matching entry (EXIT_SHARE) and speeds up.
import type { CSSProperties, FC } from 'react';
import { useVideoConfig } from 'remotion';
import { easing, EXIT_SHARE, progress, rng, useMotion } from '../motion';
import { smear } from '../moves/core';
import { pieceGap, type TextMoveProps } from './core';
import { asLines } from './core';
import { SplitText, type Unit } from './split';

export type ExitKind = 'drop' | 'mask-fall' | 'blur-out' | 'scatter' | 'letter-fade' | 'wipe';

const UNIT: Record<ExitKind, Unit> = { drop: 'word', 'mask-fall': 'word', 'blur-out': 'line', scatter: 'letter', 'letter-fade': 'letter', wipe: 'line' };

/**
 * The text is simply there from `at` (it fades in over a quick length) and leaves on `out`, which this move
 * needs. The kinds: `drop` (words fall away with gravity, last word first), `mask-fall` (words sink behind their
 * own edge), `blur-out` (the lines soften, grow a little and fade), `scatter` (letters fly outward in seeded
 * directions, turning as they go), `letter-fade` (letters fade one after another with a trace of blur), `wipe`
 * (a soft edge sweeps left to right and takes each line with it). Pieces start 65% as far apart as an entry's
 * would. Fast pieces (drop, scatter) carry motion blur; nothing else is blurred while it can be read.
 */
export const ExitSet: FC<TextMoveProps & { kind: ExitKind }> = ({ lines, at, out = at + 2, size = 8, align = 'center', colours, style, kind }) => {
  const m = useMotion();
  const { width, height, fps } = useVideoConfig();
  const unit = UNIT[kind];
  const gap = pieceGap(unit, m.preset.staggerMs) * EXIT_SHARE;
  const length = m.seconds('base') * EXIT_SHARE;
  const arrive = progress(m.t, at, at + m.seconds('quick'));
  const order = (p: { index: number; count: number }) => (kind === 'drop' ? p.count - 1 - p.index : p.index);
  return (
    <SplitText
      lines={asLines(lines)}
      size={size}
      align={align}
      colours={colours}
      by={unit}
      style={{ opacity: arrive, ...style }}
      mask={kind === 'mask-fall'}
      piece={(p): CSSProperties => {
        const from = out + order(p) * gap;
        const u = progress(m.t, from, from + length, easing.leave);
        if (u <= 0) return {};
        // Pixels a piece has gone, as a function of time, for the blur of whatever moves fast.
        const gone = (distance: number) => smear((distance * (progress(m.t + 0.5 / fps, from, from + length, easing.leave) - progress(m.t - 0.5 / fps, from, from + length, easing.leave))), width);
        if (kind === 'mask-fall') return { translate: `0 ${u * 110}%` };
        if (kind === 'drop') {
          const sway = (rng(41 + p.index * 13)() - 0.5) * 0.12;
          const blur = gone(height * 0.7);
          return { translate: `0 ${u * u * height * 0.7}px`, rotate: `${sway * u * 60}deg`, opacity: 1 - progress(u, 0.4, 1), filter: blur > 0 ? `blur(${blur}px)` : undefined };
        }
        if (kind === 'blur-out') return { filter: `blur(${u * 0.28}em)`, opacity: 1 - progress(u, 0.1, 1), scale: `${1 + u * 0.06}` };
        if (kind === 'scatter') {
          const r = rng(7 + p.index * 31);
          const angle = r() * Math.PI * 2;
          const reach = (0.25 + r() * 0.35) * Math.min(width, height);
          const blur = gone(reach);
          return {
            translate: `${Math.cos(angle) * reach * u}px ${Math.sin(angle) * reach * u}px`,
            rotate: `${(r() - 0.5) * 140 * u}deg`,
            opacity: 1 - progress(u, 0.3, 1),
            filter: blur > 0 ? `blur(${blur}px)` : undefined,
          };
        }
        if (kind === 'letter-fade') return { opacity: 1 - u, filter: u > 0.05 ? `blur(${u * 0.06}em)` : undefined };
        // wipe: a soft-edged mask whose edge travels across the line, left to right.
        const edge = u * 130 - 30;
        const mask = `linear-gradient(90deg, transparent ${edge}%, black ${edge + 30}%)`;
        return { maskImage: mask, WebkitMaskImage: mask };
      }}
    />
  );
};
