/*
 * S04: Offer and logo (hand-built). A wipe from the bottom to the light stage at events.ctaWipe, the offer line
 * "Try it today" at events.offer, the wordmark at events.logo.
 */
import type { FC } from 'react';
import { AbsoluteFill, Easing, interpolate, useVideoConfig } from 'remotion';
import { useBrand } from '../../../kit/brand';
import { Panel, useStage, Wordmark } from '../../../kit/ui';
import type { SceneData } from '../../_film';
import { events as e, useFilmTime } from '../ugc';
import { ProofBoard } from './S03';

const ease = Easing.bezier(0.22, 1, 0.36, 1);

const Offer: FC<{ t: number }> = ({ t }) => {
  const stage = useStage();
  const { fonts } = useBrand();
  const u = interpolate(t, [e.offer - 1 / 30, e.offer + 0.3], [0, 1], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ fontFamily: fonts.headline.css, fontWeight: 700, fontSize: 170, lineHeight: 1, color: stage.ink, opacity: u, translate: `0 ${(1 - u) * 36}px`, textAlign: 'center', letterSpacing: -4 }}>
      Try it <span style={{ color: stage.accent }}>today</span>
    </div>
  );
};

export const S04: FC<{ scene: SceneData }> = ({ scene }) => {
  const t = useFilmTime(scene);
  const { height } = useVideoConfig();
  const wipe = interpolate(t, [e.ctaWipe, e.ctaWipe + 0.4], [100, 0], { easing: Easing.bezier(0.4, 0, 0.2, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      {/* the board stays on screen until the wipe covers it */}
      <ProofBoard t={t} sceneStart={scene.start} />
      <Panel name="light" style={{ position: 'absolute', inset: 0, clipPath: `inset(${wipe}% 0 0 0)` }}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: height * 0.05 }}>
          <Offer t={t} />
          <Wordmark at={e.logo - 1 / 30 - scene.start} height={7} style={{ filter: 'brightness(1.07)' }} />
        </AbsoluteFill>
      </Panel>
    </AbsoluteFill>
  );
};
