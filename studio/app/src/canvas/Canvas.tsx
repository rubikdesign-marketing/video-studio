import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { api } from '../api';
import type { Box } from '../contracts/review';
import { usePlayback } from '../playback';
import { useFilm } from '../store';
import { cx } from '../ui';
import { followPlayback } from './bridge';
import { boxFromDrag, fitFrame, isTall, sideBySide, type Rect, type Size } from './geometry';
import { Overlays } from './Overlays';
import { useCanvas } from './state';
import { syncFollower } from './sync';
import { Toolbar } from './Toolbar';
import { setStageVideo } from './video';
import { versionLabel } from './versions';
import './canvas.css';

/** Space kept free around the picture. Under it the toolbar is measured, so the film never sits behind it. */
const PAD = 16;
const TOOLBAR_GAP = 24;

function useSize(): [React.RefObject<HTMLDivElement | null>, Size] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  }, []);
  return [ref, size];
}

export interface CanvasProps {
  /** The area a note points at, as shares of the frame. */
  box: Box | null;
  /** True while an area is being drawn. */
  marking: boolean;
  onBox(box: Box | null): void;
  onToggleMarking(): void;
}

/** The film, with its guides, the area box, version compare and the floating toolbar. */
export function Canvas({ box, marking, onBox, onToggleMarking }: CanvasProps) {
  const film = useFilm((s) => s.film);
  const job = useFilm((s) => s.job);
  const videos = useFilm((s) => s.videos);
  const watching = useFilm((s) => s.video);
  const canvas = useCanvas();
  const [areaRef, area] = useSize();
  const [barRef, bar] = useSize();
  const main = useRef<HTMLVideoElement>(null);
  const second = useRef<HTMLVideoElement>(null);
  const drag = useRef<{ frame: Rect; from: { x: number; y: number } } | null>(null);

  const url = (file: string | null) => {
    const version = videos.find((v) => v.file === file);
    return job && version ? `${api.mediaUrl(job, version.file)}?v=${Math.round(version.modified)}` : undefined;
  };
  const otherFile = canvas.compare ? (videos.find((v) => v.file === canvas.compareWith && v.file !== watching) ?? videos.find((v) => v.file !== watching))?.file ?? null : null;
  const comparing = otherFile !== null;
  const src = url(watching);

  // Hand the video to playback, to the capture code, and to the stand-in that makes it follow the store.
  useEffect(() => {
    const video = main.current;
    if (!video) return;
    setStageVideo(video);
    usePlayback.getState().attachVideo(video);
    const stop = followPlayback(video);
    return () => {
      stop();
      setStageVideo(null);
      usePlayback.getState().attachVideo(null);
    };
  }, []);

  // The film's own length and frame rate, for a playback store that has not been told yet.
  useEffect(() => {
    if (film && typeof usePlayback.setState === 'function' && !usePlayback.getState().duration) {
      usePlayback.setState({ duration: film.duration, fps: film.fps });
    }
  }, [film]);

  // While two versions are compared, keep the second in step with the first on every frame.
  useEffect(() => {
    if (!comparing) return;
    let frame = 0;
    const tick = () => {
      const a = main.current;
      const b = second.current;
      if (a && b && b.readyState >= 1) syncFollower(a, b, film?.fps ?? 30);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [comparing, film?.fps]);

  if (!film) return null;
  const shape = { w: film.width, h: film.height };
  const room = { w: Math.max(0, area.w - PAD * 2), h: Math.max(0, area.h - PAD - TOOLBAR_GAP - (bar.h || 48)) };
  const side = comparing && canvas.compareMode === 'side';
  const [first, other] = side ? sideBySide(room, shape) : [fitFrame(room, shape, { phone: canvas.phone }), null];
  const at = (r: Rect) => ({ left: r.x + PAD, top: r.y + PAD, width: r.w, height: r.h });
  const wipe = comparing && canvas.compareMode === 'wipe';

  const point = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!marking) {
      usePlayback.getState().toggle();
      return;
    }
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { frame: { x: r.left, y: r.top, w: r.width, h: r.height }, from: point(e) };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) onBox(boxFromDrag(drag.current.frame, drag.current.from, point(e)));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
  const onWipeKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const next = e.key === 'ArrowLeft' ? canvas.wipe - step : e.key === 'ArrowRight' ? canvas.wipe + step : e.key === 'Home' ? 0 : e.key === 'End' ? 1 : null;
    if (next === null) return;
    e.preventDefault();
    canvas.set({ wipe: Math.min(1, Math.max(0, next)) });
  };
  const onWipeDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!(e.buttons & 1) || !first.w) return;
    const r = e.currentTarget.parentElement?.getBoundingClientRect();
    if (r) canvas.set({ wipe: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) });
  };

  return (
    <div className="canvas" ref={areaRef}>
      <div className={cx('canvas-frame', canvas.phone && !side && 'is-phone')} style={at(first)}>
        <video ref={main} className="canvas-video" src={src} playsInline preload="auto" aria-label="The film" />
        {wipe ? (
          <video
            ref={second}
            className="canvas-video canvas-video--over"
            src={url(otherFile)}
            style={{ clipPath: `inset(0 0 0 ${canvas.wipe * 100}%)` }}
            muted
            playsInline
            preload="auto"
            aria-label="The other version"
          />
        ) : null}
        <Overlays
          frame={first}
          titleSafe={canvas.titleSafe}
          thirds={canvas.thirds}
          zone={isTall(shape) ? canvas.zone : null}
          box={box}
        />
        <div
          className={cx('canvas-draw', marking && 'is-marking')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {comparing ? <span className="canvas-tag canvas-tag--first">{versionLabel(videos, watching ?? '')}</span> : null}
        {wipe ? (
          <>
            <span className="canvas-tag canvas-tag--second">{versionLabel(videos, otherFile ?? '')}</span>
            <div
              className="canvas-wipe"
              role="slider"
              tabIndex={0}
              aria-label="Wipe between the two versions"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(canvas.wipe * 100)}
              style={{ left: `${canvas.wipe * 100}%` }}
              onKeyDown={onWipeKey}
              onPointerDown={(e) => e.currentTarget.setPointerCapture?.(e.pointerId)}
              onPointerMove={onWipeDrag}
            />
          </>
        ) : null}
      </div>
      {side && other ? (
        <div className="canvas-frame" style={at(other)}>
          <video ref={second} className="canvas-video" src={url(otherFile)} muted playsInline preload="auto" aria-label="The other version" />
          <span className="canvas-tag canvas-tag--first">{versionLabel(videos, otherFile ?? '')}</span>
        </div>
      ) : null}
      <Toolbar barRef={barRef} marking={marking} onToggleMarking={onToggleMarking} />
    </div>
  );
}
