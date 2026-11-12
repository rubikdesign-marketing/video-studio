// A preview aid, never part of a master: where Instagram, TikTok and YouTube Shorts draw their own buttons and
// captions over a 9:16 film (relayout.ts, PLATFORM_ZONES), and the band all three leave free. Mount it only in
// preview compositions (the library's re-layout previews, Remotion Studio); film compositions never import it, and
// tools/checks/capture_relayout.mjs checks the same zones by numbers.
import type { FC } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { voiceStyle } from '../moves/core';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import { PLATFORM_ZONES, sizedLayout, zonesFor, type PlatformName } from './relayout';

export const SafeAreaOverlay: FC<{ platform: PlatformName | 'all'; captions?: boolean; label?: boolean }> = ({ platform, captions = true, label = true }) => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const names: PlatformName[] = platform === 'all' ? ['instagram', 'tiktok', 'shorts'] : [platform];
  const layout = sizedLayout(W, H, { captions });
  const ink = '#E5484D';
  const hatch = `repeating-linear-gradient(135deg, ${alpha(ink, 0.2)} 0 ${vh(0.5)}px, ${alpha(ink, 0.06)} ${vh(0.5)}px ${vh(1)}px)`;
  const text = { color: '#FFFFFF', ...voiceStyle(brand.fonts.label, vh(1.25)) };
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {names.flatMap((name) =>
        zonesFor(name, W, H).map((z, i) => (
          <div key={`${name}-${i}`} style={{ position: 'absolute', left: z.rect.x, top: z.rect.y, width: z.rect.width, height: z.rect.height, background: hatch, boxShadow: `inset 0 0 0 1px ${alpha(ink, 0.55)}` }} />
        )),
      )}
      <div style={{ position: 'absolute', left: layout.band.x, top: layout.band.y, width: layout.band.width, height: layout.band.height, boxShadow: `inset 0 0 0 ${vh(0.15)}px ${alpha(stage.accent, 0.9)}` }} />
      {layout.captions ? (
        <div style={{ position: 'absolute', left: layout.captions.x, top: layout.captions.y, width: layout.captions.width, height: layout.captions.height, border: `${vh(0.12)}px dashed ${alpha(stage.accent, 0.8)}`, borderRadius: layout.captions.height / 2 }} />
      ) : null}
      {label ? (
        <div style={{ position: 'absolute', left: layout.band.x, top: layout.band.y - vh(2.4), padding: `${vh(0.3)}px ${vh(0.8)}px`, borderRadius: vh(brand.shape.pill), background: alpha(ink, 0.85), ...text }}>
          {platform === 'all' ? 'Safe for Instagram, TikTok and Shorts' : `${PLATFORM_ZONES[platform].label} buttons and captions`}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
