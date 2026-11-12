// Tracking settle: the letters of a line start a little wider and close up. For openings and closings.
import type { CSSProperties, FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useStage, useVh } from '../ui';
import { em, voiceStyle } from './core';

/** How much wider the letters start: 6 to 8% of the type size. */
const WIDER = 0.07;

/**
 * One line of film type whose letters close up to the brand's own tracking over a `scene` length. The glyphs are
 * never scaled: only the space between them changes, and the line stays centred on its place while it does.
 * The line is fully there within a `quick` length, so the closing is watched and not hidden inside the fade; the
 * letters set off from rest and slow into the brand's tracking.
 */
export const TrackingSettle: FC<{
  text: string;
  at: number;
  out?: number;
  size?: number;
  align?: 'left' | 'center';
  style?: CSSProperties;
}> = ({ text, at, out, size = 9, align = 'center', style }) => {
  const m = useMotion();
  const { headline } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  const extra = (1 - progress(m.t, at, at + m.seconds('scene'), easing.travel)) * WIDER;
  const enter = progress(m.t, at, at + m.seconds('quick'));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('base') * EXIT_SHARE, easing.leave);
  return (
    <div
      style={{
        ...voiceStyle(headline, vh(size)),
        color: stage.ink,
        textAlign: align,
        whiteSpace: 'pre',
        // Letters are placed between pixels, so the closing is smooth and not a row of one pixel steps.
        textRendering: 'geometricPrecision',
        opacity: enter * (1 - exit),
        ...style,
      }}
    >
      {/* The margin takes back the space after the last letter, so a centred line stays centred. */}
      <span style={{ letterSpacing: em((headline.tracking ?? 0) + extra), marginRight: em(-extra) }}>{text}</span>
    </div>
  );
};
