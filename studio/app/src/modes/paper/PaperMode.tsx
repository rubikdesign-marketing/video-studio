import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { useStore } from 'zustand';
import type { PaperBlock, PaperClip, PaperData, PaperJoin } from '../../api';
import { useReviewer } from '../../notes';
import { Shell } from '../../shell';
import { CommandMenu, ShortcutSheet, registerCoreShortcuts, registerPanelShortcuts, registerPlaybackShortcuts, useShortcuts } from '../../shortcuts';
import { registerPaperShortcuts } from '../../shortcuts/table';
import { history, useHistory } from '../../store';
import { usePanelsStore } from '../../shell';
import { ThemeSwitch, useTheme } from '../../theme';
import { Button, Chip, Field, Select, Toasts, Tooltip } from '../../ui';
import { paper, player } from './instance';
import './paper.css';
import type { PlayerState } from './player';
import type { PaperState } from './store';
import { clipOf, clock, isFiller, keyOf, lengthLine, takeLabels } from './words';

const usePaper = <T,>(select: (s: PaperState) => T): T => useStore(paper.store, select);
const usePlayer = <T,>(select: (s: PlayerState) => T): T => useStore(player.store, select);
const blockKey = (b: PaperBlock) => `${b.clip}#${b.sentence}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** After a sentence moves, puts the keyboard focus back on the same control in its new place. */
function refocus(key: string, selector: string) {
  const again = () => document.querySelector<HTMLElement>(`[data-block-key="${CSS.escape(key)}"] ${selector}`)?.focus();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(again); else again();
}

// ---------------------------------------------------------------- the transcript

function Words({ block, index, clip, data }: { block: PaperBlock; index: number; clip: PaperClip; data: PaperData }) {
  const keepPauses = usePaper((s) => s.keepPauses);
  const joins = usePaper((s) => s.check.joins);
  const kept = new Set(block.words);
  const sentence = clip.sentences[block.sentence] ?? [];
  const pauses = new Map((data.paper.proposals.pauses ?? []).filter((p) => p.clip === block.clip).map((p) => [p.after, p]));
  const flags = new Map<string, PaperJoin>(joins.filter((j) => j.flagged).map((j) => [j.after, j]));

  const act = (i: number, shift: boolean) => (shift ? void player.hear(block.clip, i) : paper.toggleWord(index, i));
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
        const pause = pauses.get(i); const flag = flags.get(k);
        const keptPause = keepPauses.includes(k);
        return (
          <span key={i}>
            <span
              className="pp-word" role="button" tabIndex={0} aria-pressed={cut} title={clock(w.start)}
              data-clip={block.clip} data-i={i} data-cut={cut || undefined}
              data-filler={!cut && isFiller(w) ? true : undefined} data-maybe={!cut && w.filler === 'maybe' ? true : undefined}
              onClick={(e: MouseEvent) => act(i, e.shiftKey)} onKeyDown={onKey(i)}
            >{w.text}</span>{' '}
            {pause ? (
              <>
                <Chip className="pp-pause" selected={keptPause} onClick={() => paper.togglePause(k)}>
                  {keptPause ? `pause ${pause.seconds} s kept` : `pause ${pause.seconds} s → ${pause.to} s`}
                </Chip>{' '}
              </>
            ) : null}
            {flag ? (
              <span className="pp-flag" data-approved={flag.approved || undefined} role="note">
                <span>{flag.approved ? 'Approved: ' : 'Check this join: '}{flag.reasons.join('; ')}</span>
                <Button className="pp-small" onClick={() => paper.toggleJoin(flag.key)}>{flag.approved ? 'Undo' : 'It keeps the meaning'}</Button>
              </span>
            ) : null}
          </span>
        );
      })}
    </p>
  );
}

function Transcript({ data }: { data: PaperData }) {
  const blocks = usePaper((s) => s.blocks);
  const root = useRef<HTMLDivElement>(null);
  const labels = takeLabels(data);
  const hooks = new Set((data.paper.proposals.hooks ?? []).map((h) => `${h.clip}#${h.sentence}`));

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

  const tool = (index: number, key: string, name: string, run: () => void) => () => { run(); refocus(key, `[data-act="${name}"]`); };
  return (
    <div className="pp-blocks" ref={root} aria-label="The edit, sentence by sentence">
      {blocks.map((b, index) => {
        const clip = clipOf(data.clips, b.clip);
        if (!clip) return null;
        const sentence = clip.sentences[b.sentence] ?? [];
        const first = clip.words[sentence[0] ?? 0];
        const all = b.words.length === sentence.length; const none = b.words.length === 0;
        const key = blockKey(b); const label = labels[key];
        return (
          <article key={key} className="pp-block" data-block={index} data-block-key={key} data-out={none || undefined} aria-label={`Sentence ${index + 1} of ${blocks.length}`}>
            <header className="pp-block-head">
              <span className="time">{b.clip} · {clock(first?.start ?? 0)}</span>
              {label ? <Chip className="pp-tag pp-tag--take">{label}</Chip> : null}
              {hooks.has(key) ? <Chip className="pp-tag pp-tag--hook">opening idea</Chip> : null}
              <span className="pp-tools">
                <Button className="pp-small" variant="quiet" data-act="up" aria-label="Move up" disabled={index === 0} onClick={tool(index, key, 'up', () => paper.moveSentence(index, 'up'))}>Up</Button>
                <Button className="pp-small" variant="quiet" data-act="down" aria-label="Move down" disabled={index === blocks.length - 1} onClick={tool(index, key, 'down', () => paper.moveSentence(index, 'down'))}>Down</Button>
                <Button className="pp-small" variant="quiet" data-act="first" disabled={index === 0} onClick={() => paper.moveSentence(index, 'first')}>To the start</Button>
                {none
                  ? <Button className="pp-small" variant="quiet" data-act="all" onClick={() => paper.keepAll(index)}>Keep all</Button>
                  : <Button className="pp-small" variant="quiet" data-act="none" onClick={() => paper.cutSentence(index)}>Cut sentence</Button>}
                {!all && !none ? <Button className="pp-small" variant="quiet" data-act="all" onClick={() => paper.keepAll(index)}>Keep all</Button> : null}
              </span>
            </header>
            <Words block={b} index={index} clip={clip} data={data} />
          </article>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- the picture and the bar under it

/** One lasting function, so a re-draw does not hand the video over again (which would stop what is playing). */
const attachVideo = (el: HTMLVideoElement | null) => player.attach(el);

function Stage({ data }: { data: PaperData }) {
  const clip = usePlayer((s) => s.clip);
  const said = usePlayer((s) => s.said);
  const soundOnly = clip ? clipOf(data.clips, clip)?.video === false : false;
  useEffect(() => { void player.showOpening(); }, [data]);
  return (
    <div className="pp-stage">
      <div className="pp-watch">
        <div className="pp-frame">
          <video ref={attachVideo} playsInline preload="auto" aria-label="The clip being played" />
          {soundOnly ? <p className="pp-sound-only">This clip is sound only.</p> : null}
        </div>
        <p className="pp-said" aria-live="off">{said}</p>
      </div>
      <Transcript data={data} />
    </div>
  );
}

function Transport() {
  const playing = usePlayer((s) => s.playing);
  const clip = usePlayer((s) => s.clip);
  const time = usePlayer((s) => s.time);
  const run = usePlayer((s) => s.run);
  const runs = usePaper((s) => s.check.runs);
  const total = runs.reduce((t, r) => t + Math.max(0, r.end - r.start), 0) || 1;
  return (
    <div className="pp-transport">
      <div className="pp-bar">
        <Button variant="primary" onClick={() => void player.playEdit()} disabled={!runs.length}>Play the edit</Button>
        <Button onClick={() => player.stop()} disabled={!playing}>Stop</Button>
        <span className="pp-time time">{clip ? `${clip} ${clock(time)}` : ''}</span>
        <p className="pp-keys">Click a word to cut it or bring it back. Shift-click to hear it. Space plays or stops the edit.</p>
      </div>
      {runs.length ? (
        <ol className="pp-strip" aria-label="The edit in order. Pick a stretch to play from there.">
          {runs.map((r, i) => (
            <li key={i} style={{ flexGrow: Math.max(0.02, (r.end - r.start) / total) }}>
              <button type="button" className="pp-run" aria-current={playing === 'edit' && run === i ? 'true' : undefined} onClick={() => void player.playEdit(i)}
                aria-label={`Stretch ${i + 1} of ${runs.length}: ${r.clip}, ${clock(r.start)} to ${clock(r.end)}. Play from here.`}>
                <span className="time">{r.clip} {clock(r.start)}</span>
              </button>
            </li>
          ))}
        </ol>
      ) : <p className="pp-keys">Nothing is kept yet, so there is nothing to play.</p>}
    </div>
  );
}

// ---------------------------------------------------------------- the side panels

function Card({ title, children }: { title: string; children: ReactNode }) {
  return <section className="pp-card" aria-label={title}><h2 className="pp-card-title">{title}</h2>{children}</section>;
}

function Ideas({ data }: { data: PaperData }) {
  const hooks = data.paper.proposals.hooks ?? [];
  const retakes = data.paper.proposals.retakes ?? [];
  return (
    <>
      <Card title="Ideas for the opening line">
        {hooks.length ? (
          <ul className="pp-ideas">
            {hooks.map((h) => (
              <li key={`${h.clip}#${h.sentence}`}>
                <div>“{h.text}”<small>{h.reasons.join(', ') || 'no strong signal'}</small></div>
                <Button className="pp-small" onClick={() => paper.openWith(h.clip, h.sentence)}>Open with it</Button>
              </li>
            ))}
          </ul>
        ) : <p>No sentences yet.</p>}
      </Card>
      {retakes.length ? (
        <Card title="Lines said more than once">
          {retakes.map((r, i) => (
            <p key={i}>{r.clip}: said {r.takes.length} times. The last complete take is kept and the others are cut; to swap, cut the kept one and click <strong>Keep all</strong> on another.</p>
          ))}
        </Card>
      ) : null}
    </>
  );
}

function SendBox() {
  const note = usePaper((s) => s.note);
  const result = usePaper((s) => s.result);
  return (
    <Card title="When it reads right">
      <Field label="Anything for the editor" multiline rows={4} value={note} onChange={(v) => paper.setNote(v)}
        placeholder="Anything for the editor (optional): the feel, what must stay, what to try" />
      <Button variant="primary" className="pp-send" onClick={() => void paper.send('ok')}>Send: ready for the rough cut</Button>
      <Button className="pp-send" onClick={() => void paper.send('notes')}>Send with notes, not ready yet</Button>
      <p className="pp-result" role="status" data-bad={result?.bad || undefined} hidden={!result}>{result?.text}</p>
    </Card>
  );
}

function TopBar({ modeSwitch, onJob }: { modeSwitch: ReactNode; onJob(job: string): void }) {
  const jobs = usePaper((s) => s.jobs);
  const job = usePaper((s) => s.job);
  const ready = usePaper((s) => s.status === 'ready');
  const check = usePaper((s) => s.check);
  const target = usePaper((s) => s.data?.paper.target_seconds);
  const label = usePaper((s) => paper.saveLabel(s));
  const failed = usePaper((s) => s.save === 'failed');
  const saveMessage = usePaper((s) => s.saveMessage);
  const canUndo = useHistory((s) => s.canUndo);
  const canRedo = useHistory((s) => s.canRedo);
  const labels = useHistory((s) => s.labels);
  const reviewer = useReviewer();
  const length = lengthLine(check, target);
  return (
    <div className="app-bar">
      <h1 className="app-title">Video Studio</h1>
      {modeSwitch}
      {jobs.length && job ? (
        <Select label="Video" hideLabel value={job} onChange={onJob} options={jobs.map((j) => ({ value: j.job, label: `${j.name}${j.status === 'sent' ? ' (sent)' : ''}` }))} />
      ) : null}
      {ready ? <Chip className={length.over ? 'pp-length pp-length--over' : 'pp-length'}><span className="time">{length.text}</span></Chip> : null}
      <span className="app-spacer" />
      {label ? (
        <Tooltip label={saveMessage ?? 'The paper edit saves by itself.'}>
          <Chip className={failed ? 'app-save-failed' : undefined}>{label}</Chip>
        </Tooltip>
      ) : null}
      <Tooltip label={labels.undo ? `Undo: ${lower(labels.undo)}` : 'Nothing to undo'}>
        <Button variant="quiet" disabled={!canUndo} onClick={() => history.undo()}>Undo</Button>
      </Tooltip>
      <Tooltip label={labels.redo ? `Redo: ${lower(labels.redo)}` : 'Nothing to redo'}>
        <Button variant="quiet" disabled={!canRedo} onClick={() => history.redo()}>Redo</Button>
      </Tooltip>
      <span className="app-reviewer">
        <Field label="Your name" hideLabel placeholder="Your name" value={reviewer.name} onChange={reviewer.setName} />
      </span>
      <ThemeSwitch />
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
        paperUp: sentence((i) => paper.moveSentence(i, 'up'), '.pp-word'),
        paperDown: sentence((i) => paper.moveSentence(i, 'down'), '.pp-word'),
        paperCut: sentence((i) => (paper.store.getState().blocks[i]?.words.length ? paper.cutSentence(i) : paper.keepAll(i)), '.pp-word'),
        paperStop: () => player.stop(),
      }),
      registerPanelShortcuts({
        toggleLeft: () => usePanelsStore.getState().toggle('left'),
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
        left={ready && data ? <Ideas data={data} /> : null}
        canvas={notice ?? (data ? <Stage data={data} /> : null)}
        right={ready ? <SendBox /> : null}
        timeline={ready ? <Transport /> : null}
      />
      <ShortcutSheet />
      <CommandMenu />
      <Toasts />
    </>
  );
}
