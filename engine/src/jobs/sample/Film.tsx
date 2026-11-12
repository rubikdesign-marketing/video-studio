// Written by tools/film/scaffold.mjs from jobs/_sample, and rewritten on every run. Do not edit: build scenes in scenes/.
import type { FC } from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';
import captionsJson from '../../../public/jobs/sample/captions.json';
import { BrandProvider } from '../../kit/brand';
import { Captions, captionsSchema } from '../../kit/Captions';
import { MotionProvider } from '../../kit/motion';
import { Stage } from '../../kit/ui';
import { filmSpan, readFilm, sceneOf, sceneSpan, type FilmProps, type Job } from '../_film';
import filmJson from './film.json';
import { S01 } from './scenes/S01';
import { S02 } from './scenes/S02';
import { S03 } from './scenes/S03';

const film = readFilm(filmJson);
const captions = captionsSchema.parse(captionsJson);

// The whole film, in the job's brand. With `only`, the composition shows just that scene's time range: the film is
// slid back so the scene starts on frame 0, which keeps the stage, the sound and the captions exactly as in the full film.
const Film: FC<FilmProps> = ({ brand, preset, stage, captions: showCaptions, only }) => (
  <Sequence from={-filmSpan(film, only).from} layout="none">
    <BrandProvider brand={brand}>
      <MotionProvider preset={preset}>
        <Stage name={stage}>
          <Sequence {...sceneSpan(film, 'S01')}>
            <S01 scene={sceneOf(film, 'S01')} />
          </Sequence>
          <Sequence {...sceneSpan(film, 'S02')}>
            <S02 scene={sceneOf(film, 'S02')} />
          </Sequence>
          <Sequence {...sceneSpan(film, 'S03')}>
            <S03 scene={sceneOf(film, 'S03')} />
          </Sequence>
        </Stage>
        <Html5Audio src={staticFile(film.audio)} />
        <Captions data={captions} enabled={showCaptions} />
      </MotionProvider>
    </BrandProvider>
  </Sequence>
);

export const job: Job = { film, Film };
