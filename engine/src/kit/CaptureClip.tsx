// A product capture made by tools/capture/capture.mjs, played inside a frame region with the engine's own motion
// on top (CAPTURE-PLAN 7.1 to 7.3 and 7.9):
//
// - the pointer is drawn by the engine in the brand's style, re-pathed between the recorded clicks (pointer.ts);
// - the camera zooms in on each action using the real positions in tracks.json, and follows the pointer (camera.ts);
// - speed ramps, freezes, jumps, rewinds, pinned events and a loopable end all go through one time map
//   (timemap.ts), so the picture, the pointer, the tracked things and the camera never drift apart;
// - a look preset sets all of it in one word (looks.ts), and any single setting can be given on its own.
//
// The picture shows the recording frame the time map asks for (a frozen frame of the video each film frame), so
// any speed, freeze or rewind is exact to the frame. Works for any brand: colours, type and radius are the brand's.
import { type CSSProperties, type FC, type ReactNode } from 'react';
import { Freeze, OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import { useBrand } from './brand';
import type { CameraMove } from './capture/camera';
import { typingTarget } from './capture/camera';
import { rectAt, thingAt, type CaptureCursor, type CaptureTracks, type Rect } from './capture/data';
import { EmphasisLayer, restOf, RestFade, type EmphasisContext, type LayerSpec } from './capture/emphasis';
import { regionView, withThings, type Emphasis, type FixedThing } from './capture/glue';
import { BurstEffect, CLICK_SECONDS, DrawnPointer, KeyCaps, PulseEffect, RingEffect, SpedUpLabel, Spotlight, ThingGlow, TrailLine } from './capture/draw';
import type { ClickEffect, CursorStyle, KeyCapMode, Look, LookName, Trail } from './capture/looks';
import { clipTime, planOfClip } from './capture/clipplan';
import { planCapture } from './capture/plan';
import type { Pace } from './capture/pointer';
import type { Relayout } from './capture/relayout';
import type { TimeSpec } from './capture/timemap';
import { clamp01, easing, lerp, presets, timing, useMotion, type Point, type PresetName } from './motion';
import { MotionBlur } from './moves/core';
import { alpha } from './tokens';
import { useStage, useVh } from './ui';

export { clipTime, planOfClip } from './capture/clipplan';
export { clicksOf, markAt, pointerAt, type CaptureCursor, type CaptureEvent, type CaptureTracks } from './capture/data';

/**
 * Version 1's push in on part of the screen, kept so older scenes still work: `to` is the area to fill the frame
 * with (page pixels), from `at` seconds on the clip's clock, easing back out from `back` if given. It becomes a
 * hand-set camera move.
 */
export type CaptureZoom = { to: { x: number; y: number; width: number }; at: number; over?: 'scene' | 'hero'; back?: number };

export type CaptureClipProps = {
  /** The recording inside public/ (`jobs/<job>/capture/<id>/recording.mp4`), its cursor.json and tracks.json. */
  src: string;
  cursor: CaptureCursor;
  tracks?: CaptureTracks;
  /** Seconds of the recording to play. The clip's own clock starts at 0 where `from` is. */
  from?: number;
  to?: number;
  /** Width of the region in frame pixels; the height follows the window's shape. Place it with `style`. */
  width: number;
  style?: CSSProperties;
  /** The app window look: rounded corners, a line border and a soft shadow (default true). */
  window?: boolean;
  /** One word for the pointer, click, camera and pace together. Default "product-demo". */
  look?: LookName;
  /** Any single setting, over the look. */
  cursorStyle?: CursorStyle;
  cursorSize?: number;
  /** The name on a named pointer's tag. */
  cursorName?: string;
  click?: ClickEffect;
  magnet?: boolean;
  glow?: boolean;
  trail?: Trail;
  caretGlow?: boolean;
  keyCaps?: KeyCapMode;
  repath?: boolean;
  pace?: Pace;
  camera?: Partial<Look['camera']>;
  /** Hand-set camera moves, in seconds on the clip's clock. They override the automatic camera from their cue on. */
  moves?: CameraMove[];
  /** Speed ramps, freezes, jumps, rewinds, pins and the loop. Times in recording seconds, pins in clip seconds. */
  time?: TimeSpec;
  /**
   * Hide the product loading (default true): a clip that plays from the recording's start begins just before the
   * first page load ends, and each later load longer than 0.6 s plays faster so it lasts 0.6 s, with the "Sped up"
   * label. False keeps the loads as recorded (waits are then sped up the older way). Same as `time.trimLoads`.
   */
  trimLoads?: boolean;
  /** Spans of the clip's clock that must be read: the camera holds still. */
  holds?: [number, number][];
  /** Version 1: a push in on part of the screen; false hides the pointer; the pointer's size in % of frame height. */
  zoom?: CaptureZoom;
  pointer?: boolean;
  pointerSize?: number;
  /**
   * Animations on the product, glued to tracked things (CAPTURE-PLAN 7.4, 7.9): lift, isolate, fly out, focus pull,
   * outline, underline, ring, highlight sweep, magnifier, callout, arrow, connection line, step badges, typed again,
   * toast pop, success moment, blur reveal and privacy blur. Cues in seconds on the clip's clock. One per beat.
   */
  emphasis?: Emphasis[];
  /** Things with a known place, for a take that tracked nothing: `{ "card": { "rect": [x, y, w, h], "from": 2 } }`. */
  things?: Record<string, FixedThing>;
  /** No pointer, effects, labels or key caps: only the picture and its emphases (for stills behind other windows). */
  bare?: boolean;
  /**
   * Draw the pointer itself (default true). False keeps the click, hover and typing effects but leaves the pointer
   * out, for a transition that draws one pointer of its own across the join.
   */
  drawPointer?: boolean;
  /** A clip carrying straight on from an earlier shot: the recording time from which its pointer is shown, resting as after an action. */
  pointerFrom?: number;
  /**
   * A region whose shape is not the page's (phase 8: a 9:16, 1:1 or 4:5 frame, or a tall crop): the clip is
   * `relayout.height` tall for its `relayout.width`, and the camera follows the action inside the wide recording,
   * keeping the acted-on thing and the pointer inside `relayout.safe` (relayout.ts). CaptureShot sets it.
   */
  relayout?: Relayout;
};

/** How long the clip runs on its own clock, in seconds, once the time effects are applied. */
export const captureSeconds = (props: Pick<CaptureClipProps, 'cursor' | 'tracks' | 'from' | 'to' | 'look' | 'time' | 'trimLoads' | 'pace' | 'repath' | 'magnet'>) =>
  planCapture(props.cursor, props.tracks, { from: props.from, to: props.to, look: props.look, time: clipTime(props), overrides: { pace: props.pace, repath: props.repath, magnet: props.magnet } }).map.duration;

const HOLD_CAPS = 0.9;

export const CaptureClip: FC<CaptureClipProps> = (props) => {
  const { src, cursor, width, style, window = true } = props;
  const tracks = withThings(cursor, props.tracks, props.things);
  const m = useMotion();
  const { fps } = useVideoConfig();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const energy = (Object.keys(presets) as PresetName[]).find((name) => presets[name] === m.preset) ?? 'confident';

  const plan = planOfClip(props, tracks, energy);
  const { look, map, pointer, camera } = plan;
  const emphasis: Emphasis[] = [...plan.marks, ...(props.emphasis ?? [])];

  const page = cursor.page;
  // The page's own box at zoom 1, and the region's height (the page's shape, or the re-laid region's).
  const pageHeight = (width * page.height) / page.width;
  const relaid = props.relayout;
  const height = relaid ? (width * relaid.height) / relaid.width : pageHeight;
  const safe = relaid ? { x: (relaid.safe.x * width) / relaid.width, y: (relaid.safe.y * width) / relaid.width, width: (relaid.safe.width * width) / relaid.width, height: (relaid.safe.height * width) / relaid.width } : { x: 0, y: 0, width, height };
  const k = width / page.width; // frame pixels per page pixel, before the camera
  const f = Math.max(0, m.t);
  const rec = map.recAt(f);
  const view = camera.at(f);
  const toRegion = (p: Point): Point => ({ x: (p.x - view.cx) * view.zoom * k + width / 2, y: (p.y - view.cy) * view.zoom * k + height / 2 });
  const boxToRegion = (r: Rect): Rect => {
    const a = toRegion(r);
    return { x: a.x, y: a.y, width: r.width * view.zoom * k, height: r.height * view.zoom * k };
  };

  // The loop: in its last stretch the picture dissolves to the first frame while the camera and pointer go back.
  const quick = (timing.quick * m.preset.length) / 1000;
  const loopLength = Math.min(map.duration / 3, (timing.hero * m.preset.length) / 1000);
  const loopBack = map.loop ? easing.travel(clamp01((f - (map.duration - loopLength)) / loopLength)) : 0;

  // The pointer.
  const state = pointer.at(rec);
  let tip = toRegion(state);
  if (loopBack > 0) {
    const first = toRegion(pointer.at(map.recAt(0)));
    tip = { x: lerp(tip.x, first.x, loopBack), y: lerp(tip.y, first.y, loopBack) };
  }
  const grow = Math.sqrt(view.zoom / (camera.base ?? 1));
  const speed = map.rateAt(f);
  const perFrame = { x: (state.vx * speed * view.zoom * k) / fps, y: (state.vy * speed * view.zoom * k) / fps };
  const lookOfPointer = { style: look.cursor, size: look.cursorSize, name: props.cursorName ?? 'Sam' };
  const drawn = (
    <DrawnPointer look={lookOfPointer} tip={tip} shape={state.shape} press={state.press} opacity={state.opacity} grow={grow} squish={look.click === 'squish'} />
  );

  // Click effects: they start as the button goes down, and play on the film's clock wherever the click shows.
  const effects = look.click === 'none' || look.click === 'squish'
    ? []
    : pointer.clicks.flatMap((c, i) =>
        map.filmTimesOf(c.t).map((ft, j) => {
          const age = f - ft;
          if (age < 0 || age > CLICK_SECONDS.pulse) return null;
          const at = toRegion(c);
          const key = `${i}-${j}`;
          if (look.click === 'pulse') {
            const thing = thingAt(tracks, c, c.t);
            return <PulseEffect key={key} at={at} box={thing ? boxToRegion(thing.rect) : null} age={age} />;
          }
          if (look.click === 'burst') return <BurstEffect key={key} at={at} age={age} />;
          return <RingEffect key={key} at={at} age={age} />;
        }),
      );

  // Hover glow on the thing under a resting pointer.
  let hover: { box: Rect; amount: number } | null = null;
  if (look.glow && state.opacity > 0.01) {
    const thing = thingAt(tracks, state, rec);
    const still = clamp01(1 - Math.hypot(state.vx, state.vy) / 500);
    if (thing && still > 0) hover = { box: boxToRegion(thing.rect), amount: still * state.opacity * 0.9 };
  }

  // The field being typed in glows, brightening on each key.
  let caret: { box: Rect; amount: number } | null = null;
  if (look.caretGlow) {
    for (const e of cursor.events) {
      if ((e.type !== 'type' && e.type !== 'paste') || rec < e.t - 0.15 || rec > (e.end ?? e.t) + 0.5) continue;
      const name = typingTarget(cursor, tracks, pointer.clicks, e);
      const box = name ? rectAt(tracks, name, rec) : null;
      if (!box) continue;
      const on = easing.arrive(clamp01((rec - (e.t - 0.15)) / 0.15)) * (1 - easing.leave(clamp01((rec - (e.end ?? e.t)) / 0.5)));
      const keys = (e.keys ?? []) as number[];
      const beat = keys.reduce((most, t) => (rec >= t ? Math.max(most, Math.exp(-(rec - t) / 0.12)) : most), 0);
      caret = { box: boxToRegion(box), amount: on * (0.65 + 0.35 * beat) };
    }
  }

  // Key caps for shortcuts (or every key), each cap pressing as its key goes down.
  let caps: { keys: string[]; age: number; downs: number[] } | null = null;
  if (look.keyCaps !== 'none') {
    for (const e of cursor.events) {
      if (e.type !== 'press' || !e.key || e.t < plan.from || e.t > plan.to) continue;
      const keys = e.shortcut && Array.isArray(e.keys) ? (e.keys as string[]) : look.keyCaps === 'all' ? [e.key] : null;
      if (!keys) continue;
      const age = f - map.filmAt(e.t);
      // Modifiers go down first: each earlier key a little before the last.
      const downs = keys.map((_, i) => (keys.length - 1 - i) * 0.07);
      if (age >= -(quick + downs[0]) && age <= HOLD_CAPS + quick) caps = { keys, age, downs };
    }
  }

  // The trail: a short fading line (hype and touch), or blur on fast moves.
  const trailPoints: Point[] = [];
  if ((look.trail === 'line' || look.cursor === 'touch') && state.opacity > 0.01) {
    for (let j = 16; j >= 0; j--) {
      const fj = f - j / fps;
      if (fj < 0) continue;
      const s = pointer.at(map.recAt(fj));
      if (look.cursor === 'touch' && s.press < 0.5) continue;
      trailPoints.push(toRegion(s));
    }
  }

  // The picture: the recording frame the time map asks for. The clock is frozen at the clip's first frame and the
  // video is trimmed to start at the wanted frame, because Remotion keeps a frozen clock inside the composition's
  // length, while the recording can run longer than the film.
  // A quarter of a frame in: the frame is then found without doubt (asked for exactly on its time, the decoder can
  // take the one before it, from rounding, and the picture falls a frame behind the tracks).
  const frameOf = (r: number) => Math.max(0, Math.round(r * fps)) + 0.25;
  const video = (r: number, extra?: CSSProperties) => (
    <Freeze frame={0}>
      <OffthreadVideo src={staticFile(src)} muted trimBefore={frameOf(r)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', ...extra }} />
    </Freeze>
  );
  const focus = view.focus;
  const shadow = `0 ${vh(4)}px ${vh(9)}px ${alpha(stage.shade, 0.3)}`;
  const glow = `0 0 ${vh(13)}px ${alpha(stage.accent, stage.screenGlow)}`;
  const turned = view.turnX !== 0 || view.turnY !== 0;

  // The camera: the page placed in the region at the view's centre and zoom. Everything glued uses the same numbers.
  // The page is laid out at its own pixel size and scaled by the camera in one step, so the browser never rounds a
  // fractional box (a region 982.8 px wide) before scaling it, which would shift the far side of the page by pixels.
  const pageScale = view.zoom * k;
  const cameraStyle: CSSProperties = { position: 'absolute', left: 0, top: 0, width: page.width, height: page.height, transformOrigin: '0 0', translate: `${width / 2 - view.cx * pageScale}px ${height / 2 - view.cy * pageScale}px`, scale: `${pageScale}` };
  // Re-laid out (a tall or square region): where the camera pulls back past the page's edges, the page sits on the
  // film's stage as a card, with the window's corners and soft shadow (craft file 05, "Staging a screen").
  const relaidStyle: CSSProperties = relaid
    ? { borderRadius: vh(brand.shape.window) / pageScale, overflow: 'hidden', background: brand.screen, boxShadow: `0 0 0 ${1 / pageScale}px ${stage.line}, 0 ${vh(2) / pageScale}px ${vh(4.5) / pageScale}px ${alpha(stage.shade, 0.28)}` }
    : {};
  const region = regionView(view, k, width, height);
  /** A piece of the recording (page rectangle `src` at recording time `rec`) drawn into `dst`, region pixels. */
  const layer = (spec: LayerSpec): ReactNode => {
    const s = spec.dst.width / Math.max(1e-6, spec.src.width * k);
    return (
      <div style={{ position: 'absolute', left: spec.dst.x, top: spec.dst.y, width: spec.dst.width, height: spec.dst.height, overflow: 'hidden', borderRadius: spec.radius, ...spec.style }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: page.width, height: page.height, transformOrigin: '0 0', translate: `${-spec.src.x * k * s}px ${-spec.src.y * k * s}px`, scale: `${s * k}`, filter: spec.filter }}>
          {video(spec.rec)}
        </div>
      </div>
    );
  };
  const ctx: EmphasisContext = { f, rec, view: region, cursor, tracks, map, seconds: map.duration, layer, allowSuccess: energy === 'hype' || props.look === 'launch' };
  const rest = emphasis.length ? restOf(emphasis, ctx, (token) => m.seconds(token), vh) : { blur: 0, dim: 0, fade: 0 };
  const restFilter = rest.blur > 0 || rest.dim > 0 ? `blur(${rest.blur / pageScale}px) brightness(${1 - rest.dim})` : undefined;

  return (
    <div style={{ position: 'absolute', width, height, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: relaid ? undefined : brand.screen,
          ...(window ? { borderRadius: vh(brand.shape.window), boxShadow: `0 0 0 1px ${stage.line}, ${shadow}, ${glow}` } : {}),
          ...(turned ? { transform: `perspective(${width * 2.2}px) rotateX(${view.turnX}deg) rotateY(${view.turnY}deg)` } : {}),
        }}
      >
        <div style={{ ...cameraStyle, ...relaidStyle, filter: restFilter }}>
          {focus && focus.amount > 0 ? (
            <>
              {video(rec, { filter: `blur(${(4 * focus.amount) / pageScale}px) brightness(${1 - 0.18 * focus.amount})` })}
              <div style={{ position: 'absolute', inset: 0, clipPath: `inset(${focus.rect.y}px ${page.width - focus.rect.x - focus.rect.width}px ${page.height - focus.rect.y - focus.rect.height}px ${focus.rect.x}px round ${vh(brand.shape.control) / pageScale}px)` }}>
                {video(rec)}
              </div>
            </>
          ) : (
            video(rec)
          )}
          {loopBack > 0 ? <div style={{ position: 'absolute', inset: 0, opacity: loopBack }}>{video(map.recAt(0))}</div> : null}
        </div>
        <RestFade amount={rest.fade} />
        {emphasis.length ? <EmphasisLayer list={emphasis} ctx={ctx} /> : null}
        {props.bare ? null : (
          <>
        {props.drawPointer === false ? null : look.cursor === 'spotlight' && state.opacity > 0.01 ? <Spotlight tip={tip} opacity={state.opacity} radius={vh(12) * grow} /> : null}
        {hover ? <ThingGlow box={hover.box} amount={hover.amount} /> : null}
        {caret ? <ThingGlow box={caret.box} amount={caret.amount} ring /> : null}
        {effects}
        {trailPoints.length > 1 && props.drawPointer !== false ? <TrailLine points={trailPoints} /> : null}
        {props.drawPointer === false ? null : look.trail === 'blur' ? (
          <MotionBlur fill x={perFrame.x} y={perFrame.y}>
            {drawn}
          </MotionBlur>
        ) : (
          drawn
        )}
          </>
        )}
      </div>
      {/* Labels stay flat and sharp: they sit outside the turned, zoomed screen. */}
      <div style={{ position: 'absolute', top: safe.y + Math.min(height, pageHeight) * 0.04, right: width - safe.x - safe.width + Math.min(height, pageHeight) * 0.04 }}>
        <SpedUpLabel amount={props.bare ? 0 : map.spedUpAt(f)} />
      </div>
      {caps && !props.bare ? (
        <div style={{ position: 'absolute', left: safe.x, width: safe.width, bottom: height - safe.y - safe.height + Math.min(height, pageHeight) * 0.07, display: 'flex', justifyContent: 'center' }}>
          <KeyCaps keys={caps.keys} age={caps.age} downs={caps.downs} hold={HOLD_CAPS} enter={quick} />
        </div>
      ) : null}
    </div>
  );
};
