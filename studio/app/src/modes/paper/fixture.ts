import type { PaperData, PaperWord } from '../../api';

const words = (text: string, start: number): PaperWord[] => text.split(' ').map((t, i) => ({ text: t, start: start + i * 0.4, end: start + i * 0.4 + 0.3 }));

/** A small paper edit for tests: two clips, four sentences, a filler, a long pause, a retake and three opening ideas. */
export function samplePaper(): PaperData {
  const one = [...words('Um, this is the first sentence.', 0.5), ...words('Here is a second one, kind of.', 4)];
  const first = one[0]; const kind = one[11]; const of = one[12];
  if (first) first.filler = 'yes';
  if (kind) kind.filler = 'maybe';
  if (of) of.repeat = true;
  const two = [...words('We make videos quickly.', 0.2), ...words('We make videos very quickly.', 3)];
  return {
    job: { name: 'Sample footage' },
    clips: [
      { name: 'take-1', words: one, sentences: [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11, 12]], duration: 8, video: true },
      { name: 'take-2', words: two, sentences: [[0, 1, 2, 3], [4, 5, 6, 7, 8]], duration: 6, video: false },
    ],
    paper: {
      status: 'draft', target_seconds: 6, note: '', keep_pauses: [], approved_joins: [],
      blocks: [
        { clip: 'take-1', sentence: 0, words: [1, 2, 3, 4, 5] },
        { clip: 'take-1', sentence: 1, words: [6, 7, 8, 9, 10, 11, 12] },
        { clip: 'take-2', sentence: 0, words: [] },
        { clip: 'take-2', sentence: 1, words: [4, 5, 6, 7, 8] },
      ],
      proposals: {
        hooks: [
          { clip: 'take-2', sentence: 1, text: 'We make videos very quickly.', reasons: ['short', 'says what it is'] },
          { clip: 'take-2', sentence: 0, text: 'We make videos quickly.', reasons: [] },
          { clip: 'take-1', sentence: 0, text: 'Um, this is the first sentence.', reasons: ['first thing said'] },
        ],
        retakes: [{ clip: 'take-2', takes: [0, 1], keep: 1 }],
        pauses: [{ clip: 'take-1', after: 5, seconds: 1.2, to: 0.5 }],
      },
    },
    check: {
      seconds: 7.4,
      runs: [{ clip: 'take-1', start: 0.82, end: 6.4 }, { clip: 'take-2', start: 2.92, end: 5 }],
      joins: [{ key: 'take-1:12>take-2:4', after: 'take-1:12', kind: 'moved', flagged: false, reasons: [], approved: true }],
    },
  };
}
/** The same edit with one join the tool wants a person to look at. */
export const flaggedJoin = { key: 'take-1:8>take-1:10', after: 'take-1:8', kind: 'inside a sentence', flagged: true, reasons: ['joins words said apart inside a sentence', 'drops "one"'], approved: false };
