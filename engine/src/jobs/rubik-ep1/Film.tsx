// Rubik "Website Teardown", episode 1 (jobs/2026-11-17-rubik-ep1). The approved voice edit is the clock: every shot's
// time comes from timeline.json (projects/rubik/video-1-edit/build/timeline.py), and the silent cards (title sting,
// chapter cards, end card) sit between voice lines without stretching them. What each shot shows is in spec.ts.
// A-roll: the footage camera's 16:9 pictures, re-centred on Kashfiq (build/center.py, edit/film-cut.json).
import type { CSSProperties, FC, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, Audio, Easing, Freeze, Img, interpolate, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { BrandProvider } from '../../kit/brand';
import timeline from './timeline.json';
import { capPlan, cueTime, groupCueTime, markBoxAt, srcAt, viewAt, zoomOf, type MarksFile, type Word } from './lib';
import marksJson from './marks.json';
import { CAP_LENGTH, FIBERY_SWATCHES, SPEC, STILLS, type Box, type Card, type Cue, type Note, type Row, type Site, type Tone } from './spec';
import { B, Browser, C, FONT, Highlight, PAGE, Spotlight, toneBg, toneInk, toneLine } from './look';

// ---------------------------------------------------------------- data
type Shot = { n: number; kind: string; voice: boolean; start: number; end: number; text: string; words: Word[]; d0?: number; d1?: number };
type TL = { fps: number; duration: number; dialogue: string; voice: { d0: number; d1: number; at: number }[]; shots: Shot[] };
const T = timeline as TL;
const MARKS = marksJson as unknown as MarksFile;
export const RubikEp1Fps = T.fps;
export const RubikEp1Frames = Math.round(T.duration * T.fps);
export const RubikEp1Schema = z.object({ captions: z.boolean(), audio: z.enum(['voice', 'mix', 'none']) });
export const RubikEp1Defaults: z.infer<typeof RubikEp1Schema> = { captions: true, audio: 'voice' };
const JOB = 'jobs/2026-11-17-rubik-ep1';

// ---------------------------------------------------------------- time helpers
const useT = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };
const sec = (s: number) => Math.round(s * T.fps);
/** A cue, as seconds from the shot's start (lib.ts: whole words first). */
const cueOf = (shot: Shot, c: Cue | undefined, dflt = 0): number => cueTime(shot.words, shot.start, c, dflt);
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const enter = (t: number, at: number, dur = 0.45) => interpolate(t, [at, at + dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
const useSpring = (at: number, damping = 16) => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return spring({ frame: f - sec(at), fps, config: { damping, stiffness: 170, mass: 0.8 } }); };

// ---------------------------------------------------------------- A-roll
type Crop = { src: [number, number]; keys: [number, number, number, number, number][] };
type Pic = { src: string; from: number; frames: number; trim: number; freeze: boolean; crop?: Crop };
type FilmCut = { pictures: Pic[]; grade: Record<string, [number, number, number]> };
const useFilmCut = () => {
  const [d, set] = useState<FilmCut | null>(null);
  const [h] = useState(() => delayRender('film-cut.json'));
  useEffect(() => { fetch(staticFile(`${JOB}/edit/film-cut.json`)).then((r) => r.json()).then((x) => { set(x); continueRender(h); }).catch((e) => cancelRender(e)); }, [h]);
  return d;
};
const cropAt = (c: Crop, f: number) => {
  const k = c.keys;
  if (f <= k[0][0]) return k[0];
  for (let i = 1; i < k.length; i++) if (f <= k[i][0]) { const a = k[i - 1]; const b = k[i]; const u = (f - a[0]) / Math.max(1, b[0] - a[0]); return a.map((v, j) => v + (b[j] - v) * u); }
  return k[k.length - 1];
};
const clipOf = (src: string) => src.slice(src.lastIndexOf('/') + 1, -4);
const GradeDefs: FC<{ grade: FilmCut['grade'] }> = ({ grade }) => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    {Object.entries(grade).map(([clip, [r, g, b]]) => (
      <filter key={clip} id={`g-${clip}`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={`${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`} />
        <feComponentTransfer><feFuncR type="gamma" amplitude="1.03" exponent="1.04" offset="-0.01" /><feFuncG type="gamma" amplitude="1.03" exponent="1.04" offset="-0.01" /><feFuncB type="gamma" amplitude="1.03" exponent="1.04" offset="-0.01" /></feComponentTransfer>
      </filter>
    ))}
  </svg>
);
const Picture: FC<{ p: Pic }> = ({ p }) => {
  const f = useCurrentFrame();
  const W = 1920;
  const c = p.crop;
  const filter = `url(#g-${clipOf(p.src)})`;
  let video: ReactNode;
  if (c) {
    const [, x, y, w] = cropAt(c, p.freeze ? 0 : f); const s = W / w;
    // Placed with a transform, not left/top: left/top round to whole pixels, so a slow face-locked move stepped
    // 0, 0, 1 px (judder); a transform is drawn at the exact sub-pixel position.
    video = <OffthreadVideo src={staticFile(p.src)} muted trimBefore={p.trim} style={{ position: 'absolute', left: 0, top: 0, width: c.src[0] * s, height: c.src[1] * s, transform: `translate3d(${-x * s}px, ${-y * s}px, 0)`, filter }} />;
  } else video = <OffthreadVideo src={staticFile(p.src)} muted trimBefore={p.trim} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter }} />;
  return p.freeze ? <Freeze frame={0}>{video}</Freeze> : <>{video}</>;
};
/** The A-roll from dialogue second d0, placed at this sequence's start: a 1920 x 1080 picture. */
const ARollAt: FC<{ cut: FilmCut; d0: number; len: number }> = ({ cut, d0, len }) => {
  const a = sec(d0); const b = a + sec(len) + 2;
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Sequence from={-a} layout="none">
        {cut.pictures.filter((p) => p.from < b && p.from + p.frames > a).map((p, i) => (
          <Sequence key={i} from={p.from} durationInFrames={p.frames} layout="none"><Picture p={p} /></Sequence>
        ))}
      </Sequence>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- shared pieces
const Stage: FC<{ tone?: 'dark' | 'light'; children?: ReactNode }> = ({ tone = 'dark', children }) => (
  <AbsoluteFill style={{ background: tone === 'dark' ? `radial-gradient(120% 90% at 18% 10%, ${C.forest2} 0%, ${C.forest} 58%, #001A10 100%)` : `radial-gradient(110% 90% at 15% 0%, #FFFFFF 0%, ${C.canvas} 60%, #E9EBE4 100%)`, fontFamily: FONT }}>
    {children}
  </AbsoluteFill>
);
const Logo: FC<{ name: string; h: number; style?: CSSProperties }> = ({ name, h, style }) => <Img src={staticFile(`${JOB}/logos/${name}.svg`)} style={{ height: h, width: 'auto', ...style }} />;
const Tag: FC<{ tone: Tone; children: ReactNode; size?: number }> = ({ tone, children, size = 15 }) => (
  <span style={{ display: 'inline-block', background: toneBg[tone], color: toneInk[tone], font: `700 ${size}px/1 ${FONT}`, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '7px 10px', borderRadius: 6 }}>{children}</span>
);

/** Kashfiq in a rounded window, cut from the centred A-roll (eyes on the centre line). */
const PiP: FC<{ cut: FilmCut; d0: number; len: number; x: number; y: number; size: number; at?: number }> = ({ cut, d0, len, x, y, size, at = 0 }) => {
  const t = useT(); const k = enter(t, at, 0.5);
  const region = 720; const s = size / region; const cx = 960 - region / 2; const cy = 432 - region * 0.4;
  return (
    <div style={{ position: 'absolute', left: x, top: y + (1 - k) * 30, width: size, height: size, borderRadius: 28, overflow: 'hidden', opacity: k, boxShadow: `0 24px 60px rgba(0,0,0,0.35), 0 0 0 3px ${C.lime}` }}>
      <div style={{ position: 'absolute', left: -cx * s, top: -cy * s, width: 1920 * s, height: 1080 * s }}>
        <div style={{ width: 1920, height: 1080, transform: `scale(${s})`, transformOrigin: '0 0', position: 'relative' }}><ARollAt cut={cut} d0={d0} len={len} /></div>
      </div>
      <div style={{ position: 'absolute', left: 12, bottom: 12, background: C.forest, color: C.white, font: `600 15px/1 ${FONT}`, padding: '7px 10px', borderRadius: 8, display: 'flex', gap: 7, alignItems: 'center' }}>
        <Logo name="mark-on-dark" h={14} />Shiyam Kashfiq
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- site shot
/** The capture on the film clock: from `from`, at the speed that reaches `to` by the shot's end, holding its last frame. */
/** Places where a capture snaps (measured with the smoothness check): [last good second, first good second after]. */
const CAP_SNAPS: Record<string, [number, number][]> = {
  'fibery-tour': [[3.85, 3.92], [5.0, 5.08], [5.52, 5.58], [18.86, 18.93]],
  'folk-journey': [[2.62, 2.68]],
  'folk-pricing': [[3.35, 3.41]],
  'slite-tour': [[47.48, 47.66]],
};
const SNAP_DISSOLVE = 8;
const FadeIn: FC<{ frames: number; children: ReactNode }> = ({ frames, children }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ opacity: interpolate(f, [0, frames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{children}</AbsoluteFill>;
};
const Capture: FC<{ cap: string; from: number; to?: number; len: number; rate?: number }> = ({ cap, from, to, len, rate: forced }) => {
  const { fps } = useVideoConfig();
  const max = CAP_LENGTH[cap] - 0.1;
  const { rate, playable, srcEnd } = capPlan(CAP_LENGTH[cap], from, to, len, forced);
  const src = staticFile(`${JOB}/capture/${cap}.mp4`);
  const style: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };
  const still = to === undefined && SPEC_STATIC.has(cap + from);
  const playFrames = Math.max(1, Math.round(playable * fps));
  // Split the playing part at each snap: the frame before the snap holds while the part after it dissolves in.
  const snaps = still ? [] : (CAP_SNAPS[cap] ?? []).filter(([a]) => a > from + 0.1 && a < srcEnd - 0.1);
  const parts = [{ src: from, f0: 0 }, ...snaps.map(([a, b]) => ({ src: b, f0: Math.round(((a - from) / rate) * fps), last: a }))];
  return (
    <>
      {still ? (
        <Sequence durationInFrames={playFrames} layout="none"><Freeze frame={0}><OffthreadVideo src={src} muted trimBefore={Math.round(from * fps)} style={style} /></Freeze></Sequence>
      ) : parts.map((p, i) => {
        const f1 = i + 1 < parts.length ? parts[i + 1].f0 : playFrames;
        const nextLast = i + 1 < parts.length ? (parts[i + 1] as { last: number }).last : 0;
        const video = <OffthreadVideo src={src} muted trimBefore={Math.round(p.src * fps)} playbackRate={rate} style={style} />;
        return (
          <Sequence key={i} layout="none">
            <Sequence from={p.f0} durationInFrames={Math.max(1, f1 - p.f0)} layout="none">{i === 0 ? video : <FadeIn frames={SNAP_DISSOLVE}>{video}</FadeIn>}</Sequence>
            {i + 1 < parts.length ? (
              <Sequence from={f1} durationInFrames={SNAP_DISSOLVE} layout="none"><Freeze frame={0}><OffthreadVideo src={src} muted trimBefore={Math.round((nextLast - 0.04) * fps)} style={style} /></Freeze></Sequence>
            ) : null}
          </Sequence>
        );
      })}
      {playable < len ? (
        <Sequence from={playFrames} layout="none"><Freeze frame={0}><OffthreadVideo src={src} muted trimBefore={Math.round(Math.min(max, srcEnd) * fps)} style={style} /></Freeze></Sequence>
      ) : null}
    </>
  );
};
const SPEC_STATIC = new Set(STILLS);

const PinMark: FC<{ x: number; y: number; tone: Tone; text?: string; at: number; k: number }> = ({ x, y, tone, text = '?', at, k }) => {
  const s = useSpring(at, 11); const t = useT();
  if (t < at) return null;
  const pulse = 1 + 0.08 * Math.sin((t - at) * 5);
  return (
    <div style={{ position: 'absolute', left: x * k - 24, top: y * k - 24, width: 48, height: 48, borderRadius: 24, background: toneBg[tone], color: toneInk[tone], display: 'grid', placeItems: 'center', font: `800 28px/1 ${FONT}`, transform: `scale(${s * pulse})`, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>{text}</div>
  );
};

/** Kashfiq's notes on the right: each note springs in on its word, newest at the bottom, four at most. */
const RAIL = { x: 1520, y: 72, w: 352 };
const NoteCard: FC<{ note: Note; shot: Shot; at: number }> = ({ note, shot, at }) => {
  const t = useT(); const s = useSpring(at, 15);
  const body = (() => {
    if (note.kind === 'timer') {
      const stop = cueOf(shot, note.stop, at + 2);
      const v = Math.min(2, Math.max(0, ((Math.min(t, stop) - at) / Math.max(0.1, stop - at)) * 2));
      return (<><div style={{ font: `700 64px/1 ${FONT}`, color: C.forest, fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(1)} s</div><div style={{ font: `600 22px/1.25 ${FONT}`, color: C.forest, marginTop: 8, opacity: t >= stop ? 1 : 0.35 }}>{note.text}</div></>);
    }
    if (note.kind === 'steps' || note.kind === 'dna') {
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          {note.kind === 'dna' ? <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>{FIBERY_SWATCHES.map((c) => <div key={c} style={{ flex: 1, height: 40, borderRadius: 8, background: c, border: '1px solid rgba(0,0,0,0.08)' }} />)}</div> : null}
          {(note.steps ?? []).map((st, i) => { const on = t >= cueOf(shot, st.at, at + i); const active = note.kind === 'steps' && on && (i === (note.steps ?? []).length - 1 || t < cueOf(shot, (note.steps ?? [])[i + 1].at, 1e9));
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: active ? C.forest : on ? 'rgba(0,45,27,0.10)' : 'rgba(0,45,27,0.04)', color: active ? C.lime : C.forest, font: `600 22px/1 ${FONT}`, opacity: on ? 1 : 0.4, transition: 'none' }}>
                <span style={{ font: `700 14px/1 ${FONT}`, opacity: 0.7 }}>{note.kind === 'steps' ? String(i + 1).padStart(2, '0') : '•'}</span>{st.text}
              </div>
            ); })}
        </div>
      );
    }
    if (note.kind === 'motion') {
      const p = (t * 0.9) % 1;
      return (<><div style={{ font: `600 22px/1.25 ${FONT}`, color: '#FFFFFF' }}>{note.text}</div>
        <div style={{ marginTop: 12, height: 92, borderRadius: 12, background: 'rgba(255,255,255,0.16)', position: 'relative', overflow: 'hidden' }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ position: 'absolute', left: 14, top: 14 + i * 24, height: 12, borderRadius: 6, background: '#FFFFFF', width: `${30 + 55 * Math.max(0, Math.min(1, (p * 3 - i * 0.5)))}%`, opacity: 0.85 }} />)}
          <div style={{ position: 'absolute', right: 10, bottom: 8, font: `700 12px/1 ${FONT}`, letterSpacing: '0.08em', color: '#FFFFFF', opacity: 0.8 }}>MOTION CONCEPT</div>
        </div></>);
    }
    if (note.kind === 'concept') return (<><div style={{ font: `700 24px/1.2 ${FONT}`, color: C.forest }}>{note.text}</div><div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, font: `600 14px/1 ${FONT}`, color: C.forest, letterSpacing: '0.06em' }}><Logo name="mark-on-light" h={16} />RUBIK CONCEPT</div></>);
    return <div style={{ font: `600 24px/1.25 ${FONT}`, color: toneInk[note.tone] }}>{note.text}</div>;
  })();
  const dark = note.tone === 'fix' || note.tone === 'ask';
  return (
    <div style={{ transform: `translateX(${(1 - s) * 60}px)`, opacity: Math.min(1, s * 1.4), background: note.kind === 'steps' || note.kind === 'dna' || note.kind === 'timer' || note.kind === 'concept' ? '#FFFFFF' : toneBg[note.tone], borderRadius: 16, padding: '16px 18px 18px', boxShadow: '0 14px 36px rgba(0,0,0,0.28)', borderLeft: note.kind ? `6px solid ${toneLine[note.tone] === C.white ? C.forest : toneLine[note.tone]}` : undefined }}>
      {note.tag ? <div style={{ font: `700 13px/1 ${FONT}`, letterSpacing: '0.1em', color: dark ? 'rgba(255,255,255,0.85)' : note.kind ? C.grey : note.tone === 'keep' ? C.forest : C.grey, marginBottom: 10 }}>{note.tag}</div> : null}
      {body}
    </div>
  );
};
const Rail: FC<{ notes: Note[]; shot: Shot; top: number }> = ({ notes, shot, top }) => {
  const t = useT();
  const shown = notes.map((n) => ({ n, at: cueOf(shot, n.at, 0.3) })).filter((x) => t >= x.at).slice(-3);
  return <div style={{ position: 'absolute', left: RAIL.x, top, width: RAIL.w, display: 'grid', gap: 14 }}>{shown.map((x, i) => <NoteCard key={x.n.text + x.n.tag + i} note={x.n} shot={shot} at={x.at} />)}</div>;
};

/** pipIn: Kashfiq's window fades in at this shot's start; false when the shot before already showed it in the same
 *  place (v2 restarted the fade at every cut, so the window blinked out for 2 frames: owner notes b001-n8, n27). */
const SiteShot: FC<{ shot: Shot; spec: Site; cut: FilmCut; d0: number; pipIn: boolean }> = ({ shot, spec, cut, d0, pipIn }) => {
  const t = useT(); const len = shot.end - shot.start;
  const k = PAGE.w / 1920;
  const still = spec.to === undefined && SPEC_STATIC.has(spec.cap + spec.from);
  const z = zoomOf(spec, shot, MARKS, CAP_LENGTH, (c, f) => SPEC_STATIC.has(c + f));
  const [vx, vy, vw] = viewAt(z, cueOf(shot, z?.at, 0), len, t);
  // Highlights tied to a capture mark move with the page as it scrolls.
  const srcT = srcAt(capPlan(CAP_LENGTH[spec.cap], spec.from, spec.to, len, spec.rate), spec.from, t, still);
  const onPage = (box: Box, mark?: string): Box => { const m = mark ? MARKS[spec.cap]?.marks[mark] : undefined; return m ? markBoxAt(box, m.scroll, MARKS[spec.cap].scroll, srcT) : box; };
  const scale = 1920 / vw;
  const pauseAt = spec.pause ? cueOf(shot, spec.pause.at) : 1e9;
  const patchAt = spec.patch ? cueOf(shot, spec.patch.at) : 1e9; const pw = interpolate(t, [patchAt, patchAt + 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut });
  const morphAt = spec.morph ? cueOf(shot, spec.morph.at) : 1e9; const mu = enter(t, morphAt, 0.6);
  const stripAt = spec.strip ? cueOf(shot, spec.strip.at) : 1e9; const su = enter(t, stripAt, 0.5);
  return (
    <Stage>
      <Browser url={spec.url}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE.w, height: PAGE.h, transform: `scale(${scale}) translate(${-vx * k}px, ${-vy * k}px)`, transformOrigin: '0 0' }}>
          {spec.pause ? (
            <Spotlight box={spec.pause.box} at={pauseAt} k={k} pw={PAGE.w} ph={PAGE.h}><Capture cap={spec.cap} from={spec.from} to={spec.to} len={len} rate={spec.rate} /></Spotlight>
          ) : <Capture cap={spec.cap} from={spec.from} to={spec.to} len={len} rate={spec.rate} />}
          {spec.patch && pw > 0 ? (
            <div style={{ position: 'absolute', left: spec.patch.box[0] * k, top: spec.patch.box[1] * k, width: spec.patch.box[2] * k, height: spec.patch.box[3] * k, background: spec.patch.bg, clipPath: `inset(0 ${(1 - pw) * 100}% 0 0)`, padding: 4 }}>
              <div style={{ display: 'inline-block', marginBottom: 10, background: C.forest, color: C.lime, font: `700 11px/1 ${FONT}`, letterSpacing: '0.1em', padding: '6px 8px', borderRadius: 5 }}>{spec.patch.label.toUpperCase()}</div>
              {spec.patch.lines.map((l) => <div key={l} style={{ font: `800 35px/1.08 ${FONT}`, letterSpacing: '-0.02em', color: spec.patch?.ink }}>{l}</div>)}
            </div>
          ) : null}
          {spec.morph && mu > 0 ? (
            <div style={{ position: 'absolute', left: (spec.morph.box[0] + spec.morph.box[2] / 2) * k, top: spec.morph.box[1] * k, height: spec.morph.box[3] * k, transform: 'translateX(-50%)', background: spec.morph.bg, color: spec.morph.ink, borderRadius: 999, display: 'grid', placeItems: 'center', padding: `0 ${16 + 10 * mu}px`, font: `700 ${15}px/1 ${FONT}`, whiteSpace: 'nowrap', boxShadow: `0 0 0 ${3 * mu}px ${C.lime}` }}>
              <span>{mu < 0.5 ? spec.morph.from : spec.morph.to}</span>
            </div>
          ) : null}
          {(spec.rings ?? []).map((r, i) => <Highlight key={i} box={onPage(r.box, r.mark)} at={cueOf(shot, r.at)} out={r.out !== undefined ? cueOf(shot, r.out) : undefined} k={k} scale={scale} />)}
          {(spec.pins ?? []).map((p, i) => <PinMark key={i} x={p.x} y={p.y} tone={p.tone} text={p.text} at={cueOf(shot, p.at)} k={k} />)}
        </div>
        {spec.strip && su > 0 ? (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '22px 30px', background: C.forest, color: C.white, font: `700 38px/1.15 ${FONT}`, letterSpacing: '-0.02em', transform: `translateY(${(1 - su) * 100}%)`, display: 'flex', alignItems: 'center', gap: 18 }}>
            <span style={{ width: 10, height: 44, borderRadius: 5, background: C.lime }} />{spec.strip.text}
          </div>
        ) : null}
      </Browser>
      <Rail notes={spec.notes ?? []} shot={shot} top={RAIL.y} />
      <PiP cut={cut} d0={d0} len={len} x={RAIL.x + RAIL.w - 300} y={PAGE.y + PAGE.h - 300 + 4} size={300} at={pipIn ? 0 : -1} />
    </Stage>
  );
};

// ---------------------------------------------------------------- A-roll shot with its graphics
const ARollShot: FC<{ shot: Shot; spec: Extract<typeof SPEC[number], { type: 'aroll' }>; cut: FilmCut; d0: number }> = ({ shot, spec, cut, d0 }) => {
  const t = useT(); const len = shot.end - shot.start;
  return (
    <AbsoluteFill style={{ fontFamily: FONT }}>
      <ARollAt cut={cut} d0={d0} len={len} />
      <AbsoluteFill style={{ background: 'radial-gradient(130% 100% at 50% 40%, transparent 60%, rgba(0,0,0,0.28) 100%)' }} />
      {spec.lower ? (() => { const at = cueOf(shot, spec.lower.at); const u = enter(t, at, 0.6); const out = 1 - enter(t, len - 0.4, 0.35); return (
        <div style={{ position: 'absolute', left: 96, bottom: 150, display: 'flex', alignItems: 'center', gap: 22, background: C.forest, borderRadius: 18, padding: '20px 30px 20px 22px', clipPath: `inset(0 ${(1 - u) * 100}% 0 0 round 18px)`, opacity: out, boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: C.forest2, display: 'grid', placeItems: 'center' }}><Logo name="mark-on-dark" h={38} /></div>
          <div><div style={{ font: `700 40px/1.05 ${FONT}`, color: C.white, letterSpacing: '-0.02em' }}>{spec.lower.name}</div><div style={{ font: `600 19px/1 ${FONT}`, color: C.lime, letterSpacing: '0.08em', marginTop: 10, textTransform: 'uppercase' }}>{spec.lower.role}</div></div>
        </div>); })() : null}
      {spec.pills ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', gap: 22 }}>
          {spec.pills.map((p, i) => { const s = useSpringSafe(shot, p.at, t, i); return (
            <div key={p.text} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', borderRadius: 999, padding: '16px 26px', boxShadow: '0 16px 40px rgba(0,0,0,0.3)', transform: `translateY(${(1 - s) * -30}px) scale(${0.9 + 0.1 * s})`, opacity: Math.min(1, s * 1.5) }}>
              <Logo name={p.logo} h={30} /><span style={{ font: `600 24px/1 ${FONT}`, color: C.grey }}>{p.text}</span>
            </div>); })}
        </div>
      ) : null}
      {spec.labels ? (
        <div style={{ position: 'absolute', right: 96, top: 170, display: 'grid', gap: 14, width: 470 }}>
          {spec.labels.map((l, i) => { const at = cueOf(shot, l.at, i); const s = enter(t, at, 0.45); return (
            <div key={l.text} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(0,45,27,0.92)', color: C.white, borderRadius: 14, padding: '16px 20px', font: `600 26px/1.15 ${FONT}`, transform: `translateX(${(1 - s) * 40}px)`, opacity: s }}>
              <span style={{ font: `700 16px/1 ${FONT}`, color: C.lime }}>{String(i + 1).padStart(2, '0')}</span>{l.text}
            </div>); })}
        </div>
      ) : null}
      {spec.tag ? (() => { const at = cueOf(shot, spec.tag.at); const u = enter(t, at, 0.5); return (
        <div style={{ position: 'absolute', left: 96, top: 96, background: C.lime, color: C.forest, font: `700 30px/1.15 ${FONT}`, borderRadius: 14, padding: '16px 22px', maxWidth: 640, transform: `translateY(${(1 - u) * -20}px)`, opacity: u, letterSpacing: '-0.01em' }}>{spec.tag.text}</div>); })() : null}
      {spec.cta ? (() => { const at = cueOf(shot, spec.cta.at); const s = useSpringSafe(shot, spec.cta.at, t, 0); const typed = Math.floor(Math.max(0, (t - at - 0.5) * 22)); return (
        <div style={{ position: 'absolute', right: 96, top: 150, width: 560, background: C.forest, borderRadius: 24, padding: 32, transform: `translateX(${(1 - s) * 120}px)`, opacity: Math.min(1, s * 1.5), boxShadow: '0 30px 70px rgba(0,0,0,0.4)' }}>
          <div style={{ font: `700 46px/1.05 ${FONT}`, color: C.white, letterSpacing: '-0.025em' }}>{spec.cta.title}</div>
          <div style={{ marginTop: 22, background: '#FFFFFF', borderRadius: 12, padding: '16px 18px', font: `500 24px/1 ${FONT}`, color: C.ink, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ color: C.grey }}>💬</span>{'yourstartup.com'.slice(0, typed)}<span style={{ width: 2, height: 26, background: C.ink, opacity: Math.floor(t * 2) % 2 }} /></div>
          <div style={{ marginTop: 16, font: `600 22px/1.2 ${FONT}`, color: C.lime }}>{spec.cta.sub}</div>
        </div>); })() : null}
      {spec.sign ? <div style={{ position: 'absolute', left: 64, bottom: 56, opacity: enter(t, 0.3, 0.6) }}><Logo name="wordmark-on-dark" h={34} /></div> : null}
    </AbsoluteFill>
  );
};
const useSpringSafe = (shot: Shot, c: Cue, t: number, i: number) => { const at = cueOf(shot, c, i * 0.3); const u = Math.max(0, t - at); return u <= 0 ? 0 : 1 - Math.exp(-u * 9) * Math.cos(u * 11); };

// ---------------------------------------------------------------- cards
const TitleCard: FC = () => {
  const t = useT();
  const m = interpolate(t, [0, 0.7], [0, 1], { extrapolateRight: 'clamp', easing: ease });
  const w = enter(t, 0.55, 0.6); const ep = enter(t, 1.0, 0.5); const ti = enter(t, 1.25, 0.6); const out = 1 - enter(t, 3.05, 0.3);
  return (
    <Stage tone="dark">
      <AbsoluteFill style={{ display: 'grid', placeItems: 'center', opacity: out }}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
            <div style={{ transform: `scale(${0.82 + 0.18 * m})`, opacity: m, clipPath: `inset(0 ${(1 - Math.max(w, 0.32 * m)) * 100}% 0 0)` }}><Logo name="wordmark-on-dark" h={120} /></div>
          </div>
          <div style={{ font: `700 22px/1 ${FONT}`, letterSpacing: '0.24em', color: C.lime, opacity: ep, transform: `translateY(${(1 - ep) * 10}px)` }}>WEBSITE TEARDOWN · EPISODE 01</div>
          <div style={{ font: `700 84px/1 ${FONT}`, letterSpacing: '-0.035em', color: C.white, opacity: ti, transform: `translateY(${(1 - ti) * 24}px)` }}>What does this startup do?</div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
const ChapterCard: FC<{ c: Extract<Card, { type: 'chapter' }> }> = ({ c }) => {
  const t = useT(); const wipe = interpolate(t, [0, 0.45], [100, 0], { extrapolateRight: 'clamp', easing: ease });
  const n = enter(t, 0.15, 0.5); const l = enter(t, 0.3, 0.55); const u = enter(t, 0.5, 0.5);
  return (
    <AbsoluteFill style={{ clipPath: `inset(${wipe}% 0 0 0)` }}>
      <Stage tone="dark">
        <div style={{ position: 'absolute', left: 140, top: 140, font: `700 22px/1 ${FONT}`, letterSpacing: '0.2em', color: C.mint }}>WEBSITE TEARDOWN</div>
        <div style={{ position: 'absolute', left: 140, top: 300, font: `800 260px/0.85 ${FONT}`, color: C.lime, letterSpacing: '-0.05em', opacity: n, transform: `translateY(${(1 - n) * 40}px)` }}>{c.n}</div>
        <div style={{ position: 'absolute', left: 150, top: 590, opacity: l, transform: `translateY(${(1 - l) * 30}px)` }}><Logo name={`${c.logo}-white`} h={110} /></div>
        <div style={{ position: 'absolute', left: 150, top: 760, font: `500 30px/1 ${FONT}`, color: C.mint, opacity: u }}>{c.url}</div>
        <div style={{ position: 'absolute', right: 140, bottom: 140, display: 'flex', gap: 14, alignItems: 'center', opacity: u }}>
          <span style={{ font: `600 22px/1 ${FONT}`, color: C.mint, marginRight: 8 }}>Site {c.of} of 3</span>
          {[1, 2, 3].map((i) => <div key={i} style={{ width: i === c.of ? 56 : 16, height: 16, borderRadius: 8, background: i === c.of ? C.lime : 'rgba(255,255,255,0.22)' }} />)}
        </div>
      </Stage>
    </AbsoluteFill>
  );
};
const MaximCard: FC<{ c: Extract<Card, { type: 'maxim' }>; shot: Shot }> = ({ c, shot }) => {
  const t = useT();
  return (
    <Stage tone="dark">
      <AbsoluteFill style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 1500 }}>
          {c.small ? <div style={{ font: `700 22px/1 ${FONT}`, letterSpacing: '0.2em', color: C.mint, marginBottom: 36 }}>{c.small.toUpperCase()}</div> : null}
          {c.lines.map((l, i) => { const at = cueOf(shot, l.at, i * 0.6); const u = enter(t, at, 0.5); return (
            <div key={i} style={{ font: `800 ${c.lines.length > 2 ? 96 : 132}px/1.04 ${FONT}`, letterSpacing: '-0.04em', color: l.hi ? C.lime : C.white, opacity: u, transform: `translateY(${(1 - u) * 36}px)` }}>{l.text}</div>); })}
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
const VerdictCard: FC<{ c: Extract<Card, { type: 'verdict' }>; shots: Shot[]; first: Shot; cut: FilmCut; d0: number; len: number }> = ({ c, shots, first, cut, d0, len }) => {
  const t = useT(); const wipe = interpolate(t, [0, 0.45], [100, 0], { extrapolateRight: 'clamp', easing: ease });
  const rowAt = (r: Row) => groupCueTime(shots, r.at, first.start, 1);
  return (
    <AbsoluteFill style={{ clipPath: `inset(${wipe}% 0 0 0)` }}>
      <Stage tone="light">
        <div style={{ position: 'absolute', left: 120, top: 110, display: 'flex', alignItems: 'center', gap: 26 }}>
          <Logo name={c.logo} h={64} />
          <span style={{ width: 2, height: 54, background: C.line }} />
          <span style={{ font: `700 26px/1 ${FONT}`, letterSpacing: '0.2em', color: C.grey }}>THE VERDICT</span>
        </div>
        <div style={{ position: 'absolute', left: 120, top: 250, width: 1220, display: 'grid', gap: 22 }}>
          {c.rows.map((r, i) => { const at = rowAt(r); const s = enter(t, at, 0.5); const ghost = enter(t, 0.35 + i * 0.12, 0.4); return (
            <div key={i} style={{ position: 'relative', minHeight: 112 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: 20, border: `3px dashed ${C.grey}`, opacity: 0.35 * ghost * (1 - s) }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 26, background: '#FFFFFF', borderRadius: 20, padding: '26px 30px', boxShadow: '0 10px 30px rgba(0,0,0,0.07)', borderLeft: `10px solid ${r.tone === 'keep' ? C.lime : C.fix}`, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
              <Tag tone={r.tone} size={20}>{r.tone === 'keep' ? 'Keep' : 'Fix'}</Tag>
              <span style={{ font: `700 46px/1.1 ${FONT}`, color: C.ink, letterSpacing: '-0.025em' }}>{r.text}</span>
            </div></div>); })}
        </div>
        <PiP cut={cut} d0={d0} len={len} x={1480} y={640} size={340} at={0.3} />
      </Stage>
    </AbsoluteFill>
  );
};
const PathCard: FC<{ shots: Shot[]; first: Shot; cut: FilmCut; d0: number; len: number }> = ({ shots, first, cut, d0, len }) => {
  const t = useT();
  const at = (word: string, d: number) => groupCueTime(shots, word, first.start, d);
  const Node: FC<{ text: string; on: number; hi?: boolean }> = ({ text, on, hi }) => (
    <div style={{ background: hi ? C.forest : '#FFFFFF', color: hi ? C.lime : C.ink, borderRadius: 18, padding: '24px 30px', font: `700 38px/1 ${FONT}`, boxShadow: '0 10px 30px rgba(0,0,0,0.08)', opacity: on, transform: `scale(${0.9 + 0.1 * on})` }}>{text}</div>
  );
  const Arrow: FC<{ on: number; label?: string; tone?: Tone }> = ({ on, label, tone }) => (
    <div style={{ position: 'relative', width: 150, height: 40 }}>
      <div style={{ position: 'absolute', left: 10, top: 18, height: 4, width: 120 * on, background: C.grey, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 120, top: 10, width: 0, height: 0, borderLeft: `16px solid ${C.grey}`, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', opacity: on }} />
      {label ? <div style={{ position: 'absolute', left: 20, top: -44, opacity: on }}><Tag tone={tone ?? 'fix'} size={17}>{label}</Tag></div> : null}
    </div>
  );
  const r1 = at('most', 0.2); const r1b = at('page.', r1 + 2); const r1c = at('click.', r1 + 4);
  const r2 = at('inserted', 7); const r2b = at('glimpse', r2 + 2); const r2c = at('answers', r2 + 4);
  return (
    <Stage tone="light">
      <div style={{ position: 'absolute', left: 120, top: 120, font: `700 26px/1 ${FONT}`, letterSpacing: '0.2em', color: C.grey }}>HOW VISITORS FIND THE PRICE</div>
      <div style={{ position: 'absolute', left: 120, top: 250 }}>
        <div style={{ font: `600 28px/1 ${FONT}`, color: C.grey, marginBottom: 22, opacity: enter(t, r1) }}>Most SaaS sites</div>
        <div style={{ display: 'flex', alignItems: 'center' }}><Node text="Home" on={enter(t, r1)} /><Arrow on={enter(t, r1b)} /><Node text="Pricing page" on={enter(t, r1b)} /><Arrow on={enter(t, r1c)} label="+1 click" /><Node text="Answer" on={enter(t, r1c)} /></div>
      </div>
      <div style={{ position: 'absolute', left: 120, top: 560 }}>
        <div style={{ font: `600 28px/1 ${FONT}`, color: C.forest, marginBottom: 22, opacity: enter(t, r2) }}>Slite</div>
        <div style={{ display: 'flex', alignItems: 'center' }}><Node text="Home" on={enter(t, r2)} /><Arrow on={enter(t, r2b)} label="in the scroll" tone="keep" /><Node text="Answer" on={enter(t, r2c)} hi /></div>
      </div>
      <PiP cut={cut} d0={d0} len={len} x={1480} y={640} size={340} at={0.3} />
    </Stage>
  );
};
const LessonsCard: FC<{ c: Extract<Card, { type: 'lessons' }>; shots: Shot[]; first: Shot; cut: FilmCut; d0: number; len: number }> = ({ c, shots, first, cut, d0, len }) => {
  const t = useT();
  const at = (cue: Cue | undefined, d: number) => (cue === undefined ? d : groupCueTime(shots, cue, first.start, d));
  return (
    <Stage tone="dark">
      <div style={{ position: 'absolute', left: 120, top: 110, font: `700 24px/1 ${FONT}`, letterSpacing: '0.2em', color: C.mint }}>WHAT WE LEARNED</div>
      <div style={{ position: 'absolute', left: 120, top: 200, width: 1240, display: 'grid', gap: 40 }}>
        {c.rules.map((r, i) => { const a = at(r.at, i); const u = enter(t, a, 0.55); const sb = enter(t, at(r.sub_at, a + 1.5), 0.5); return (
          <div key={i} style={{ opacity: u * (r.dim ? 0.38 : 1), transform: `translateY(${(1 - u) * 30}px)` }}>
            <div style={{ display: 'flex', gap: 28, alignItems: 'baseline' }}>
              <span style={{ font: `800 92px/1 ${FONT}`, color: C.lime }}>{r.n}</span>
              <span style={{ font: `800 ${r.dim ? 56 : 76}px/1.04 ${FONT}`, color: C.white, letterSpacing: '-0.035em' }}>{r.text}</span>
            </div>
            {r.sub ? <div style={{ marginLeft: 82, marginTop: 14, font: `600 36px/1.2 ${FONT}`, color: C.lime, opacity: sb }}>{r.sub}</div> : null}
            {r.stills ? <div style={{ marginLeft: 82, marginTop: 26, display: 'flex', gap: 20 }}>{r.stills.map((s, j) => { const v = enter(t, a + 0.6 + j * 0.25, 0.5); return <Img key={s} src={staticFile(`${JOB}/stills/${s}.jpg`)} style={{ width: 400, height: 225, objectFit: 'cover', borderRadius: 14, opacity: v, transform: `translateY(${(1 - v) * 20}px)`, boxShadow: '0 16px 40px rgba(0,0,0,0.4)' }} />; })}</div> : null}
          </div>); })}
      </div>
      <PiP cut={cut} d0={d0} len={len} x={1480} y={640} size={340} at={0.3} />
    </Stage>
  );
};
const EndCard: FC = () => {
  const t = useT(); const m = enter(t, 0.1, 0.8); const l = enter(t, 0.7, 0.6); const u = enter(t, 1.2, 0.6); const n = enter(t, 2.0, 0.6);
  return (
    <Stage tone="dark">
      <AbsoluteFill style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ display: 'grid', justifyItems: 'center', gap: 34, textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, opacity: m, transform: `scale(${0.92 + 0.08 * m})` }}><Logo name="wordmark-on-dark" h={110} /></div>
          <div style={{ font: `700 54px/1.1 ${FONT}`, color: C.white, letterSpacing: '-0.03em', opacity: l, transform: `translateY(${(1 - l) * 20}px)` }}>Full-stack design partner<br />for funded startups.</div>
          <div style={{ font: `700 44px/1 ${FONT}`, color: C.forest, background: C.lime, padding: '20px 38px', borderRadius: 999, opacity: u }}>rubik.design</div>
          <div style={{ font: `600 24px/1 ${FONT}`, color: C.mint, opacity: n, letterSpacing: '0.04em' }}>Next episode: your website? Drop it in the comments.</div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};

// ---------------------------------------------------------------- captions (one line at a time, no crossfade)
type Line = { t0: number; t1: number; words: Word[]; end?: number };
const buildLines = (shots: Shot[], hide: Set<number>): Line[] => {
  const lines: Line[] = [];
  for (const s of shots) {
    if (!s.voice || hide.has(s.n)) continue;
    let cur: Word[] = [];
    const push = () => { if (cur.length) lines.push({ t0: cur[0].t0, t1: cur[cur.length - 1].t1, words: cur, end: s.end } as Line); cur = []; };
    s.words.forEach((w, i) => {
      const len = cur.reduce((a, x) => a + x.w.length + 1, 0);
      const gap = i > 0 ? w.t0 - s.words[i - 1].t1 : 0;
      if (cur.length && (len + w.w.length > 34 || gap > 0.45)) push();
      cur.push(w);
      if (/[.?!]$/.test(w.w) && cur.length > 2) push();
    });
    push();
  }
  for (let i = 0; i < lines.length; i++) { const nx = lines[i + 1]; lines[i].t1 = Math.min(nx ? Math.min(nx.t0, lines[i].t1 + 0.5) : lines[i].t1 + 0.5, (lines[i].end ?? 1e9) + 0.25); }
  return lines;
};
const CaptionLayer: FC<{ lines: Line[]; siteRanges: [number, number][] }> = ({ lines, siteRanges }) => {
  const t = useT();
  const line = lines.find((l) => t >= l.t0 - 0.05 && t < l.t1);
  if (!line) return null;
  const onSite = siteRanges.some(([a, b]) => t >= a && t < b);
  const cx = onSite ? PAGE.x + PAGE.w / 2 : 960;
  return (
    <div style={{ position: 'absolute', left: cx, bottom: onSite ? 34 : 64, transform: 'translateX(-50%)', background: `linear-gradient(${C.forest2}, ${C.forest})`, borderRadius: 16, padding: '14px 24px', whiteSpace: 'nowrap', font: `${B.captions.weight} ${onSite ? 36 : 46}px/1.15 ${FONT}`, letterSpacing: '-0.01em', boxShadow: '0 12px 30px rgba(0,0,0,0.35)' }}>
      {line.words.map((w, i) => { const said = t >= w.t0; const now = said && t < w.t1 + 0.08; return <span key={i} style={{ color: now ? C.lime : said ? C.white : 'rgba(255,255,255,0.45)' }}>{w.w}{i < line.words.length - 1 ? ' ' : ''}</span>; })}
    </div>
  );
};

// ---------------------------------------------------------------- the film
const Inner: FC<z.infer<typeof RubikEp1Schema>> = ({ captions, audio }) => {
  const cut = useFilmCut();
  const shots = T.shots;
  const dOf = (filmT: number) => { // dialogue time at a film time
    let seg = T.voice[0]; for (const v of T.voice) if (filmT >= v.at - 1e-6) seg = v; return filmT - seg.at + seg.d0;
  };
  const hide = new Set([7, 39]);
  const lines = useMemo(() => buildLines(shots, hide), []); // eslint-disable-line react-hooks/exhaustive-deps
  const siteRanges = useMemo(() => shots.filter((s) => s.kind === 'site' || ['verdict', 'path', 'lessons', 'cont'].includes((SPEC[s.n] as { type: string }).type)).map((s) => [s.start, s.end] as [number, number]), [shots]);
  if (!cut) return null;
  const group = (first: number, until: number) => shots.filter((s) => s.n >= first && s.n <= until && s.voice);
  return (
    <AbsoluteFill style={{ background: C.forest }}>
      <GradeDefs grade={cut.grade} />
      {shots.map((s, i) => {
        const spec = SPEC[s.n];
        if (spec.type === 'cont') return null;
        let end = s.end;
        if ('until' in spec && spec.until) end = shots.find((x) => x.n === spec.until)!.end;
        const from = sec(s.start); const dur = Math.max(1, sec(end) - from);
        const d0 = dOf(s.start); const len = end - s.start;
        let body: ReactNode = null;
        if (spec.type === 'site') body = <SiteShot shot={s} spec={spec} cut={cut} d0={d0} pipIn={i === 0 || SPEC[shots[i - 1].n].type !== 'site'} />;
        else if (spec.type === 'aroll') body = <ARollShot shot={s} spec={spec} cut={cut} d0={d0} />;
        else if (spec.type === 'title') body = <TitleCard />;
        else if (spec.type === 'chapter') body = <ChapterCard c={spec} />;
        else if (spec.type === 'maxim') body = <MaximCard c={spec} shot={s} />;
        else if (spec.type === 'verdict') body = <VerdictCard c={spec} shots={group(s.n, spec.until)} first={s} cut={cut} d0={d0} len={len} />;
        else if (spec.type === 'path') body = <PathCard shots={group(s.n, spec.until)} first={s} cut={cut} d0={d0} len={len} />;
        else if (spec.type === 'lessons') body = <LessonsCard c={spec} shots={group(s.n, spec.until ?? s.n)} first={s} cut={cut} d0={d0} len={len} />;
        else if (spec.type === 'end') body = <EndCard />;
        return <Sequence key={i} from={from} durationInFrames={dur} name={`S${s.n} ${spec.type}`}>{body}</Sequence>;
      })}
      {captions ? <CaptionLayer lines={lines} siteRanges={siteRanges} /> : null}
      {audio === 'voice' ? T.voice.map((v, i) => (
        <Sequence key={i} from={sec(v.at)} durationInFrames={sec(v.d1 - v.d0)} layout="none"><Audio src={staticFile(T.dialogue)} trimBefore={sec(v.d0)} /></Sequence>
      )) : audio === 'mix' ? <Audio src={staticFile(`${JOB}/audio/mix.wav`)} /> : null}
    </AbsoluteFill>
  );
};

export const RubikEp1: FC<z.infer<typeof RubikEp1Schema>> = (props) => (
  <BrandProvider brand="rubik"><Inner {...props} /></BrandProvider>
);
