/*
 * S03: Proof (hand-built). The board held, the camera settling on its title; a ring lands on "Campaign Launch Board"
 * (events.ring) and one caption names only what is on screen. The pointer from the demo fades out as the camera moves.
 */
import type { FC } from 'react';
import { AbsoluteFill, interpolate } from 'remotion';
import type { SceneData } from '../../_film';
import { RecBadge } from '../../../kit/ugc';
import { camAt, events as e, PageOutline, PagePointer, UgcCaptions, useFilmTime, Window, WIN } from '../ugc';
import { S02_KEYS } from './S02';

const END = S02_KEYS[S02_KEYS.length - 1];
// Starts exactly where the demo's camera ended (a motion-matched cut), then settles on the title.
const KEYS: [number, number, number, number][] = [[e.cutProof, END[1], END[2], END[3]], [10.2, 640, 495, 2.6], [13.0, 640, 495, 2.8]];

/** The board window with its ring, pointer and REC badge at film time `t`. S04 draws it again under the light wipe, so 13.0 s is a wipe over the product, not a cut to an empty stage. `sceneStart` is the film time of the scene that draws it. */
export const ProofBoard: FC<{ t: number; sceneStart: number }> = ({ t, sceneStart }) => {
  const cam = camAt(KEYS, t);
  const fade = interpolate(t, [e.cutProof, e.cutProof + 0.5], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Window src="jobs/ugc-01/graded/demo-3.png" cam={cam}>
      <PageOutline cam={cam} rect={[365, 16, 152, 20]} t={t} at={e.ring} grow={0.25} />
      <PagePointer cam={cam} x={1848} y={97} opacity={fade} />
      {/* the recording that began in the demo (REC at 2.6 s) is still running: no new entrance, the timer carries on (the badge reads the scene clock, so a later scene adds its offset) */}
      <RecBadge at={-1} timerFrom={e.cutProof - 2.6 - 1 + (sceneStart - 9)} width={WIN.w} height={WIN.h} x={0.05} y={0.07} size={3.4} />
    </Window>
  );
};

export const S03: FC<{ scene: SceneData }> = ({ scene }) => {
  const t = useFilmTime(scene);
  return (
    <AbsoluteFill>
      <ProofBoard t={t} sceneStart={scene.start} />
      <UgcCaptions t={t} />
    </AbsoluteFill>
  );
};
