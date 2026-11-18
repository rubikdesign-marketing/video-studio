import type { Film, Seconds, VideoVersion } from '../contracts/film';
import type { Box, DraftNote, Edit, ExportRequest, NoteKind } from '../contracts/review';

/** A job as the job list gives it (`GET /api/jobs`): enough to pick a film, without its on-screen text. */
export interface JobSummary {
  job: string; name: string; type: string; stage_next: string; videos: VideoVersion[]; duration: Seconds | null;
  scenes: { id: string; title: string; start: Seconds; end: Seconds; energy: number; lines: { start: Seconds; end: Seconds; text: string }[] }[];
}

/** `GET /api/film`. `filmModified` is when film.json last changed; edits are saved against it. */
export interface FilmResponse { film: Film; videos: VideoVersion[]; filmModified: number }

/** A note as it sits in a sent batch. */
export interface BatchNote {
  id: string; time: Seconds; scene: string | null; scene_title: string | null; kind: NoteKind; topic: string | null;
  must: boolean; text: string; box: Box | null; frame: string | null; resolved: boolean; reply: string | null;
}
export interface Batch {
  batch: number; job: string; video: string | null; reviewer: string | null; sent_at: string; status: string;
  approved: boolean; good_scenes: string[]; notes: BatchNote[];
}

/** The notes being written, not yet sent. */
export interface Draft { notes: DraftNote[]; goodScenes: string[] }
/** `GET /api/review`. */
export interface Review { draft: Draft; batches: Batch[] }

/** What `POST /api/send` takes. `frames` holds a captured picture (a JPEG data address) for a note, by its `localId`. */
export interface SendRequest {
  video: string | null; reviewer: string; approved: boolean; notes: DraftNote[]; goodScenes: string[];
  frames?: Record<string, string>;
}

export interface SavedEdits { filmModified: number; edits: Edit[] }
export interface ExportReceipt extends ExportRequest { export: number; job: string; requested_at: string; status: string }

/**
 * What the server says while a page is listening (`GET /api/events`).
 * `render` (scene by scene) is in the contract but the render tools do not record it today, so the server sends
 * `rendering` with the seconds so far instead. Screens should handle both.
 */
export type StudioEvent =
  | { type: 'render'; scene: number; of: number }
  | { type: 'rendering'; active: boolean; elapsed: Seconds }
  | { type: 'version'; file: string }
  | { type: 'batch'; n: number; status: string };

export type EventsStatus = 'connecting' | 'live' | 'reconnecting' | 'closed';
