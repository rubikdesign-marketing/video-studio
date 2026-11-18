// Shared contract (ARCHITECTURE_PLAN.md section 5). Changes go through the Conductor.
import type { Seconds } from './film';

export interface Command { label: string; do(): void; undo(): void }
export interface History {
  run(c: Command): void; undo(): void; redo(): void;
  canUndo: boolean; canRedo: boolean; labels: { undo?: string; redo?: string };
}
export interface Playback {
  time: Seconds; playing: boolean; rate: 0.25 | 0.5 | 1; loop: [Seconds, Seconds] | null;
  seek(t: Seconds): void; step(frames: number): void; toggle(): void;
}
export type Selection =
  | { kind: 'scene'; scene: string } | { kind: 'cue'; scene: string; cue: number }
  | { kind: 'note'; localId: string } | null;
export interface SnapPoint { time: Seconds; source: 'scene' | 'line' | 'cue' | 'note' | 'playhead' }
/** Pure. `tolerance` is in seconds, already converted from pixels by the caller. */
export type Snap = (t: Seconds, points: SnapPoint[], tolerance: Seconds) => { time: Seconds; hit: SnapPoint | null };
export interface Shortcut { id: string; keys: string; label: string; group: string; run(): void }
