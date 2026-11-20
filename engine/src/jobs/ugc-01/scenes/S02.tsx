/*
 * S02: Demo (hand-built). One pointer-led path from the card's take-5 cursor.json, compressed to this beat:
 * the pointer comes in from the right (real path shape, 4.668 s to 5.441 s of the take), clicks the sidebar item
 * "Campaign Launch Board" at events.click, the page swaps 3 frames later, the camera then follows the pointer to
 * the New button, and a glow opens on it (events.hover).
 */
import type { FC } from 'react';
import { AbsoluteFill, Easing, interpolate } from 'remotion';
import cursor from '../../../../../jobs/_tulvo-capture-test/capture/boards/take-5/cursor.json';
import type { SceneData } from '../../_film';
import { RecBadge, TapRipple } from '../../../kit/ugc';
import { camAt, events as e, PageOutline, PagePointer, project, UgcCaptions, useFilmTime, Window, WIN } from '../ugc';

// Where the camera is: on the sidebar for the click, then following to the New button, a slow push after.
export const S02_KEYS: [number, number, number, number][] = [[2.5, 400, 540, 2.4], [e.cameraFollow, 400, 540, 2.4], [7.1, 1500, 540, 2.4], [9.0, 1500, 540, 2.55]];

const REAL: number[][] = (cursor as { path: number[][] }).path.filter((r) => r[0] >= 4.668 && r[0] <= 5.441);
const SIDEBAR: [number, number] = [101.3, 397]; // the click in the take (cursor.json events, step 5)
const NEW: [number, number] = [1848, 97]; // centre of the New button on the 1920 x 1080 page
const smooth = Easing.bezier(0.4, 0, 0.2, 1);

/** The pointer in page pixels at film time t, or null before it is on the page. */
export const pointerAt = (t: number): [number, number] => {
  if (t < 2.9) return [REAL[0][1], REAL[0][2]];
  if (t <= e.pointerArrive) {
    // the real path shape, from where it starts to the sidebar, stretched to fit the beat
    const u = (t - 2.9) / (e.pointerArrive - 2.9);
    const real = 4.668 + u * (5.441 - 4.668);
    const i = Math.max(1, REAL.findIndex((r) => r[0] >= real));
    const [a, b] = [REAL[i - 1], REAL[i]];
    const k = b[0] === a[0] ? 1 : (real - a[0]) / (b[0] - a[0]);
    return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  }
  if (t < 5.8) return SIDEBAR;
  const u = interpolate(t, [5.8, 7.8], [0, 1], { easing: smooth, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // a shallow arc: it rises a little above the straight line
  return [SIDEBAR[0] + (NEW[0] - SIDEBAR[0]) * u, SIDEBAR[1] + (NEW[1] - SIDEBAR[1]) * u - Math.sin(u * Math.PI) * 90];
};

export const S02: FC<{ scene: SceneData }> = ({ scene }) => {
  const t = useFilmTime(scene);
  const cam = camAt(S02_KEYS, t);
  const [px, py] = pointerAt(t);
  const press = t >= e.click && t < e.click + 0.1 ? 1 : 0;
  const src = t < e.swap ? 'demo-1' : t < e.hover ? 'demo-2' : 'demo-3';
  const local = (film: number) => film - scene.start; // the tap ripple wants the scene's own clock
  const tap = project(cam, SIDEBAR[0], SIDEBAR[1]); // where the finger lands, in window pixels (the camera is still at the click)
  return (
    <AbsoluteFill>
      <Window src={`jobs/ugc-01/graded/${src}.png`} cam={cam}>
        <PageOutline cam={cam} rect={[1807, 80, 82, 34]} t={t} at={e.hover} grow={0.2} />
        <TapRipple at={local(e.click)} x={tap.x / WIN.w} y={tap.y / WIN.h} width={WIN.w} height={WIN.h} size={9} />
        <RecBadge at={0.1} width={WIN.w} height={WIN.h} x={0.05} y={0.07} size={3.4} />
        <PagePointer cam={cam} x={px} y={py} press={press} />
      </Window>
      <UgcCaptions t={t} />
    </AbsoluteFill>
  );
};
