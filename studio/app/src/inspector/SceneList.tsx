import { formatTime } from '../canvas/format';
import { usePlayback } from '../playback';
import { editor, useEditedFilm, useNotes, useSelection } from '../store';
import { Chip, cx } from '../ui';
import './inspector.css';

/** Every scene with its on-screen texts. Choosing one selects it and goes to it in the film. */
export function SceneList() {
  const film = useEditedFilm();
  const selection = useSelection();
  const good = useNotes((s) => s.goodScenes);
  if (!film) return null;
  const go = (t: number) => usePlayback.getState().seek(t + 0.001);
  return (
    <ol className="scene-list">
      {film.scenes.map((scene, i) => {
        const sceneSelected = selection?.kind === 'scene' && selection.scene === scene.id;
        return (
          <li key={scene.id}>
            <button
              type="button"
              className={cx('scene-item', sceneSelected && 'is-selected')}
              aria-current={sceneSelected ? 'true' : undefined}
              onClick={() => {
                editor.select({ kind: 'scene', scene: scene.id });
                go(scene.start);
              }}
            >
              <span className="scene-item-top">
                <span className="scene-item-name">Scene {i + 1}</span>
                <span className="time scene-item-time">{formatTime(scene.start)}</span>
                {good.includes(scene.id) ? <Chip>Good</Chip> : null}
              </span>
              <span className="scene-item-title">{scene.title}</span>
            </button>
            {scene.texts.length ? (
              <ul className="scene-cues">
                {scene.texts.map((cue, c) => {
                  const cueSelected = selection?.kind === 'cue' && selection.scene === scene.id && selection.cue === c;
                  return (
                    <li key={c}>
                      <button
                        type="button"
                        className={cx('scene-cue', cueSelected && 'is-selected')}
                        aria-current={cueSelected ? 'true' : undefined}
                        aria-label={`On-screen text: ${cue.lines.join(' ')}`}
                        onClick={() => {
                          editor.select({ kind: 'cue', scene: scene.id, cue: c });
                          go(scene.start + cue.at);
                        }}
                      >
                        {cue.lines.join(' / ')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
