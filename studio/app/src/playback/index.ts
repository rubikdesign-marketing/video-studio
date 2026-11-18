// Placeholder until Worker 2 lands. Worker 2 replaces this file. The exported names and their types stay.
import { create } from 'zustand';
import type { PlaybackPort } from '../contracts/ports';

export const usePlayback = create<PlaybackPort>((set, get) => ({
  time: 0, playing: false, rate: 1, loop: null, duration: 0, fps: 60,
  seek: (t) => set({ time: Math.max(0, t) }),
  step: (frames) => set({ time: Math.max(0, get().time + frames / get().fps) }),
  toggle: () => set({ playing: !get().playing }),
  attachVideo: () => {},
}));
