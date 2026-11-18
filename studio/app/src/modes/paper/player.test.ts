// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { samplePaper } from './fixture';
import { createPlayer } from './player';

/** A pretend video element: a clock the test moves, and the events a real one sends. */
function fakeVideo() {
  const el = new EventTarget() as EventTarget & Record<string, unknown>;
  let time = 0; let paused = true; let src = '';
  Object.defineProperties(el, {
    currentTime: { get: () => time, set: (t: number) => { time = t; } },
    paused: { get: () => paused }, ended: { get: () => false },
    src: { get: () => src, set: (s: string) => { src = s; queueMicrotask(() => el.dispatchEvent(new Event('loadedmetadata'))); } },
  });
  el.play = () => { paused = false; return Promise.resolve(); };
  el.pause = () => { paused = true; };
  el.removeAttribute = () => { src = ''; };
  return { el: el as unknown as HTMLVideoElement, advance(seconds: number) { if (!paused) time += seconds; el.dispatchEvent(new Event('timeupdate')); }, get time() { return time; }, get src() { return src; }, get paused() { return paused; } };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('the paper player', () => {
  const data = samplePaper();
  let cut = new Set<string>();
  let video = fakeVideo();
  let player = createPlayer({ clips: () => data.clips, runs: () => data.check.runs, isCut: (clip, i) => cut.has(`${clip}:${i}`), url: (clip) => `/clip-media/demo/${clip}` });
  beforeEach(() => {
    cut = new Set(['take-1:0']); video = fakeVideo();
    player = createPlayer({ clips: () => data.clips, runs: () => data.check.runs, isCut: (clip, i) => cut.has(`${clip}:${i}`), url: (clip) => `/clip-media/demo/${clip}` });
    player.attach(video.el);
  });

  it('shows the opening picture without playing', async () => {
    await player.showOpening();
    expect([video.src, video.time, video.paused, player.store.getState().clip]).toEqual(['/clip-media/demo/take-1', 0.82, true, 'take-1']);
  });

  it('plays one word from just before it, for two and a half seconds, cut or not', async () => {
    await player.hear('take-1', 0);                                                   // "Um," is cut in the edit
    expect(video.time).toBeCloseTo(0.35, 10);
    expect([video.paused, player.store.getState().playing]).toEqual([false, 'word']);
    video.advance(0.2);
    expect(player.store.getState().now).toEqual({ clip: 'take-1', index: 0 });        // a cut word is lit when you ask to hear it
    expect(player.store.getState().said).toBe('Um,');
    video.advance(2.4);
    expect(player.store.getState().playing).toBe('word');
    video.advance(0.1);                                                               // past 0.5 + 2.5
    expect([player.store.getState().playing, video.paused, player.store.getState().now]).toEqual([null, true, null]);
  });

  it('plays the edit stretch by stretch, across clips, and stops at the end', async () => {
    await player.playEdit();
    expect([video.src, video.time, player.store.getState().run, player.store.getState().playing]).toEqual(['/clip-media/demo/take-1', 0.82, 0, 'edit']);
    video.advance(0.1);
    expect(player.store.getState().now).toEqual({ clip: 'take-1', index: 1 });
    video.advance(5.5); await settle();                                               // past the end of the first stretch (6.4)
    expect([video.src, video.time, player.store.getState().run]).toEqual(['/clip-media/demo/take-2', 2.92, 1]);
    expect(video.paused).toBe(false);
    video.advance(0.2);
    expect([player.store.getState().clip, player.store.getState().now?.clip]).toEqual(['take-2', 'take-2']);
    video.advance(2); await settle();                                                 // past 5: nothing left
    expect([player.store.getState().playing, video.paused, player.store.getState().run]).toEqual([null, true, -1]);
  });

  it('does not light a cut word while the edit plays', async () => {
    cut.add('take-1:2');
    await player.playEdit();
    video.advance(0.1);                                                               // 0.92: "this" (index 1), kept
    expect(player.store.getState().said).toBe('this');
    video.advance(0.4);                                                               // 1.32: "is" (index 2), cut
    expect(player.store.getState().now).toBeNull();
    expect(player.store.getState().said).toBe('this');                                // the last word said stays up
  });

  it('starts from a chosen stretch, toggles with one call, and stops on demand', async () => {
    await player.playEdit(1);
    expect([video.src, video.time, player.store.getState().run]).toEqual(['/clip-media/demo/take-2', 2.92, 1]);
    player.toggle();
    expect([player.store.getState().playing, video.paused]).toEqual([null, true]);
    player.toggle(); await settle();
    expect([player.store.getState().playing, player.store.getState().run]).toEqual(['edit', 0]);
    player.stop();
    video.advance(30); await settle();
    expect(player.store.getState().playing).toBeNull();                               // a stopped edit does not carry on
  });

  it('plays nothing when nothing is kept, and lets go of the video when it goes away', async () => {
    const empty = createPlayer({ clips: () => data.clips, runs: () => [], isCut: () => false, url: () => '' });
    empty.attach(video.el);
    await empty.playEdit();
    expect([empty.store.getState().playing, video.paused]).toEqual([null, true]);
    await player.playEdit(); player.attach(null);
    expect(player.store.getState().playing).toBeNull();
    video.advance(10); await settle();
    expect(player.store.getState().run).toBe(-1);
  });
});
