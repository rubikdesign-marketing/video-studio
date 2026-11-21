// CaptureJoin: two captures (or two parts of one) joined by one transition on one film clock (CAPTURE-PLAN 7.5 and
// 7.9). The plan is in joins.ts (pure, measured by tools/checks/capture_transitions.mjs); this draws it: each shot is
// a CaptureShot in its staging, moved, scaled, softened or cut out as the plan says, with the one pointer the join
// carries across, and the real pixels that fly (shared element), grow (container) or hang on the wall (grid zoom).
//
// Put it inside the film's Stage, as a CaptureShot: the page never moves. Shot A's clock starts with the join's;
// shot B's clock starts at the plan's `bStart`. The whole join runs `joinSeconds(...)`.
import { useContext, type CSSProperties, type FC, type ReactNode } from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { lerp, presets, useMotion, type PresetName } from '../motion';
import { MotionBlur } from '../moves/core';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import type { Rect } from './data';
import { PointerOverride } from '../CaptureClip';
import { DrawnPointer } from './draw';
import { planJoin, type JoinFrame, type JoinOptions, type JoinSource, type Layer, type Piece } from './joins';
import { CaptureShot, type CaptureShotProps } from './staging';

export type CaptureJoinProps = JoinOptions & {
  /** The outgoing shot, from its start. */
  a: JoinSource;
  /** The incoming shot, as it plays on its own. */
  b: JoinSource;
  /** Anything else a CaptureShot takes (the address in a browser frame, more takes for a split). */
  shot?: Partial<CaptureShotProps>;
};

const useEnergy = (): PresetName => {
  const m = useMotion();
  return (Object.keys(presets) as PresetName[]).find((name) => presets[name] === m.preset) ?? 'confident';
};

/** The join's plan for the frame in use. */
export const useJoinPlan = (props: CaptureJoinProps) => {
  const { width, height, fps } = useVideoConfig();
  const energy = useEnergy();
  const frame: JoinFrame = { width, height, fps };
  return planJoin(props.a, props.b, props, energy, frame);
};

/** How long a join runs, in seconds, for metadata: shot A up to the join, the join, and the rest of shot B. */
export const joinSeconds = (props: CaptureJoinProps, energy: PresetName, frame: JoinFrame) => planJoin(props.a, props.b, props, energy, frame).total;

const layerStyle = (l: Layer, perspective: number): CSSProperties => {
  const filters: string[] = [];
  if (l.blur > 0.05) filters.push(`blur(${l.blur}px)`);
  if (l.dim > 0.001) filters.push(`brightness(${1 - l.dim})`);
  let clipPath: string | undefined;
  if (l.clip && 'circle' in l.clip) clipPath = `circle(${Math.max(0, l.clip.circle.r)}px at ${l.clip.circle.x}px ${l.clip.circle.y}px)`;
  return {
    position: 'absolute',
    inset: 0,
    transformOrigin: `${l.ox}px ${l.oy}px`,
    transform: l.turn !== 0 ? `perspective(${perspective}px) rotateY(${l.turn}deg)` : undefined,
    backfaceVisibility: l.turn !== 0 ? 'hidden' : undefined,
    translate: l.tx !== 0 || l.ty !== 0 ? `${l.tx}px ${l.ty}px` : undefined,
    scale: l.scale !== 1 ? `${l.scale}` : undefined,
    opacity: l.opacity < 1 ? l.opacity : undefined,
    filter: filters.length ? filters.join(' ') : undefined,
    clipPath,
  };
};

/** A piece of a recording at a recording time: page rectangle `page` drawn into `dst` (frame pixels), uniformly. */
const Crop: FC<{ src: string; pageSize: { width: number; height: number }; piece: { page: Rect; rec: number; dst: Rect }; radius: number; style?: CSSProperties }> = ({ src, pageSize, piece, radius, style }) => {
  const { fps } = useVideoConfig();
  const s = piece.dst.width / piece.page.width; // frame pixels per page pixel
  const top = piece.dst.height / 2 - (piece.page.y + piece.page.height / 2) * s;
  return (
    <div style={{ position: 'absolute', left: piece.dst.x, top: piece.dst.y, width: piece.dst.width, height: piece.dst.height, overflow: 'hidden', borderRadius: radius, ...style }}>
      <div style={{ position: 'absolute', left: -piece.page.x * s, top, width: pageSize.width * s, height: pageSize.height * s }}>
        <Freeze frame={0}>
          <OffthreadVideo src={staticFile(src)} muted trimBefore={Math.max(0, Math.round(piece.rec * fps)) + 0.25} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </Freeze>
      </div>
    </div>
  );
};

export const CaptureJoin: FC<CaptureJoinProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const plan = useJoinPlan(props);
  const t = frame / fps;
  const { shot } = props;
  const a = plan.aSource;
  const b = plan.bSource;
  const la = plan.layer('a', t);
  const lb = plan.layer('b', t);
  const durAFrames = Math.max(1, Math.round(plan.durA * fps));
  const bStartFrame = Math.round(plan.bStart * fps);
  const perspective = vh(240);
  const look = plan.planA.look;
  const forced = useContext(PointerOverride);
  const pointerLook = { style: forced ?? look.cursor, size: look.cursorSize, name: a.cursorName ?? 'Sam' };
  const lift = (amount: number) => `0 0 0 1px ${alpha(stage.ink, 0.08)}, 0 ${vh(lerp(1, 2.6, amount))}px ${vh(lerp(3, 5.5, amount))}px ${alpha(stage.shade, lerp(0.25, 0.22, amount))}`;

  const wrap = (l: Layer, node: ReactNode, key: string) => {
    if (!l.visible || l.opacity <= 0.001) return null;
    let inner = node;
    if (Math.abs(l.mx) > 0.3 || Math.abs(l.my) > 0.3) {
      inner = (
        <MotionBlur fill x={l.mx} y={l.my}>
          {node}
        </MotionBlur>
      );
    }
    if (l.clip && 'inset' in l.clip) {
      // A container: a rounded window cut into a full-frame panel, painted in the product's own background, with
      // a soft shadow while it is small.
      const r = l.clip.inset;
      const radius = lerp(vh(brand.shape.control), vh(brand.shape.window), l.clip.round);
      const edges = [r.y, W - r.x - r.width, H - r.y - r.height, r.x].map((e) => `${e}px`).join(' ');
      const content = plan.containerContent(t);
      return (
        <div key={key} style={{ ...layerStyle({ ...l, clip: null }, perspective), zIndex: l.z, filter: `drop-shadow(0 ${vh(2)}px ${vh(4)}px ${alpha(stage.shade, 0.3 * (1 - l.clip.round))})` }}>
          <div style={{ position: 'absolute', inset: 0, clipPath: `inset(${edges} round ${radius}px)` }}>
            <div style={{ position: 'absolute', left: plan.boxB.x, top: plan.boxB.y, width: plan.boxB.width, height: plan.boxB.height, background: brand.screen }} />
            <div style={{ position: 'absolute', inset: 0, opacity: content }}>{inner}</div>
          </div>
        </div>
      );
    }
    return (
      <div key={key} style={{ ...layerStyle(l, perspective), zIndex: l.z }}>
        {inner}
      </div>
    );
  };

  const shotA = (
    <Freeze frame={durAFrames - 1} active={frame >= durAFrames}>
      <CaptureShot {...shot} {...a} staging={plan.stagingA} drawPointer={plan.drawsOwn('a', t) && frame < durAFrames} />
    </Freeze>
  );
  const shotB = (
    <Sequence from={bStartFrame} layout="none">
      <CaptureShot {...shot} {...b} staging={plan.stagingB} drawPointer={plan.drawsOwn('b', t)} />
    </Sequence>
  );

  // The circle reveal's edge: a hairline in the stage's line colour that fades as the circle opens.
  let ring: ReactNode = null;
  if (lb.visible && lb.clip && 'circle' in lb.clip && lb.clip.circle.r > 0) {
    const c = lb.clip.circle;
    const fade = 1 - Math.min(1, c.r / (W * 0.9));
    ring = <div style={{ position: 'absolute', left: c.x - c.r, top: c.y - c.r, width: c.r * 2, height: c.r * 2, borderRadius: '50%', boxShadow: `0 0 0 ${vh(0.18)}px ${alpha(stage.ink, 0.18 * fade)}, 0 0 ${vh(3)}px ${alpha(stage.shade, 0.25 * fade)}`, zIndex: 2 }} />;
  }

  const pieces = plan.pieces(t);
  const srcOf = (p: Piece) => (p.which === 'a' ? a.src : b.src);

  return (
    <AbsoluteFill>
      {plan.tiles(t).map((tile, i) => (
        <Crop
          key={`tile${i}`}
          src={tile.which === 'a' ? a.src : b.src}
          pageSize={(tile.which === 'a' ? a : b).cursor.page}
          piece={{ page: { x: 0, y: 0, width: (tile.which === 'a' ? a : b).cursor.page.width, height: (tile.which === 'a' ? a : b).cursor.page.height }, rec: tile.rec, dst: tile.dst }}
          radius={vh(brand.shape.window) * (tile.dst.width / plan.boxA.width)}
          style={{ boxShadow: `0 0 0 1px ${stage.line}, 0 ${vh(1)}px ${vh(3)}px ${alpha(stage.shade, 0.2)}`, opacity: tile.opacity }}
        />
      ))}
      {wrap(la, shotA, 'a')}
      {wrap(lb, shotB, 'b')}
      {ring}
      {pieces.map((p, i) =>
        p.opacity > 0.001 ? (
          <Crop
            key={`piece${i}`}
            src={srcOf(p)}
            pageSize={p.which === 'a' ? a.cursor.page : b.cursor.page}
            piece={p}
            radius={vh(brand.shape.control) * 0.6}
            style={{ opacity: p.opacity, zIndex: 3, boxShadow: p.lift > 0.01 ? lift(p.lift) : undefined }}
          />
        ) : null,
      )}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
        {plan.pointers(t).map((p, i) => (
          <DrawnPointer key={i} look={pointerLook} tip={p.tip} shape={p.shape} press={p.press} opacity={p.opacity} grow={p.grow} squish={look.click === 'squish'} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
