// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sampleFilm } from '../fixtures/sample-film';
import { handleKey, shortcutStore } from '../shortcuts';
import { editor } from '../store';
import { registerPlaybackShortcuts, usePlayback } from './index';

type FrameCallback = (now: number, frame: { mediaTime: number }) => void;

/** A pretend video element with a clock the test moves. `perFrame` decides whether it can report each shown frame. */
function fakeVideo(perFrame: boolean) {
  const el = new EventTarget() as EventTarget & Record<string, unknown>;
  let time = 0; let paused = true; let seeking = false;
  const callbacks = new Map<number, FrameCallback>(); let next = 1;
  Object.defineProperties(el, {
    currentTime: { get: () => time, set: (t: number) => { time = t; seeking = true; } },
    paused: { get: () => paused },
    seeking: { get: () => seeking },
    ended: { get: () => false },
    duration: { get: () => sampleFilm.duration },
  });
  el.playbackRate = 1;
  el.play = () => { paused = false; el.dispatchEvent(new Event('play')); return Promise.resolve(); };
  el.pause = () => { if (!paused) { paused = true; el.dispatchEvent(new Event('pause')); } };
  if (perFrame) {
    el.requestVideoFrameCallback = (cb: FrameCallback) => { callbacks.set(next, cb); return next++; };
    el.cancelVideoFrameCallback = (handle: number) => { callbacks.delete(handle); };
  }
  return {
    el: el as unknown as HTMLVideoElement,
    /** The browser finishes a seek. */
    settle() { if (seeking) { seeking = false; el.dispatchEvent(new Event('seeked')); } },
    /** The browser shows the next frame: the clock moves on, then the frame callbacks run. */
    showFrame(seconds: number) {
      if (!paused) time += seconds * (el.playbackRate as number);
      const due = [...callbacks.values()]; callbacks.clear();
      for (const cb of due) cb(performance.now(), { mediaTime: time });
    },
    get time() { return time; },
    get waiting() { return callbacks.size; },
  };
}

/** Screen refreshes for the fallback path, run by hand. */
function fakeScreen() {
  const queue = new Map<number, FrameRequestCallback>(); let next = 1;
  globalThis.requestAnimationFrame = (cb) => { queue.set(next, cb); return next++; };
  globalThis.cancelAnimationFrame = (handle) => { queue.delete(handle); };
  return { refresh() { const due = [...queue.values()]; queue.clear(); for (const cb of due) cb(performance.now()); } };
}

const p = () => usePlayback.getState();
const FRAME = 1 / 60;

beforeEach(() => {
  editor.stores.film.setState({ job: 'demo', status: 'ready', film: sampleFilm });
  p().attachVideo(null);
  usePlayback.setState({ time: 0, playing: false, rate: 1, loop: null });
});
afterEach(() => { p().attachVideo(null); shortcutStore.setState({ shortcuts: [] }); });

describe('playback', () => {
  it('takes the length and the frame rate from the film in the store', () => {
    expect([p().duration, p().fps]).toEqual([12.2, 60]);
    editor.stores.film.setState({ film: { ...sampleFilm, fps: 30, duration: 20 } });
    expect([p().duration, p().fps]).toEqual([20, 30]);
    p().seek(15);
    editor.stores.film.setState({ job: 'another', film: sampleFilm });
    expect([p().time, p().duration]).toEqual([0, 12.2]);                           // another film starts from the beginning
  });

  it('stays within one frame of the video at 60 frames a second, frame by frame', () => {
    const video = fakeVideo(true);
    p().attachVideo(video.el);
    p().toggle();
    expect(p().playing).toBe(true);
    let worst = 0;
    for (let i = 0; i < 600; i++) {                                                // ten seconds of film
      video.showFrame(FRAME);
      worst = Math.max(worst, Math.abs(p().time - video.el.currentTime));
    }
    expect(video.time).toBeCloseTo(10, 5);
    expect(worst).toBeLessThanOrEqual(FRAME);
    expect(worst).toBe(0);                                                         // in fact it is on the same frame
  });

  it('stays within one frame where the browser cannot report frames, even when screen and film drift apart', () => {
    const screen = fakeScreen(); const video = fakeVideo(false);
    p().attachVideo(video.el);
    p().toggle();
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      video.showFrame(FRAME * 0.6);                                                // the film moves on a little...
      worst = Math.max(worst, Math.abs(p().time - video.el.currentTime));          // ...before the screen catches up
      video.showFrame(FRAME * 0.4);
      screen.refresh();
      worst = Math.max(worst, Math.abs(p().time - video.el.currentTime));
    }
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(FRAME);
  });

  it('plays, pauses and follows the video when it is paused from elsewhere', () => {
    const video = fakeVideo(true);
    p().toggle();
    expect(p().playing).toBe(false);                                               // nothing to play yet
    p().attachVideo(video.el);
    p().toggle(); expect([p().playing, video.el.paused]).toEqual([true, false]);
    video.el.pause(); expect(p().playing).toBe(false);
    p().toggle(); p().toggle(); expect(video.el.paused).toBe(true);
    p().attachVideo(null);
    expect(video.waiting).toBe(0);                                                 // it let go of the video
  });

  it('seeks within the film and holds the place until the video gets there', () => {
    const video = fakeVideo(true);
    p().attachVideo(video.el);
    p().seek(5); expect([p().time, video.time]).toEqual([5, 5]);
    video.showFrame(0);                                                            // an old frame arrives mid-seek: ignored
    expect(p().time).toBe(5);
    video.settle();
    p().seek(-3); expect(p().time).toBe(0);
    p().seek(99); expect(p().time).toBe(12.2);
  });

  it('steps by whole frames of the film and pauses to do it', () => {
    const video = fakeVideo(true);
    p().attachVideo(video.el); p().toggle();
    p().seek(1); video.settle();
    p().step(1);
    expect(p().playing).toBe(false);
    expect(p().time).toBeCloseTo(61 / 60, 10);
    video.settle(); p().step(-2);
    expect(p().time).toBeCloseTo(59 / 60, 10);
    editor.stores.film.setState({ film: { ...sampleFilm, fps: 30 } });
    video.settle(); p().seek(1); video.settle(); p().step(1);
    expect(p().time).toBeCloseTo(31 / 30, 10);                                     // the film's own frame rate
    video.settle(); p().seek(0); video.settle(); p().step(-1);
    expect(p().time).toBe(0);
  });

  it('plays at a quarter, half and full speed', () => {
    const video = fakeVideo(true);
    p().setRate(0.5);
    p().attachVideo(video.el);
    expect(video.el.playbackRate).toBe(0.5);                                       // a new video takes the chosen speed
    p().setRate(0.25); expect([p().rate, video.el.playbackRate]).toEqual([0.25, 0.25]);
    p().toggle();
    for (let i = 0; i < 60; i++) video.showFrame(FRAME);
    expect(p().time).toBeCloseTo(0.25, 5);
  });

  it('repeats a scene and goes to the scene before and the next one', () => {
    const video = fakeVideo(true);
    p().attachVideo(video.el);
    p().seek(4); video.settle();
    p().toggleSceneLoop();
    expect(p().loop).toEqual([3.5, 8.6]);
    p().seek(8.5); video.settle(); p().toggle();
    for (let i = 0; i < 12; i++) { video.showFrame(FRAME); video.settle(); }
    expect(p().time).toBeGreaterThanOrEqual(3.5);
    expect(p().time).toBeLessThan(3.7);                                            // it went round instead of into scene 3
    p().toggle();

    p().nextScene(); expect([p().time, p().loop]).toEqual([8.6, [8.6, 12.2]]);     // the repeat moves with you
    video.settle(); p().nextScene(); expect(p().time).toBe(8.6);                   // there is no scene after the last
    p().toggleSceneLoop(); expect(p().loop).toBeNull();
    video.settle(); p().seek(9.5); video.settle();
    p().previousScene(); expect(p().time).toBe(8.6);                               // first to the start of this scene
    video.settle(); p().previousScene(); expect(p().time).toBe(3.5);               // then to the scene before
    video.settle(); p().seek(0.1); video.settle(); p().previousScene(); expect(p().time).toBe(0);
  });

  it('keeps its place when the canvas swaps in another version', () => {
    const first = fakeVideo(true); const second = fakeVideo(true);
    p().attachVideo(first.el); p().seek(6); first.settle();
    p().attachVideo(second.el);
    expect(second.time).toBe(6);
    first.showFrame(0);
    expect(first.waiting).toBe(0);
  });

  it('answers to its keys through the shortcut table', () => {
    const video = fakeVideo(true);
    p().attachVideo(video.el);
    const stop = registerPlaybackShortcuts();
    const press = (key: string, shiftKey = false) => { expect(handleKey({ key, shiftKey }), key).toBe(true); video.settle(); };
    press(' '); expect(p().playing).toBe(true);
    press(' '); expect(p().playing).toBe(false);
    press('ArrowRight'); expect(p().time).toBeCloseTo(1 / 60, 10);
    press('ArrowLeft'); expect(p().time).toBe(0);
    press('ArrowRight', true); expect(p().time).toBe(1);
    press('ArrowRight', true); press('ArrowLeft', true); expect(p().time).toBe(1);
    press('ArrowDown'); expect(p().time).toBe(3.5);
    press('ArrowDown'); expect(p().time).toBe(8.6);
    press('ArrowUp'); expect(p().time).toBe(3.5);
    press('l'); expect(p().loop).toEqual([3.5, 8.6]);
    press('l'); expect(p().loop).toBeNull();
    press(','); expect(p().rate).toBe(0.5);
    press(','); press(','); expect(p().rate).toBe(0.25);
    press('.'); press('.'); press('.'); expect(p().rate).toBe(1);
    stop();
    expect(handleKey({ key: ' ' })).toBe(false);
  });
});
