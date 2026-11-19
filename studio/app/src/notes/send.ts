import type { Batch } from '../api';
import { plainMessage } from '../api';
import type { Box } from '../contracts/review';
import type { Editor } from '../store';

export interface SendOptions {
  editor: Pick<Editor, 'stores' | 'send'>;
  reviewer: string;
  approved: boolean;
  /** Takes a picture of the film at a moment, with the marked area drawn on it. Null when it cannot. */
  capture(time: number, box: Box | null): Promise<string | null>;
}
export type SendResult = { ok: true; batch: Batch; message: string } | { ok: false; problem: string; needsName?: boolean };

export const NAME_FIRST = 'Add your name first, so it is clear who the notes are from.';
export const SENT = 'Sent. Only the scenes your notes touch will be changed, and the new version will appear here.';
export const APPROVED = 'Approved. This version is recorded as approved.';

/** "2 notes and 1 good scene", or nothing when there is nothing to send. */
export function whatToSend(notes: number, good: number): string {
  const parts: string[] = [];
  if (notes) parts.push(`${notes} note${notes > 1 ? 's' : ''}`);
  if (good) parts.push(`${good} good scene${good > 1 ? 's' : ''}`);
  return parts.join(' and ');
}

/**
 * Sends the notes as one batch: a picture of the film is taken for every note at its moment, then the store sends
 * them. The server gets the same fields the old review page posts.
 */
export async function sendNotes({ editor, reviewer, approved, capture }: SendOptions): Promise<SendResult> {
  const name = reviewer.trim();
  if (!name) return { ok: false, problem: NAME_FIRST, needsName: true };
  const { notes, goodScenes } = editor.stores.notes.getState();
  if (!notes.length && !goodScenes.length && !approved) return { ok: false, problem: 'There is nothing to send yet.' };
  try {
    const frames: Record<string, string> = {};
    for (const note of notes) {
      const picture = await capture(note.time, note.box);
      if (picture) frames[note.localId] = picture;
    }
    const batch = await editor.send({ reviewer: name, approved, frames });
    return { ok: true, batch, message: approved ? APPROVED : SENT };
  } catch (error) {
    return { ok: false, problem: `That did not send. ${plainMessage(error)}` };
  }
}
