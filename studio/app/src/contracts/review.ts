// Shared contract (ARCHITECTURE_PLAN.md section 5). Changes go through the Conductor.
import type { Seconds } from './film';

export type NoteKind = 'change' | 'keep';
export interface Box { x: number; y: number; w: number; h: number } // shares of the frame, 0 to 1
export interface DraftNote {
  localId: string; time: Seconds; kind: NoteKind; topic: string | null;
  must: boolean; text: string; box: Box | null;
}
export type Edit =
  | { op: 'text.words'; scene: string; cue: number; lines: string[] }
  | { op: 'text.time'; scene: string; cue: number; at: Seconds; out: Seconds };
export interface EditList { film_modified: number; edits: Edit[] }
export interface ExportRequest {
  ratio: '16:9' | '9:16' | '1:1'; height: 720 | 1080 | 2160; quality: 'preview' | 'master';
}
