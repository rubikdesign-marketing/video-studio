import type { CSSProperties } from 'react';
import type { Box } from '../contracts/review';
import { boxToRect, thirds, titleSafe, zoneRects, type Rect, type Size } from './geometry';
import { SAFE_ZONES, type Platform } from './safe-zones';

const place = (r: Rect): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h });

export interface OverlaysProps {
  /** The size of the picture on screen, in pixels. Everything is drawn from it, so it scales with the film. */
  frame: Size;
  titleSafe: boolean;
  thirds: boolean;
  zone: Platform | null;
  box: Box | null;
}

/** The guides drawn over the film. None of them takes a click. */
export function Overlays({ frame, titleSafe: showTitleSafe, thirds: showThirds, zone, box }: OverlaysProps) {
  const lines = thirds(frame);
  const app = zone ? zoneRects(frame, SAFE_ZONES[zone]) : null;
  return (
    <div className="canvas-overlays" aria-hidden="true">
      {app ? (
        <>
          {app.covered.map((r, i) => (
            <div key={i} className="canvas-covered" style={place(r)} />
          ))}
          <div className="canvas-safe" style={place(app.safe)}>
            <span className="canvas-guide-label">Clear on {zone ? SAFE_ZONES[zone].name : ''}</span>
          </div>
        </>
      ) : null}
      {showThirds ? (
        <>
          {lines.down.map((x) => (
            <div key={`d${x}`} className="canvas-third canvas-third--down" style={{ left: x }} />
          ))}
          {lines.across.map((y) => (
            <div key={`a${y}`} className="canvas-third canvas-third--across" style={{ top: y }} />
          ))}
        </>
      ) : null}
      {showTitleSafe ? (
        <div className="canvas-title-safe" style={place(titleSafe(frame))}>
          <span className="canvas-guide-label">Title-safe</span>
        </div>
      ) : null}
      {box ? <div className="canvas-box" style={place(boxToRect(frame, box))} /> : null}
    </div>
  );
}
