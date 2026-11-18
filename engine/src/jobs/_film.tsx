// What every scaffolded job shares: the shape of its film.json, the props of its compositions, and how the
// list of jobs becomes Remotion compositions. This file is written by hand. Everything else in this folder
// (index.ts and one folder per job) is written by tools/film/scaffold.mjs; only scenes/*.tsx are yours to edit.
import type { FC } from 'react';
import { Composition, Folder } from 'remotion';
import { z } from 'zod';
import { brandNames } from '../kit/brand';
import { presetNames } from '../kit/motion';
import { stageNames } from '../kit/tokens';

const seconds = z.number();

/** One job's film.json. All times are seconds from the start of the film, taken from the voice. */
export const filmSchema = z.object({
  job: z.string(),
  slug: z.string(),
  fps: z.number(),
  width: z.number(),
  height: z.number(),
  /** The brand's folder name in brands/: job.json "brand", else studio.json "default_brand". */
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  stage: z.enum(stageNames),
  duration: seconds,
  /** The sound file, as a path inside public/. */
  audio: z.string(),
  scenes: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      start: seconds,
      end: seconds,
      energy: z.number(),
      /** The voice lines this scene covers. */
      lines: z.array(z.object({ id: z.string(), start: seconds, end: seconds, text: z.string() })),
      /** On-screen text, ready for <Headline>. `at` and `out` are on the scene's own clock, which starts at 0. */
      texts: z.array(
        z.object({ lines: z.union([z.tuple([z.string()]), z.tuple([z.string(), z.string()])]), at: seconds, out: seconds }),
      ),
      /** The shots of the shot list, each arriving at `at` on the scene's own clock. Older film.json files have none. */
      shots: z
        .array(
          z.object({
            id: z.string(),
            at: seconds,
            size: z.string(),
            /** The capture's file inside the job folder, or null. */
            capture: z.string().nullable(),
            /** The shot's background settings from the shot list, as the job's own background reads them. */
            background: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .default([]),
    }),
  ),
});
export type FilmData = z.infer<typeof filmSchema>;
export type SceneData = FilmData['scenes'][number];

/** Props of every job composition. `only` narrows it to one scene's time range. */
export const filmPropsSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  stage: z.enum(stageNames),
  captions: z.boolean(),
  only: z.string().optional(),
});
export type FilmProps = z.infer<typeof filmPropsSchema>;

export type Job = { film: FilmData; Film: FC<FilmProps> };

export const readFilm = (json: unknown): FilmData => filmSchema.parse(json);

export const sceneOf = (film: FilmData, id: string): SceneData => {
  const scene = film.scenes.find((s) => s.id === id);
  if (!scene) throw new Error(`The film "${film.slug}" has no scene ${id}. Run tools/film/scaffold.mjs on the job again.`);
  return scene;
};

const toFrame = (film: FilmData, time: number) => Math.round(time * film.fps);

/** Where a scene sits in the film, as <Sequence> props. Scenes are back to back: one ends on the frame the next starts. */
export const sceneSpan = (film: FilmData, id: string) => {
  const scene = sceneOf(film, id);
  const from = toFrame(film, scene.start);
  return { name: `${scene.id} ${scene.title}`, from, durationInFrames: toFrame(film, scene.end) - from };
};

/** The frames a composition shows: the whole film, or only one scene of it. */
export const filmSpan = (film: FilmData, only?: string) =>
  only ? sceneSpan(film, only) : { from: 0, durationInFrames: toFrame(film, film.duration) };

/** A composition named <slug> for each job's film, and one named <slug>-<scene id> for each of its scenes. */
export const JobCompositions: FC<{ jobs: Job[] }> = ({ jobs }) => (
  <>
    {jobs.map(({ film, Film }) => {
      const frame = { component: Film, schema: filmPropsSchema, width: film.width, height: film.height, fps: film.fps };
      const props = { brand: film.brand, preset: film.preset, stage: film.stage, captions: true };
      return (
        <Folder key={film.slug} name={film.slug}>
          <Composition id={film.slug} {...frame} durationInFrames={filmSpan(film).durationInFrames} defaultProps={props} />
          {film.scenes.map(({ id }) => (
            <Composition
              key={id}
              id={`${film.slug}-${id}`}
              {...frame}
              durationInFrames={filmSpan(film, id).durationInFrames}
              defaultProps={{ ...props, only: id }}
            />
          ))}
        </Folder>
      );
    })}
  </>
);
