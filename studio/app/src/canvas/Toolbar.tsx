import { useFilm } from '../store';
import { RATES, usePlayback, type Rate } from '../playback';
import { Button, Icon, MenuItem, Popover, Segmented, Select } from '../ui';
import { formatTime } from './format';
import { isTall } from './geometry';
import { PLATFORMS, SAFE_ZONES, type Platform } from './safe-zones';
import { useCanvas, type CompareMode } from './state';
import { versionOptions } from './versions';

const modes: { value: CompareMode; label: string }[] = [
  { value: 'side', label: 'Side by side' },
  { value: 'wipe', label: 'Wipe' },
];
const rateLabel = (r: Rate) => (r === 1 ? '1×' : r === 0.5 ? '½×' : '¼×');

export interface ToolbarProps {
  /** So the canvas can measure the bar and keep the film clear of it. */
  barRef?: React.Ref<HTMLDivElement>;
  /** Starts a note at the playhead (the N key). */
  onNote?(): void;
}

/** The one transport, under the film: frame steps, play, the time, speed, repeat, and a note at this moment. */
export function Toolbar({ barRef, onNote }: ToolbarProps) {
  const film = useFilm((s) => s.film);
  const playing = usePlayback((s) => s.playing);
  const time = usePlayback((s) => s.time);
  const rate = usePlayback((s) => s.rate);
  const looping = usePlayback((s) => s.loop !== null);
  const p = usePlayback.getState;
  const nextRate = RATES[(RATES.indexOf(rate) + RATES.length - 1) % RATES.length] ?? 1;

  return (
    <div ref={barRef} className="canvas-toolbar" role="toolbar" aria-label="Playback">
      <Button variant="quiet" className="canvas-icon" aria-label="Back one frame" title="Back one frame (Left arrow)" onClick={() => { p().pause(); p().step(-1); }}>
        <Icon name="back" />
      </Button>
      <Button className="canvas-play" aria-label={playing ? 'Pause' : 'Play'} title={`${playing ? 'Pause' : 'Play'} (Space)`} onClick={() => p().toggle()}>
        <Icon name={playing ? 'pause' : 'play'} size={18} />
      </Button>
      <Button variant="quiet" className="canvas-icon" aria-label="Forward one frame" title="Forward one frame (Right arrow)" onClick={() => { p().pause(); p().step(1); }}>
        <Icon name="forward" />
      </Button>
      <span className="canvas-time time">
        {formatTime(time)} <span className="canvas-time-of">/ {formatTime(film?.duration ?? 0)}</span>
      </span>
      <Button variant="quiet" title={`Speed: ${rateLabel(rate)}. Click for ${rateLabel(nextRate)}.`} aria-label={`Speed ${rateLabel(rate)}`} onClick={() => p().setRate(nextRate)}>
        {rateLabel(rate)}
      </Button>
      <Button variant="quiet" aria-pressed={looping} title="Repeat this scene (L)" onClick={() => p().toggleSceneLoop()}>
        <Icon name="repeat" />
        <span className="canvas-label">Repeat scene</span>
      </Button>
      <span className="canvas-toolbar-fill" />
      {onNote ? (
        <Button className="canvas-note" title="Write a note at this moment (N)" onClick={onNote}>
          <Icon name="note" />
          Note at <span className="time">{formatTime(time)}</span> <kbd className="canvas-kbd">N</kbd>
        </Button>
      ) : null}
    </div>
  );
}

/** Everything that changes how the film is shown: phone size, guides, safe zones and compare, in one menu over the film. */
export function ViewMenu() {
  const film = useFilm((s) => s.film);
  const videos = useFilm((s) => s.videos);
  const watching = useFilm((s) => s.video);
  const canvas = useCanvas();
  const tall = film ? isTall({ w: film.width, h: film.height }) : false;
  const others = versionOptions(videos).filter((v) => v.value !== watching);
  const other = others.find((v) => v.value === canvas.compareWith) ?? others[0];
  const on = canvas.phone || canvas.titleSafe || canvas.thirds || !!canvas.zone || canvas.compare;
  const label = canvas.zone && tall ? `View: ${SAFE_ZONES[canvas.zone].name}` : canvas.compare ? 'View: compare' : 'View';
  const zone = (z: Platform | null) => canvas.set({ zone: z });

  return (
    <div className="canvas-view">
      <Popover label={<><Icon name="view" />{label}</>} align="end" pressed={on} ariaLabel={label} title="Phone size, guides, safe zones and compare">
        {() => (
          <div role="menu" aria-label="View options">
            <p className="ui-menu-title">Size</p>
            <MenuItem checked={canvas.phone} onClick={() => canvas.set({ phone: !canvas.phone })}>Phone size</MenuItem>
            <hr className="ui-menu-rule" />
            <p className="ui-menu-title">Safe zones{tall ? '' : ' (tall films only)'}</p>
            <MenuItem checked={!canvas.zone} disabled={!tall} onClick={() => zone(null)}>None</MenuItem>
            {PLATFORMS.map((pl) => (
              <MenuItem key={pl} checked={tall && canvas.zone === pl} disabled={!tall} onClick={() => zone(pl)} hint={pl === canvas.lastZone ? 'S' : undefined}>{SAFE_ZONES[pl].name}</MenuItem>
            ))}
            <hr className="ui-menu-rule" />
            <p className="ui-menu-title">Guides</p>
            <MenuItem checked={canvas.titleSafe} onClick={() => canvas.set({ titleSafe: !canvas.titleSafe })} hint="5% margin">Title-safe</MenuItem>
            <MenuItem checked={canvas.thirds} onClick={() => canvas.set({ thirds: !canvas.thirds })}>Thirds</MenuItem>
            <hr className="ui-menu-rule" />
            <p className="ui-menu-title">Compare</p>
            <MenuItem checked={canvas.compare} disabled={!others.length} hint={others.length ? 'C' : 'Needs two versions'}
              onClick={() => canvas.set({ compare: !canvas.compare, compareWith: other?.value ?? null })}>Compare two versions</MenuItem>
            {canvas.compare && other ? (
              <div className="canvas-view-compare">
                <Segmented label="How to compare" options={modes} value={canvas.compareMode} onChange={(compareMode) => canvas.set({ compareMode })} />
                <Select label="Compare with" hideLabel value={other.value} onChange={(compareWith) => canvas.set({ compareWith })} options={others} />
              </div>
            ) : null}
            <p className="ui-menu-help">Safe zones use each app's margins for ads, the strictest they publish.</p>
          </div>
        )}
      </Popover>
    </div>
  );
}
