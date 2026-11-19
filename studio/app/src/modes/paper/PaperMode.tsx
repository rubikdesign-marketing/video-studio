import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { create, useStore } from 'zustand';
import type { PaperBlock, PaperClip, PaperData, PaperJoin } from '../../api';
import { YouMenu, useReviewer } from '../../notes';
import { Shell, usePanelsStore } from '../../shell';
import { CommandMenu, ShortcutSheet, TABLE, formatKeys, openMenu, openSheet, registerCoreShortcuts, registerPanelShortcuts, registerPlaybackShortcuts, useShortcuts } from '../../shortcuts';
import { registerPaperShortcuts } from '../../shortcuts/table';
import { history, useHistory } from '../../store';
import { useTheme } from '../../theme';
import { Button, Chip, Field, Icon, MenuItem, Popover, Segmented, Select, Toasts, Tooltip, cx } from '../../ui';
import { paper, player } from './instance';
import './paper.css';
import type { PlayerState } from './player';
import type { PaperState } from './store';
import { clipOf, clock, isFiller, keyOf, openJoins, takeLabels } from './words';

// Editor v2, phase C (EDITOR-V2-PLAN.md): Paper edit reads like a document. The words lead; the take and time sit in
// a margin; each sentence has one handle and one menu; Edit shows the cuts, Read hides them; the length is held
// against the target; joins to check come before sending; a line said twice is a choice of take.

const usePaper = <T,>(select: (s: PaperState) => T): T => useStore(paper.store, select);
const usePlayer = <T,>(select: (s: PlayerState) => T): T => useStore(player.store, select);
/** Edit shows every cut, filler and pause; Read hides them, so the script reads as it will be heard. */
export const usePaperView = create<{ read: boolean; toggle(): void }>((set, get) => ({ read: false, toggle: () => set({ read: !get().read }) }));

const blockKey = (b: PaperBlock) => `${b.clip}#${b.sentence}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const minutes = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`; };

/** After a sentence moves, puts the keyboard focus back on the same control in its new place. */
function refocus(key: string, selector: string) {
  const again = () => document.querySelector<HTMLElement>(`[data-block-key="${CSS.escape(key)}"] ${selector}`)?.focus();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(again); else again();
}
/** Plays the edit from the stretch that holds this sentence's first kept word. */
function hearSentence(block: PaperBlock, data: PaperData): void {
  const clip = clipOf(data.clips, block.clip); const first = block.words[0];
  const w = first === undefined ? undefined : clip?.words[first];
  if (!w) return;
  const runs = paper.store.getState().check.runs;
  const i = runs.findIndex((r) => r.clip === block.clip && w.start >= r.start - 0.05 && w.start < r.end);
  void player.playEdit(i < 0 ? 0 : i);
}

// ---------------------------------------------------------------- the transcript

function Words({ block, index, clip, data }: { block: PaperBlock; index: number; clip: PaperClip; data: PaperData }) {
  const keepPauses = usePaper((s) => s.keepPauses);
  const joins = usePaper((s) => s.check.joins);
  const read = usePaperView((s) => s.read);
  const kept = new Set(block.words);
  const sentence = clip.sentences[block.sentence] ?? [];
  const firstKept = sentence.find((i) => kept.has(i));
  const pauses = new Map((data.paper.proposals.pauses ?? []).filter((p) => p.clip === block.clip).map((p) => [p.after, p]));
  const flags = new Map<string, PaperJoin>(joins.filter((j) => j.flagged).map((j) => [j.after, j]));
  const act = (i: number, shift: boolean) => (shift ? void player.hear(block.clip, i) : paper.toggleWord(index, i));
  if (!sentence.some((i) => clip.words[i])) return <p className="pp-gone">No words for this sentence in the transcript. It plays as it was cut.</p>;
  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault(); e.stopPropagation();
    act(i, e.shiftKey);
  };
  return (
    <p className="pp-text">
      {sentence.map((i) => {
        const w = clip.words[i];
        if (!w) return null;
        const cut = !kept.has(i); const k = keyOf(block.clip, i);
        if (read && cut) return null;
        const pause = pauses.get(i); const flag = flags.get(k);
        const keptPause = keepPauses.includes(k);
        // In Read, a sentence whose first words were cut starts with a capital, as it will be heard.
        const shown = read && i === firstKept ? w.text.charAt(0).toUpperCase() + w.text.slice(1) : w.text;
        return (
          <span key={i}>
            <span
              className="pp-word" role="button" tabIndex={0} aria-pressed={cut} title={`${clock(w.start)}${isFiller(w) ? ', a filler' : w.filler === 'maybe' ? ', maybe a filler' : ''}`}
              aria-label={w.text}
              data-clip={block.clip} data-i={i} data-cut={cut || undefined}
              data-filler={!cut && isFiller(w) ? true : undefined} data-maybe={!cut && w.filler === 'maybe' ? true : undefined}
              onClick={(e: MouseEvent) => act(i, e.shiftKey)} onKeyDown={onKey(i)}
            >{shown}</span>{' '}
            {pause && !read && !cut ? (
              <>
                <Chip className="pp-pause" selected={keptPause} onClick={() => paper.togglePause(k)}>
                  {keptPause ? `pause ${pause.seconds} s kept` : `pause ${pause.seconds} s → ${pause.to} s`}
                </Chip>{' '}
              </>
            ) : null}
            {flag && !read ? (
              flag.approved ? (
                // An approved join steps back to a small mark, so a long interview's text is not buried under them.
                <span className="pp-flag pp-flag--done" data-approved role="note" data-join={flag.key} title={`Approved join: ${flag.reasons.join('; ')}`}>
                  <Icon name="circleCheck" size={13} />
                  <span className="visually-hidden">Approved: {flag.reasons.join('; ')}</span>
                  <Button variant="quiet" className="pp-flag-undo" onClick={() => paper.toggleJoin(flag.key)}>Undo</Button>
                </span>
              ) : (
                <span className="pp-flag" role="note" data-join={flag.key}>
                  <Icon name="flag" size={13} />
                  <span>Check this join: {flag.reasons.join('; ')}</span>
                  <Button className="pp-small" onClick={() => paper.toggleJoin(flag.key)}>It keeps the meaning</Button>
                </span>
              )
            ) : null}
          </span>
        );
      })}
    </p>
  );
}

/** The one menu of a sentence: hear it, open with it, move it, cut it or bring it back. */
function SentenceMenu({ index, block, data, count }: { index: number; block: PaperBlock; data: PaperData; count: number }) {
  const sentence = clipOf(data.clips, block.clip)?.sentences[block.sentence] ?? [];
  const none = block.words.length === 0; const all = block.words.length === sentence.length;
  const key = blockKey(block);
  const move = (where: 'up' | 'down' | 'first') => () => { paper.moveSentence(index, where); refocus(key, '.pp-menu > .ui-button'); };
  return (
    <Popover className="pp-menu" ariaLabel="Sentence actions" title="Sentence actions" label={<Icon name="more" />}>
      {(close) => (
        <div role="menu" aria-label="Sentence actions">
          <MenuItem disabled={none} onClick={() => { close(); hearSentence(block, data); }}>Hear it</MenuItem>
          <MenuItem disabled={index === 0 && !none} onClick={() => { close(); paper.openWith(block.clip, block.sentence); }}>Open with this</MenuItem>
          <hr className="ui-menu-rule" />
          <MenuItem disabled={index === 0} hint={formatKeys(TABLE.paperUp.keys)} onClick={move('up')}>Move up</MenuItem>
          <MenuItem disabled={index === count - 1} hint={formatKeys(TABLE.paperDown.keys)} onClick={move('down')}>Move down</MenuItem>
          <MenuItem disabled={index === 0} onClick={move('first')}>Move to the start</MenuItem>
          <hr className="ui-menu-rule" />
          {none ? null : <MenuItem hint={formatKeys(TABLE.paperCut.keys)} onClick={() => { close(); paper.cutSentence(index); }}>Cut the sentence</MenuItem>}
          {all ? null : <MenuItem onClick={() => { close(); paper.keepAll(index); }}>Keep every word</MenuItem>}
        </div>
      )}
    </Popover>
  );
}

function Transcript({ data }: { data: PaperData }) {
  const blocks = usePaper((s) => s.blocks);
  const read = usePaperView((s) => s.read);
  const root = useRef<HTMLDivElement>(null);
  const [drop, setDrop] = useState<{ index: number; after: boolean } | null>(null);
  const dragging = useRef<number | null>(null);
  const labels = takeLabels(data);
  const hooks = new Set((data.paper.proposals.hooks ?? []).map((h) => `${h.clip}#${h.sentence}`));
  const opening = blocks.findIndex((b) => b.words.length > 0);
  const retakes = data.paper.proposals.retakes ?? [];

  // The word being said is lit straight on the page, so playing does not re-draw the whole transcript.
  useEffect(() => {
    let lit: Element | null = null;
    const light = (now: PlayerState['now']) => {
      lit?.removeAttribute('data-now');
      lit = now ? (root.current?.querySelector(`.pp-word[data-clip="${CSS.escape(now.clip)}"][data-i="${now.index}"]`) ?? null) : null;
      lit?.setAttribute('data-now', 'true');
    };
    light(player.store.getState().now);
    return player.store.subscribe((s, before) => { if (s.now !== before.now) light(s.now); });
  }, [blocks]);

  const onDragOver = (index: number) => (e: DragEvent) => {
    if (dragging.current === null) return;
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    setDrop({ index, after: e.clientY > box.top + box.height / 2 });
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const from = dragging.current;
    if (from !== null && drop) {
      let to = drop.index + (drop.after ? 1 : 0);
      if (from < to) to -= 1;
      paper.moveSentenceTo(from, to);
    }
    dragging.current = null; setDrop(null);
  };

  return (
    <div className={cx('pp-blocks', read && 'is-read')} ref={root} aria-label="The edit, sentence by sentence">
      {blocks.map((b, index) => {
        const clip = clipOf(data.clips, b.clip);
        if (!clip) return null;
        const sentence = clip.sentences[b.sentence] ?? [];
        const first = clip.words[sentence[0] ?? 0];
        const none = b.words.length === 0;
        if (read && none) return null;
        const key = blockKey(b); const label = labels[key];
        const retake = retakes.find((r) => r.clip === b.clip && r.takes.includes(b.sentence));
        return (
          <article
            key={key} className={cx('pp-block', drop?.index === index && (drop.after ? 'is-drop-after' : 'is-drop-before'))}
            data-block={index} data-block-key={key} data-out={none || undefined} aria-label={`Sentence ${index + 1} of ${blocks.length}`}
            onDragOver={onDragOver(index)} onDrop={onDrop}
          >
            <header className="pp-margin">
              <span className="pp-take">{b.clip}</span>
              <span className="pp-time time">{clock(first?.start ?? 0)}</span>
              {index === opening ? <span className="pp-opening">Opening</span> : null}
              {label ? <span className="pp-tag">{label}</span> : null}
              {hooks.has(key) && index !== opening ? <span className="pp-tag">opening idea</span> : null}
              {read ? null : (
                <span className="pp-tools">
                  <span
                    className="pp-handle" role="button" tabIndex={-1} draggable aria-label="Drag to move this sentence" title={`Drag to move. ${formatKeys(TABLE.paperUp.keys)} and ${formatKeys(TABLE.paperDown.keys)} work too.`}
                    onDragStart={(e) => { dragging.current = index; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', key); } catch { /* old browsers */ } }}
                    onDragEnd={() => { dragging.current = null; setDrop(null); }}
                  ><Icon name="grip" /></span>
                  <SentenceMenu index={index} block={b} data={data} count={blocks.length} />
                </span>
              )}
            </header>
            {none ? (
              <p className="pp-gone">
                <span className="pp-gone-text">{sentence.map((i) => clip.words[i]?.text ?? '').join(' ')}</span>
                {retake ? (
                  <Button className="pp-small" onClick={() => paper.chooseTake(b.clip, b.sentence)}>Use this take</Button>
                ) : (
                  <Button className="pp-small" onClick={() => paper.keepAll(index)}>Bring it back</Button>
                )}
              </p>
            ) : (
              <Words block={b} index={index} clip={clip} data={data} />
            )}
          </article>
        );
      })}
    </div>
  );
}

/** The column the transcript is read in, with Edit and Read on top. */
function Document({ data }: { data: PaperData }) {
  const read = usePaperView((s) => s.read);
  const blocks = usePaper((s) => s.blocks);
  const kept = blocks.filter((b) => b.words.length).length;
  return (
    <div className="pp-doc">
      <div className="pp-doc-bar">
        <Segmented label="How to show the transcript" value={read ? 'read' : 'edit'} onChange={(v) => { if ((v === 'read') !== read) usePaperView.getState().toggle(); }}
          options={[{ value: 'edit', label: 'Edit' }, { value: 'read', label: 'Read' }]} />
        <span className="pp-doc-stats">{kept} of {blocks.length} sentences kept</span>
        <span className="pp-keys">Click a word to cut it or bring it back. Shift-click to hear it.</span>
      </div>
      <div className="pp-doc-scroll">
        <Transcript data={data} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the rail

/** One lasting function, so a re-draw does not hand the video over again (which would stop what is playing). */
const attachVideo = (el: HTMLVideoElement | null) => player.attach(el);

function Picture({ data }: { data: PaperData }) {
  const clip = usePlayer((s) => s.clip);
  const said = usePlayer((s) => s.said);
  const soundOnly = clip ? clipOf(data.clips, clip)?.video === false : false;
  useEffect(() => { void player.showOpening(); }, [data]);
  return (
    <div className="pp-watch">
      <div className="pp-frame">
        <video ref={attachVideo} playsInline preload="auto" aria-label="The clip being played" />
        {soundOnly ? <p className="pp-sound-only">This clip is sound only.</p> : null}
        {clip ? <span className="pp-frame-clip">{clip}</span> : null}
      </div>
      <p className="pp-said" aria-live="off">{said}</p>
    </div>
  );
}

/** The length against the target, as a bar with the target marked. */
function Length() {
  const seconds = usePaper((s) => s.check.seconds);
  const target = usePaper((s) => s.data?.paper.target_seconds ?? null);
  const raw = usePaper((s) => (s.data?.clips ?? []).reduce((t, c) => t + (c.duration ?? 0), 0));
  const over = target ? seconds - target : 0;
  const span = Math.max(seconds, target ?? 0) * 1.15 || 1;
  return (
    <section className="pp-card pp-length" aria-label="Length">
      <p className="pp-length-big">
        <strong className="time">{seconds.toFixed(1)} s</strong>
        <span>{target ? `of ${target} s target` : 'no target set'}</span>
        {target ? <em className={cx('pp-length-verdict', over > 0.5 && 'is-over')}>{over > 0.5 ? `${Math.round(over)} s over` : over < -0.5 ? `${Math.round(-over)} s to spare` : 'On target'}</em> : null}
      </p>
      {target ? (
        <div className="pp-length-bar" role="img" aria-label={`${seconds.toFixed(1)} seconds against a ${target} second target`}>
          <i className={cx(over > 0.5 && 'is-over')} style={{ width: `${(seconds / span) * 100}%` }} />
          <b style={{ left: `${(target / span) * 100}%` }} />
        </div>
      ) : null}
      {raw ? <p className="pp-quiet">From {minutes(raw)} of footage. This edit keeps {Math.round((seconds / raw) * 100)}% of it.</p> : null}
    </section>
  );
}

/** Joins worth a listen before sending: listed here, marked in the text. */
function Joins() {
  const all = usePaper((s) => s.check.joins);            // select the stored array; a filtered one would be new on every call
  const joins = all.filter((j) => j.flagged);
  if (!joins.length) return null;
  const open = joins.filter((j) => !j.approved).length;
  return (
    <section className="pp-card" aria-label="Joins to check">
      <h2 className="pp-card-title"><span>Joins to check</span><span className="pp-quiet">{joins.length - open} of {joins.length} checked</span></h2>
      {open ? null : <p className="pp-quiet">Every join has been heard and approved. Each one is marked with a tick in the text.</p>}
      <ul className="pp-list">
        {joins.filter((j) => !j.approved).map((j) => {
          const [clip] = j.after.split(':');
          return (
            <li key={j.key} className={cx('pp-join', j.approved && 'is-done')}>
              <span>{j.reasons.join('; ')}{clip ? <span className="pp-quiet"> ({clip})</span> : null}</span>
              <span className="pp-row">
                <Button className="pp-small" onClick={() => document.querySelector<HTMLElement>(`[data-join="${CSS.escape(j.key)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })}>Show it</Button>
                <Button className="pp-small" onClick={() => paper.toggleJoin(j.key)}>{j.approved ? 'Undo' : 'It keeps the meaning'}</Button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Ideas({ data }: { data: PaperData }) {
  const blocks = usePaper((s) => s.blocks);
  const hooks = data.paper.proposals.hooks ?? [];
  const opening = blocks.find((b) => b.words.length > 0);
  if (!hooks.length) return null;
  return (
    <section className="pp-card" aria-label="Ideas for the opening line">
      <h2 className="pp-card-title"><span>Open with</span><span className="pp-quiet">{hooks.length} ideas from Claude</span></h2>
      <ul className="pp-ideas">
        {hooks.map((h) => {
          const now = opening?.clip === h.clip && opening.sentence === h.sentence;
          return (
            <li key={`${h.clip}#${h.sentence}`} className={cx(now && 'is-now')}>
              <q>{h.text}</q>
              <span className="pp-row">
                <span className="pp-why">{h.reasons.join(', ') || 'no strong signal'}</span>
                {now ? <span className="pp-now"><Icon name="circleCheck" size={14} />Opening now</span>
                  : <Button className="pp-small" onClick={() => paper.openWith(h.clip, h.sentence)}>Open with this</Button>}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A line said more than once is a choice of take, not a workaround. */
function Takes({ data }: { data: PaperData }) {
  const blocks = usePaper((s) => s.blocks);
  const retakes = data.paper.proposals.retakes ?? [];
  if (!retakes.length) return null;
  return (
    <section className="pp-card" aria-label="Lines said more than once">
      <h2 className="pp-card-title"><span>Said more than once</span></h2>
      {retakes.map((r) => {
        const clip = clipOf(data.clips, r.clip);
        return (
          <div key={`${r.clip}:${r.takes.join(',')}`} className="pp-takes" role="radiogroup" aria-label={`Takes in ${r.clip}`}>
            {r.takes.map((t, n) => {
              const block = blocks.find((b) => b.clip === r.clip && b.sentence === t);
              const on = !!block?.words.length;
              const text = (clip?.sentences[t] ?? []).map((i) => clip?.words[i]?.text ?? '').join(' ');
              return (
                <label key={t} className={cx('pp-take-option', on && 'is-on')}>
                  <input type="radio" name={`take-${r.clip}-${r.takes.join('-')}`} checked={on} onChange={() => paper.chooseTake(r.clip, t)} />
                  <span>{text}<small>Take {n + 1} of {r.takes.length}{t === r.keep ? ', the one proposed' : ''}</small></span>
                </label>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function CleanUp({ data }: { data: PaperData }) {
  const blocks = usePaper((s) => s.blocks);
  let cut = 0; let maybe = 0; let left = 0;
  for (const b of blocks) {
    if (!b.words.length) continue;
    const clip = clipOf(data.clips, b.clip); const kept = new Set(b.words);
    for (const i of clip?.sentences[b.sentence] ?? []) {
      const w = clip?.words[i];
      if (!w) continue;
      if (isFiller(w)) { if (kept.has(i)) left++; else cut++; }
      else if (w.filler === 'maybe' && kept.has(i)) maybe++;
    }
  }
  if (!cut && !left && !maybe) return null;
  return (
    <section className="pp-card" aria-label="Clean-up">
      <h2 className="pp-card-title"><span>Clean-up</span></h2>
      <p className="pp-row pp-between">
        <span><strong>{cut}</strong> filler word{cut === 1 ? '' : 's'} cut{left ? `, ${left} kept` : ''}</span>
        {left ? <Button className="pp-small" onClick={() => paper.fillers(true)}>Cut them all</Button>
          : cut ? <Button className="pp-small" onClick={() => paper.fillers(false)}>Bring them back</Button> : null}
      </p>
      {maybe ? <p className="pp-quiet">{maybe} word{maybe === 1 ? ' is' : 's are'} maybe a filler, underlined in the text. Click one to cut it.</p> : null}
    </section>
  );
}

function Rail({ data }: { data: PaperData }) {
  const note = usePaper((s) => s.note);
  return (
    <div className="pp-rail">
      <Picture data={data} />
      <Length />
      <Joins />
      <Ideas data={data} />
      <Takes data={data} />
      <CleanUp data={data} />
      <section className="pp-card" aria-label="Note for the editor">
        <Field label="Anything for the editor" multiline rows={3} value={note} onChange={(v) => paper.setNote(v)}
          placeholder="Optional: the feel, what must stay, what to try" />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- the strip under the transcript

function Transport() {
  const playing = usePlayer((s) => s.playing);
  const clip = usePlayer((s) => s.clip);
  const time = usePlayer((s) => s.time);
  const run = usePlayer((s) => s.run);
  const runs = usePaper((s) => s.check.runs);
  const target = usePaper((s) => s.data?.paper.target_seconds ?? null);
  const total = runs.reduce((t, r) => t + Math.max(0, r.end - r.start), 0) || 1;
  const span = Math.max(total, target ?? 0);
  return (
    <div className="pp-transport">
      <div className="pp-bar">
        <Button onClick={() => void player.playEdit()} disabled={!runs.length}><Icon name="play" />Play the edit</Button>
        <Button variant="quiet" onClick={() => player.stop()} disabled={!playing}><Icon name="pause" />Stop</Button>
        <span className="pp-time time">{clip ? `${clip} ${clock(time)}` : ''}</span>
        <p className="pp-keys">Space plays or stops the edit. Each block is one stretch of a take.</p>
      </div>
      {runs.length ? (
        <div className="pp-strip-wrap">
          <ol className="pp-strip" aria-label="The edit in order. Pick a stretch to play from there." style={{ width: `${(total / span) * 100}%` }}>
            {runs.map((r, i) => (
              <li key={i} style={{ flexGrow: Math.max(0.02, (r.end - r.start) / total) }}>
                <button type="button" className="pp-run" aria-current={playing === 'edit' && run === i ? 'true' : undefined} onClick={() => void player.playEdit(i)}
                  aria-label={`Stretch ${i + 1} of ${runs.length}: ${r.clip}, ${clock(r.start)} to ${clock(r.end)}. Play from here.`}>
                  <span className="time">{r.clip} {clock(r.start)}</span>
                </button>
              </li>
            ))}
          </ol>
          {target ? <span className="pp-target" style={{ left: `${(target / span) * 100}%` }}><span>Target {target} s</span></span> : null}
        </div>
      ) : <p className="pp-keys">Nothing is kept yet, so there is nothing to play.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- the decision and the bar

/** The send panel: ready for the rough cut, or with notes and not ready yet. The note for the editor goes with it. */
function SendPanel() {
  const note = usePaper((s) => s.note);
  const open = usePaper((s) => openJoins(s.check));
  const result = usePaper((s) => s.result);
  return (
    <section className="send-panel" aria-label="When it reads right">
      <h2 className="send-title">Send for the rough cut</h2>
      <p className="send-text">
        Claude cuts the footage to this paper edit. Read it once in Read view first: that is how it will sound.
        {note.trim() ? ' Your note for the editor goes with it.' : ' A note for the editor can go with it: write it in the side panel.'}
        {open ? ` ${open} join${open > 1 ? 's are' : ' is'} not checked yet, so it can only go with notes.` : ''}
      </p>
      <div className="send-actions">
        <Button variant="primary" onClick={() => void paper.send('ok')}><Icon name="send" />Send: ready for the rough cut</Button>
        <Button onClick={() => void paper.send('notes')}>Send with notes, not ready yet</Button>
      </div>
      <p className="pp-result" role="status" data-bad={result?.bad || undefined} hidden={!result}>{result?.text}</p>
    </section>
  );
}

/** The one decision: check the joins first, then send. While joins are open, sending with notes stays one click away. */
function PaperDecision() {
  const open = usePaper((s) => openJoins(s.check));
  const sent = usePaper((s) => s.sent);
  const panel = () => <SendPanel />;
  if (open) {
    const firstFlag = () => {
      const el = document.querySelector<HTMLElement>('.pp-flag:not([data-approved])');
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.querySelector<HTMLButtonElement>('button')?.focus();
    };
    return (
      <span className="decision decision--split">
        <Button variant="primary" onClick={firstFlag}><Icon name="flag" />Check {open} join{open > 1 ? 's' : ''}</Button>
        <Popover variant="primary" align="end" ariaLabel="More choices" title="Send anyway" label={<Icon name="down" />} panelClassName="send-popover">{panel}</Popover>
      </span>
    );
  }
  return (
    <Popover className="decision" variant={sent ? 'default' : 'primary'} align="end" ariaLabel={sent ? 'Sent for the rough cut' : 'Send for the rough cut'}
      label={<><Icon name={sent ? 'circleCheck' : 'send'} />{sent ? 'Sent for the rough cut' : 'Send for the rough cut'}</>} panelClassName="send-popover">
      {panel}
    </Popover>
  );
}

function TopBar({ modeSwitch, onJob }: { modeSwitch: ReactNode; onJob(job: string): void }) {
  const jobs = usePaper((s) => s.jobs);
  const job = usePaper((s) => s.job);
  const ready = usePaper((s) => s.status === 'ready');
  const label = usePaper((s) => paper.saveLabel(s));
  const failed = usePaper((s) => s.save === 'failed');
  const saveMessage = usePaper((s) => s.saveMessage);
  const canUndo = useHistory((s) => s.canUndo);
  const canRedo = useHistory((s) => s.canRedo);
  const labels = useHistory((s) => s.labels);
  return (
    <div className="app-bar">
      <div className="app-where">
        <h1 className="app-title">Video Studio</h1>
        {jobs.length && job ? (
          <Select label="Video" hideLabel value={job} onChange={onJob} options={jobs.map((j) => ({ value: j.job, label: `${j.name}${j.status === 'sent' ? ' (sent)' : ''}` }))} />
        ) : null}
      </div>
      <div className="app-mid">{modeSwitch}</div>
      <div className="app-act">
        {label ? (
          <Tooltip label={saveMessage ?? 'The paper edit saves by itself.'}>
            <span className={cx('app-status', failed && 'app-save-failed')} role="status">
              {label === 'Saved' || label === 'Sent' ? <Icon name="circleCheck" size={14} /> : null}{label}
            </span>
          </Tooltip>
        ) : null}
        <Button variant="quiet" className="app-icon" disabled={!canUndo} aria-label={labels.undo ? `Undo: ${lower(labels.undo)}` : 'Undo'} title={labels.undo ? `Undo: ${lower(labels.undo)}` : 'Nothing to undo'} onClick={() => history.undo()}><Icon name="undo" /></Button>
        <Button variant="quiet" className="app-icon" disabled={!canRedo} aria-label={labels.redo ? `Redo: ${lower(labels.redo)}` : 'Redo'} title={labels.redo ? `Redo: ${lower(labels.redo)}` : 'Nothing to redo'} onClick={() => history.redo()}><Icon name="redo" /></Button>
        <Button variant="quiet" className="app-icon" aria-label="Find a command" title={`Find a command (${formatKeys(TABLE.menu.keys)})`} onClick={() => openMenu()}><Icon name="search" /></Button>
        <Button variant="quiet" className="app-icon app-keys" aria-label="Keyboard shortcuts" title={`Keyboard shortcuts (${formatKeys(TABLE.sheet.keys)})`} onClick={() => openSheet()}><Icon name="keyboard" /></Button>
        <YouMenu panelNames={{ right: 'Side panel', timeline: 'Edit strip' }} />
        {ready ? <PaperDecision /> : null}
      </div>
    </div>
  );
}

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="pp-notice" role="status"><h2>{title}</h2>{children ? <p>{children}</p> : null}</div>;
}

// ---------------------------------------------------------------- the mode

const param = (name: string) => new URLSearchParams(window.location.search).get(name);
function setJobParam(job: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('job', job);
  window.history.replaceState(null, '', url);
}
/** Where the focus lands in a sentence after a key moved or cut it: a word, or the button of a sentence cut whole. */
const FOCUS_IN_SENTENCE = '.pp-word, .pp-gone .ui-button';
/** The sentence the keyboard focus is in, for the sentence keys. */
function focusedBlock(): { index: number; key: string } | null {
  const el = document.activeElement?.closest<HTMLElement>('[data-block]');
  return el ? { index: Number(el.dataset.block), key: el.dataset.blockKey ?? '' } : null;
}

/** Paper edit mode: the transcript of raw footage, cut by clicking words. `modeSwitch` is the Review / Paper edit control. */
export function PaperEdit({ modeSwitch }: { modeSwitch: ReactNode }) {
  const status = usePaper((s) => s.status);
  const jobsStatus = usePaper((s) => s.jobsStatus);
  const noJobs = usePaper((s) => s.jobsStatus === 'ready' && s.jobs.length === 0);
  const message = usePaper((s) => s.message);
  const data = usePaper((s) => s.data);
  const job = usePaper((s) => s.job);
  useShortcuts();

  useEffect(() => {
    // A name typed on the old paper page is taken over, once.
    try { if (!useReviewer.getState().name) { const old = localStorage.getItem('paper-who') || localStorage.getItem('who'); if (old) useReviewer.getState().setName(old); } } catch { /* no storage */ }
    void paper.start(param('job'));
    const sentence = (run: (index: number) => void, focusOn: string) => () => { const b = focusedBlock(); if (b) { run(b.index); refocus(b.key, focusOn); } };
    const stops = [
      registerCoreShortcuts(history),
      registerPlaybackShortcuts({ playPause: () => player.toggle() }),
      registerPaperShortcuts({
        paperUp: sentence((i) => paper.moveSentence(i, 'up'), FOCUS_IN_SENTENCE),
        paperDown: sentence((i) => paper.moveSentence(i, 'down'), FOCUS_IN_SENTENCE),
        paperCut: sentence((i) => (paper.store.getState().blocks[i]?.words.length ? paper.cutSentence(i) : paper.keepAll(i)), FOCUS_IN_SENTENCE),
        paperStop: () => player.stop(),
        paperRead: () => usePaperView.getState().toggle(),
      }),
      registerPanelShortcuts({
        toggleRight: () => usePanelsStore.getState().toggle('right'),
        toggleTimeline: () => usePanelsStore.getState().toggle('timeline'),
        toggleTheme: () => useTheme.getState().setTheme(useTheme.getState().theme === 'night' ? 'paper' : 'night'),
      }),
    ];
    const save = () => void paper.flush().catch(() => {});
    window.addEventListener('pagehide', save);
    return () => { stops.forEach((stop) => stop()); window.removeEventListener('pagehide', save); save(); player.attach(null); };
  }, []);
  useEffect(() => { if (job) setJobParam(job); }, [job]);

  const pick = (next: string) => { player.reset(); void paper.open(next); };
  const ready = status === 'ready' && data !== null;
  let notice: ReactNode = null;
  if (jobsStatus === 'failed') notice = <Notice title="The studio did not answer">{message}</Notice>;
  else if (noJobs) notice = (
    <Notice title="No paper edits yet">
      A video shows up here once its footage is ingested and the first paper edit is made. Run the footage tool's ingest step for the job
      (node tools/footage/footage.mjs ingest jobs/your-job), then its paper step (node tools/footage/footage.mjs paper jobs/your-job). Then reload this page.
    </Notice>
  );
  else if (status === 'failed') notice = <Notice title="This paper edit could not be opened">{message}</Notice>;
  else if (!ready) notice = <Notice title="Loading the paper edit…" />;

  return (
    <>
      <Shell
        topBar={<TopBar modeSwitch={modeSwitch} onJob={pick} />}
        toggles={false}
        names={{ right: 'Side', timeline: 'Edit strip' }}
        canvas={notice ?? (data ? <Document data={data} /> : null)}
        right={ready && data ? <Rail data={data} /> : null}
        timeline={ready ? <Transport /> : null}
      />
      <ShortcutSheet />
      <CommandMenu />
      <Toasts />
    </>
  );
}
