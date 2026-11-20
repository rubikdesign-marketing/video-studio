// Hand-written, in the pattern of ../ugc-01/Film.tsx (that one is written by tools/film/scaffold.mjs; this job has one scene and no voice, so it is kept by hand).
import type { FC } from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';
import { BrandProvider } from '../../kit/brand';
import { MotionProvider } from '../../kit/motion';
import { Stage } from '../../kit/ui';
import { filmSpan, readFilm, sceneOf, sceneSpan, type FilmProps, type Job } from '../_film';
import filmJson from './film.json';
import { S01 } from './scenes/S01';

const film = readFilm(filmJson);

const Film: FC<FilmProps> = ({ brand, preset, stage, only }) => (
  <Sequence from={-filmSpan(film, only).from} layout="none">
    <BrandProvider brand={brand}>
      <MotionProvider preset={preset}>
        <Stage name={stage}>
          <Sequence {...sceneSpan(film, 'S01')}>
            <S01 scene={sceneOf(film, 'S01')} />
          </Sequence>
        </Stage>
        <Html5Audio src={staticFile(film.audio)} />
      </MotionProvider>
    </BrandProvider>
  </Sequence>
);

export const job: Job = { film, Film };
