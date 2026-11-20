import { useState } from 'react';
import { editor, useFilm, useNotes } from '../store';
import { Button, Field, Icon, Popover } from '../ui';
import { useRail } from './railTab';
import { useReviewer } from './reviewer';
import { sendFromPage } from './SendBox';
import { whatToSend } from './send';
import './notes.css';

const CHECKS: [string, string][] = [
  ['The first three seconds.', 'Would someone scrolling past stop? Is the offer or the hook on screen and spoken?'],
  ['Once with the sound off.', 'Does the story still land from the picture and captions alone?'],
  ['Once at phone size.', 'Can every word that matters be read?'],
  ['Anything to take out.', 'A moment that repeats, waits too long, or says what the voice already said.'],
];

/** Batches Claude has not finished yet. */
const WAITING = new Set(['sent', 'picked up']);

/** What the decision button says right now. Exported for tests. */
export function decisionLabel(o: { notes: number; good: number; repliesToCheck: number; waiting: boolean }): { label: string; primary: boolean; icon: 'send' | 'check' | 'wait' | 'guide' } {
  if (o.notes) return { label: `Send ${whatToSend(o.notes, 0)}`, primary: true, icon: 'send' };
  if (o.repliesToCheck) return { label: `Check ${o.repliesToCheck} repl${o.repliesToCheck === 1 ? 'y' : 'ies'}`, primary: true, icon: 'guide' };
  if (o.waiting) return { label: 'Waiting for the next version', primary: false, icon: 'wait' };
  return { label: 'Approve version', primary: true, icon: 'check' };
}

/** The send panel: name if missing, the four checks, send, approve, and the notes from before. */
function SendPanel({ close }: { close(): void }) {
  const notes = useNotes((s) => s.notes.length);
  const good = useNotes((s) => s.goodScenes.length);
  const previous = useNotes((s) => s.previous);
  const reviewer = useReviewer();
  const [busy, setBusy] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const what = whatToSend(notes, good);

  const send = async (approved: boolean) => {
    setBusy(true);
    let sent = false;
    try {
      sent = await sendFromPage(approved);
    } finally {
      setBusy(false);
    }
    if (sent) close();                       // a missing name keeps the panel open, with the cursor in the name field
  };

  return (
    <div className="send-panel">
      <h2 className="send-title">{notes ? `Send ${whatToSend(notes, 0)} to Claude` : 'Approve this version'}</h2>
      <p className="send-text">
        {notes
          ? `Claude picks them up and makes the next version. Only the scenes your notes touch will change.${good ? ` ${good} scene${good > 1 ? 's are' : ' is'} marked as looking good.` : ''}`
          : 'No notes are waiting. Approving records this version as final, so the next step can start.'}
      </p>
      <span data-reviewer>
        <Field label="Your name, shown on what you send" value={reviewer.name} onChange={reviewer.setName} placeholder="For example, Maya" />
      </span>
      {notes ? (
        <details className="notes-guide">
          <summary>Four things worth checking before you send</summary>
          <ul>{CHECKS.map(([a, b]) => <li key={a}><strong>{a}</strong> {b}</li>)}</ul>
        </details>
      ) : null}
      <div className="send-actions">
        {notes ? (
          <Button variant="primary" disabled={busy || !what} onClick={() => void send(false)}>
            <Icon name="send" />
            {busy ? 'Sending…' : `Send ${what}`}
          </Button>
        ) : null}
        {confirmApprove ? (
          <div className="send-confirm" role="alert">
            <p>Your {notes} note{notes > 1 ? 's go' : ' goes'} along with the approval.</p>
            <Button variant="primary" disabled={busy} onClick={() => void send(true)}>Approve and send</Button>
            <Button onClick={() => setConfirmApprove(false)}>Not yet</Button>
          </div>
        ) : (
          <Button variant={notes ? 'default' : 'primary'} disabled={busy} onClick={() => (notes ? setConfirmApprove(true) : void send(true))}>
            {notes ? 'Approve as it is instead' : <><Icon name="check" />Approve version</>}
          </Button>
        )}
        {previous ? (
          <Button variant="quiet" onClick={() => { editor.restorePreviousDraft(); close(); }}>Bring back the notes from before</Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The one decision on the page, top right. It says what to do next: send the notes, check Claude's replies,
 * wait for the next version, or approve. Its panel holds the rest (EDITOR-V2-PLAN.md, phase A2).
 */
export function Decision({ repliesToCheck = 0 }: { repliesToCheck?: number }) {
  const notes = useNotes((s) => s.notes.length);
  const good = useNotes((s) => s.goodScenes.length);
  const last = useFilm((s) => s.batches[s.batches.length - 1]);
  const waiting = !!last && !last.approved && WAITING.has(last.status);
  const d = decisionLabel({ notes, good, repliesToCheck, waiting });

  if (d.icon === 'guide') {
    return (
      <Button variant="primary" className="decision" onClick={() => { useRail.getState().setTab('replies'); editor.select(null); }}>
        <Icon name="guide" />
        {d.label}
      </Button>
    );
  }
  return (
    <Popover className="decision" variant={d.primary ? 'primary' : 'default'} align="end" ariaLabel={d.label}
      label={<><Icon name={d.icon} />{d.label}</>} panelClassName="send-popover">
      {(close) => <SendPanel close={close} />}
    </Popover>
  );
}
