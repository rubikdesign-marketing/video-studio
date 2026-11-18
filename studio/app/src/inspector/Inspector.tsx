import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { formatSeconds, formatTime } from '../canvas/format';
import type { Scene, TextCue } from '../contracts/film';
import { MAX_WORDS, applyEdits, countWords, editedCue, editor as pageEditor, type Editor } from '../store';
import { Button, Chip, Field } from '../ui';
import './inspector.css';

type Ed = Pick<Editor, 'stores' | 'setCueWords' | 'setCueTime' | 'resetCue' | 'select'>;

const number = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text.replace(',', '.')));
const shown = (n: number): string => String(Math.round(n * 1000) / 1000);

/** The selected scene: its title, times, energy and what is said. Nothing here can be changed. */
function SceneDetails({ scene, index, ed }: { scene: Scene; index: number; ed: Ed }) {
  return (
    <div className="inspector-block">
      <h3 className="inspector-title">Scene {index + 1}</h3>
      <p className="inspector-lead">{scene.title}</p>
      <dl className="inspector-facts">
        <dt>Starts</dt>
        <dd className="time">{formatTime(scene.start)}</dd>
        <dt>Ends</dt>
        <dd className="time">{formatTime(scene.end)}</dd>
        <dt>Length</dt>
        <dd className="time">{formatSeconds(scene.end - scene.start)}</dd>
        <dt>Energy</dt>
        <dd>{scene.energy}</dd>
      </dl>
      <h4 className="inspector-sub">What is said</h4>
      {scene.lines.length ? (
        <ul className="inspector-lines">
          {scene.lines.map((line) => (
            <li key={line.id}>
              <span className="time inspector-when">
                {formatTime(line.start)} to {formatTime(line.end)}
              </span>
              {line.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="inspector-quiet">Nothing is said in this scene.</p>
      )}
      <h4 className="inspector-sub">On-screen text</h4>
      {scene.texts.length ? (
        <ul className="inspector-cues">
          {scene.texts.map((cue, i) => (
            <li key={i}>
              <Button variant="quiet" onClick={() => ed.select({ kind: 'cue', scene: scene.id, cue: i })}>
                {cue.lines.join(' / ')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="inspector-quiet">This scene has no on-screen text.</p>
      )}
      <p className="inspector-quiet">Scene lengths come from the voice, so they are changed with a note, not here.</p>
    </div>
  );
}

/** The selected on-screen text: its words, one field per line, and when it comes and goes inside its scene. */
function CueEditor({ scene, index, cueIndex, cue, changed, ed }: { scene: Scene; index: number; cueIndex: number; cue: TextCue; changed: { words: boolean; time: boolean }; ed: Ed }) {
  const length = scene.end - scene.start;

  // What is typed stays in the fields even when it cannot be kept (an eighth word), so the reason can be read.
  const [words, setWords] = useState<string[] | null>(null);
  const [wordsProblem, setWordsProblem] = useState<string | null>(null);
  const [times, setTimes] = useState<{ at: string; out: string } | null>(null);
  const [timeProblem, setTimeProblem] = useState<string | null>(null);
  const kept = useRef('');
  const stored = `${cue.lines.join('\n')}|${cue.at}|${cue.out}`;
  useEffect(() => {
    // The stored text changed from somewhere else (undo, a drag on the timeline): show that, not what was typed.
    if (stored !== kept.current) {
      kept.current = stored;
      setWords(null);
      setWordsProblem(null);
      setTimes(null);
      setTimeProblem(null);
    }
  }, [stored]);

  // True for the one draw between a change from elsewhere and the tidy-up above, so the old typing never flashes.
  const fromElsewhere = stored !== kept.current;
  const lines = (fromElsewhere ? null : words) ?? cue.lines;
  const count = countWords(lines);
  const changeWords = (next: string[]) => {
    const tidy = next.map((line) => line.trim());
    const outcome = ed.setCueWords(scene.id, cueIndex, tidy);
    if (outcome.ok) kept.current = `${tidy.join('\n')}|${cue.at}|${cue.out}`;
    setWords(next);
    setWordsProblem(outcome.ok ? null : outcome.problem);
  };
  const time = (fromElsewhere ? null : times) ?? { at: shown(cue.at), out: shown(cue.out) };
  const changeTime = (next: { at: string; out: string }) => {
    const at = number(next.at);
    const out = number(next.out);
    const outcome = ed.setCueTime(scene.id, cueIndex, at, out);
    if (outcome.ok) kept.current = `${cue.lines.join('\n')}|${at}|${out}`;
    setTimes(next);
    setTimeProblem(outcome.ok ? null : outcome.problem);
  };

  return (
    <div className="inspector-block">
      <h3 className="inspector-title">On-screen text</h3>
      <p className="inspector-lead">
        Scene {index + 1}, {scene.title}
      </p>

      <div className="inspector-fields">
        {lines.map((line, i) => (
          <Field
            key={i}
            label={lines.length > 1 ? `Line ${i + 1}` : 'Words'}
            value={line}
            onChange={(value) => changeWords(lines.map((l, j) => (j === i ? value : l)))}
            error={i === lines.length - 1 && !fromElsewhere ? (wordsProblem ?? undefined) : undefined}
          />
        ))}
        <div className="inspector-row">
          <Chip className={count > MAX_WORDS ? 'inspector-over' : undefined}>
            {count} of {MAX_WORDS} words
          </Chip>
          {lines.length === 1 ? (
            <Button variant="quiet" onClick={() => changeWords([...lines, ''])}>
              Add a second line
            </Button>
          ) : (
            <Button variant="quiet" onClick={() => changeWords(lines.slice(0, -1))}>
              Remove the last line
            </Button>
          )}
          {changed.words ? (
            <Button variant="quiet" onClick={() => ed.resetCue(scene.id, cueIndex, 'words')}>
              Put back the original words
            </Button>
          ) : null}
        </div>
      </div>

      <h4 className="inspector-sub">When it shows</h4>
      <div className="inspector-times">
        <Field label="Comes on at (seconds)" value={time.at} onChange={(at) => changeTime({ ...time, at })} />
        <Field label="Goes off at (seconds)" value={time.out} onChange={(out) => changeTime({ ...time, out })} error={fromElsewhere ? undefined : (timeProblem ?? undefined)} />
      </div>
      <p className="inspector-quiet">
        Counted from the start of the scene, which is {formatSeconds(length)} long. In the film this text shows from{' '}
        <span className="time">{formatTime(scene.start + cue.at)}</span> to <span className="time">{formatTime(scene.start + cue.out)}</span>.
      </p>
      <div className="inspector-row">
        {changed.time ? (
          <Button variant="quiet" onClick={() => ed.resetCue(scene.id, cueIndex, 'time')}>
            Put back the original timing
          </Button>
        ) : null}
        <Button variant="quiet" onClick={() => ed.select({ kind: 'scene', scene: scene.id })}>
          Show the whole scene
        </Button>
      </div>
      <p className="inspector-quiet">Your changes are saved beside the film. The film itself changes at the next render.</p>
    </div>
  );
}

/** Shows the selected scene or on-screen text. `editor` is only passed by tests. */
export function Inspector({ editor: ed = pageEditor }: { editor?: Ed }) {
  const film = useStore(ed.stores.film, (s) => s.film);
  const edits = useStore(ed.stores.edits, (s) => s.edits);
  const selection = useStore(ed.stores.selection, (s) => s.selection);
  const edited = useMemo(() => (film ? applyEdits(film, edits) : null), [film, edits]);

  if (!film || !edited || !selection || selection.kind === 'note') {
    return (
      <div className="inspector-block">
        <h3 className="inspector-title">Details</h3>
        <p className="inspector-quiet">Choose a scene or an on-screen text to see it here.</p>
      </div>
    );
  }
  const index = edited.scenes.findIndex((s) => s.id === selection.scene);
  const scene = edited.scenes[index];
  if (!scene) return null;
  if (selection.kind === 'scene') return <SceneDetails scene={scene} index={index} ed={ed} />;
  const found = editedCue(film, edits, selection.scene, selection.cue);
  if (!found) return null;
  return (
    <CueEditor
      key={`${selection.scene}:${selection.cue}`}
      scene={scene}
      index={index}
      cueIndex={selection.cue}
      cue={found.cue}
      changed={found}
      ed={ed}
    />
  );
}
