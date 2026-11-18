import { useFilm } from '../store';
import { usePlayback } from '../playback';
import { Button, Segmented, Select } from '../ui';
import { formatTime } from './format';
import { isTall } from './geometry';
import { PLATFORMS, SAFE_ZONES, type Platform } from './safe-zones';
import { useCanvas, type CompareMode } from './state';
import { versionOptions } from './versions';

type ZoneChoice = Platform | 'off';
const zoneOptions: { value: ZoneChoice; label: string }[] = [
  { value: 'off', label: 'No safe zone' },
  ...PLATFORMS.map((p) => ({ value: p, label: `${SAFE_ZONES[p].name} safe zone` })),
];
const modes: { value: CompareMode; label: string }[] = [
  { value: 'side', label: 'Side by side' },
  { value: 'wipe', label: 'Wipe' },
];

export interface ToolbarProps {
  /** So the canvas can measure the bar and keep the film clear of it. */
  barRef?: React.Ref<HTMLDivElement>;
  marking: boolean;
  onToggleMarking(): void;
}

/** The floating bar over the canvas: play, phone size, guides, the area box and compare. */
export function Toolbar({ barRef, marking, onToggleMarking }: ToolbarProps) {
  const film = useFilm((s) => s.film);
  const videos = useFilm((s) => s.videos);
  const watching = useFilm((s) => s.video);
  const playing = usePlayback((s) => s.playing);
  const time = usePlayback((s) => s.time);
  const canvas = useCanvas();
  const tall = film ? isTall({ w: film.width, h: film.height }) : false;
  const others = versionOptions(videos).filter((v) => v.value !== watching);
  const other = others.find((v) => v.value === canvas.compareWith) ?? others[0];

  return (
    <div ref={barRef} className="canvas-toolbar" role="toolbar" aria-label="Canvas">
      <Button variant="primary" onClick={() => usePlayback.getState().toggle()}>
        {playing ? 'Pause' : 'Play'}
      </Button>
      <span className="canvas-time time">
        {formatTime(time)} of {formatTime(film?.duration ?? 0)}
      </span>
      <span className="canvas-toolbar-gap" />
      <Button variant="quiet" aria-pressed={canvas.phone} onClick={() => canvas.set({ phone: !canvas.phone })}>
        Phone size
      </Button>
      <Button variant="quiet" aria-pressed={canvas.titleSafe} onClick={() => canvas.set({ titleSafe: !canvas.titleSafe })}>
        Title-safe
      </Button>
      <Button variant="quiet" aria-pressed={canvas.thirds} onClick={() => canvas.set({ thirds: !canvas.thirds })}>
        Thirds
      </Button>
      <span title={tall ? undefined : 'Safe zones are for tall (9:16) films.'}>
        <Select<ZoneChoice>
          label="Safe zone"
          hideLabel
          disabled={!tall}
          value={tall ? (canvas.zone ?? 'off') : 'off'}
          onChange={(value) => canvas.set({ zone: value === 'off' ? null : value })}
          options={zoneOptions}
        />
      </span>
      <Button variant="quiet" aria-pressed={marking} onClick={onToggleMarking}>
        {marking ? 'Remove the area' : 'Point at an area'}
      </Button>
      <span className="canvas-toolbar-gap" />
      <span title={others.length ? undefined : 'Compare needs at least two versions.'}>
        <Button
          variant="quiet"
          aria-pressed={canvas.compare}
          disabled={!others.length}
          onClick={() => canvas.set({ compare: !canvas.compare, compareWith: other?.value ?? null })}
        >
          Compare
        </Button>
      </span>
      {canvas.compare && other ? (
        <>
          <Segmented label="How to compare" options={modes} value={canvas.compareMode} onChange={(compareMode) => canvas.set({ compareMode })} />
          <Select label="Compare with" hideLabel value={other.value} onChange={(compareWith) => canvas.set({ compareWith })} options={others} />
        </>
      ) : null}
    </div>
  );
}
