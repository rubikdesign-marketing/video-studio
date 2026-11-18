import { useEffect, useState, type ReactNode } from 'react';
import { api, plainMessage, type JobSummary } from './api';
import { Canvas, VersionList, useCanvas, versionOptions } from './canvas';
import { Inspector, SceneList } from './inspector';
import { PaperEdit } from './modes/paper';
import { NoteEditor, NotesList, SendBox, SentBatches, sendFromPage, startNote, toggleMarking, useComposer, useReviewer } from './notes';
import { registerPlaybackShortcuts, usePlayback } from './playback';
import { Shell, usePanelsStore } from './shell';
import { CommandMenu, ShortcutSheet, registerCoreShortcuts, registerNoteShortcuts, registerPanelShortcuts, useShortcuts } from './shortcuts';
import { editor, history, useFilm, useHistory, useNotes, useSaveLabel, useSaving, useSelection } from './store';
import { ThemeSwitch, useTheme } from './theme';
import { Timeline } from './timeline';
import { Button, Chip, Field, Segmented, Select, Toasts, Tooltip, showToast } from './ui';
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="app-section" aria-label={title}>
      <h2 className="app-section-title">{title}</h2>
      {children}
    </section>
  );
}

function TopBar({ jobs, job, onJob, modeSwitch }: { jobs: JobSummary[]; job: string | null; onJob(job: string): void; modeSwitch: ReactNode }) {
  const videos = useFilm((s) => s.videos);
  const video = useFilm((s) => s.video);
  const rendering = useFilm((s) => s.rendering);
  const newVersion = useFilm((s) => s.newVersion);
  const live = useFilm((s) => s.live);
  const save = useSaveLabel();
  const canUndo = useHistory((s) => s.canUndo);
  const canRedo = useHistory((s) => s.canRedo);
  const labels = useHistory((s) => s.labels);
  const reviewer = useReviewer();
  const name = jobs.find((j) => j.job === job)?.name ?? job ?? '';
  const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

  return (
    <div className="app-bar">
      <h1 className="app-title">Video Studio</h1>
      {modeSwitch}
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
      {newVersion && newVersion !== video ? (
        <Button variant="primary" onClick={() => editor.chooseVideo(newVersion)}>
          A new version has arrived. Watch it
        </Button>
      ) : null}
      {rendering.active ? (
        <Chip>
          {rendering.scene && rendering.of ? `Rendering scene ${rendering.scene} of ${rendering.of}` : `Rendering, ${Math.round(rendering.elapsed)}s so far`}
        </Chip>
      ) : null}
      {live === 'reconnecting' ? <Chip>Reconnecting to the studio…</Chip> : null}
      <span className="app-spacer" />
      <Tooltip label={save.message ?? 'Notes and text changes save by themselves.'}>
        <Chip className={save.status === 'failed' ? 'app-save-failed' : undefined}>{save.label}</Chip>
      </Tooltip>
      <Tooltip label={labels.undo ? `Undo: ${lower(labels.undo)}` : 'Nothing to undo'}>
        <Button variant="quiet" disabled={!canUndo} onClick={() => history.undo()}>
          Undo
        </Button>
      </Tooltip>
      <Tooltip label={labels.redo ? `Redo: ${lower(labels.redo)}` : 'Nothing to redo'}>
        <Button variant="quiet" disabled={!canRedo} onClick={() => history.redo()}>
          Redo
        </Button>
      </Tooltip>
      <span data-reviewer className="app-reviewer">
        <Field label="Your name" hideLabel placeholder="Your name" value={reviewer.name} onChange={reviewer.setName} />
      </span>
      <ThemeSwitch />
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
        topBar={<TopBar jobs={list} job={job} onJob={open} modeSwitch={modeSwitch} />}
        left={
          ready ? (
            <>
              <Section title="Scenes">
                <SceneList />
              </Section>
              <Section title="Notes to send">
                <NotesList />
              </Section>
              <Section title="Versions">
                <VersionList />
              </Section>
              <Section title="Sent earlier">
                <SentBatches />
              </Section>
            </>
          ) : null
        }
        canvas={
          notice ?? (
            <Canvas
              box={selectedNote ? selectedNote.box : composer.box}
              marking={composer.marking}
              onBox={(box) => (selectedNote ? editor.changeNote(selectedNote.localId, { box }) : composer.set({ box }))}
              onToggleMarking={() => toggleMarking(selectedNote)}
            />
          )
        }
        right={
          ready ? (
            <>
              <StaleNotice />
              <Inspector />
              <NoteEditor />
              <SendBox />
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
