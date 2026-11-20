import { describe, expect, it } from 'vitest';
import type { SnapPoint } from '../contracts/store';
import { sampleFilm } from '../fixtures/sample-film';
import { dragCue, MIN_CUE, snap, SNAP_ORDER, snapPoints } from './snap';

const note = { localId: 'n', time: 6.4, kind: 'change' as const, topic: null, must: false, text: '', box: null };

describe('snap', () => {
  it('snaps to every kind of point', () => {
    for (const source of SNAP_ORDER) {
      const point: SnapPoint = { time: 5, source };
      expect(snap(5.04, [point], 0.05)).toEqual({ time: 5, hit: point });
      expect(snap(4.96, [point], 0.05)).toEqual({ time: 5, hit: point });
    }
  });

  it('leaves the time alone when nothing is within the tolerance', () => {
    const points: SnapPoint[] = [{ time: 5, source: 'scene' }, { time: 7, source: 'cue' }];
    expect(snap(5.2, points, 0.1)).toEqual({ time: 5.2, hit: null });
    expect(snap(6, points, 0.5)).toEqual({ time: 6, hit: null });
    expect(snap(3, [], 1)).toEqual({ time: 3, hit: null });
    expect(snap(5.01, points, 0)).toEqual({ time: 5.01, hit: null });
    expect(snap(5, points, 0).hit).toEqual({ time: 5, source: 'scene' });        // exactly on it still counts
  });

  it('takes the nearest point, whatever its kind', () => {
    const points: SnapPoint[] = [{ time: 5, source: 'scene' }, { time: 5.1, source: 'playhead' }, { time: 5.3, source: 'line' }];
    expect(snap(5.08, points, 0.5).hit).toEqual({ time: 5.1, source: 'playhead' });
    expect(snap(5.02, points, 0.5).hit).toEqual({ time: 5, source: 'scene' });
    expect(snap(5.25, points, 0.5).hit).toEqual({ time: 5.3, source: 'line' });
  });

  it('breaks a tie by kind: scene, then line, cue, note, playhead', () => {
    for (let i = 0; i < SNAP_ORDER.length; i++) {
      for (let j = i + 1; j < SNAP_ORDER.length; j++) {
        const first: SnapPoint = { time: 4, source: SNAP_ORDER[i] ?? 'scene' };
        const second: SnapPoint = { time: 6, source: SNAP_ORDER[j] ?? 'scene' };     // both exactly 1 away from 5
        expect(snap(5, [first, second], 2).hit).toBe(first);
        expect(snap(5, [second, first], 2).hit).toBe(first);                         // whatever order they come in
      }
    }
    const same: SnapPoint[] = [{ time: 5, source: 'playhead' }, { time: 5, source: 'note' }, { time: 5, source: 'cue' }];
    expect(snap(5.01, same, 0.1).hit?.source).toBe('cue');
  });

  it('breaks a tie between two points of the same kind by taking the first', () => {
    const a: SnapPoint = { time: 4, source: 'cue' }; const b: SnapPoint = { time: 6, source: 'cue' };
    expect(snap(5, [a, b], 2).hit).toBe(a);
  });

  it('lists every point of a film, and leaves out the cue being dragged', () => {
    const all = snapPoints(sampleFilm, [note], 1.25);
    const count = (source: SnapPoint['source']) => all.filter((p) => p.source === source).length;
    expect([count('scene'), count('line'), count('cue'), count('note'), count('playhead')]).toEqual([6, 3, 8, 1, 1]);
    expect(all).toContainEqual({ time: 3.5 + 2.7, source: 'cue' });                    // cue times are turned into film times
    expect(all).toContainEqual({ time: 3.8, source: 'line' });
    const without = snapPoints(sampleFilm, [], null, { scene: 'S02', cue: 1 });
    expect(without.filter((p) => p.source === 'cue')).toHaveLength(6);
    expect(without.some((p) => p.source === 'playhead')).toBe(false);
  });
});

describe('dragging an on-screen text', () => {
  // Scene 2 of the sample film: 3.5 to 8.6 (5.1 long). Its second text is on from 2.7 to 4.75.
  const base = { at: 2.7, out: 4.75, sceneStart: 3.5, sceneLength: 5.1, points: [] as SnapPoint[], tolerance: 0.1 };

  it('moves the whole text and keeps its length', () => {
    expect(dragCue({ ...base, mode: 'move', delta: -1 })).toEqual({ at: 1.7, out: 3.75, guide: null });
  });
  it('never leaves the scene', () => {
    expect(dragCue({ ...base, mode: 'move', delta: -50 })).toEqual({ at: 0, out: 2.05, guide: null });
    expect(dragCue({ ...base, mode: 'move', delta: 50 })).toEqual({ at: 3.05, out: 5.1, guide: null });
    expect(dragCue({ ...base, mode: 'start', delta: -50 })).toMatchObject({ at: 0, out: 4.75 });
    expect(dragCue({ ...base, mode: 'end', delta: 50 })).toMatchObject({ at: 2.7, out: 5.1 });
  });
  it('never gets shorter than a fifth of a second', () => {
    expect(MIN_CUE).toBe(0.2);
    expect(dragCue({ ...base, mode: 'start', delta: 50 })).toMatchObject({ at: 4.55, out: 4.75 });
    expect(dragCue({ ...base, mode: 'end', delta: -50 })).toMatchObject({ at: 2.7, out: 2.9 });
  });
  it('snaps the dragged edge and says where the guide line goes', () => {
    const points: SnapPoint[] = [{ time: 7.0, source: 'playhead' }];                   // 3.5 into the scene
    expect(dragCue({ ...base, points, mode: 'start', delta: 0.76 })).toEqual({ at: 3.5, out: 4.75, guide: 7.0 });
    expect(dragCue({ ...base, points, mode: 'end', delta: -1.2 })).toEqual({ at: 2.7, out: 3.5, guide: 7.0 });
    expect(dragCue({ ...base, points, mode: 'start', delta: 0.5 })).toEqual({ at: 3.2, out: 4.75, guide: null });
  });
  it('snaps whichever end of a moved text is nearer to a point', () => {
    const points: SnapPoint[] = [{ time: 5.0, source: 'line' }, { time: 8.6, source: 'scene' }];
    expect(dragCue({ ...base, points, mode: 'move', delta: -1.16 })).toEqual({ at: 1.5, out: 3.55, guide: 5.0 });    // its start, to the line
    expect(dragCue({ ...base, points, mode: 'move', delta: 0.3 })).toEqual({ at: 3.05, out: 5.1, guide: 8.6 });      // its end, to the scene's end
  });
  it('shows no guide when the scene edge, not the snap, stopped it', () => {
    const points: SnapPoint[] = [{ time: 3.45, source: 'note' }];                      // just before the scene starts
    expect(dragCue({ ...base, points, mode: 'start', delta: -2.72 })).toEqual({ at: 0, out: 4.75, guide: null });
  });
});
