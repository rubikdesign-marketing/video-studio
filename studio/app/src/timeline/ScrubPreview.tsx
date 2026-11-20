import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import type { Seconds } from '../contracts/film';
import { useFilm } from '../store';
import { clock, HEAD } from './view';

/**
 * Hovering the timeline shows the frame under the pointer (EDITOR-V2-PLAN.md, phase B5). The frame comes from a
 * second, hidden copy of the film, so the film on the canvas never moves while you look around. Mouse and pen only:
 * a finger on the timeline is a scrub, which the ruler already handles.
 */
export function ScrubPreview({ track, pps, duration }: { track: { current: HTMLDivElement | null }; pps: number; duration: Seconds }) {
  const job = useFilm((s) => s.job);
  const videos = useFilm((s) => s.videos);
  const watching = useFilm((s) => s.video);
  const version = videos.find((v) => v.file === watching);
  const src = job && version ? `${api.mediaUrl(job, version.file)}?v=${Math.round(version.modified)}` : undefined;
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; time: Seconds } | null>(null);
  const seeking = useRef(false);
  const wanted = useRef<Seconds | null>(null);

  useEffect(() => {
    const el = track.current;
    const v = video.current;
    if (!el || !v) return;
    const seek = (t: Seconds) => {
      wanted.current = t;
      if (seeking.current || v.readyState < 1) return;
      seeking.current = true;
      v.currentTime = t;
    };
    const onSeeked = () => {
      seeking.current = false;
      const c = canvas.current;
      try { c?.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height); } catch { /* the frame is not ready; the next move draws it */ }
      if (wanted.current !== null && Math.abs(wanted.current - v.currentTime) > 0.04) seek(wanted.current);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.buttons) { setTip(null); return; }
      const box = el.getBoundingClientRect();
      const t = (e.clientX - box.left - HEAD) / pps;
      if (t < 0 || t > duration) { setTip(null); return; }
      setTip({ x: e.clientX, y: box.top, time: t });
      seek(Math.min(duration - 0.04, t));
    };
    const onLeave = () => setTip(null);
    v.addEventListener('seeked', onSeeked);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      v.removeEventListener('seeked', onSeeked);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [track, pps, duration]);

  const shape = useFilm((s) => s.film);
  const tall = shape ? shape.height > shape.width : true;
  const w = tall ? 54 : 128;
  const h = tall ? 96 : 72;
  return (
    <>
      <video ref={video} src={src} muted playsInline preload="auto" hidden aria-hidden="true" />
      {typeof document === 'undefined' ? null : createPortal(
        <div className="tl-scrub" hidden={!tip} aria-hidden="true" style={tip ? { left: tip.x, top: tip.y } : undefined}>
          <canvas ref={canvas} width={w * 2} height={h * 2} style={{ width: w, height: h }} />
          <span className="time">{tip ? clock(tip.time, 0.1) : ''}</span>
        </div>,
        document.body,
      )}
    </>
  );
}
