import { useState } from 'react';
import { captureAt } from '../canvas/video';
import { usePlayback } from '../playback';
import { editor, useNotes } from '../store';
import { Button, Sheet, showToast } from '../ui';
import { useReviewer } from './reviewer';
import { sendNotes, whatToSend } from './send';
import './notes.css';

/** Sends from anywhere (the send panel, the Cmd+Enter shortcut). Says how it went in a toast; true when it went. */
export async function sendFromPage(approved: boolean): Promise<boolean> {
  const back = usePlayback.getState().time;
  const result = await sendNotes({ editor, reviewer: useReviewer.getState().name, approved, capture: captureAt });
  usePlayback.getState().seek(back);              // taking the pictures moved the film: put it back
  if (result.ok) {
    showToast(result.message, { tone: 'good' });
    return true;
  }
  showToast(result.problem, { tone: 'warn' });
  if (result.needsName) document.querySelector<HTMLInputElement>('[data-reviewer] input')?.focus();
  return false;
}

/** Send, approve, and the four things worth checking first. */
export function SendBox() {
  const notes = useNotes((s) => s.notes.length);
  const good = useNotes((s) => s.goodScenes.length);
  const previous = useNotes((s) => s.previous);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const what = whatToSend(notes, good);

  const send = async (approved: boolean) => {
    setAsking(false);
    setBusy(true);
    try {
      await sendFromPage(approved);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="notes-send">
      <Button variant="primary" disabled={!what || busy} onClick={() => void send(false)}>
        {busy ? 'Sending…' : what ? `Send ${what}` : 'Send notes'}
      </Button>
      <Button disabled={busy} onClick={() => (notes ? setAsking(true) : void send(true))}>
        Approve this version as it is
      </Button>
      {previous ? (
        <Button variant="quiet" onClick={() => editor.restorePreviousDraft()}>
          Bring back the notes from before
        </Button>
      ) : null}
      <details className="notes-guide">
        <summary>Four things worth checking before you send</summary>
        <ul>
          <li>
            <strong>The first three seconds.</strong> Would someone scrolling past stop? Is the offer or the hook on screen and spoken?
          </li>
          <li>
            <strong>Once with the sound off.</strong> Does the story still land from the picture and captions alone?
          </li>
          <li>
            <strong>Once at phone size.</strong> Can every word that matters be read?
          </li>
          <li>
            <strong>Anything to take out.</strong> A moment that repeats, waits too long, or says what the voice already said.
          </li>
        </ul>
      </details>
      <Sheet
        open={asking}
        onClose={() => setAsking(false)}
        title="Approve and send the notes too?"
        footer={
          <>
            <Button onClick={() => setAsking(false)}>Not yet</Button>
            <Button variant="primary" data-autofocus onClick={() => void send(true)}>
              Approve and send
            </Button>
          </>
        }
      >
        <p>You still have notes that are not sent. Approve this version anyway and send them along?</p>
      </Sheet>
    </div>
  );
}
