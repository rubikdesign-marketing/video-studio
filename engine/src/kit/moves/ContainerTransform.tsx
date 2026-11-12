// Container transform: a small element grows to become the whole frame, its content appearing in the last third
// of the move. Reversed, the whole frame shrinks back into the small element.
import type { FC, ReactNode } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { clamp01, easing, lerp, progress, useMotion } from '../motion';
import { alpha, type StageName } from '../tokens';
import { Panel, useStage, useVh } from '../ui';
import type { Rect } from './core';

/** The share of the move after which the full-frame content shows, and before which the small face has gone. */
const THIRD = 1 / 3;

/**
 * A card at `from` (pixels in the frame) painted in one of the brand's pages. At `at` it grows over a `scene`
 * length until it is the frame. `card` is what the small element shows (a label, a logo); it goes in the first
 * third. The children are the full-frame scene; they are laid out at full size from the start and appear in the
 * last third, so nothing is ever stretched. With `reverse`, the frame is full until `at` and then shrinks to the
 * card. Do not use it twice in a row.
 */
export const ContainerTransform: FC<{
  children: ReactNode;
  from: Rect;
  at: number;
  page: StageName;
  card?: ReactNode;
  reverse?: boolean;
  radius?: number;
}> = ({ children, from, at, page, card, reverse = false, radius }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const { width, height } = useVideoConfig();
  const moved = progress(m.t, at, at + m.seconds('scene'), easing.travel);
  const open = reverse ? 1 - moved : moved;
  // The container is a window cut into a full-frame panel. Its edges move between pixels, and what is inside never moves.
  const edges = [from.y, width - from.x - from.width, height - from.y - from.height, from.x].map((edge) => `${lerp(edge, 0, open)}px`);
  const round = lerp(vh(radius ?? brand.shape.window), 0, open);
  const shadow = `drop-shadow(0 ${vh(2)}px ${vh(4)}px ${alpha(stage.shade, 0.3 * (1 - open))})`;
  return (
    <AbsoluteFill style={{ filter: open < 1 ? shadow : undefined }}>
      <Panel name={page} style={{ position: 'absolute', inset: 0, clipPath: open < 1 ? `inset(${edges.join(' ')} round ${round}px)` : undefined }}>
        <AbsoluteFill style={{ opacity: clamp01((open - (1 - THIRD)) / THIRD) }}>{children}</AbsoluteFill>
        <div
          style={{
            position: 'absolute',
            left: from.x,
            top: from.y,
            width: from.width,
            height: from.height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 1 - clamp01(open / THIRD),
          }}
        >
          {card}
        </div>
      </Panel>
    </AbsoluteFill>
  );
};
