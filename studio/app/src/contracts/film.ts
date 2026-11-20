// Shared contract (ARCHITECTURE_PLAN.md section 5). Changes go through the Conductor.

export type Seconds = number;
export interface VoiceLine { id: string; start: Seconds; end: Seconds; text: string }
/** `at` and `out` are seconds from the start of the scene. */
export interface TextCue { lines: string[]; at: Seconds; out: Seconds }
export interface Scene {
  id: string; title: string; start: Seconds; end: Seconds; energy: number;
  lines: VoiceLine[]; texts: TextCue[];
}
export interface Film {
  job: string; slug: string; fps: number; width: number; height: number;
  brand: string; stage: 'light' | 'dark'; duration: Seconds; scenes: Scene[];
}
export interface VideoVersion { file: string; modified: number }
