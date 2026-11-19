import { useEffect, useState, type ReactNode } from 'react';
import { api, plainMessage, type JobSummary } from './api';
import { Canvas, useCanvas, versionOptions } from './canvas';
import { Inspector } from './inspector';
import { PaperEdit } from './modes/paper';
import { Decision, Rail, sendFromPage, startNote, toggleMarking, useComposer, useRail, useReviewer } from './notes';
import { registerPlaybackShortcuts, usePlayback } from './playback';
import { Shell, usePanelsStore } from './shell';
import { CommandMenu, ShortcutSheet, TABLE, formatKeys, openMenu, openSheet, registerCoreShortcuts, registerNoteShortcuts, registerPanelShortcuts, useShortcuts } from './shortcuts';
import { editor, history, useFilm, useHistory, useNotes, useSaveLabel, useSaving, useSelection } from './store';
import { ThemeSwitch, useTheme } from './theme';
import { Timeline } from './timeline';
import { Button, Field, Icon, MenuItem, Popover, Segmented, Select, Toasts, Tooltip, cx, showToast } from './ui';
import { sceneAt } from './canvas';
import './App.css';

const param = (name: string) => new URLSearchParams(window.location.search).get(name);
function setParams(change: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(change)) {
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  window.history.replaceState(null, '', url);
}

type Jobs = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'ready'; jobs: JobSummary[] };

/** Reads the list of films, and opens the one named in the address (`?job=`), or the first. */
function useOpenJob(): { jobs: Jobs; job: string | null; open(job: string): void; retry(): void } {
  const [jobs, setJobs] = useState<Jobs>({ status: 'loading' });
  const [job, setJob] = useState<string | null>(() => param('job'));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setJobs({ status: 'loading' });
    api.listJobs().then(
      (list) => {
        if (!current) return;
        setJobs({ status: 'ready', jobs: list });
        setJob((wanted) => wanted ?? list[0]?.job ?? null);
      },
      (error: unknown) => current && setJobs({ status: 'failed', message: plainMessage(error) }),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!job) return;
    const wanted = param('v');
    void editor.open(job).then(() => {
      if (wanted) editor.chooseVideo(wanted);
    });
  }, [job, attempt]);

  return {
    jobs,
    job,
    open(next) {
      setParams({ job: next, v: null });
      setJob(next);
    },
    retry: () => setAttempt((n) => n + 1),
  };
}

/** A plain message in the middle of the canvas: loading, nothing to show, or something went wrong. */
function Notice({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="app-notice" role="status">
      <h2 className="app-notice-title">{title}</h2>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

/** Your name on notes, the theme, and which panels show. Set once, so kept out of the bar. */
function YouMenu() {
  const reviewer = useReviewer();
  const panels = usePanelsStore();
  const initials = reviewer.name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]?.toUpperCase()).slice(0, 2).join('');
  return (
    <Popover className="app-you" align="end" ariaLabel={reviewer.name ? `You: ${reviewer.name}` : 'You: name, theme and panels'}
      label={initials ? <span className="app-initials">{initials}</span> : <Icon name="user" />} panelClassName="app-you-panel">
      {() => (
        <div className="app-you-body">
          <span data-reviewer>
            <Field label="Your name, shown on notes you send" value={reviewer.name} onChange={reviewer.setName} placeholder="For example, Maya" />
          </span>
          <div className="app-you-row"><span>Theme</span><ThemeSwitch /></div>
          <div role="group" aria-label="Panels">
            <p className="ui-menu-title">Show</p>
            <MenuItem checked={panels.isOpen('right')} hint={formatKeys(TABLE.toggleRight.keys)} onClick={() => panels.toggle('right')}>Notes panel</MenuItem>
            <MenuItem checked={panels.isOpen('timeline')} hint={formatKeys(TABLE.toggleTimeline.keys)} onClick={() => panels.toggle('timeline')}>Timeline</MenuItem>
          </div>
        </div>
      )}
    </Popover>
  );
}

/** Where the film stands, in one quiet line: saved, rendering, reconnecting, or a new version to watch. */
function Status() {
  const rendering = useFilm((s) => s.rendering);
  const newVersion = useFilm((s) => s.newVersion);
  const video = useFilm((s) => s.video);
  const live = useFilm((s) => s.live);
  const save = useSaveLabel();
  if (newVersion && newVersion !== video) {
    return (
      <Button className="app-new-version" onClick={() => { editor.chooseVideo(newVersion); setParams({ v: newVersion }); }}>
        <Icon name="play" />
        New version ready. Watch it
      </Button>
    );
  }
  if (rendering.active) {
    return (
      <span className="app-status" role="status">
        <span className="app-status-spin" aria-hidden="true" />
        {rendering.scene && rendering.of ? `Rendering scene ${rendering.scene} of ${rendering.of}` : `Rendering, ${Math.round(rendering.elapsed)} s so far`}
      </span>
    );
  }
  if (live === 'reconnecting') return <span className="app-status" role="status">Reconnecting to the studio…</span>;
  return (
    <Tooltip label={save.message ?? 'Notes and text changes save by themselves.'}>
      <span className={cx('app-status', save.status === 'failed' && 'app-save-failed')} role="status">
        {save.status === 'saved' ? <Icon name="circleCheck" size={14} /> : null}
        {save.label}
      </span>
    </Tooltip>
  );
}

function TopBar({ jobs, job, onJob, modeSwitch, decision }: { jobs: JobSummary[]; job: string | null; onJob(job: string): void; modeSwitch: ReactNode; decision?: ReactNode }) {
  const videos = useFilm((s) => s.videos);
  const video = useFilm((s) => s.video);
  const canUndo = useHistory((s) => s.canUndo);
  const canRedo = useHistory((s) => s.canRedo);
  const labels = useHistory((s) => s.labels);
  const name = jobs.find((j) => j.job === job)?.name ?? job ?? '';
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

  return (
    <div className="app-bar">
      <div className="app-where">
        <h1 className="app-title">Video Studio</h1>
        {jobs.length > 1 && job ? (
          <Select label="Film" hideLabel value={job} onChange={onJob} options={jobs.map((j) => ({ value: j.job, label: j.name }))} />
        ) : name ? (
          <span className="app-film">{name}</span>
        ) : null}
        {video && videos.length ? (
          <Select
            label="Version"
            hideLabel
            value={video}
            onChange={(file) => {
              editor.chooseVideo(file);
              setParams({ v: file });
            }}
            options={versionOptions(videos)}
          />
        ) : null}
      </div>
      <div className="app-mid">{modeSwitch}</div>
      <div className="app-act">
        <Status />
        <Button variant="quiet" className="app-icon" disabled={!canUndo} aria-label={labels.undo ? `Undo: ${lower(labels.undo)}` : 'Undo'} title={labels.undo ? `Undo: ${lower(labels.undo)}` : 'Nothing to undo'} onClick={() => history.undo()}>
          <Icon name="undo" />
        </Button>
        <Button variant="quiet" className="app-icon" disabled={!canRedo} aria-label={labels.redo ? `Redo: ${lower(labels.redo)}` : 'Redo'} title={labels.redo ? `Redo: ${lower(labels.redo)}` : 'Nothing to redo'} onClick={() => history.redo()}>
          <Icon name="redo" />
        </Button>
        <Button variant="quiet" className="app-icon" aria-label="Find a command" title={`Find a command (${formatKeys(TABLE.menu.keys)})`} onClick={() => openMenu()}>
          <Icon name="search" />
        </Button>
        <Button variant="quiet" className="app-icon app-keys" aria-label="Keyboard shortcuts" title={`Keyboard shortcuts (${formatKeys(TABLE.sheet.keys)})`} onClick={() => openSheet()}>
          <Icon name="keyboard" />
        </Button>
        <YouMenu />
        {decision}
      </div>
    </div>
  );
}

/** Shown when the film was rendered again under unsaved text changes. */
function StaleNotice() {
  const stale = useSaving((s) => s.stale);
  const message = useSaving((s) => s.message);
  if (!stale) return null;
  const reload = () =>
    void editor.reloadFilm().then(
      (result) => showToast(result.message ?? 'The film is up to date. Your text changes were kept.', { tone: result.dropped ? 'warn' : 'good' }),
      (error: unknown) => showToast(plainMessage(error), { tone: 'warn' }),
    );
  return (
    <div className="app-stale" role="alert">
      <p>{message}</p>
      <Button variant="primary" onClick={reload}>
        Reload the film
      </Button>
    </div>
  );
}

/** Every key this page answers to, registered once. The playback keys are the timeline's to add. */
function usePageShortcuts() {
  useShortcuts();
  useEffect(() => {
    const openRight = () => {
      const panels = usePanelsStore.getState();
      if (!panels.isOpen('right')) panels.toggle('right');
    };
    const selectedNote = () => {
      const selection = editor.stores.selection.getState().selection;
      return selection?.kind === 'note' ? (editor.stores.notes.getState().notes.find((n) => n.localId === selection.localId) ?? null) : null;
    };
    const stops = [
      registerCoreShortcuts(history),
      registerPlaybackShortcuts(),
      registerPanelShortcuts({
        toggleLeft: () => usePanelsStore.getState().toggle('left'),
        toggleRight: () => usePanelsStore.getState().toggle('right'),
        toggleTimeline: () => usePanelsStore.getState().toggle('timeline'),
        toggleTheme: () => useTheme.getState().setTheme(useTheme.getState().theme === 'night' ? 'paper' : 'night'),
      }),
      registerNoteShortcuts({
        newNote: () => {
          openRight();
          startNote();
        },
        markGood: () => {
          const scene = sceneAt(editor.stores.film.getState().film, usePlayback.getState().time);
          if (scene) editor.setSceneGood(scene.id, !editor.stores.notes.getState().goodScenes.includes(scene.id));
        },
        removeSelected: () => {
          const note = selectedNote();
          if (note) editor.removeNote(note.localId);
        },
        pointAtArea: () => toggleMarking(selectedNote()),
        toggleSafeZones: () => useCanvas.getState().toggleZones(),
        compareVersions: () => {
          const canvas = useCanvas.getState();
          const { videos, video } = editor.stores.film.getState();
          const other = videos.find((v) => v.file !== video);
          if (other) canvas.set({ compare: !canvas.compare, compareWith: canvas.compareWith ?? other.file });
        },
        send: () => void sendFromPage(false),
      }),
    ];
    const save = () => void editor.flush().catch(() => {});
    window.addEventListener('pagehide', save);
    return () => {
      stops.forEach((stop) => stop());
      window.removeEventListener('pagehide', save);
    };
  }, []);
}

function ReviewApp({ modeSwitch }: { modeSwitch: ReactNode }) {
  const { jobs, job, open, retry } = useOpenJob();
  const status = useFilm((s) => s.status);
  const message = useFilm((s) => s.message);
  const hasVideo = useFilm((s) => s.videos.length > 0);
  const selection = useSelection();
  const notes = useNotes((s) => s.notes);
  const composer = useComposer();
  usePageShortcuts();

  const list = jobs.status === 'ready' ? jobs.jobs : [];
  const ready = status === 'ready' && hasVideo;
  const selectedNote = selection?.kind === 'note' ? (notes.find((n) => n.localId === selection.localId) ?? null) : null;
  const again = (
    <Button variant="primary" onClick={retry}>
      Try again
    </Button>
  );

  let notice: ReactNode = null;
  if (jobs.status === 'failed') notice = <Notice title="The studio did not answer" action={again}>{jobs.message}</Notice>;
  else if (status === 'failed') notice = <Notice title="This film could not be opened" action={again}>{message}</Notice>;
  else if (jobs.status === 'loading' || status === 'loading' || (job && status === 'empty')) notice = <Notice title="Loading the film…" />;
  else if (!ready)
    notice = (
      <Notice title="No videos to review yet">
        A video shows up here once a preview has been rendered. Ask for a preview render, and it will appear by itself.
      </Notice>
    );

  return (
    <>
      <Shell
        topBar={<TopBar jobs={list} job={job} onJob={open} modeSwitch={modeSwitch} decision={ready ? <Decision /> : null} />}
        toggles={false}
        canvas={
          notice ?? (
            <Canvas
              box={selectedNote ? selectedNote.box : composer.box}
              marking={composer.marking}
              onBox={(box) => (selectedNote ? editor.changeNote(selectedNote.localId, { box }) : composer.set({ box }))}
              onToggleMarking={() => toggleMarking(selectedNote)}
              onNote={() => { const panels = usePanelsStore.getState(); if (!panels.isOpen('right')) panels.toggle('right'); useRail.getState().setTab('send'); startNote(); }}
            />
          )
        }
        right={
          ready ? (
            <>
              <StaleNotice />
              <Rail inspector={<Inspector />} />
            </>
          ) : null
        }
        timeline={ready ? <Timeline /> : null}
      />
      <ShortcutSheet />
      <CommandMenu />
      <Toasts />
    </>
  );
}

type Mode = 'review' | 'paper';

/** The editor: Review (a rendered film and its notes) or Paper edit (a transcript of raw footage), chosen by `?mode=`. */
export function App() {
  const [mode, setMode] = useState<Mode>(() => (param('mode') === 'paper' ? 'paper' : 'review'));
  const modeSwitch = (
    <Segmented
      label="What to work on"
      value={mode}
      onChange={(next) => {
        setParams({ mode: next === 'paper' ? 'paper' : null, v: null });
        setMode(next);
      }}
      options={[
        { value: 'review', label: 'Review' },
        { value: 'paper', label: 'Paper edit' },
      ]}
    />
  );
  return mode === 'paper' ? <PaperEdit modeSwitch={modeSwitch} /> : <ReviewApp modeSwitch={modeSwitch} />;
}
