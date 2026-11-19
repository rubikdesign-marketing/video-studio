/*
 * S02: The new time
 *
 * The brief for this scene, from jobs/2026-11-18-halden-launch/shots.json when the file was first made.
 * Times are film time and were right on that day: the live ones are in ../film.json and reach
 * this scene as the `scene` prop, so the scene keeps up when the voice is re-timed.
 *
 *   Time           2.60 to 5.80 s (3.20 s long)
 *   Energy         3 of 5
 *   Transition in  1 (hand-off object)
 *   Hand-off       the word before slides into the clock
 *
 * Voice
 *   None, this is a silent scene that holds for 3.20 s after the sound has ended.
 *
 * Shot 1 (F02), from 2.90 s
 *   On-screen text Doors open / at *6:30*.
 *   Shot size      medium
 *   Shows          no capture
 *   Focal point    centre, the time
 *   Move           the time lands and holds
 *   Sound          a low warm tick as 6:30 lands
 */
// Proof: the new time rises out of a mask and holds, large, so 6:30 reads at phone size.
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { Label, useVh } from '../../../kit/ui';
import { MaskRise } from '../../../kit/type';
import type { SceneData } from '../../_film';

export const S02: FC<{ scene: SceneData }> = ({ scene }) => {
  const vh = useVh();
  const [cue] = scene.texts;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: vh(3), flexDirection: 'column' }}>
      <Label at={cue.at} out={cue.out} size={2.4}>{scene.shots[0]?.label ?? ''}</Label>
      <MaskRise lines={cue.lines} at={cue.at + 0.15} out={cue.out} size={12} />
    </AbsoluteFill>
  );
};
