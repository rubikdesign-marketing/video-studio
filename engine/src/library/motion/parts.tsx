// Small pieces the gallery scenes are set up with: a line of type, a card, a tile and the caption that names the
// move. They are plain on purpose, so the move is the only thing that moves. Sizes are percentages of frame height.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { useBrand } from '../../kit/brand';
import { useCue, voiceStyle } from '../../kit/moves/core';
import { alpha, type StagePalette } from '../../kit/tokens';
import { Label, useStage, useVh } from '../../kit/ui';

type VoiceName = 'headline' | 'label' | 'product';
type Role = keyof Pick<StagePalette, 'ink' | 'second' | 'accent' | 'onAccent'>;

/** Fades up on `at` and goes on `out`. Without `at` the piece is simply there, for content a transition carries in. */
const useArrival = (at?: number, out?: number): CSSProperties => {
  const vh = useVh();
  const cue = useCue(at ?? 0, out, 'quick');
  if (at === undefined) return { opacity: 1 - cue.exit };
  return { opacity: cue.enter * (1 - cue.exit), translate: `0 ${(1 - cue.settle) * vh(1.2)}px` };
};

/** One line of type in a brand voice. */
export const Line: FC<{
  children: ReactNode;
  at?: number;
  out?: number;
  voice?: VoiceName;
  size?: number;
  colour?: Role;
  style?: CSSProperties;
}> = ({ children, at, out, voice = 'headline', size = 7, colour = 'ink', style }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const arrival = useArrival(at, out);
  return <div style={{ ...voiceStyle(brand.fonts[voice], vh(size)), color: stage[colour], whiteSpace: 'pre', ...arrival, ...style }}>{children}</div>;
};

/** A group that fades up together on `at`. */
export const Arrive: FC<{ children: ReactNode; at: number; out?: number; style?: CSSProperties }> = ({ children, at, out, style }) => (
  <div style={{ ...useArrival(at, out), ...style }}>{children}</div>
);

/** Everything inside sits in the middle of the frame, stacked. */
export const Centre: FC<{ children: ReactNode; gap?: number; style?: CSSProperties }> = ({ children, gap = 4, style }) => {
  const vh = useVh();
  return <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: vh(gap), ...style }}>{children}</AbsoluteFill>;
};

/** Things side by side. */
export const row = (gap: number): CSSProperties => ({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap });

/** A card on the stage: the stage's soft fill, a line border and a soft shadow. `flat` leaves the shadow to a Lift. */
export const Card: FC<{
  children?: ReactNode;
  at?: number;
  out?: number;
  width?: number;
  flat?: boolean;
  style?: CSSProperties;
}> = ({ children, at, out, width, flat = false, style }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const arrival = useArrival(at, out);
  const border = `0 0 0 1px ${stage.line}`;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: vh(1.6),
        boxSizing: 'border-box',
        width: width === undefined ? undefined : vh(width),
        padding: vh(3.4),
        borderRadius: vh(brand.shape.window),
        background: stage.soft,
        boxShadow: flat ? border : `${border}, 0 ${vh(1)}px ${vh(3)}px ${alpha(stage.shade, 0.25)}`,
        ...arrival,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** A card with a short label and one value. */
export const Tile: FC<{ label: string; value: string; at?: number; out?: number; width?: number; flat?: boolean }> = ({
  label,
  value,
  at,
  out,
  width = 34,
  flat,
}) => (
  <Card at={at} out={out} width={width} flat={flat}>
    <Line voice="label" size={2.8} colour="second">
      {label}
    </Line>
    <Line voice="label" size={7.5} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Line>
  </Card>
);

/** The name of the move, bottom left, in sentence case. */
export const MoveCaption: FC<{ children: string }> = ({ children }) => {
  const vh = useVh();
  return (
    <Label size={2.6} style={{ position: 'absolute', left: vh(6), bottom: vh(6) }}>
      {children}
    </Label>
  );
};
