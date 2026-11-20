/*
 * S01: The early riser
 *
 * The brief for this scene, from jobs/2026-11-18-halden-launch/shots.json when the file was first made.
 * Times are film time and were right on that day: the live ones are in ../film.json and reach
 * this scene as the `scene` prop, so the scene keeps up when the voice is re-timed.
 *
 *   Time           0.00 to 2.60 s (2.60 s long)
 *   Energy         2 of 5
 *   Transition in  none (first scene)
 *   Hand-off       none
 *
 * Voice
 *   None, this is a silent scene that holds for 2.60 s after the sound has ended.
 *
 * Shot 1 (F01), from 0.30 s
 *   On-screen text Fresh bread, / *before* work.
 *   Shot size      abstract
 *   Shows          no capture
 *   Focal point    centre
 *   Move           words rise one at a time, slow
 *   Sound          soft room tone
 */
// Hook: two lines fade up word by word, slowly (the reference is liked for its pacing and type).
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { FadeUp } from '../../../kit/type';
import type { SceneData } from '../../_film';

export const S01: FC<{ scene: SceneData }> = ({ scene }) => {
  const [cue] = scene.texts;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <FadeUp lines={cue.lines} at={cue.at} out={cue.out} size={9} />
    </AbsoluteFill>
  );
};
