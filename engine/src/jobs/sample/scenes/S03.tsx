/*
 * S03: One scene at a time
 *
 * The brief for this scene, from jobs/_sample/shots.json when the file was first made.
 * Times are film time and were right on that day: the live ones are in ../film.json and reach
 * this scene as the `scene` prop, so the scene keeps up when the voice is re-timed.
 *
 *   Time           8.60 to 12.20 s (3.60 s long)
 *   Energy         5 of 5
 *   Transition in  5 (match cut)
 *   Hand-off       the last dot matches the wordmark tile
 *
 * Voice
 *   03  8.90-11.20 Change one scene, and render it alone.
 *
 * Shot 1, from 8.90 s
 *   On-screen text Change *one* scene.
 *   Shot size      wide
 *   Shows          no capture
 *   Focal point    centre
 *   Move           text rises, wordmark settles under it
 *   Sound          third beep, hit on the cut
 */
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { Headline, Label, useVh } from '../../../kit/ui';
import type { SceneData } from '../../_film';

const centred = { alignItems: 'center', justifyContent: 'center' } as const;

// A placeholder: only the on-screen text, at its cue. Build the scene here from the kit (engine/README.md).
// Cues are seconds on the scene's own clock. Take them from `scene`, never as typed-in numbers.
export const S03: FC<{ scene: SceneData }> = ({ scene }) => {
  const vh = useVh();
  return (
    <>
      <AbsoluteFill style={{ ...centred, justifyContent: 'flex-start', paddingTop: vh(9) }}>
        <Label>Draft of {scene.title}</Label>
      </AbsoluteFill>
      {scene.texts.map((text, i) => (
        <AbsoluteFill key={i} style={centred}>
          <Headline lines={text.lines} at={text.at} out={text.out} />
        </AbsoluteFill>
      ))}
    </>
  );
};
