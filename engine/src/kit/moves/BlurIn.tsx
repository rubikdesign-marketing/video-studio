// Blur in: each word goes from soft to sharp while it settles into place. For calm films.
import { Fragment, type CSSProperties, type FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useStage, useVh } from '../ui';
import { voiceStyle, Word, wordGap } from './core';

/** How soft a word starts, as a percentage of frame height. */
const SOFT = 0.9;
/** How far below its place a word starts, in em. */
const BELOW = 0.18;

/**
 * A headline of one or two clauses whose words sharpen as they settle. The first clause is in ink, the second in
 * the stage's second colour; star one word to set it in the accent voice. `size` is a percentage of frame height.
 * Each word is there, soft, within a `quick` length; it reaches its place first and comes into focus last, over a
 * `base` length, so the sharpening is seen and not skipped.
 */
export const BlurIn: FC<{
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
  const gap = wordGap(m.preset);
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  const words = lines.map((line) => line.split(' '));
  return (
    <div style={{ ...voiceStyle(headline, vh(size)), textAlign: align, opacity: 1 - exit, translate: `0 ${-exit * 0.12}em`, ...style }}>
      {words.map((line, li) => {
        const wordsBefore = words.slice(0, li).flat().length;
        return (
          <div key={li} style={{ color: li === 0 ? stage.ink : stage.second }}>
            {line.map((word, wi) => {
              const start = at + (wordsBefore + wi) * gap;
              // Position lands first, with no overshoot (a word that bounces by a pixel twitches). Focus comes
              // last: it holds soft for a moment, then pulls sharp and eases into the final sharpness.
              const below = 1 - progress(m.t, start, start + m.seconds('base'));
              const soft = 1 - progress(m.t, start, start + m.seconds('base') + m.seconds('tick'), easing.travel);
              const opacity = progress(m.t, start, start + m.seconds('quick'));
              return (
                <Fragment key={wi}>
                  {wi > 0 ? ' ' : null}
                  <span
                    style={{
                      display: 'inline-block',
                      opacity,
                      translate: `0 ${below * BELOW}em`,
                      filter: soft > 0 ? `blur(${soft * vh(SOFT)}px)` : undefined,
                    }}
                  >
                    <Word text={word} />
                  </span>
                </Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
