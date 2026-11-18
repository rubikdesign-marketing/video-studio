// Split screen: before and after at once. Two halves slide to meet, and the hook line sits on a plate across the seam.
import type { CSSProperties, FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, lerp, progress, useMotion } from '../motion';
import { voiceStyle } from '../moves/core';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { Centred, HookText, Opener, useHookLayout, type OpenerProps } from './core';

/**
 * Two halves of the frame, the "before" in the stage's soft fill and the "after" in the accent colour, already
 * sliding when the film starts (the seam travels from 62% to 50%). Side by side in a wide frame, one above the
 * other in a tall or square one. The hook line sits on a solid plate over the seam so it reads against either half.
 * Sound: a soft whoosh as the seam moves, an impact as the plate settles.
 * Props: `line`, `before`, `after` (the two states, a few words each), `at`, `out`, `next`, `size`.
 */
export const SplitScreen: FC<OpenerProps & { line: string; before?: string; after?: string }> = ({ line, before = 'Rebuilt by hand', after = 'Ready on Monday', at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const brand = useBrand();
  const { width, height } = useVideoConfig();
  const t = m.t - at;
  const tall = height >= width * 0.99;
  const short = Math.min(width, height);
  const layout = useHookLayout(line, { size, share: tall ? 0.76 : 0.7, maxLines: tall ? 4 : 3 });
  const seam = lerp(0.62, 0.5, progress(t, 0, m.seconds('scene') * 1.2, easing.arrive));
  const plate = m.settle(at + 0.1, 'base');
  const pad = layout.size * 0.42;
  const label = (text: string, colour: string, place: CSSProperties) => (
    <div style={{ position: 'absolute', ...voiceStyle(brand.fonts.label, short * 0.07), color: colour, whiteSpace: 'pre', ...place }}>{text}</div>
  );
  const edge = short * 0.06;
  const slab = (colour: string): CSSProperties => ({ position: 'absolute', background: colour });
  return (
    <Opener out={out} next={next} style={style}>
      {tall ? (
        <>
          <div style={{ ...slab(stage.soft), left: 0, right: 0, top: 0, height: height * seam }} />
          <div style={{ ...slab(stage.accent), left: 0, right: 0, top: height * seam, bottom: 0 }} />
          {label(before, stage.ink, { left: edge, top: edge })}
          {label(after, stage.onAccent, { right: edge, bottom: edge })}
        </>
      ) : (
        <>
          <div style={{ ...slab(stage.soft), top: 0, bottom: 0, left: 0, width: width * seam }} />
          <div style={{ ...slab(stage.accent), top: 0, bottom: 0, left: width * seam, right: 0 }} />
          {label(before, stage.ink, { left: edge, top: edge })}
          {label(after, stage.onAccent, { right: edge, bottom: edge })}
        </>
      )}
      <Centred>
        <div
          style={{
            background: stage.page,
            padding: pad,
            borderRadius: (height * brand.shape.window) / 100,
            boxShadow: `0 0 0 1px ${stage.line}, 0 ${short * 0.02}px ${short * 0.06}px ${alpha(stage.shade, 0.3)}`,
            scale: String(lerp(0.9, 1, plate)),
            opacity: Math.min(1, 0.4 + plate),
          }}
        >
          <HookText layout={layout} />
        </div>
      </Centred>
    </Opener>
  );
};
