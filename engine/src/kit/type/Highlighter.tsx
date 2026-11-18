// Highlighter: a marker stroke in the accent colour sweeps behind chosen words, its edges a little uneven.
// For the phrase in a line that carries the offer. After Magic UI, "highlighter" (MIT).
import type { FC } from 'react';
import { easing, EXIT_SHARE, progress, rng, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { asLines, type TextMoveProps } from './core';
import { EmphasisText, useAnalysis, type Mark, type Run } from './emphasis';

/** How opaque the marker is: soft enough to read the ink through it. */
const STRENGTH = 0.36;
/** The stroke's height and top, as shares of the line height, and how far it overhangs the words, in em. */
const BAND = { top: 0.2, bottom: 0.9, overhang: 0.1, edge: 0.07, step: 0.1 } as const;

/**
 * Sweeps a translucent accent marker from left to right behind the chosen words (`mark`: a word or phrase, word
 * numbers, or left out for the starred words) at `at`, over a `scene` length; the words stay in ink on top. The
 * stroke's top and bottom edges and its leading end are uneven, the same on every render (`seed`). At `out`
 * the marker wipes away from the left. The line itself is drawn by the move and stays where it is.
 */
export const Highlighter: FC<TextMoveProps & { mark?: Mark; seed?: number }> = ({ lines, at, out, size = 8, align = 'center', colours, style, mark, seed = 11 }) => {
  const m = useMotion();
  const stage = useStage();
  const ls = asLines(lines);
  const data = useAnalysis(ls, mark);
  const sweep = m.seconds('scene');
  const lead = progress(m.t, at, at + sweep, easing.travel);
  const trail = out === undefined ? 0 : progress(m.t, out, out + sweep * EXIT_SHARE, easing.leave);
  const overlay = (run: Run, fx: { fontSize: number; lineHeight: number; runWidth: (r: Run) => number }) => {
    if (lead <= 0 || trail >= 1) return null;
    const w = fx.runWidth(run);
    const h = fx.lineHeight;
    const over = BAND.overhang * fx.fontSize;
    const total = w + over * 2;
    const random = rng(seed + run.id * 13);
    const stepPx = BAND.step * fx.fontSize;
    const n = Math.max(2, Math.ceil(total / stepPx));
    const jitter = () => (random() - 0.5) * 2 * BAND.edge * fx.fontSize;
    // A slow lean along each edge, plus a quicker wobble, so it looks pressed by a hand and not cut by a ruler.
    const lean = () => (random() - 0.5) * 2 * 0.09 * fx.fontSize;
    const [topLean, bottomLean] = [lean(), lean()];
    const top = Array.from({ length: n + 1 }, (_, i) => jitter() + topLean * (i / n - 0.5));
    const bottom = Array.from({ length: n + 1 }, (_, i) => jitter() + bottomLean * (i / n - 0.5));
    const tip = jitter() * 2.5;
    const from = trail * total;
    const to = lead * total;
    const y0 = BAND.top * h;
    const y1 = BAND.bottom * h;
    const upper: string[] = [];
    const lower: string[] = [];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * total;
      if (x < from || x > to) continue;
      upper.push(`${(x - over).toFixed(1)} ${(y0 + top[i]).toFixed(1)}`);
      lower.push(`${(x - over).toFixed(1)} ${(y1 + bottom[i]).toFixed(1)}`);
    }
    if (upper.length === 0) return null;
    // The leading end is a ragged slant, not a straight cut.
    const end = Math.min(to, total) - over;
    const d = `M ${upper.join(' L ')} L ${(end + tip).toFixed(1)} ${(y0 + (y1 - y0) * 0.3).toFixed(1)} L ${(end - tip).toFixed(1)} ${(y0 + (y1 - y0) * 0.7).toFixed(1)} L ${lower.reverse().join(' L ')} Z`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex: -1, pointerEvents: 'none' }}>
        <path d={d} fill={alpha(stage.accent, STRENGTH)} />
      </svg>
    );
  };
  return <EmphasisText lines={ls} size={size} align={align} colours={colours} style={style} mark={mark} analysis={data} overlay={overlay} />;
};
