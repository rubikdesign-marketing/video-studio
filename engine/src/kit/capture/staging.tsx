// Where the screen sits (CAPTURE-PLAN 7.6 and the 7.9 staging list): one component, CaptureShot, that fills the
// frame with a capture in one of twenty stagings. Each is a small frame drawn around CaptureClip, so the pointer,
// camera, time map and product animations are the same in all of them.
//
// Frames are generic: a browser with no company's controls, devices with no company's shapes (no notch, no logo,
// no window dots), a mail window and a terminal with no made-up text. Colours come from the brand's two stages,
// corner radii and type from the brand, lengths from the motion tokens. Every take shown at once (split, picture in
// picture, grid, before and after) plays on the film's one clock, so they stay frame-locked; `align: "marks"` also
// lands each extra take's marks on the film frames where the first take's marks land.
import type { CSSProperties, FC, ReactNode } from 'react';
import { AbsoluteFill, Freeze, OffthreadVideo, staticFile, useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { CaptureClip, planOfClip, type CaptureClipProps } from '../CaptureClip';
import { clamp01, easing, lerp, presets, useMotion, useRealTime, type PresetName, type TimingToken } from '../motion';
import { voiceStyle } from '../moves/core';
import { alpha, type StagePalette } from '../tokens';
import { useStage, useVh } from '../ui';
import type { CaptureCursor } from './data';
import { withThings } from './glue';
import { resolveLook, type StagingName } from './looks';
import { isPhoneTake, isWide, sizedStaging, sizedTiles, type SizedLayoutOptions } from './relayout';
import type { Pin } from './timemap';

/** One take to show: the same settings a CaptureClip takes, without its place in the frame. */
export type CaptureSource = Omit<CaptureClipProps, 'width' | 'style' | 'window'>;

export type CaptureShotProps = CaptureSource & {
  /** Where the screen sits. Default: the look's own staging. */
  staging?: StagingName;
  /** More takes, for the stagings that show several: split, split-three, pip, before-after, grid, wall, stacked. */
  others?: CaptureSource[];
  /** The address in a browser frame (the one in the take's capture.json), or none. */
  address?: string | null;
  /** Before and after: when the line crosses (clip seconds), where it rests (share of the width) and the words. */
  wipe?: { at: number; to?: number; over?: TimingToken; labels?: [string, string] | null };
  /** Mail frame: who it is from and its subject, as the real mail has them. Left out, the frame has no words. */
  email?: { from?: string; subject?: string };
  /** Terminal frame: its title, or none. */
  title?: string;
  /** Takes shown at once run on one clock; "marks" also lands their shared marks on the same film frames. */
  align?: 'clock' | 'marks';
  /** How much of the frame's width the main screen fills (craft file 05: 55 to 75%). */
  size?: number;
  /**
   * In a 9:16, 1:1 or 4:5 frame: keep the caption slot (default true) and a title slot (default false) clear of
   * the action, so captions and on-screen text never cover the thing being acted on (relayout.ts, sizedLayout).
   */
  captions?: boolean;
  titleSlot?: boolean;
};

const ASPECT = 16 / 9;

const useEnergy = (): PresetName => {
  const m = useMotion();
  return (Object.keys(presets) as PresetName[]).find((name) => presets[name] === m.preset) ?? 'confident';
};

/** Extra takes with pins that land their marks where the first take's marks land on the film's clock. */
const alignedOthers = (first: CaptureSource, others: CaptureSource[], align: CaptureShotProps['align'], energy: PresetName): CaptureSource[] => {
  if (align !== 'marks') return others;
  const plan = planOfClip(first, withThings(first.cursor, first.tracks, first.things), energy);
  const marksOf = (c: CaptureCursor) => c.events.filter((e) => e.type === 'mark' && e.name);
  const times = new Map(marksOf(first.cursor).filter((e) => e.t >= plan.from && e.t <= plan.to).map((e) => [e.name!, plan.map.filmAt(e.t)]));
  return others.map((other) => {
    const wanted: Pin[] = marksOf(other.cursor)
      .filter((e) => times.has(e.name!) && e.t >= (other.from ?? 0))
      .map((e) => ({ event: { mark: e.name! }, at: +times.get(e.name!)!.toFixed(4) }));
    // Each mark is pinned only when the take's own pauses can take it (the time map refuses a pin that would need
    // its pauses played more than 8 times faster or slower, and never retimes an action).
    const pins: Pin[] = [];
    const tracks = withThings(other.cursor, other.tracks, other.things);
    for (const pin of wanted) {
      const trial = { ...other, time: { ...other.time, pins: [...(other.time?.pins ?? []), ...pins, pin] } };
      try {
        planOfClip(trial, tracks, energy);
        pins.push(pin);
      } catch {
        // This mark stays where the take has it.
      }
    }
    return pins.length ? { ...other, time: { ...other.time, pins: [...(other.time?.pins ?? []), ...pins] } } : other;
  });
};

// ---------------------------------------------------------------- small pieces

/** A frozen frame of a take, as a still window: real pixels, for windows behind and walls of screens. */
export const CaptureStill: FC<{ src: string; at: number; width: number; style?: CSSProperties }> = ({ src, at, width, style }) => {
  const { fps } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', width, height: width / ASPECT, overflow: 'hidden', ...style }}>
      <Freeze frame={0}>
        <OffthreadVideo src={staticFile(src)} muted trimBefore={Math.max(0, Math.round(at * fps)) + 0.25} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </Freeze>
    </div>
  );
};

const Chevron: FC<{ x: number; y: number; size: number; colour: string; flip?: boolean; width: number }> = ({ x, y, size, colour, flip, width }) => (
  <svg style={{ position: 'absolute', left: x, top: y, width: size, height: size, overflow: 'visible' }} viewBox="0 0 24 24">
    <path d={flip ? 'M9 5 L16 12 L9 19' : 'M15 5 L8 12 L15 19'} fill="none" stroke={colour} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The bar of a clean browser frame: back, forward and reload drawn as plain lines, and the address (or none). */
const BrowserBar: FC<{ palette: StagePalette; height: number; address?: string | null }> = ({ palette, height, address }) => {
  const brand = useBrand();
  const vh = useVh();
  const icon = height * 0.42;
  const y = (height - icon) / 2;
  return (
    <div style={{ position: 'relative', height, background: palette.page, borderBottom: `1px solid ${palette.line}` }}>
      <Chevron x={height * 0.45} y={y} size={icon} colour={palette.second} width={2.2} />
      <Chevron x={height * 1.15} y={y} size={icon} colour={alpha(palette.second, 0.5)} width={2.2} flip />
      <svg style={{ position: 'absolute', left: height * 1.9, top: y, width: icon, height: icon }} viewBox="0 0 24 24">
        <path d="M19 12 A7 7 0 1 1 16.9 7" fill="none" stroke={palette.second} strokeWidth={2.2} strokeLinecap="round" />
        <path d="M17.6 3.6 L17.4 7.4 L13.6 7.2" fill="none" stroke={palette.second} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: height * 2.9,
          right: height * 2.9,
          top: height * 0.2,
          bottom: height * 0.2,
          borderRadius: vh(brand.shape.pill),
          background: alpha(palette.ink, 0.055),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: palette.second,
          ...voiceStyle(brand.fonts.label, height * 0.34),
        }}
      >
        {address ?? ''}
      </div>
    </div>
  );
};

/** A window with a bar on top (browser, mail, terminal) and the capture under it. */
const Window: FC<{ width: number; bar: ReactNode; barHeight: number; palette: StagePalette; children: ReactNode; style?: CSSProperties }> = ({ width, bar, barHeight, palette, children, style }) => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  return (
    <div
      style={{
        position: 'relative',
        width,
        borderRadius: vh(brand.shape.window),
        overflow: 'hidden',
        background: palette.page,
        boxShadow: `0 0 0 1px ${alpha(palette.ink, 0.12)}, 0 ${vh(4)}px ${vh(9)}px ${alpha(stage.shade, 0.3)}, 0 0 ${vh(13)}px ${alpha(stage.accent, stage.screenGlow)}`,
        ...style,
      }}
    >
      <div style={{ height: barHeight }}>{bar}</div>
      <div style={{ position: 'relative', width, height: width / ASPECT }}>{children}</div>
    </div>
  );
};

/** The capture with no window of its own, filling `width`. */
const Screen: FC<{ source: CaptureSource; width: number; style?: CSSProperties }> = ({ source, width, style }) => (
  <CaptureClip {...source} width={width} window={false} style={{ position: 'relative', ...style }} />
);

// ---------------------------------------------------------------- devices (generic: no company's shapes)

/** Bezel colours: the brand's dark page for the glass edge, its light line colour for the metal. */
const useDevice = () => {
  const brand = useBrand();
  return { bezel: brand.stages.dark.page, edge: alpha(brand.stages.dark.ink, 0.14), metal: brand.stages.light.line, metalDark: alpha(brand.stages.light.ink, 0.28) };
};

const Laptop: FC<{ width: number; children: ReactNode }> = ({ width, children }) => {
  const d = useDevice();
  const stage = useStage();
  const vh = useVh();
  const pad = vh(1.5);
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ padding: `${pad}px ${pad}px ${pad * 1.4}px`, background: d.bezel, borderRadius: `${vh(2)}px ${vh(2)}px ${vh(0.4)}px ${vh(0.4)}px`, boxShadow: `0 0 0 1px ${d.edge}` }}>
        <div style={{ position: 'relative', width, height: width / ASPECT, overflow: 'hidden', borderRadius: vh(0.3) }}>{children}</div>
      </div>
      <div
        style={{
          position: 'relative',
          width: (width + pad * 2) * 1.14,
          height: vh(1.7),
          background: `linear-gradient(180deg, ${d.metal}, ${d.metalDark})`,
          borderRadius: `${vh(0.3)}px ${vh(0.3)}px ${vh(1.6)}px ${vh(1.6)}px`,
          boxShadow: `0 ${vh(2.4)}px ${vh(5)}px ${alpha(stage.shade, 0.35)}`,
        }}
      >
        <div style={{ position: 'absolute', left: '43%', width: '14%', top: 0, height: vh(0.55), borderRadius: `0 0 ${vh(0.6)}px ${vh(0.6)}px`, background: d.metalDark }} />
      </div>
    </div>
  );
};

const Monitor: FC<{ width: number; children: ReactNode }> = ({ width, children }) => {
  const d = useDevice();
  const stage = useStage();
  const vh = useVh();
  const pad = vh(1.1);
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ padding: `${pad}px ${pad}px ${pad * 2.2}px`, background: d.bezel, borderRadius: vh(1.2), boxShadow: `0 0 0 1px ${d.edge}, 0 ${vh(3)}px ${vh(7)}px ${alpha(stage.shade, 0.28)}` }}>
        <div style={{ position: 'relative', width, height: width / ASPECT, overflow: 'hidden' }}>{children}</div>
      </div>
      <div style={{ width: width * 0.1, height: vh(7), background: `linear-gradient(90deg, ${d.metalDark}, ${d.metal}, ${d.metalDark})` }} />
      <div style={{ width: width * 0.3, height: vh(1.3), borderRadius: vh(0.7), background: `linear-gradient(180deg, ${d.metal}, ${d.metalDark})`, boxShadow: `0 ${vh(1.6)}px ${vh(3)}px ${alpha(stage.shade, 0.3)}` }} />
    </div>
  );
};

const Slab: FC<{ width: number; height: number; pad: number; radius: number; children: ReactNode }> = ({ width, height, pad, radius, children }) => {
  const d = useDevice();
  const stage = useStage();
  const vh = useVh();
  return (
    <div style={{ padding: pad, background: d.bezel, borderRadius: radius, boxShadow: `0 0 0 ${vh(0.35)}px ${d.metal}, 0 0 0 ${vh(0.45)}px ${d.edge}, 0 ${vh(4)}px ${vh(9)}px ${alpha(stage.shade, 0.32)}` }}>
      <div style={{ position: 'relative', width, height, overflow: 'hidden', borderRadius: Math.max(0, radius - pad) }}>{children}</div>
    </div>
  );
};

/**
 * A tall crop of a wide take: the follow camera of relayout.ts keeps the acted-on thing and the pointer inside it,
 * pulling back when the pointer travels further than the crop holds.
 */
const PhoneCrop: FC<{ source: CaptureSource; width: number; height: number }> = ({ source, width, height }) => {
  const { height: H } = useVideoConfig();
  const relayout = source.relayout ?? { width, height, safe: { x: 0, y: 0, width, height }, frameHeight: H };
  return <CaptureClip {...source} relayout={relayout} width={width} window={false} style={{ position: 'relative' }} />;
};

// ---------------------------------------------------------------- 9:16, 1:1 and 4:5 (phase 8)

/**
 * A capture in a frame that is not wide: the staging's own version (relayout.ts, sizedStaging), with the follow
 * camera keeping the action inside the frame's safe area, clear of the caption and title slots and, on 9:16, of the
 * platforms' own buttons. A phone-size take fills the frame with a touch pointer.
 */
const SizedShot: FC<{ source: CaptureSource; staging: StagingName; others: CaptureSource[]; address?: string | null; options: SizedLayoutOptions }> = ({ source: given, staging, others, address, options }) => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const phone = isPhoneTake(given.cursor.page);
  const source: CaptureSource = phone && !given.cursorStyle ? { ...given, cursorStyle: 'touch' } : given;
  const shadow = `0 0 0 1px ${stage.line}, 0 ${vh(2)}px ${vh(4.5)}px ${alpha(stage.shade, 0.3)}, 0 0 ${vh(7)}px ${alpha(stage.accent, stage.screenGlow)}`;
  const radius = vh(brand.shape.window) * 0.75;
  const page = { ...source.cursor.page, scale: source.cursor.scale };

  // Two tiles at most for a grid: three stacked in a tall frame leave each too small to read.
  const tiles = staging === 'split' ? 2 : staging === 'split-three' ? 3 : staging === 'grid' ? 2 : 0;
  if (tiles) {
    const takes = staging === 'grid' ? (others.length ? [source, ...others] : stretchesOf(source, tiles)) : [source, ...others];
    while (takes.length < tiles) takes.push(source);
    return (
      <AbsoluteFill>
        {sizedTiles(tiles, { width: W, height: H }, options).map(({ rect, relayout }, i) => (
          <div key={i} style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderRadius: radius, overflow: 'hidden', boxShadow: shadow }}>
            {/* A tile is a small part of the frame: its pointer is drawn smaller, so it never hides the word it points at. */}
            <CaptureClip {...takes[i]} cursorSize={takes[i].cursorSize ?? resolveLook(takes[i].look).cursorSize * 0.7} relayout={takes[i].relayout ?? relayout} width={rect.width} window={false} keyCaps="none" style={{ left: 0, top: 0 }} />
          </div>
        ))}
      </AbsoluteFill>
    );
  }

  const laid = sizedStaging(staging, { width: W, height: H }, page, options);
  const relayout = source.relayout ?? laid.relayout;
  const { region, outer } = laid;
  const clip = <CaptureClip {...source} relayout={relayout} width={region.width} window={false} style={{ left: 0, top: 0 }} />;
  if (laid.kind === 'full') return <AbsoluteFill>{<div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, overflow: 'hidden' }}>{clip}</div>}</AbsoluteFill>;
  if (laid.kind === 'phone') {
    return (
      <AbsoluteFill>
        <div style={{ position: 'absolute', left: outer.x, top: outer.y }}>
          <Slab width={region.width} height={region.height} pad={laid.bezel} radius={laid.bezel * 3.2}>
            {/* The screen's own colour behind the page, so a pulled-back view never shows the bezel through it. */}
            <div style={{ position: 'absolute', inset: 0, background: brand.screen }}>{clip}</div>
          </Slab>
        </div>
      </AbsoluteFill>
    );
  }
  const palette = brand.stages[staging === 'browser-dark' || staging === 'terminal' ? 'dark' : 'light'];
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: outer.x, top: outer.y, width: outer.width, height: outer.height, borderRadius: radius, overflow: 'hidden', background: brand.screen, boxShadow: shadow }}>
        {laid.bar ? <BrowserBar palette={palette} height={laid.bar} address={staging === 'browser' || staging === 'browser-dark' ? address : null} /> : null}
        <div style={{ position: 'absolute', left: 0, top: laid.bar, width: region.width, height: region.height, overflow: 'hidden' }}>{clip}</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- the shot

/** A capture placed in the frame in one of the stagings. Fills the frame; put it inside the film's Stage. */
export const CaptureShot: FC<CaptureShotProps> = (props) => {
  const { width: W, height: H } = useVideoConfig();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const m = useMotion();
  const now = useRealTime();
  const energy = useEnergy();
  const { staging: asked, others: givenOthers = [], address, wipe, email, title, align = 'clock', size = 0.72, captions = true, titleSlot = false, ...source } = props;
  const staging = asked ?? resolveLook(source.look).staging;
  const others = alignedOthers(source, givenOthers, align, energy);
  if (!isWide(W, H)) return <SizedShot source={source} staging={staging} others={others} address={address} options={{ captions, title: titleSlot }} />;
  const centre: CSSProperties = { alignItems: 'center', justifyContent: 'center' };
  /** The widest a 16:9 screen can be at `share` of the width, keeping `room` of the height free. */
  const fit = (share: number, extraHeight = 0, room = 0.16) => Math.min(W * share, ((H * (1 - room) - extraHeight) * ASPECT));

  switch (staging) {
    case 'frameless': {
      const w = Math.min(W, H * ASPECT);
      return (
        <AbsoluteFill style={centre}>
          <Screen source={source} width={w} />
        </AbsoluteFill>
      );
    }
    case 'browser':
    case 'browser-dark':
    case 'email':
    case 'terminal': {
      const palette = brand.stages[staging === 'browser-dark' || staging === 'terminal' ? 'dark' : 'light'];
      const barHeight = vh(staging === 'email' && (email?.subject || email?.from) ? 10.5 : 4.6);
      const w = fit(size, barHeight);
      let bar: ReactNode;
      if (staging === 'email') {
        bar = (
          <div style={{ height: barHeight, background: palette.page, borderBottom: `1px solid ${palette.line}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: vh(0.6), padding: `0 ${vh(3)}px` }}>
            {email?.subject ? <div style={{ color: palette.ink, ...voiceStyle(brand.fonts.headline, vh(2.6)) }}>{email.subject}</div> : null}
            {email?.from ? <div style={{ color: palette.second, ...voiceStyle(brand.fonts.label, vh(1.8)) }}>{email.from}</div> : null}
          </div>
        );
      } else if (staging === 'terminal') {
        bar = (
          <div style={{ height: barHeight, background: alpha(palette.ink, 0.06), borderBottom: `1px solid ${palette.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: palette.second, ...voiceStyle(brand.fonts.label, barHeight * 0.34) }}>
            {title ?? ''}
          </div>
        );
      } else bar = <BrowserBar palette={palette} height={barHeight} address={address} />;
      return (
        <AbsoluteFill style={centre}>
          <Window width={w} bar={bar} barHeight={barHeight} palette={palette}>
            <Screen source={source} width={w} />
          </Window>
        </AbsoluteFill>
      );
    }
    case 'float': {
      const w = fit(size * 0.84);
      // A slow drift on the film's real clock; at most 12 degrees (craft file 05: 10 on wides), never for reading.
      const ry = -10 + 1.6 * Math.sin(now * 0.35);
      const rx = 6 + 1 * Math.sin(now * 0.27 + 1);
      const lift = vh(1) * Math.sin(now * 0.4);
      return (
        <AbsoluteFill style={{ ...centre, perspective: vh(240) }}>
          <div style={{ position: 'absolute', width: w * 0.92, height: vh(7), top: H / 2 + w / ASPECT / 2 + vh(3), left: (W - w * 0.92) / 2, borderRadius: '50%', background: alpha(stage.shade, 0.32), filter: `blur(${vh(3.4)}px)`, scale: `${1 - lift / vh(30)}` }} />
          <div style={{ transform: `translateY(${-lift}px) rotateX(${rx}deg) rotateY(${ry}deg)`, transformStyle: 'preserve-3d' }}>
            <div style={{ position: 'relative', width: w, height: w / ASPECT, borderRadius: vh(brand.shape.window), boxShadow: `0 ${vh(2)}px ${vh(3)}px ${alpha(stage.shade, 0.18)}, 0 ${vh(8)}px ${vh(16)}px ${alpha(stage.shade, 0.28)}, 0 0 ${vh(13)}px ${alpha(stage.accent, stage.screenGlow)}` }}>
              <CaptureClip {...source} width={w} style={{ position: 'relative' }} />
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case 'isometric': {
      const w = fit(0.56);
      const depth = vh(1.6);
      const edge = brand.stages.dark.page;
      const steps = Array.from({ length: 8 }, (_, i) => `${((i + 1) * depth) / 8}px ${((i + 1) * depth) / 8}px 0 ${edge}`).join(', ');
      return (
        <AbsoluteFill style={centre}>
          <div style={{ transform: 'rotateX(42deg) rotateZ(-26deg)', transformStyle: 'preserve-3d' }}>
            <div style={{ position: 'relative', width: w, height: w / ASPECT, borderRadius: vh(brand.shape.window), boxShadow: `${steps}, ${depth * 3}px ${depth * 3}px ${vh(5)}px ${alpha(stage.shade, 0.35)}` }}>
              <CaptureClip {...source} width={w} window={false} style={{ position: 'relative', borderRadius: vh(brand.shape.window), overflow: 'hidden' }} />
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case 'laptop': {
      const w = fit(0.6, vh(5), 0.2);
      return (
        <AbsoluteFill style={centre}>
          <Laptop width={w}>
            <Screen source={source} width={w} />
          </Laptop>
        </AbsoluteFill>
      );
    }
    case 'monitor': {
      const w = fit(0.6, vh(12), 0.16);
      return (
        <AbsoluteFill style={centre}>
          <Monitor width={w}>
            <Screen source={source} width={w} />
          </Monitor>
        </AbsoluteFill>
      );
    }
    case 'tablet': {
      const w = fit(0.6, vh(6));
      return (
        <AbsoluteFill style={centre}>
          <Slab width={w} height={w / ASPECT} pad={vh(2.4)} radius={vh(3.6)}>
            <Screen source={source} width={w} />
          </Slab>
        </AbsoluteFill>
      );
    }
    case 'phone':
    case 'phone-crop': {
      const h = H * (staging === 'phone' ? 0.8 : 0.86);
      const w = staging === 'phone' ? h * (9 / 19.5) : h * (9 / 16);
      const crop = <PhoneCrop source={source} width={w} height={h} />;
      return (
        <AbsoluteFill style={centre}>
          {staging === 'phone' ? (
            <Slab width={w} height={h} pad={vh(1.1)} radius={vh(6)}>
              {crop}
            </Slab>
          ) : (
            <div style={{ borderRadius: vh(brand.shape.window), overflow: 'hidden', boxShadow: `0 0 0 1px ${stage.line}, 0 ${vh(4)}px ${vh(9)}px ${alpha(stage.shade, 0.3)}` }}>{crop}</div>
          )}
        </AbsoluteFill>
      );
    }
    case 'stacked': {
      const w = fit(0.62, 0, 0.26);
      const hgt = w / ASPECT;
      // Behind: the other takes given, or stills of this take's own marks (real pixels).
      const marks = source.cursor.events.filter((e) => e.type === 'mark').map((e) => e.t);
      const behind: ReactNode[] = (others.length ? others.slice(0, 2) : []).map((o, i) => <CaptureClip key={`o${i}`} {...o} width={w} bare style={{ position: 'absolute', left: 0, top: 0 }} />);
      if (!behind.length) {
        for (const t of marks.slice(-2).reverse()) behind.push(<CaptureStill key={`s${t}`} src={source.src} at={t} width={w} style={{ left: 0, top: 0, borderRadius: vh(brand.shape.window) }} />);
      }
      const offset = vh(6);
      return (
        <AbsoluteFill style={centre}>
          <div style={{ position: 'relative', width: w + offset * 2, height: hgt + offset * 2 }}>
            {behind
              .slice(0, 2)
              .map((node, i) => {
                const depth = Math.min(2, behind.length) - i;
                return (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      left: offset * depth,
                      top: offset * (2 - depth),
                      width: w,
                      height: hgt,
                      scale: `${1 - 0.025 * depth}`,
                      borderRadius: vh(brand.shape.window),
                      overflow: 'hidden',
                      filter: `brightness(${1 - 0.06 * depth})`,
                      boxShadow: `0 0 0 1px ${stage.line}, 0 ${vh(2)}px ${vh(5)}px ${alpha(stage.shade, 0.22)}`,
                    }}
                  >
                    {node}
                  </div>
                );
              })}
            <CaptureClip {...source} width={w} style={{ left: 0, top: offset * 2 }} />
          </div>
        </AbsoluteFill>
      );
    }
    case 'split':
    case 'split-three': {
      const count = staging === 'split' ? 2 : 3;
      const takes = [source, ...others].slice(0, count);
      while (takes.length < count) takes.push(source);
      const gap = vh(2.6);
      const w = Math.min((W * 0.92 - gap * (count - 1)) / count, ((H * 0.8) * ASPECT));
      return (
        <AbsoluteFill style={{ ...centre, flexDirection: 'row', gap }}>
          {takes.map((t, i) => (
            <CaptureClip key={i} {...t} width={w} style={{ position: 'relative' }} />
          ))}
        </AbsoluteFill>
      );
    }
    case 'pip': {
      const w = fit(size, 0, 0.2);
      const small = w * 0.32;
      const inset = others[0] ?? source;
      return (
        <AbsoluteFill style={centre}>
          <div style={{ position: 'relative', width: w, height: w / ASPECT }}>
            <CaptureClip {...source} width={w} style={{ left: 0, top: 0 }} />
            <div style={{ position: 'absolute', right: -vh(3), bottom: -vh(3), width: small, height: small / ASPECT, borderRadius: vh(brand.shape.window), boxShadow: `0 0 0 ${vh(0.45)}px ${stage.page}, 0 ${vh(2)}px ${vh(5)}px ${alpha(stage.shade, 0.35)}` }}>
              <CaptureClip {...inset} width={small} keyCaps="none" style={{ left: 0, top: 0 }} />
            </div>
          </div>
        </AbsoluteFill>
      );
    }
    case 'grid': {
      const takes = others.length ? [source, ...others] : stretchesOf(source, 4);
      const count = Math.min(6, takes.length);
      const cols = count <= 4 ? 2 : 3;
      const rows = Math.ceil(count / cols);
      const gap = vh(2.2);
      const w = Math.min((W * 0.86 - gap * (cols - 1)) / cols, ((H * 0.86 - gap * (rows - 1)) / rows) * ASPECT);
      return (
        <AbsoluteFill style={centre}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${w}px)`, gap }}>
            {takes.slice(0, count).map((t, i) => (
              <div key={i} style={{ position: 'relative', width: w, height: w / ASPECT }}>
                <CaptureClip {...t} width={w} keyCaps="none" style={{ left: 0, top: 0 }} />
              </div>
            ))}
          </div>
        </AbsoluteFill>
      );
    }
    case 'wall': {
      // Columns of stills of the takes' own moments, drifting up and down in turn, the wall turned a little.
      const sources = [source, ...others];
      const moments = sources.flatMap((s) => s.cursor.events.filter((e) => e.type === 'mark').map((e) => ({ src: s.src, at: e.t })));
      if (!moments.length) moments.push({ src: source.src, at: source.from ?? 0 });
      const cols = 4;
      const per = 4;
      const gap = vh(2.4);
      const w = W * 0.27;
      const h = w / ASPECT;
      const drift = (h + gap) * 0.9;
      return (
        <AbsoluteFill style={{ overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: W / 2, top: H / 2, rotate: '-9deg', scale: '1.12' }}>
            {Array.from({ length: cols }, (_, c) => {
              const dir = c % 2 ? 1 : -1;
              const y = dir * drift * easing.travel(clamp01(m.t / Math.max(1, 8))) - (per * (h + gap)) / 2;
              return (
                <div key={c} style={{ position: 'absolute', left: (c - cols / 2) * (w + gap), top: 0, translate: `0 ${y}px` }}>
                  {Array.from({ length: per }, (_, r) => {
                    const mo = moments[(c * per + r * 3) % moments.length];
                    return <CaptureStill key={r} src={mo.src} at={mo.at} width={w} style={{ top: r * (h + gap), borderRadius: vh(brand.shape.window), boxShadow: `0 0 0 1px ${stage.line}, 0 ${vh(1.5)}px ${vh(4)}px ${alpha(stage.shade, 0.22)}` }} />;
                  })}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>
      );
    }
    case 'before-after': {
      const w = fit(size, 0, 0.2);
      const h = w / ASPECT;
      const after = others[0] ?? source;
      const cue = wipe ?? { at: 0.8 };
      const u = easing.travel(clamp01((m.t - cue.at) / m.seconds(cue.over ?? 'hero')));
      const x = lerp(0, w * (cue.to ?? 0.5), u);
      const labels = cue.labels === undefined ? (['Before', 'After'] as [string, string]) : cue.labels;
      const knob = vh(5.2);
      const pill = (text: string, side: 'left' | 'right', show: number): ReactNode => (
        <div
          style={{
            position: 'absolute',
            top: vh(2),
            [side]: vh(2),
            padding: `${vh(0.7)}px ${vh(1.5)}px`,
            borderRadius: vh(brand.shape.pill),
            background: alpha(stage.page, 0.92),
            color: stage.ink,
            opacity: show,
            boxShadow: `0 0 0 1px ${stage.line}`,
            ...voiceStyle(brand.fonts.label, vh(2)),
          }}
        >
          {text}
        </div>
      );
      return (
        <AbsoluteFill style={centre}>
          <div style={{ position: 'relative', width: w, height: h, borderRadius: vh(brand.shape.window), boxShadow: `0 0 0 1px ${stage.line}, 0 ${vh(4)}px ${vh(9)}px ${alpha(stage.shade, 0.3)}` }}>
            <CaptureClip {...source} width={w} window={false} style={{ left: 0, top: 0, borderRadius: vh(brand.shape.window), overflow: 'hidden' }} />
            <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${w - x}px 0 0 round ${vh(brand.shape.window)}px)` }}>
              <CaptureClip {...after} width={w} window={false} bare style={{ left: 0, top: 0 }} />
            </div>
            {labels ? (
              <>
                {pill(labels[1], 'left', clamp01((x - vh(16)) / vh(6)))}
                {pill(labels[0], 'right', clamp01((w - x - vh(16)) / vh(6)))}
              </>
            ) : null}
            {u > 0 ? (
              <>
                <div style={{ position: 'absolute', left: x - vh(0.17), top: 0, bottom: 0, width: vh(0.34), background: stage.page, boxShadow: `0 0 ${vh(1.2)}px ${alpha(stage.shade, 0.35)}` }} />
                <div style={{ position: 'absolute', left: x - knob / 2, top: h / 2 - knob / 2, width: knob, height: knob, borderRadius: '50%', background: stage.page, boxShadow: `0 ${vh(0.6)}px ${vh(1.8)}px ${alpha(stage.shade, 0.35)}` }}>
                  <Chevron x={knob * 0.1} y={knob * 0.28} size={knob * 0.44} colour={stage.ink} width={2.6} />
                  <Chevron x={knob * 0.46} y={knob * 0.28} size={knob * 0.44} colour={stage.ink} width={2.6} flip />
                </div>
              </>
            ) : null}
          </div>
        </AbsoluteFill>
      );
    }
    case 'card':
    default: {
      const w = fit(size);
      return (
        <AbsoluteFill style={centre}>
          <CaptureClip {...source} width={w} style={{ position: 'relative' }} />
        </AbsoluteFill>
      );
    }
  }
};

/** Stretches of one take for a grid: around each mark (or evenly through the take when it has fewer marks). */
export const stretchesOf = (source: CaptureSource, count: number): CaptureSource[] => {
  const c = source.cursor;
  const from = source.from ?? 0;
  const to = source.to ?? c.seconds;
  const marks = c.events.filter((e) => e.type === 'mark' && e.t >= from && e.t <= to).map((e) => e.t);
  const starts = marks.length >= count ? marks.slice(0, count) : Array.from({ length: count }, (_, i) => from + ((to - from - 3) * i) / Math.max(1, count - 1));
  return starts.map((t) => ({ ...source, from: Math.max(from, Math.min(to - 3, t - 1)), to: Math.min(to, Math.max(t - 1, from) + 4), time: { ...source.time, trimLoads: false } }));
};
