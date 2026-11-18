// Glitch in: the line arrives through a few frames of digital glitch: slices shifted sideways and a colour split
// in the brand's colours, settling clean. For a hard, techy arrival. After Leonxlnx/cinetic, "glitch text" (MIT).
// Flash safety: the type never changes brightness or opacity while it glitches (only its place and a thin colour
// fringe move), and the glitch covers a few bands of the line at a time, never the whole frame.
import type { CSSProperties, FC, ReactElement } from 'react';
import { rng } from '../motion';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/** Steps the glitch lasts when it arrives, and when it leaves. */
const STEPS_IN = 6;
const STEPS_OUT = 3;

type Glitch = { amount: number; step: number } | null;

/**
 * The line shows at once, cut into five bands at places that change every step (about 0.6 of a tick). In each
 * step one to three bands are shifted sideways by up to 0.14 em, and a fringe in the accent colour and the
 * stage's second colour is offset to either side of one band. Each step is smaller than the last; after
 * six steps the line is whole and still. On `out` it glitches for three steps at full size and fades.
 * Seeded: the same glitch every render. Starred words keep their voice.
 */
export const GlitchIn: FC<TextMoveProps & { seed?: number }> = ({ lines, at, out, size = 8, align = 'center', colours, style, seed = 2 }) => {
  const clock = useTextClock(at, out, 'line');
  const { m } = clock;
  const all = asLines(lines);
  const length = m.seconds('tick') * 0.6;

  const glitch: Glitch = (() => {
    const inStep = Math.floor((m.t - at) / length);
    if (inStep >= 0 && inStep < STEPS_IN && !(out !== undefined && m.t >= out)) return { step: inStep, amount: 1 - inStep / STEPS_IN };
    if (out !== undefined && m.t >= out) {
      const outStep = Math.floor((m.t - out) / length);
      if (outStep < STEPS_OUT + 2) return { step: 100 + outStep, amount: 1 };
    }
    return null;
  })();

  const copy = (key: string, wrapper: CSSProperties, inner: CSSProperties, roles?: typeof colours) => (
    <div key={key} style={{ position: 'absolute', inset: 0, ...wrapper }}>
      <SplitText lines={all} size={size} align={align} colours={roles ?? colours} by="line" piece={() => ({})} style={{ position: 'absolute', left: 0, right: 0, top: 0, ...inner }} />
    </div>
  );
  const band = (from: number, to: number): CSSProperties => ({ clipPath: `inset(${from}% -25% ${100 - to}% -25%)` });

  let layers: ReactElement[] = [];
  if (glitch) {
    const random = rng(seed * 977 + glitch.step * 61);
    const cuts = [0, ...[0, 0, 0, 0].map(() => 0.12 + 0.76 * random()).sort((a, b) => a - b), 1];
    const edges = cuts.map((c, i) => (i === 0 ? -20 : i === cuts.length - 1 ? 120 : c * 100));
    const shifted = new Set<number>();
    const wanted = 1 + Math.floor(random() * 3);
    while (shifted.size < wanted) shifted.add(Math.floor(random() * 5));
    const fringe = Math.floor(random() * 5);
    const reach = 0.14 * glitch.amount;
    // The fringe: the accent and the second colour, either side of one band, under the type.
    const split = 0.05 * (0.4 + 0.6 * glitch.amount);
    layers = [
      copy('f1', band(edges[fringe], edges[fringe + 1] + 0.4), { translate: `${-split}em 0` }, ['accent']),
      copy('f2', band(edges[fringe], edges[fringe + 1] + 0.4), { translate: `${split}em 0` }, ['second']),
      ...[0, 1, 2, 3, 4].map((b) => copy(`b${b}`, band(edges[b], edges[b + 1] + 0.4), { translate: shifted.has(b) ? `${(random() * 2 - 1) * reach}em 0` : undefined })),
    ];
  }
  return (
    <div style={{ position: 'relative', opacity: m.t < at ? 0 : 1 - clock.exit, ...style }}>
      {/* The whole line, in flow: it holds the place and is what the eye sees when the glitch is over. */}
      <div style={{ visibility: glitch ? 'hidden' : 'visible' }}>
        <SplitText lines={all} size={size} align={align} colours={colours} by="line" piece={() => ({})} />
      </div>
      {layers}
    </div>
  );
};
