import type { Film } from '../contracts/film';

/**
 * The sample job's film, copied from engine/src/jobs/sample/film.json (job `_sample`).
 * Only the fields in the Film contract are kept. The real file also carries `preset`, `audio`,
 * `audio_from`, `planned_instant_changes` and `planned_holds`, which the editor does not read.
 */
export const sampleFilm: Film = {
  job: '_sample',
  slug: 'sample',
  fps: 60,
  width: 1920,
  height: 1080,
  brand: 'tulvo',
  stage: 'dark',
  duration: 12.2,
  scenes: [
    {
      id: 'S01',
      title: 'What this is',
      start: 0,
      end: 3.5,
      energy: 3,
      lines: [{ id: '01', start: 0.3, end: 3.1, text: 'This is the sample film for the Toolvo video studio.' }],
      texts: [{ lines: ['A *sample* film.'], at: 0.3, out: 3.15 }],
    },
    {
      id: 'S02',
      title: 'Picture follows sound',
      start: 3.5,
      end: 8.6,
      energy: 4,
      lines: [
        {
          id: '02',
          start: 3.8,
          end: 8.2,
          text: 'Three beeps stand in for three voice lines, so the picture can be fitted to the sound.',
        },
      ],
      texts: [
        { lines: ['Three beeps.'], at: 0.3, out: 2.35 },
        { lines: ['Picture fitted', 'to the *sound*.'], at: 2.7, out: 4.75 },
      ],
    },
    {
      id: 'S03',
      title: 'One scene at a time',
      start: 8.6,
      end: 12.2,
      energy: 5,
      lines: [{ id: '03', start: 8.9, end: 11.2, text: 'Change one scene, and render it alone.' }],
      texts: [{ lines: ['Change *one* scene.'], at: 0.3, out: 3.25 }],
    },
  ],
};
