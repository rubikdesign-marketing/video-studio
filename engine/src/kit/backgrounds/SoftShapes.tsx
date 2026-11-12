// Soft shapes: three large shapes in the brand's soft fill, its accent and a tone between the two, out of focus
// and drifting at the corners of the frame: a circle, a rounded square and a long pill. They share one layer and a single blur,
// light enough that each still reads as a shape.
import type { FC } from 'react';
import { alpha } from '../tokens';
import { Fill, mix, px, useBackdrop, type TreatmentProps } from './shared';

export const SoftShapes: FC<TreatmentProps> = ({ energy = 'rest', seed = 1, over = false }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height, vh } = b;
  /** A shape's place: its rest position as shares of the frame, its tilt in degrees, and the wander numbered `i`. */
  const place = (i: number, x: number, y: number, tilt: number) =>
    `translate(${width * x + b.drift(i * 3, 9)} ${height * y + b.drift(i * 3 + 1, 7)}) rotate(${tilt + 6 * b.sway(i * 3 + 2) * b.reach})`;
  return (
    <Fill colour={over ? undefined : stage.page}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: `blur(${px(vh(2.6))})` }}>
        <circle transform={place(0, 0.1, 0.14, 0)} r={vh(34)} fill={alpha(stage.soft, dark ? 0.75 : 0.9)} />
        <rect transform={place(1, 0.9, 0.88, -14)} x={-vh(23)} y={-vh(23)} width={vh(46)} height={vh(46)} rx={vh(9)} fill={alpha(stage.accent, dark ? 0.2 : 0.12)} />
        <rect transform={place(2, 0.85, 0.1, 24)} x={-vh(27)} y={-vh(8.5)} width={vh(54)} height={vh(17)} rx={vh(8.5)} fill={alpha(mix(stage.soft, stage.accent, 0.4), dark ? 0.4 : 0.3)} />
      </svg>
    </Fill>
  );
};
