// Mark word: a straight, crisp mark drawn round or through chosen words: a box, brackets, a strike or an
// underline, in the accent colour. Geometric, unlike the hand-drawn mark (DrawnMark).
import type { FC } from 'react';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useStage, useVh } from '../ui';
import { asLines, type TextMoveProps } from './core';
import { EmphasisText, useAnalysis, type Fx, type Mark, type Run } from './emphasis';

/** Room the line opens either side of the marked words, in em, so the mark clears its neighbours. */
const PAD = 0.16;

export type MarkKind = 'box' | 'bracket' | 'strike' | 'underline';

/**
 * Draws a clean accent line with `stroke-dash` on the chosen words (`mark`) at `at`: `kind` "box" round them,
 * "bracket" a square bracket each side, "strike" through them, "underline" under them. The stroke is `weight`
 * per cent of frame height thick. It draws over a `scene` length (a `base` length for a bracket or a line) and,
 * at `out`, draws back off the way it came, faster.
 */
export const MarkWord: FC<TextMoveProps & { mark?: Mark; kind?: MarkKind; weight?: number }> = ({ lines, at, out, size = 8, align = 'center', colours, style, mark, kind = 'box', weight = 0.5 }) => {
  const m = useMotion();
  const stage = useStage();
  const vh = useVh();
  const ls = asLines(lines);
  const data = useAnalysis(ls, mark);
  const length = m.seconds(kind === 'box' ? 'scene' : 'base');
  const drawn = progress(m.t, at, at + length, easing.travel);
  const gone = out === undefined ? 0 : progress(m.t, out, out + length * EXIT_SHARE, easing.leave);
  const shown = drawn - gone;
  const overlay = (run: Run, fx: Fx) => {
    if (drawn <= 0 || shown <= 0) return null;
    const w = fx.runWidth(run);
    const h = fx.lineHeight;
    const stroke = vh(weight);
    const padX = PAD * fx.fontSize;
    const padY = 0.04 * fx.fontSize;
    const x0 = 0;
    const x1 = w + padX * 2;
    const top = -padY + 0.04 * h;
    const bottom = h + padY - 0.04 * h;
    const mid = h * 0.56;
    const arm = Math.min(0.24 * fx.fontSize, (bottom - top) * 0.22);
    // `pathLength` 1 makes the dash a share of the path, so one number draws it.
    const common = { fill: 'none', stroke: stage.accent, strokeWidth: stroke, strokeLinejoin: 'miter' as const, strokeLinecap: 'butt' as const, pathLength: 1 };
    const dash = (u: number) => ({ strokeDasharray: '1 1', strokeDashoffset: 1 - u });
    let paths;
    if (kind === 'box') {
      paths = <path d={`M ${x0} ${top} H ${x1} V ${bottom} H ${x0} Z`} {...common} {...dash(shown)} />;
    } else if (kind === 'bracket') {
      paths = (
        <>
          <path d={`M ${x0 + arm} ${top} H ${x0} V ${bottom} H ${x0 + arm}`} {...common} {...dash(shown)} />
          <path d={`M ${x1 - arm} ${top} H ${x1} V ${bottom} H ${x1 - arm}`} {...common} {...dash(shown)} />
        </>
      );
    } else if (kind === 'strike') {
      paths = <path d={`M ${x0} ${mid} H ${x1}`} {...common} {...dash(shown)} />;
    } else {
      paths = <path d={`M ${x0} ${bottom} H ${x1}`} {...common} {...dash(shown)} />;
    }
    return (
      <svg
        viewBox={`${x0} ${top} ${x1 - x0} ${bottom - top}`}
        width={x1 - x0}
        height={bottom - top}
        style={{ position: 'absolute', left: x0, top, overflow: 'visible', pointerEvents: 'none' }}
      >
        {paths}
      </svg>
    );
  };
  return <EmphasisText lines={ls} size={size} align={align} colours={colours} style={style} mark={mark} analysis={data} overlay={overlay} pad={PAD} />;
};
