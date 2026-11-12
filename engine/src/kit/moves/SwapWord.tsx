// Swap: one word slides out and its replacement slides in, while the rest of the line holds. Before and after
// in one line.
import type { CSSProperties, FC } from 'react';
import { useBrand } from '../brand';
import { easing, progress, useMotion } from '../motion';
import { useStage, useVh } from '../ui';
import { useCue, voiceStyle, Word } from './core';

/** From the old word to the new one on the roll, in em: more than a line, so only one word is whole at a time. */
const PITCH = 1.3;

/**
 * A line that ends in a word which is swapped at `swapAt`. The old word is in the warm colour (the "before") and
 * the new one in the accent. The swapped word is the last on its line and its place is as wide as the wider of
 * the two, so the words before it never move. The two words are on one roll behind a mask the height of the
 * line: the old one speeds up and out through the top as the new one comes up and slows into place, a `base`
 * length in all. They are never printed over each other and neither fades.
 */
export const SwapWord: FC<{
  lead?: string;
  from: string;
  to: string;
  at: number;
  swapAt: number;
  out?: number;
  size?: number;
  style?: CSSProperties;
}> = ({ lead, from, to, at, swapAt, out, size = 7, style }) => {
  const m = useMotion();
  const { headline } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  const line = useCue(at, out);
  const rolled = progress(m.t, swapAt, swapAt + m.seconds('base'), easing.travel);
  const cell: CSSProperties = { gridArea: '1 / 1', justifySelf: 'start' };
  return (
    <div
      style={{
        ...voiceStyle(headline, vh(size)),
        display: 'inline-flex',
        alignItems: 'baseline',
        whiteSpace: 'pre',
        color: stage.ink,
        opacity: line.enter * (1 - line.exit),
        translate: `0 ${(1 - line.enter) * vh(1.2)}px`,
        ...style,
      }}
    >
      {lead ? <span>{lead} </span> : null}
      {/* Both words share one cell. The mask is a clip path, so the words keep their baseline; it leaves room for
          descenders and for the overhang of an italic, and nothing more. */}
      <span style={{ display: 'inline-grid', clipPath: 'inset(-0.04em -0.15em -0.14em)' }}>
        {rolled < 1 ? (
          <span style={{ ...cell, color: stage.warm, translate: `0 ${-rolled * PITCH}em` }}>
            <Word text={from} />
          </span>
        ) : null}
        <span style={{ ...cell, color: stage.accent, translate: `0 ${(1 - rolled) * PITCH}em` }}>
          <Word text={to} />
        </span>
      </span>
    </div>
  );
};
