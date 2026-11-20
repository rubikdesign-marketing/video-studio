import type { Film, VideoVersion } from '../contracts/film';
import type { DraftNote, Edit, EditList, ExportRequest } from '../contracts/review';
import { ApiError, errorFromResponse, offlineError } from './errors';
import { subscribeEvents, type EventsOptions } from './events';
import type { Batch, Draft, ExportReceipt, ExportRecord, FilmResponse, JobSummary, PaperData, PaperJob, PaperPayload, PaperSaved, Review, SavedEdits, SendRequest } from './types';

export interface ClientOptions {
  /** Where the studio server is. Empty for the page's own server. */
  baseUrl?: string;
  fetch?: typeof fetch;
}

/** Notes saved by the old review page carry fewer fields. This fills the rest in so the editor can read them. */
export function toDraftNote(raw: unknown, index: number): DraftNote {
  const n = (raw && typeof raw === 'object' ? raw : {}) as Partial<DraftNote>;
  const box = n.box && typeof n.box === 'object' ? n.box : null;
  const time = typeof n.time === 'number' && Number.isFinite(n.time) ? n.time : 0;
  // A note over a stretch keeps its end through a save and a reload; anything else stays a note about one moment.
  const end = typeof n.end === 'number' && Number.isFinite(n.end) && n.end > time ? { end: n.end } : {};
  return {
    localId: typeof n.localId === 'string' && n.localId ? n.localId : `saved-${index + 1}`,
    time: typeof n.time === 'number' && Number.isFinite(n.time) ? n.time : 0,
    kind: n.kind === 'keep' ? 'keep' : 'change',
    topic: typeof n.topic === 'string' && n.topic ? n.topic : null,
    must: n.must === true,
    text: typeof n.text === 'string' ? n.text : '',
    box: box ? { x: Number(box.x) || 0, y: Number(box.y) || 0, w: Number(box.w) || 0, h: Number(box.h) || 0 } : null,
    ...end,
  };
}

export function createClient(options: ClientOptions = {}) {
  const base = (options.baseUrl ?? '').replace(/\/$/, '');
  const doFetch: typeof fetch = options.fetch ?? ((input, init) => fetch(input, init));
  const forJob = (path: string, job: string) => `${base}${path}?job=${encodeURIComponent(job)}`;

  async function call<T>(url: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw offlineError();
    }
    let data: unknown = null;
    try { data = await response.json(); } catch { /* an answer with no JSON in it */ }
    if (!response.ok) throw errorFromResponse(response.status, data);
    if (data === null) throw new ApiError('failed', 'The studio gave an answer the page could not read. Try again.', { status: response.status });
    return data as T;
  }

  return {
    /** Every job that has a film to watch. */
    async listJobs(): Promise<JobSummary[]> {
      return (await call<{ jobs: JobSummary[] }>(`${base}/api/jobs`)).jobs;
    },
    /** The film with its on-screen text, and its rendered versions, newest first. */
    async getFilm(job: string): Promise<FilmResponse> {
      const d = await call<{ film: Film; videos: VideoVersion[]; film_modified: number }>(forJob('/api/film', job));
      return { film: d.film, videos: d.videos, filmModified: d.film_modified };
    },
    /** The notes not yet sent, and every batch sent so far. */
    async getReview(job: string): Promise<Review> {
      const d = await call<{ draft?: { notes?: unknown[]; good_scenes?: string[] }; batches?: Batch[] }>(forJob('/api/review', job));
      return { draft: { notes: (d.draft?.notes ?? []).map(toDraftNote), goodScenes: d.draft?.good_scenes ?? [] }, batches: d.batches ?? [] };
    },
    /** Saves the notes being written. */
    async saveDraft(job: string, draft: Draft): Promise<void> {
      await call(forJob('/api/draft', job), { notes: draft.notes, good_scenes: draft.goodScenes });
    },
    /** Sends the notes as a batch for Claude to pick up. The server clears the draft. */
    async sendBatch(job: string, request: SendRequest): Promise<Batch> {
      const notes = request.notes.map((n) => ({ ...n, frame: request.frames?.[n.localId] ?? null }));
      const d = await call<{ batch: Batch }>(forJob('/api/send', job), {
        video: request.video, reviewer: request.reviewer, approved: request.approved, good_scenes: request.goodScenes, notes,
      });
      return d.batch;
    },
    /** The direct text changes saved beside the film. */
    async getEdits(job: string): Promise<SavedEdits> {
      const d = await call<EditList>(forJob('/api/edits', job));
      return { filmModified: d.film_modified, edits: d.edits ?? [] };
    },
    /** Saves the direct text changes. Throws an ApiError of kind `stale` when the film has changed since. */
    async saveEdits(job: string, filmModified: number, edits: Edit[]): Promise<void> {
      const list: EditList = { film_modified: filmModified, edits };
      await call(forJob('/api/edits', job), list);
    },
    /** Asks for an export. Claude picks the request up like a batch of notes. */
    async requestExport(job: string, request: ExportRequest): Promise<ExportReceipt> {
      return (await call<{ export: ExportReceipt }>(forJob('/api/export', job), request)).export;
    },
    /** The exports asked for so far, oldest first, with where each has got to. */
    async getExports(job: string): Promise<ExportRecord[]> {
      return (await call<{ exports?: ExportRecord[] }>(forJob('/api/exports', job))).exports ?? [];
    },
    /** Every job that has a paper edit (a transcript of raw footage to cut). */
    async listPaperJobs(): Promise<PaperJob[]> {
      return (await call<{ jobs: PaperJob[] }>(`${base}/api/paper/jobs`)).jobs;
    },
    /** The paper edit of a job: its sentences, the clips' words and what the server makes of the edit. */
    getPaper: (job: string): Promise<PaperData> => call<PaperData>(forJob('/api/paper', job)),
    /** Saves what a person changed in the paper edit. The answer carries the joins and length worked out afresh. */
    savePaper: (job: string, payload: PaperPayload): Promise<PaperSaved> => call<PaperSaved>(forJob('/api/paper/save', job), payload),
    /** Sends the paper edit. `approved: true` means "ready for the rough cut". */
    sendPaper: (job: string, payload: PaperPayload & { approved: boolean }): Promise<PaperSaved> => call<PaperSaved>(forJob('/api/paper/send', job), payload),
    /** The address of a clip's working copy (or its sound, when it has no picture), for a video element. */
    clipMediaUrl: (job: string, clip: string) => `${base}/clip-media/${encodeURIComponent(job)}/${encodeURIComponent(clip)}`,
    /** The address of a rendered version, for a video element. */
    mediaUrl: (job: string, file: string) => `${base}/media/${encodeURIComponent(job)}/${encodeURIComponent(file)}`,
    /** The address of a picture saved with a sent note. `frame` is the note's `frame` field (`review/frames/b001-n1.jpg`). */
    frameUrl: (job: string, frame: string) => `${base}/frames/${encodeURIComponent(job)}/${encodeURIComponent(frame.split('/').pop() ?? '')}`,
    /** Live events for a job. Reconnects by itself. Returns the function that stops listening. */
    events: (job: string, handlers: EventsOptions) => subscribeEvents(forJob('/api/events', job), handlers),
  };
}

export type StudioClient = ReturnType<typeof createClient>;

/** The client for this page's own server. */
export const api: StudioClient = createClient();
