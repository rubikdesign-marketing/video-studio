import { editor, useFilm } from '../store';
import { cx } from '../ui';
import { versionLabel } from './versions';

/** Every rendered version, newest first. Choosing one puts it on the canvas. */
export function VersionList() {
  const videos = useFilm((s) => s.videos);
  const watching = useFilm((s) => s.video);
  if (!videos.length) return <p className="canvas-empty">No version has been rendered yet.</p>;
  return (
    <ul className="canvas-versions">
      {videos.map((v) => (
        <li key={v.file}>
          <button
            type="button"
            className={cx('canvas-version', v.file === watching && 'is-current')}
            aria-current={v.file === watching ? 'true' : undefined}
            onClick={() => editor.chooseVideo(v.file)}
          >
            {versionLabel(videos, v.file)}
          </button>
        </li>
      ))}
    </ul>
  );
}
