/*
 * S01: What this is
 *
 * The brief for this scene, from jobs/_sample/shots.json when the file was first made.
 * Times are film time and were right on that day: the live ones are in ../film.json and reach
 * this scene as the `scene` prop, so the scene keeps up when the voice is re-timed.
 *
 *   Time           0.00 to 3.50 s (3.50 s long)
 *   Energy         3 of 5
 *   Transition in  none (first scene)
 *   Hand-off       none
 *
 * Voice
 *   01  0.30-3.10  This is the sample film for the Toolvo video studio.
 *
 * Shot 1, from 0.30 s
 *   On-screen text A *sample* film.
 *   Shot size      abstract
 *   Shows          no capture
 *   Focal point    centre
 *   Move           words rise, slow drift left
 *   Sound          first beep
 */
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { Headline, Label, useVh } from '../../../kit/ui';
import type { SceneData } from '../../_film';

const centred = { alignItems: 'center', justifyContent: 'center' } as const;

// A placeholder: only the on-screen text, at its cue. Build the scene here from the kit (engine/README.md).
// Cues are seconds on the scene's own clock. Take them from `scene`, never as typed-in numbers.
export const S01: FC<{ scene: SceneData }> = ({ scene }) => {
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
