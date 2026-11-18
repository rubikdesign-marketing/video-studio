// Notification drop: a large phone-style notification drops in carrying the hook line, with two older ones behind it.
// The viewer's own world, used as the pattern interrupt.
import type { CSSProperties, FC } from 'react';
import { Img, staticFile, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { lerp, useMotion } from '../motion';
import { MotionBlur, useTravel, voiceStyle } from '../moves/core';
import { alpha } from '../tokens';
import { useStage } from '../ui';
import { Centred, HookText, Opener, useHookLayout, type OpenerProps } from './core';

/**
 * The notification (88% of the frame's width, the brand's soft fill) is already half in when the film starts,
 * drops to the middle of the frame with the preset's small overshoot, then buzzes sideways for a moment as a phone
 * does. Two older notifications sit behind it. Its header names the app (`app`, the brand's name by default).
 * Sound: a notification chime or pop on the landing, a soft buzz under the wiggle.
 * Props: `line`, `app`, `when` (the time stamp), `at`, `out`, `next`, `size`.
 */
export const NotificationDrop: FC<OpenerProps & { line: string; app?: string; when?: string }> = ({ line, app, when = 'now', at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const brand = useBrand();
  const travel = useTravel();
  const { width, height } = useVideoConfig();
  const t = m.t - at;
  const short = Math.min(width, height);
  const toastW = Math.min(width * 0.88, short * 1.35);
  const pad = toastW * 0.05;
  const layout = useHookLayout(line, { size, share: (toastW - pad * 2) / width, maxLines: height > width ? 4 : 3 });
  const radius = (short * brand.shape.window) / 100;
  const head = short * 0.04;
  const toastH = layout.height + pad * 2 + head * 2.4;
  const rest = (height - toastH) / 2;
  const start = -toastH * 0.45 - rest;
  const dropAt = (time: number) => {
    const u = Math.max(0, Math.min(1, (time - at) / m.seconds('scene')));
    return 1 - (1 - u) ** 3;
  };
  const landed = m.seconds('scene');
  const since = t - landed;
  const buzz = since > 0 && since < 0.3 ? Math.sin(since * 120) * (1 - since / 0.3) * width * 0.006 : 0;
  const y = lerp(start, 0, Math.min(1.04, m.settle(at, 'scene')));
  const surface = (extra: CSSProperties) => ({
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    height: toastH,
    borderRadius: radius,
    background: stage.soft,
    boxShadow: `0 0 0 1px ${stage.line}, 0 ${short * 0.015}px ${short * 0.05}px ${alpha(stage.shade, 0.28)}`,
    ...extra,
  });
  return (
    <Opener out={out} next={next} style={style}>
      <Centred>
        <MotionBlur y={travel((time) => lerp(start, 0, dropAt(time)))}>
          <div style={{ position: 'relative', width: toastW, height: toastH, translate: `${buzz}px ${y}px` }}>
            <div style={surface({ scale: '0.88', translate: `0 ${-toastH * 0.2}px`, opacity: 0.6 })} />
            <div style={surface({ scale: '0.94', translate: `0 ${-toastH * 0.1}px`, opacity: 0.85 })} />
            <div style={surface({ padding: pad, boxSizing: 'border-box' })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: head * 0.6, marginBottom: head * 0.5 }}>
                <div style={{ width: head * 1.4, height: head * 1.4, borderRadius: head * 0.4, background: stage.page, boxShadow: `0 0 0 1px ${stage.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Img src={staticFile(stage.mark)} style={{ height: head * 0.9 }} />
                </div>
                <div style={{ ...voiceStyle(brand.fonts.label, head), color: stage.second, whiteSpace: 'pre' }}>{`${app ?? brand.name}   ${when}`}</div>
              </div>
              <HookText layout={layout} align="left" />
            </div>
          </div>
        </MotionBlur>
      </Centred>
    </Opener>
  );
};
