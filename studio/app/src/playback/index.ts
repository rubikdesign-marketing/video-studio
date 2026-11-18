import { create } from 'zustand';
import type { Scene, Seconds } from '../contracts/film';
import type { PlaybackPort } from '../contracts/ports';
import { registerPlaybackShortcuts as bindPlaybackKeys } from '../shortcuts';
import { editor } from '../store';

export type Rate = PlaybackPort['rate'];
export const RATES: Rate[] = [0.25, 0.5, 1];

/** The playback contract, plus what the timeline and the shortcuts need on top of it. */
export interface PlaybackState extends PlaybackPort {
  play(): void;
  pause(): void;
  setRate(rate: Rate): void;
  /** Repeat between two times, or null to stop repeating. */
  setLoop(loop: [Seconds, Seconds] | null): void;
  /** Repeat the scene under the playhead, or stop repeating. */
  toggleSceneLoop(): void;
  /** Back to the start of this scene, or to the scene before when already at its start. */
  previousScene(): void;
  nextScene(): void;
}

/** The parts of a video element this file uses, so a test can stand in for one. */
type FrameCallback = (now: number, frame: { mediaTime: number }) => void;
type Video = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: FrameCallback) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** How long the video may show no frame before the screen refresh takes over the clock, in ms. */
const QUIET_MS = 100;

/**
 * A frame's time, worked out as frame / fps, can land a hair before the frame begins (123 / 60 is 2.0499999...), and
 * the video would then show the frame before. So the video is sent a tenth of a millisecond further on, and a
 * report back that differs by no more than that is taken as "arrived".
 */
const NUDGE = 1e-4;
const send = (el: Video, time: Seconds) => { if (Math.abs(el.currentTime - (time + NUDGE)) > 1e-6) el.currentTime = time + NUDGE; };

let video: Video | null = null;
let stopFollowing: (() => void) | null = null;

const scenes = (): Scene[] => editor.stores.film.getState().film?.scenes ?? [];
const sceneAt = (t: Seconds): Scene | undefined => {
  const all = scenes();
  return all.find((s) => t >= s.start && t < s.end) ?? (all.length && t >= (all.at(-1)?.end ?? 0) ? all.at(-1) : all[0]);
};

export const usePlayback = create<PlaybackState>((set, get) => {
  const limit = () => {
    const d = get().duration;
    if (d > 0) return d;
    return video && Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
  };
  const goTo = (t: Seconds) => {
    const time = Math.min(Math.max(0, Number.isFinite(t) ? t : 0), limit());
    set({ time });
    if (video) send(video, time);
  };

  /** What the video says the time is. Ignored while it is still getting to a place it was sent. */
  const report = (el: Video, t: Seconds) => {
    if (el !== video || el.seeking) return;
    const s = get();
    if (s.loop && !el.paused && t >= s.loop[1] - 0.5 / s.fps) { goTo(s.loop[0]); return; }
    if (Math.abs(t - s.time) > NUDGE * 2) set({ time: t });
  };

  /** Keeps `time` on the video's frame: per shown frame where the browser can say, otherwise per screen refresh. */
  const follow = (el: Video): (() => void) => {
    let stopped = false;
    const onPlay = () => set({ playing: true });
    const onPause = () => { set({ playing: false }); report(el, el.currentTime); };
    const onTime = () => report(el, el.currentTime);
    const events: [string, () => void][] = [['play', onPlay], ['playing', onPlay], ['pause', onPause], ['ended', onPause], ['seeked', onTime], ['timeupdate', onTime]];
    for (const [name, handler] of events) el.addEventListener(name, handler);
    // Two clocks. The video says which frame it is showing, where the browser can tell (the exact one). The screen
    // refresh is the stand-in: it speaks only when the video has shown no frame for a moment, which is always in
    // browsers that cannot tell, and also while the video is off screen or covered and so shows no frames.
    const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
    let frameHandle = 0; let screenHandle = 0; let lastFrameAt = Number.NEGATIVE_INFINITY;
    const perFrame = typeof el.requestVideoFrameCallback === 'function';
    if (perFrame) {
      const tick: FrameCallback = (_now, frame) => {
        if (stopped) return;
        lastFrameAt = now();
        report(el, frame.mediaTime);
        frameHandle = el.requestVideoFrameCallback?.(tick) ?? 0;
      };
      frameHandle = el.requestVideoFrameCallback?.(tick) ?? 0;
    }
    const onScreen = typeof requestAnimationFrame === 'function';
    if (onScreen) {
      const tick = () => {
        if (stopped) return;
        if (now() - lastFrameAt > QUIET_MS) report(el, el.currentTime);
        screenHandle = requestAnimationFrame(tick);
      };
      screenHandle = requestAnimationFrame(tick);
    }
    return () => {
      stopped = true;
      for (const [name, handler] of events) el.removeEventListener(name, handler);
      if (perFrame) el.cancelVideoFrameCallback?.(frameHandle);
      if (onScreen) cancelAnimationFrame(screenHandle);
    };
  };

  return {
    time: 0, playing: false, rate: 1, loop: null, duration: 0, fps: 60,

    seek: goTo,
    step(frames) {
      get().pause();
      const { fps, time } = get();
      goTo((Math.round(time * fps) + frames) / fps);
    },
    toggle() { if (get().playing) get().pause(); else get().play(); },
    play() {
      if (!video) return;                                     // nothing to play until the canvas hands over its video
      const { time, loop, fps } = get();
      if (time >= limit() - 0.5 / fps) goTo(loop ? loop[0] : 0);   // at the end: start again
      void Promise.resolve(video.play()).catch(() => set({ playing: false }));
    },
    pause() { video?.pause(); if (!video) set({ playing: false }); },
    setRate(rate) { set({ rate }); if (video) video.playbackRate = rate; },
    setLoop(loop) { set({ loop: loop && loop[1] > loop[0] ? loop : null }); },
    toggleSceneLoop() {
      if (get().loop) { set({ loop: null }); return; }
      const scene = sceneAt(get().time);
      if (scene) set({ loop: [scene.start, scene.end] });
    },
    previousScene() {
      const all = scenes(); const { time, loop } = get();
      const index = all.findIndex((s) => s === sceneAt(time));
      const current = all[index];
      if (!current) return;
      const target = time - current.start > 0.35 ? current : all[index - 1] ?? current;
      if (loop) set({ loop: [target.start, target.end] });     // the repeat moves with you
      goTo(target.start);
    },
    nextScene() {
      const all = scenes(); const { time, loop } = get();
      const next = all[all.findIndex((s) => s === sceneAt(time)) + 1];
      if (!next) return;
      if (loop) set({ loop: [next.start, next.end] });
      goTo(next.start);
    },
    attachVideo(el) {
      if (el === video) return;
      stopFollowing?.(); stopFollowing = null;
      video = el;
      if (!el) { set({ playing: false }); return; }
      el.playbackRate = get().rate;
      if (get().time > 0 || el.currentTime > 0) send(el, get().time);                  // a new version opens where the last one was
      set({ playing: !el.paused && !el.ended });
      stopFollowing = follow(el);
    },
  };
});

// The length and frame rate come from the film in the store. Another film starts from the beginning.
let job = editor.stores.film.getState().job;
const takeFilm = () => {
  const s = editor.stores.film.getState(); const p = usePlayback.getState();
  const duration = s.film?.duration ?? 0; const fps = s.film?.fps || 60;
  if (s.job !== job) { job = s.job; p.pause(); usePlayback.setState({ duration, fps, loop: null }); p.seek(0); return; }
  if (duration !== p.duration || fps !== p.fps) {
    usePlayback.setState({ duration, fps });
    if (duration > 0 && p.time > duration) p.seek(duration);
  }
};
editor.stores.film.subscribe(takeFilm);
takeFilm();

/** Puts the playback keys in the shortcut table: Space, the arrows, the scene keys and the speed keys. */
export function registerPlaybackShortcuts(): () => void {
  const p = () => usePlayback.getState();
  const jump = (seconds: number) => { p().pause(); p().seek(p().time + seconds); };
  const speed = (by: number) => { const next = RATES[RATES.indexOf(p().rate) + by]; if (next) p().setRate(next); };
  return bindPlaybackKeys({
    playPause: () => p().toggle(),
    frameBack: () => p().step(-1),
    frameForward: () => p().step(1),
    secondBack: () => jump(-1),
    secondForward: () => jump(1),
    previousScene: () => p().previousScene(),
    nextScene: () => p().nextScene(),
    loopScene: () => p().toggleSceneLoop(),
    slower: () => speed(-1),
    faster: () => speed(1),
  });
}
