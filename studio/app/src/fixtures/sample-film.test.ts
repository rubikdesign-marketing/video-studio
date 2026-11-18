import { describe, expect, it } from 'vitest';
import { sampleFilm } from './sample-film';

describe('sample film fixture', () => {
  it('has its scenes in time order', () => {
    const { scenes, duration } = sampleFilm;
    expect(scenes.length).toBeGreaterThan(0);
    let previousEnd = 0;
    for (const scene of scenes) {
      expect(scene.start).toBeGreaterThanOrEqual(previousEnd);
      expect(scene.end).toBeGreaterThan(scene.start);
      previousEnd = scene.end;
    }
    expect(previousEnd).toBeLessThanOrEqual(duration);
  });

  it('keeps every text cue inside its scene', () => {
    for (const scene of sampleFilm.scenes) {
      const length = scene.end - scene.start;
      for (const cue of scene.texts) {
        expect(cue.at).toBeGreaterThanOrEqual(0);
        expect(cue.out).toBeGreaterThan(cue.at);
        expect(cue.out).toBeLessThanOrEqual(length);
      }
    }
  });
});
