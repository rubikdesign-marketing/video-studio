/*
 * S04: The name
 *
 * The brief for this scene, from jobs/2026-11-18-halden-launch/shots.json when the file was first made.
 * Times are film time and were right on that day: the live ones are in ../film.json and reach
 * this scene as the `scene` prop, so the scene keeps up when the voice is re-timed.
 *
 *   Time           9.00 to 12.00 s (3.00 s long)
 *   Energy         2 of 5
 *   Transition in  2 (container transform)
 *   Hand-off       none
 *
 * Voice
 *   None, this is a silent scene that holds for 3.00 s after the sound has ended.
 *
 * Shot 1 (F05), from 9.30 s
 *   On-screen text Halden *Bakehouse*
 *   Shot size      abstract
 *   Shows          no capture
 *   Focal point    centre, the logo
 *   Move           logo and name settle, hold to the end
 *   Sound          room tone fades
 */
// Close: the wordmark settles and holds to the last frame, with the new hours under it.
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { Label, Wordmark, useVh } from '../../../kit/ui';
import type { SceneData } from '../../_film';

export const S04: FC<{ scene: SceneData }> = ({ scene }) => {
  const vh = useVh();
  const [cue] = scene.texts;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: vh(4) }}>
      <Wordmark at={cue.at} height={11} />
      <Label at={cue.at + 0.35} size={3.2}>{scene.shots[0]?.label ?? ''}</Label>
    </AbsoluteFill>
  );
};
