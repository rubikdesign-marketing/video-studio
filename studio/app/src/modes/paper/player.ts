import { createStore } from 'zustand/vanilla';
import type { PaperCheck, PaperClip } from '../../api';
import { clipOf } from './words';

export interface PlayerState {
  /** What is playing: the whole edit, one word, or nothing. */
  playing: 'edit' | 'word' | null;
  /** The clip on the video element now. */
  clip: string | null;
  time: number;
  /** The word being said. */
  now: { clip: string; index: number } | null;
  said: string;
  /** While the edit plays: which stretch of it, counted from 0. */
  run: number;
}
export interface PlayerSource {
  clips(): PaperClip[];
  runs(): PaperCheck['runs'];
  /** True when the word is cut in the edit: a cut word is not lit while the edit plays. */
  isCut(clip: string, index: number): boolean;
  url(clip: string): string;
}

type Job = { kind: 'word'; until: number } | { kind: 'edit'; runs: PaperCheck['runs']; k: number };
const idle: PlayerState = { playing: null, clip: null, time: 0, now: null, said: '', run: -1 };

/** Plays one word, or the edit stretch by stretch, on the one video element it is given. */
export function createPlayer(source: PlayerSource) {
  const store = createStore<PlayerState>(() => idle);
  let v: HTMLVideoElement | null = null;
  let job: Job | null = null;
  let switching = false;
  let frame = 0;
  let loaded: string | null = null;

  /** Puts a clip on the video element and waits until it can be moved about in. */
  function setClip(clip: string): Promise<void> {
    const el = v;
    if (!el || loaded === clip) return Promise.resolve();
    return new Promise((resolve) => {
      loaded = clip; store.setState({ clip });
      const done = () => { el.removeEventListener('loadedmetadata', done); el.removeEventListener('error', done); resolve(); };
      el.addEventListener('loadedmetadata', done); el.addEventListener('error', done);
      el.src = source.url(clip);
    });
  }
  function showNow(t: number) {
    const clip = loaded;
    if (!clip) return;
    const words = clipOf(source.clips(), clip)?.words ?? [];
    const index = words.findIndex((w) => t >= w.start && t < w.end);
    const lit = index >= 0 && (job?.kind === 'word' || !source.isCut(clip, index));
    const before = store.getState();
    const now = lit ? (before.now && before.now.clip === clip && before.now.index === index ? before.now : { clip, index }) : null;
    store.setState({ time: t, now, said: lit ? (words[index]?.text ?? '') : before.said });
  }
  /** Looks at where the video is and moves on when a word or a stretch is over. */
  function check() {
    const el = v;
    if (!el || !job || switching) return;
    const t = el.currentTime;
    if (job.kind === 'word') { if (t >= job.until || el.ended) { stop(); return; } }
    else { const r = job.runs[job.k]; if (r && (t >= r.end || el.ended)) { void nextRun(); return; } }
    showNow(t);
  }
  function loop() {
    cancel();
    if (typeof requestAnimationFrame !== 'function') return;
    const tick = () => { if (!job) return; check(); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
  }
  const cancel = () => { if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame); frame = 0; };

  async function nextRun(): Promise<void> {
    const mine = job; const el = v;
    if (!mine || mine.kind !== 'edit' || !el) return;
    mine.k++;
    const r = mine.runs[mine.k];
    if (!r) { stop(); return; }
    switching = true;
    store.setState({ run: mine.k });
    await setClip(r.clip);
    if (job !== mine) { switching = false; return; }             // stopped, or something else started, while it loaded
    el.currentTime = Math.max(0, r.start);
    switching = false;
    await Promise.resolve(el.play()).catch(() => {});
  }

  function stop(): void {
    job = null; switching = false; cancel();
    v?.pause();
    store.setState({ playing: null, now: null, run: -1 });
  }
  /** Plays a word and a little after it (2.5 seconds), cut or not. */
  async function hear(clip: string, index: number): Promise<void> {
    stop();
    const el = v; const w = clipOf(source.clips(), clip)?.words[index];
    if (!el || !w) return;
    const mine: Job = { kind: 'word', until: w.start + 2.5 };
    job = mine; store.setState({ playing: 'word' });
    await setClip(clip);
    if (job !== mine) return;
    el.currentTime = Math.max(0, w.start - 0.15);
    void Promise.resolve(el.play()).catch(() => {});
    loop();
  }
  /** Plays the edit as the rough cut will hold it, from its first stretch or from the one given. */
  async function playEdit(from = 0): Promise<void> {
    stop();
    const runs = source.runs();
    if (!v || !runs.length) return;
    job = { kind: 'edit', runs, k: from - 1 };
    store.setState({ playing: 'edit' });
    await nextRun();
    if (job) loop();
  }
  /** Shows the first picture of the edit, without playing. */
  async function showOpening(): Promise<void> {
    const first = source.runs()[0] ?? { clip: source.clips()[0]?.name, start: 0 };
    if (!v || !first.clip || job) return;
    await setClip(first.clip);
    if (v && !job) { v.currentTime = Math.max(0, first.start); store.setState({ time: Math.max(0, first.start) }); }
  }

  return {
    store, hear, playEdit, stop, showOpening,
    toggle: () => (job ? stop() : void playEdit()),
    /** The page hands over its video element, and null when it goes away. */
    attach(el: HTMLVideoElement | null) {
      if (el === v) return;
      if (v) { stop(); v.removeEventListener('timeupdate', check); v.removeEventListener('ended', check); }
      v = el; loaded = null; store.setState(idle);
      if (el) { el.addEventListener('timeupdate', check); el.addEventListener('ended', check); }   // also moves on when the page gets no frames
    },
    /** Another job: forget the clip that was loaded. */
    reset() { stop(); loaded = null; if (v) { v.removeAttribute('src'); v.load?.(); } store.setState(idle); },
  };
}
export type Player = ReturnType<typeof createPlayer>;
