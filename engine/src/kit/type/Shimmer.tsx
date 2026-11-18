// Shimmer: a band of light passes across the letters once, for the word that should feel premium.
// After Magic UI, "animated shiny text" (MIT).
import type { FC } from 'react';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { isDarkPage, lightOf } from '../moves/core';
import { useStage } from '../ui';
import { asLines, type TextMoveProps } from './core';
import { EmphasisText, mixColour, useAnalysis, type Mark } from './emphasis';

/** Half the band's width as a share of the run it crosses. */
const HALF = 0.2;

/**
 * Sends a band of light through the letters of the chosen words (`mark`; left out, the whole line) once, at `at`,
 * over a `scene` length: the ink turns to a light tone at the middle of the band and back. The tone is the
 * accent warmed toward the brand's lightest ink, so it shows on a light page and on a dark one. It never loops;
 * `out` sends it through a second time, quicker (a closing glint), and the words end as they began.
 */
export const Shimmer: FC<TextMoveProps & { mark?: Mark }> = ({ lines, at, out, size = 8, align = 'center', colours, style, mark }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const ls = asLines(lines);
  const everything = mark === undefined && !ls.some((l) => l.includes('*'));
  const picked: Mark | undefined = everything ? ls.flatMap((l) => l.replace(/\*/g, '').split(' ').filter(Boolean).map((_, i) => i)) : mark;
  const data = useAnalysis(ls, picked);
  const sweep = m.seconds('scene') * 1.4;
  const first = progress(m.t, at, at + sweep, easing.travel);
  const second = out === undefined ? 0 : progress(m.t, out, out + sweep * EXIT_SHARE, easing.travel);
  // 0 to 1 is the band crossing; it starts and ends fully outside the run.
  const pos = (u: number) => -HALF + u * (1 + HALF * 2);
  const light = lightOf(brand);
  const sheen = isDarkPage(stage) ? mixColour(stage.accent, 0.3, light) : mixColour(stage.accent, 0.4, light);
  const word = (e: { from: number; to: number; line: number; run: number }, base: string) => {
    const u = second > 0 && second < 1 ? second : first;
    if (e.run < 0 || u <= 0 || u >= 1) return undefined;
    const width = e.to - e.from;
    const centre = ((pos(u) - e.from) / width) * 100;
    const half = (HALF / width) * 100;
    const background = `linear-gradient(100deg, ${base} ${centre - half}%, ${sheen} ${centre}%, ${base} ${centre + half}%)`;
    return { style: { backgroundImage: background, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' } };
  };
  return (
    <EmphasisText
      lines={ls}
      size={size}
      align={align}
      colours={colours}
      style={style}
      mark={picked}
      analysis={data}
      word={(e, fx) => word(e, fx.lineColour(e.line))}
    />
  );
};
