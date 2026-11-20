import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import type { Film, Scene, Seconds, TextCue } from '../contracts/film';
import type { DraftNote } from '../contracts/review';
import { usePlayback } from '../playback';
import { formatKeys, registerPlaybackShortcuts, TABLE } from '../shortcuts';
import { editor, useEditedFilm, useNotes, useSelection } from '../store';
import { Button, Icon, MenuItem, Popover, showToast } from '../ui';
import { useComposer } from '../notes/composer';
import { useRail } from '../notes/railTab';
import { ScrubPreview } from './ScrubPreview';
import { dragCue, SNAP_PIXELS, snapPoints } from './snap';
import './timeline.css';
import { clock, clockExact, HEAD, LANES, scrollAfterZoom, ticks, tickStep, useTimelineView, type LaneId } from './view';

const later = (work: () => void): number => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(work) : (setTimeout(work, 16) as unknown as number));
const plain = (lines: string[]) => lines.join(' ').replaceAll('*', '');
const px = (n: number) => `${Math.round(n * 100) / 100}px`;

// ---------------------------------------------------------------- the bar above the lanes

/** Which lanes show, and which are locked. Hide and lock used to sit on every lane; they are set once, so they live here. */
function LanesMenu({ hasVoice }: { hasVoice: boolean }) {
  const lanes = useTimelineView((s) => s.lanes);
  const view = useTimelineView.getState;
  return (
    <Popover label={<><Icon name="layers" />Lanes</>} ariaLabel="Lanes" up>
      {() => (
        <div role="menu" aria-label="Lanes">
          <p className="ui-menu-title">Show</p>
          {LANES.map(({ id, name }) => (
            <MenuItem key={id} checked={!lanes[id].hidden && (id !== 'voice' || hasVoice)} disabled={id === 'voice' && !hasVoice}
              hint={id === 'voice' && !hasVoice ? 'No voice in this film' : undefined} onClick={() => view().toggleHidden(id)}>{name}</MenuItem>
          ))}
          <hr className="ui-menu-rule" />
          <p className="ui-menu-title">Lock, so a drag cannot change it</p>
          {LANES.filter(({ id }) => id === 'text' || id === 'notes').map(({ id, name }) => (
            <MenuItem key={id} checked={lanes[id].locked} onClick={() => view().toggleLocked(id)}>{name}</MenuItem>
          ))}
        </div>
      )}
    </Popover>
  );
}

function Bar({ duration, zoom, hasVoice }: { duration: Seconds; zoom(factor: number): void; hasVoice: boolean }) {
  const fitted = useTimelineView((s) => s.fitted);
  return (
    <div className="tl-bar" role="toolbar" aria-label="Timeline">
      <div className="tl-bar-group">
        <LanesMenu hasVoice={hasVoice} />
      </div>
      <span className="tl-hint">Hover to preview. Drag on-screen words to retime them. Drag in Notes to note a stretch.</span>
      <div className="tl-bar-group tl-bar-zoom">
        <Button variant="quiet" aria-label="Zoom out" title={`Zoom out (${formatKeys(TABLE.zoomOut.keys)})`} onClick={() => zoom(1 / 1.5)} disabled={fitted}>−</Button>
        <Button variant="quiet" aria-label="Zoom in" title={`Zoom in (${formatKeys(TABLE.zoomIn.keys)})`} onClick={() => zoom(1.5)}>+</Button>
        <Button variant="quiet" aria-pressed={fitted} title={`Fit the whole film (${formatKeys(TABLE.fitTimeline.keys)})`} onClick={() => useTimelineView.getState().fit(duration)}>Fit</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the ruler and the playhead

/** The ruler is the playhead's control: click or drag to scrub, arrow keys to step. */
function Ruler({ film, pps }: { film: Film; pps: number }) {
  const lane = useRef<HTMLDivElement>(null);
  const step = tickStep(pps);
  const loop = usePlayback((s) => s.loop);

  // The slider's value changes every frame, so it is written straight to the element instead of re-drawing the ruler.
  useEffect(() => {
    const write = (time: Seconds) => {
      lane.current?.setAttribute('aria-valuenow', String(Math.round(time * 100) / 100));
      lane.current?.setAttribute('aria-valuetext', `${clockExact(time)} of ${clockExact(film.duration)}`);
    };
    write(usePlayback.getState().time);
    return usePlayback.subscribe((s, before) => { if (s.time !== before.time) write(s.time); });
  }, [film.duration]);

  const scrub = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !lane.current) return;
    e.preventDefault();
    lane.current.focus();
    const p = usePlayback.getState(); const wasPlaying = p.playing;
    const left = lane.current.getBoundingClientRect().left;
    let x = e.clientX; let waiting = false;
    const go = () => { waiting = false; usePlayback.getState().seek((x - left) / pps); };
    p.pause(); go();
    const move = (ev: PointerEvent) => { x = ev.clientX; if (!waiting) { waiting = true; later(go); } };   // once per frame, at the newest position
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      if (ev.type === 'pointerup') x = ev.clientX;         // end exactly where the pointer was let go
      go();
      if (wasPlaying) usePlayback.getState().play();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const onKeyDown = (e: ReactKeyboardEvent) => {
    const p = usePlayback.getState();
    const act: (() => void) | undefined = e.altKey || e.metaKey || e.ctrlKey ? undefined
      : e.key === 'ArrowLeft' ? () => (e.shiftKey ? (p.pause(), p.seek(p.time - 1)) : p.step(-1))
      : e.key === 'ArrowRight' ? () => (e.shiftKey ? (p.pause(), p.seek(p.time + 1)) : p.step(1))
      : e.key === 'Home' ? () => p.seek(0)
      : e.key === 'End' ? () => p.seek(film.duration)
      : e.key === 'PageUp' ? () => p.previousScene()
      : e.key === 'PageDown' ? () => p.nextScene()
      : undefined;
    if (!act) return;
    e.preventDefault();                                    // also keeps the page-wide shortcut from stepping a second time
    act();
  };
  return (
    <div className="tl-row tl-row--ruler">
      <div className="tl-head tl-head--ruler">Time</div>
      <div
        ref={lane} className="tl-lane tl-ruler" style={{ width: px(film.duration * pps) }}
        role="slider" tabIndex={0} aria-label="Playhead" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={film.duration}
        onPointerDown={scrub} onKeyDown={onKeyDown}
      >
        {loop ? <span className="tl-loop" style={{ left: px(loop[0] * pps), width: px((loop[1] - loop[0]) * pps) }} /> : null}
        {ticks(film.duration, step).map((t) => (
          <span key={t} className="tl-tick time" style={{ left: px(t * pps) }} aria-hidden="true">{clock(t, step)}</span>
        ))}
      </div>
    </div>
  );
}

/** The playhead line. It moves every frame without re-drawing anything else, and keeps itself in view while playing. */
function Playhead({ pps, scroller }: { pps: number; scroller: { current: HTMLDivElement | null } }) {
  const line = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const place = (time: Seconds, playing: boolean) => {
      const x = time * pps;
      if (line.current) line.current.style.transform = `translateX(${px(x)})`;
      const el = scroller.current;
      if (playing && el && el.clientWidth > 0 && (HEAD + x > el.scrollLeft + el.clientWidth - 24 || HEAD + x < el.scrollLeft + HEAD)) el.scrollLeft = Math.max(0, x - 48);
    };
    place(usePlayback.getState().time, false);
    return usePlayback.subscribe((s, before) => { if (s.time !== before.time) place(s.time, s.playing); });
  }, [pps, scroller]);
  return <div ref={line} className="tl-playhead" data-testid="playhead" aria-hidden="true" />;
}

// ---------------------------------------------------------------- lanes

/** One lane. A hidden lane is left out altogether; the Lanes menu brings it back. */
function Lane({ id, name, pps, duration, children, onPointerDown }: { id: LaneId; name: string; pps: number; duration: Seconds; children: ReactNode; onPointerDown?(e: ReactPointerEvent<HTMLDivElement>): void }) {
  const state = useTimelineView((s) => s.lanes[id]);
  if (state.hidden) return null;
  return (
    <div className="tl-row" data-lane={id} data-locked={state.locked || undefined} role="group" aria-label={`${name} lane`}>
      <div className="tl-head">
        <span className="tl-head-name" title={name}>{name}</span>
        {state.locked ? <span className="tl-head-lock" title="Locked in the Lanes menu">Locked</span> : null}
      </div>
      <div className="tl-lane" style={{ width: px(duration * pps) }} onPointerDown={state.locked ? undefined : onPointerDown}>{children}</div>
    </div>
  );
}

/** A scene: click to go there (and see it in the inspector); the tick marks it as looking good. */
function SceneBlock({ scene, index, pps, selected, locked, good }: { scene: Scene; index: number; pps: number; selected: boolean; locked: boolean; good: boolean }) {
  return (
    <div className="tl-item tl-scene-wrap" data-good={good || undefined} style={{ left: px(scene.start * pps), width: px((scene.end - scene.start) * pps) }}>
      <button
        type="button" className="tl-scene" disabled={locked} aria-current={selected || undefined}
        aria-label={`Scene ${index + 1}: ${scene.title}, ${clock(scene.start)} to ${clock(scene.end)}${good ? ', looks good' : ''}`}
        onClick={() => { usePlayback.getState().seek(scene.start); editor.select({ kind: 'scene', scene: scene.id }); }}
      >
        <span className="tl-scene-number">{index + 1}</span>
        <span className="tl-item-text">{scene.title}</span>
      </button>
      <button
        type="button" className="tl-good" aria-pressed={good} title={`${good ? 'Looks good. Click to undo' : 'Mark as looking good'} (G)`}
        aria-label={good ? `Scene ${index + 1} looks good. Undo` : `Mark scene ${index + 1} as looking good`}
        onClick={() => editor.setSceneGood(scene.id, !good)}
      >
        <Icon name={good ? 'circleCheck' : 'circle'} size={15} />
      </button>
    </div>
  );
}

function CueBlock({ film, scene, index, cue, pps, selected, locked }: { film: Film; scene: Scene; index: number; cue: TextCue; pps: number; selected: boolean; locked: boolean }) {
  const [draft, setDraft] = useState<{ at: Seconds; out: Seconds } | null>(null);
  const shown = draft ?? cue;
  const sceneNo = film.scenes.indexOf(scene) + 1;
  const commit = (at: Seconds, out: Seconds) => {
    if (at === cue.at && out === cue.out) return;
    const result = editor.setCueTime(scene.id, index, at, out);         // the one write: a history step with its own label
    if (!result.ok) showToast(result.problem, { tone: 'warn' });
  };

  const drag = (mode: 'move' | 'start' | 'end') => (e: ReactPointerEvent) => {
    if (locked || e.button !== 0) return;
    e.stopPropagation();
    const startX = e.clientX;
    const points = snapPoints(film, editor.stores.notes.getState().notes, usePlayback.getState().time, { scene: scene.id, cue: index });
    let last: { at: Seconds; out: Seconds } | null = null;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!last && Math.abs(dx) < 3) return;                              // a click, not a drag
      const r = dragCue({ mode, at: cue.at, out: cue.out, sceneStart: scene.start, sceneLength: scene.end - scene.start, delta: dx / pps, points, tolerance: SNAP_PIXELS / pps });
      last = { at: r.at, out: r.out };
      setDraft(last);                                                     // shown while dragging; nothing is saved yet
      useTimelineView.getState().setGuide(r.guide);
    };
    const end = (keep: boolean) => () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', finish); window.removeEventListener('pointercancel', cancel);
      useTimelineView.getState().setGuide(null);
      editor.select({ kind: 'cue', scene: scene.id, cue: index });
      if (keep && last) commit(last.at, last.out);
      setDraft(null);
    };
    const finish = end(true); const cancel = end(false);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', finish); window.addEventListener('pointercancel', cancel);
  };
  // Without a pointer: Alt with an arrow moves the text one frame, and with Shift moves only its end.
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (locked || !e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const r = dragCue({ mode: e.shiftKey ? 'end' : 'move', at: cue.at, out: cue.out, sceneStart: scene.start, sceneLength: scene.end - scene.start, delta: (e.key === 'ArrowLeft' ? -1 : 1) / film.fps, points: [], tolerance: 0 });
    commit(r.at, r.out);
  };
  const words = plain(cue.lines);
  return (
    <div
      className="tl-item tl-cue" data-dragging={draft ? true : undefined} data-selected={selected || undefined}
      style={{ left: px((scene.start + shown.at) * pps), width: px((shown.out - shown.at) * pps) }}
    >
      <span className="tl-cue-edge tl-cue-edge--start" onPointerDown={drag('start')} aria-hidden="true" />
      <button
        type="button" className="tl-cue-body" disabled={locked} aria-current={selected || undefined}
        aria-label={`On-screen text in scene ${sceneNo}: ${words}, ${clockExact(shown.at)} to ${clockExact(shown.out)} into the scene`}
        aria-description="Drag to move it, or drag an end to make it longer or shorter. With the keyboard: hold Alt and press the left or right arrow to move it one frame, and add Shift to move only its end."
        onPointerDown={drag('move')} onKeyDown={onKeyDown} onClick={() => editor.select({ kind: 'cue', scene: scene.id, cue: index })}
      >
        <span className="tl-item-text">{words}</span>
      </button>
      <span className="tl-cue-edge tl-cue-edge--end" onPointerDown={drag('end')} aria-hidden="true" />
    </div>
  );
}

function NotePin({ note, number, pps, selected, locked }: { note: DraftNote; number: number; pps: number; selected: boolean; locked: boolean }) {
  const kind = note.kind === 'keep' ? 'Keep this' : note.must ? 'Must fix' : 'Change';
  return (
    <>
      {note.end ? <span className="tl-item tl-span" data-kind={note.kind} data-must={note.must || undefined} aria-hidden="true"
        style={{ left: px(note.time * pps), width: px((note.end - note.time) * pps) }} /> : null}
      <button
        type="button" className="tl-item tl-pin" disabled={locked} data-kind={note.kind} data-must={note.must || undefined} aria-current={selected || undefined}
        style={{ left: px(note.time * pps) }} title={note.text || undefined}
        aria-label={`Note ${number} ${note.end ? `from ${clock(note.time)} to ${clock(note.end)}` : `at ${clock(note.time)}`}, ${kind}${note.text ? `: ${note.text}` : ''}`}
        onClick={() => { editor.select({ kind: 'note', localId: note.localId }); usePlayback.getState().seek(note.time); }}
      >
        <span className="tl-pin-mark" aria-hidden="true" />
        <span className="tl-pin-number" aria-hidden="true">{number}</span>
      </button>
    </>
  );
}

// ---------------------------------------------------------------- the timeline

function Lanes({ film }: { film: Film }) {
  const scroller = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<number | null>(null);
  const pps = useTimelineView((s) => s.pps);
  const lanes = useTimelineView((s) => s.lanes);
  const guide = useTimelineView((s) => s.guide);
  const notes = useNotes((s) => s.notes);
  const good = useNotes((s) => s.goodScenes);
  const selection = useSelection();
  const duration = film.duration;
  const hasVoice = film.scenes.some((s) => s.lines.length > 0);
  const span = useComposer((s) => s.span);
  const track = useRef<HTMLDivElement>(null);
  const [marking, setMarking] = useState<{ a: Seconds; b: Seconds } | null>(null);

  /** Dragging across the Notes lane marks a stretch for the next note; a plain click there moves the playhead. */
  const markInLane = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.tl-pin')) return;
    const left = e.currentTarget.getBoundingClientRect().left;
    const at = (x: number) => Math.min(duration, Math.max(0, (x - left) / pps));
    const a = at(e.clientX); let b = a;
    setMarking({ a, b });
    const move = (ev: PointerEvent) => { b = at(ev.clientX); setMarking({ a, b }); };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      setMarking(null);
      const start = Math.min(a, b); const end = Math.max(a, b);
      const p = usePlayback.getState();
      if (end - start < 0.15) { p.pause(); p.seek(start); return; }
      p.pause(); p.seek(start);
      useComposer.getState().set({ span: { start, end } });
      useRail.getState().setTab('send');
      editor.select(null);
      useComposer.getState().askFocus();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };
  const band = marking ? { start: Math.min(marking.a, marking.b), end: Math.max(marking.a, marking.b) } : span;

  /** Zooms around a point of the scrolling area (the pointer, or the middle). */
  const zoom = (factor: number, pointerX?: number) => {
    const el = scroller.current; const view = useTimelineView.getState(); const old = view.pps;
    const next = view.zoomTo(old * factor, duration);
    if (el && next !== old) pendingScroll.current = scrollAfterZoom(old, next, el.scrollLeft, pointerX ?? (el.clientWidth + HEAD) / 2);
  };
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  useLayoutEffect(() => {
    if (pendingScroll.current !== null && scroller.current) scroller.current.scrollLeft = pendingScroll.current;
    pendingScroll.current = null;
  }, [pps]);

  // Keep the width measured, so "fitted" stays fitted when the panel or the window changes size.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => useTimelineView.getState().measure(el.clientWidth, duration);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure); watch.observe(el);
    return () => watch.disconnect();
  }, [duration]);

  // Pinch on a trackpad arrives as a wheel with Ctrl held; Cmd with the wheel does the same.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomRef.current(Math.exp(-e.deltaY * 0.01), e.clientX - el.getBoundingClientRect().left);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => registerPlaybackShortcuts({
    fitTimeline: () => useTimelineView.getState().fit(duration),
    zoomIn: () => zoomRef.current(1.5),
    zoomOut: () => zoomRef.current(1 / 1.5),
  }), [duration]);

  const energyTop = Math.max(5, ...film.scenes.map((s) => s.energy));
  return (
    <>
      <Bar duration={duration} zoom={(factor) => zoom(factor)} hasVoice={hasVoice} />
      <div className="tl-scroll" ref={scroller}>
        <div className="tl-track" ref={track} style={{ width: px(HEAD + duration * pps) }}>
          <Ruler film={film} pps={pps} />
          <Lane id="scenes" name="Scenes" pps={pps} duration={duration}>
            {film.scenes.map((scene, i) => (
              <SceneBlock key={scene.id} scene={scene} index={i} pps={pps} locked={lanes.scenes.locked} good={good.includes(scene.id)} selected={selection?.kind === 'scene' && selection.scene === scene.id} />
            ))}
          </Lane>
          {hasVoice ? <Lane id="voice" name="Voice" pps={pps} duration={duration}>
            {film.scenes.flatMap((scene) => scene.lines.map((line) => (
              <button
                key={`${scene.id}-${line.id}`} type="button" className="tl-item tl-voice" disabled={lanes.voice.locked} title={line.text}
                style={{ left: px(line.start * pps), width: px((line.end - line.start) * pps) }}
                aria-label={`Voice line at ${clock(line.start)}: ${line.text}. Go to it.`} onClick={() => usePlayback.getState().seek(line.start)}
              >
                <span className="tl-item-text">{line.text}</span>
              </button>
            )))}
          </Lane> : null}
          <Lane id="text" name="On-screen words" pps={pps} duration={duration}>
            {film.scenes.flatMap((scene) => scene.texts.map((cue, i) => (
              <CueBlock key={`${scene.id}-${i}`} film={film} scene={scene} index={i} cue={cue} pps={pps} locked={lanes.text.locked}
                selected={selection?.kind === 'cue' && selection.scene === scene.id && selection.cue === i} />
            )))}
          </Lane>
          <Lane id="notes" name="Notes" pps={pps} duration={duration} onPointerDown={markInLane}>
            {band ? <span className="tl-item tl-marking" aria-hidden="true" style={{ left: px(band.start * pps), width: px((band.end - band.start) * pps) }} /> : null}
            {notes.map((note, i) => (
              <NotePin key={note.localId} note={note} number={i + 1} pps={pps} locked={lanes.notes.locked} selected={selection?.kind === 'note' && selection.localId === note.localId} />
            ))}
          </Lane>
          <Lane id="energy" name="Pace" pps={pps} duration={duration}>
            {film.scenes.map((scene, i) => (
              <span key={scene.id} className="tl-item tl-energy" role="img" aria-label={`Scene ${i + 1} pace: ${scene.energy} of ${energyTop}`}
                style={{ left: px(scene.start * pps), width: px((scene.end - scene.start) * pps), height: `${Math.round((scene.energy / energyTop) * 100)}%` }}>
                <span className="tl-energy-number" aria-hidden="true">{scene.energy}</span>
              </span>
            ))}
          </Lane>
          {guide !== null ? <div className="tl-guide" data-testid="snap-guide" style={{ transform: `translateX(${px(guide * pps)})` }} aria-hidden="true" /> : null}
          <Playhead pps={pps} scroller={scroller} />
        </div>
      </div>
      <ScrubPreview track={track} pps={pps} duration={duration} />
    </>
  );
}

/** The timeline of the open film: ruler, playhead and its lanes (three by default). It reads everything from the stores. */
export function Timeline() {
  const film = useEditedFilm();
  return (
    <section className="tl" aria-label="Timeline">
      {film && film.duration > 0 ? <Lanes film={film} /> : <p className="tl-empty">The timeline appears here once a film is open.</p>}
    </section>
  );
}
