/*
 * S03: Order the night before
 *
 * The brief for this scene, from jobs/2026-11-18-halden-launch/shots.json when the file was first made.
 * Times are film time and were right on that day: the live ones are in ../film.json and reach
 * this scene as the `scene` prop, so the scene keeps up when the voice is re-timed.
 *
 *   Time           5.80 to 9.00 s (3.20 s long)
 *   Energy         3 of 5
 *   Transition in  3 (camera carry)
 *   Hand-off       none
 *
 * Voice
 *   None, this is a silent scene that holds for 3.20 s after the sound has ended.
 *
 * Shot 1 (F03), from 6.10 s
 *   On-screen text Order tonight.
 *   Shot size      medium
 *   Shows          no capture
 *   Focal point    upper third
 *   Move           line types on, calm
 *   Sound          paper rustle
 *
 * Shot 2 (F04), from 7.55 s
 *   On-screen text Pick up *warm*.
 *   Shot size      medium
 *   Shows          no capture
 *   Focal point    lower third
 *   Move           second line settles under the first
 *   Sound          soft chime
 */
// Offer: "Order tonight." then "Pick up warm." under it; the first line stays so the two read as one promise.
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { useVh } from '../../../kit/ui';
import { FadeUp } from '../../../kit/type';
import type { SceneData } from '../../_film';

export const S03: FC<{ scene: SceneData }> = ({ scene }) => {
  const vh = useVh();
  const [first, second] = scene.texts;
  const end = second?.out ?? first.out;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: vh(2) }}>
      <FadeUp lines={first.lines} at={first.at} out={end} size={9} by="line" />
      {second ? <FadeUp lines={second.lines} at={second.at} out={second.out} size={9} by="line" /> : null}
    </AbsoluteFill>
  );
};
