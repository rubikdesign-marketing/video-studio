// The plan a CaptureClip draws from, worked out from its props. Pure (no React, no Remotion), so transitions and the
// checks can ask where a clip's pointer, camera and things are at any film time without drawing it.
import type { CaptureClipProps } from '../CaptureClip';
import type { PresetName } from '../motion';
import type { CameraMove } from './camera';
import type { CaptureTracks } from './data';
import { planCapture } from './plan';
import type { TimeSpec } from './timemap';

/** The clip's time effects, with `trimLoads` given on its own folded in. */
export const clipTime = (props: Pick<CaptureClipProps, 'time' | 'trimLoads'>): TimeSpec | undefined =>
  props.trimLoads === undefined ? props.time : { ...props.time, trimLoads: props.trimLoads };

/** The plan a clip draws from (the pointer, the time map, the camera and the look's own marks), for its energy. */
export const planOfClip = (props: Omit<CaptureClipProps, 'width'>, tracks: CaptureTracks | undefined, energy: PresetName) => {
  const { cursor } = props;
  const zoomMoves: CameraMove[] = props.zoom
    ? [
        { move: 'push-in', to: { x: props.zoom.to.x, y: props.zoom.to.y, width: props.zoom.to.width, height: (props.zoom.to.width * cursor.page.height) / cursor.page.width }, at: props.zoom.at, over: props.zoom.over },
        ...(props.zoom.back !== undefined ? [{ move: 'key', to: 'page', at: props.zoom.back, over: props.zoom.over } as CameraMove] : []),
      ]
    : [];
  return planCapture(cursor, tracks, {
    from: props.from,
    to: props.to,
    look: props.look,
    overrides: {
      cursor: props.pointer === false ? 'hidden' : props.cursorStyle,
      cursorSize: props.cursorSize ?? (props.pointerSize ? props.pointerSize / 3.2 : undefined),
      click: props.click,
      magnet: props.magnet,
      glow: props.glow,
      trail: props.trail,
      caretGlow: props.caretGlow,
      keyCaps: props.keyCaps,
      repath: props.repath,
      pace: props.pace,
      camera: props.zoom ? { ...props.camera, auto: false } : props.camera,
    },
    time: clipTime(props),
    moves: [...zoomMoves, ...(props.moves ?? [])],
    holds: props.holds,
    energy,
    pointerFrom: props.pointerFrom,
    region: props.relayout,
  });
};
