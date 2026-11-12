/*
 * S02: Picture follows sound
 *
 * The brief for this scene, from jobs/_sample/shots.json when the file was first made.
 * Times are film time and were right on that day: the live ones are in ../film.json and reach
 * this scene as the `scene` prop, so the scene keeps up when the voice is re-timed.
 *
 *   Time           3.50 to 8.60 s (5.10 s long)
 *   Energy         4 of 5
 *   Transition in  1 (hand-off object)
 *   Hand-off       the full stop of the headline becomes the first beep's dot
 *
 * Voice
 *   02  3.80-8.20  Three beeps stand in for three voice lines, so the picture can be fitted to the sound.
 *
 * Shot 1, from 3.80 s
 *   On-screen text Three beeps.
 *   Shot size      medium
 *   Shows          no capture
 *   Focal point    left third
 *   Move           three dots pop in, one per beat
 *   Sound          second beep
 *
 * Shot 2, from 6.20 s
 *   On-screen text Picture fitted / to the *sound*.
 *   Shot size      macro
 *   Shows          no capture
 *   Focal point    centre
 *   Move           push in on the dots, then hold
 *   Sound          low swell into the hold
 */
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { Headline, Label, useVh } from '../../../kit/ui';
import type { SceneData } from '../../_film';

const centred = { alignItems: 'center', justifyContent: 'center' } as const;

// A placeholder: only the on-screen text, at its cue. Build the scene here from the kit (engine/README.md).
// Cues are seconds on the scene's own clock. Take them from `scene`, never as typed-in numbers.
export const S02: FC<{ scene: SceneData }> = ({ scene }) => {
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
