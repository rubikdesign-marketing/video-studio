// Footage parts for edits of raw footage (FOOTAGE-PLAN.md): a treated plate with a camera that zooms on the face,
// the person cut out on top of it, and a layer between the two for words that sit behind the person's head.
// Brand-neutral: colours and type come from the brand in use; footage, cutouts and face tracks from the job.
//
// A plate fills the 9:16 frame exactly (the footage tool frames it). Face tracks are in plate shares (0..1), on the
// film clock, from tools/footage/py/faces.py through the job's data file.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp01, easing, lerp, progress } from '../motion';

export type FaceSample = { t: number; x: number; y: number; top: number; chin: number; w: number };

/** The face at film time `t`, interpolated between samples (positions are already smoothed by faces.py). */
export const faceAt = (track: FaceSample[], t: number): FaceSample => {
  if (!track.length) return { t, x: 0.5, y: 0.38, top: 0.3, chin: 0.46, w: 0.2 };
  if (t <= track[0].t) return track[0];
  const last = track[track.length - 1];
  if (t >= last.t) return last;
  let i = 0;
  while (track[i + 1].t < t) i++;
  const a = track[i];
  const b = track[i + 1];
  const u = (t - a.t) / (b.t - a.t);
  return { t, x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), top: lerp(a.top, b.top, u), chin: lerp(a.chin, b.chin, u), w: lerp(a.w, b.w, u) };
};

/** A camera move on the footage: from `from` to `to` (zoom, 1 = the plate as framed) between two film times. */
export type Zoom = { at: number; until: number; from: number; to: number };

/** The zoom at film time t: the last move that has started, eased; before any move, the first one's start. */
export const zoomAt = (moves: Zoom[], t: number) => {
  let z = moves.length ? moves[0].from : 1;
  for (const m of moves) if (t >= m.at) z = lerp(m.from, m.to, progress(t, m.at, m.until, easing.travel));
  return z;
};

export type Camera = { zoom: number; ax: number; ay: number };

/** Where a plate point (shares) lands in the frame, through the camera. */
export const toFrame = (cam: Camera, w: number, h: number, nx: number, ny: number) => ({
  x: cam.ax + (nx * w - cam.ax) * cam.zoom,
  y: cam.ay + (ny * h - cam.ay) * cam.zoom,
});

type ShotProps = {
  plate: string;
  matte?: string | null;
  /** Film seconds the shot starts and ends. */
  start: number;
  end: number;
  /** Plate seconds at the shot's start. */
  offset: number;
  face: FaceSample[];
  zooms?: Zoom[];
  /** Drawn between the plate and the cutout: words behind the person. Given the camera and the face, in frame px. */
  behind?: (ctx: { t: number; cam: Camera; head: { x: number; top: number; chin: number; eyes: number; width: number } }) => ReactNode;
  /** Drawn over the cutout. Same arguments. */
  front?: (ctx: { t: number; cam: Camera; head: { x: number; top: number; chin: number; eyes: number; width: number } }) => ReactNode;
  /** Hide the plate (the room) and keep only the cutout: 0 shows the room, 1 has slid it away. */
  roomAway?: (t: number) => { x: number; opacity: number };
  /** Move the cutout and the words with it (frame px), for staging the person on a new background. */
  shift?: (t: number) => { x: number; y: number };
  style?: CSSProperties;
};

/**
 * One footage shot. The plate and its cutout play in step, under one camera anchored on the face, so a zoom keeps
 * the face where it is. `behind` sits between them; `front` sits on top.
 */
export const FootageShot: FC<ShotProps> = ({ plate, matte, start, end, offset, face, zooms = [], behind, front, roomAway, shift, style }) => {
  const { fps, width: W, height: H } = useVideoConfig();
  const from = Math.round(start * fps);
  const dur = Math.max(1, Math.round(end * fps) - from);
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <ShotBody {...{ plate, matte, start, offset, face, zooms, behind, front, roomAway, shift, style, W, H, fps }} />
    </Sequence>
  );
};

const fill: CSSProperties = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

const ShotBody: FC<Omit<ShotProps, 'end'> & { W: number; H: number; fps: number }> = ({
  plate, matte, start, offset, face, zooms = [], behind, front, roomAway, shift, style, W, H, fps,
}) => {
  const frame = useCurrentFrame();
  const t = start + frame / fps;
  const anchor = faceAt(face, start + 0.05);
  const cam: Camera = { zoom: zoomAt(zooms, t), ax: anchor.x * W, ay: anchor.y * H };
  const f = faceAt(face, t);
  const eyes = toFrame(cam, W, H, f.x, f.y);
  const top = toFrame(cam, W, H, f.x, f.top);
  const chin = toFrame(cam, W, H, f.x, f.chin);
  const s = shift ? shift(t) : { x: 0, y: 0 };
  const head = { x: eyes.x + s.x, top: top.y + s.y, chin: chin.y + s.y, eyes: eyes.y + s.y, width: f.w * W * cam.zoom };
  const camStyle: CSSProperties = { ...fill, transformOrigin: `${cam.ax}px ${cam.ay}px`, transform: `scale(${cam.zoom})` };
  const room = roomAway ? roomAway(t) : { x: 0, opacity: 1 };
  const trim = Math.round(offset * fps);
  return (
    <AbsoluteFill style={style}>
      {room.opacity > 0 ? (
        <AbsoluteFill style={{ transform: `translateX(${room.x}px)`, opacity: room.opacity }}>
          <div style={camStyle}>
            <OffthreadVideo src={staticFile(plate)} muted trimBefore={trim} style={fill} />
          </div>
        </AbsoluteFill>
      ) : null}
      {behind ? <AbsoluteFill>{behind({ t, cam, head })}</AbsoluteFill> : null}
      {matte ? (
        <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
          <div style={camStyle}>
            <OffthreadVideo src={staticFile(matte)} muted transparent trimBefore={trim} style={fill} />
          </div>
        </AbsoluteFill>
      ) : null}
      {front ? <AbsoluteFill>{front({ t, cam, head })}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};

/** 0 to 1 and back: in over `inS` from `at`, out over `outS` from `out`. */
export const window01 = (t: number, at: number, out: number, inS = 0.25, outS = 0.18) =>
  clamp01(progress(t, at, at + inS, easing.arrive) - progress(t, out, out + outS, easing.leave));
