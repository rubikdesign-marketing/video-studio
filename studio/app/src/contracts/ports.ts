// Shared contract (ARCHITECTURE_PLAN.md section 5). Changes go through the Conductor.
// What the canvas, inspector and notes may rely on from playback, whoever builds it.
import type { Seconds } from './film';
import type { Playback } from './store';

export interface PlaybackPort extends Playback {
  /** Length of the loaded film. 0 until a film is loaded. */
  duration: Seconds;
  /** Frames per second of the loaded film. */
  fps: number;
  /** The canvas hands its video element over here, and passes null when it goes away. */
  attachVideo(el: HTMLVideoElement | null): void;
}
