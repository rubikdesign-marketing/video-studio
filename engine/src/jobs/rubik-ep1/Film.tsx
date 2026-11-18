// Rubik "Website Teardown", episode 1 (jobs/2026-11-17-rubik-ep1). The approved voice edit is the clock: every shot's
// time comes from timeline.json (projects/rubik/video-1-edit/build/timeline.py), and the silent cards (title sting,
// chapter cards, end card) sit between voice lines without stretching them. What each shot shows is in spec.ts.
// A-roll: the footage camera's 16:9 pictures, re-centred on Kashfiq (build/center.py, edit/film-cut.json).
import type { CSSProperties, FC, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AbsoluteFill, Audio, Easing, Freeze, Img, interpolate, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { BrandProvider } from '../../kit/brand';
import { MotionProvider } from '../../kit/motion';
import timeline from './timeline.json';
import { beatAt, capPlan, cueTime, resolveBeats, groupCueTime, markBoxAt, srcAt, viewAt, zoomOf, type MarksFile, type Word } from './lib';
import marksJson from './marks.json';
import { CAP_LENGTH, FIBERY_SWATCHES, SPEC, STILLS, type Box, type Card, type Cue, type Note, type Proof, type Row, type Site, type Tone } from './spec';
import { B, Browser, C, FONT, Highlight, KineticLine, PAGE, Spotlight, toneBg, toneInk } from './look';

// ---------------------------------------------------------------- data
type Shot = { n: number; kind: string; voice: boolean; start: number; end: number; text: string; words: Word[]; d0?: number; d1?: number };
type TL = { fps: number; duration: number; dialogue: string; voice: { d0: number; d1: number; at: number }[]; shots: Shot[] };
const T = timeline as TL;
const MARKS = marksJson as unknown as MarksFile;
export const RubikEp1Fps = T.fps;
export const RubikEp1Frames = Math.round(T.duration * T.fps);
export const RubikEp1Schema = z.object({ captions: z.boolean(), audio: z.enum(['voice', 'mix', 'none']), plate: z.boolean().optional() });
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
/** grade: per clip, gains that match skin and exposure to the reference clip plus one look (build/grade.py); an older
 *  cut stores the gains alone. */
type Grade = { gain: [number, number, number]; lift: number; gamma: number; sat: number };
type FilmCut = { pictures: Pic[]; grade: Record<string, Grade | [number, number, number]> };
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
    {Object.entries(grade).map(([clip, v]) => { const gr: Grade = Array.isArray(v) ? { gain: v, lift: -0.01, gamma: 1.04, sat: 1 } : v; const [r, g, b] = gr.gain;
      const fn = { type: 'gamma', amplitude: '1.03', exponent: String(gr.gamma), offset: String(gr.lift) } as const;
      return (
        <filter key={clip} id={`g-${clip}`} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={`${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`} />
          <feColorMatrix type="saturate" values={String(gr.sat)} />
          <feComponentTransfer><feFuncR {...fn} /><feFuncG {...fn} /><feFuncB {...fn} /></feComponentTransfer>
        </filter>
      ); })}
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
/** Kashfiq cut out (build/matte_front.sh: Robust Video Matting on a 1920 x 1080 plate of the centred A-roll), standing
 *  in front of the browser at the bottom right (presence 'front'). Each file covers these film frames; `lid` is the plate
 *  row of the laptop's top edge: the matte makes the lid half see-through, so the cut-out is clipped there and that
 *  row sits on the frame's bottom edge. */
const MATTES: { name: string; a: number; b: number; lid: number }[] = [
  { name: 's21-22', a: 2317, b: 2800, lid: 875 }, { name: 's33', a: 4846, b: 5112, lid: 835 },
  { name: 's55', a: 9994, b: 10350, lid: 850 }, { name: 's58', a: 10779, b: 11164, lid: 815 }];
const Front: FC<{ shot: Shot; fadeIn: boolean }> = ({ shot, fadeIn }) => {
  const t = useT(); const f0 = sec(shot.start);
  const m = MATTES.find((x) => f0 >= x.a && f0 < x.b);
  if (!m) return null;
  const u = fadeIn ? enter(t, 0.1, 0.6) : 1; const sc = 0.75; const W = 1920 * sc; const H = 1080 * sc; const lid = m.lid * sc;
  return (
    <div style={{ position: 'absolute', left: 1650 - W / 2, top: 1080 - lid + (1 - u) * 90, width: W, height: H, opacity: u, clipPath: `inset(0 0 ${H - lid}px 0)`, filter: 'drop-shadow(0 18px 40px rgba(0,0,0,0.5))' }}>
      <OffthreadVideo src={staticFile(`${JOB}/edit/matte/${m.name}.mov`)} transparent muted trimBefore={f0 - m.a} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};
/** Kashfiq full-frame behind the browser: blurred, darkened and pushed in a little, so the page reads first and he is
 *  still there (presence 'behind'). Fades in when the shot before did not have him behind. */
const Behind: FC<{ cut: FilmCut; d0: number; len: number; fadeIn: boolean }> = ({ cut, d0, len, fadeIn }) => {
  const t = useT(); const u = fadeIn ? enter(t, 0, 0.6) : 1;
  return (
    <AbsoluteFill style={{ opacity: u, transform: 'scale(1.06)', filter: 'blur(14px) brightness(0.42) saturate(0.8)' }}>
      <ARollAt cut={cut} d0={d0} len={len} />
    </AbsoluteFill>
  );
};
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
/** A stopwatch on the page (b001-n14): a lime ring fills as it counts 0.0 to 2.0 s, stops on the word, then the
 *  verdict stamps in under it. */
const Stopwatch: FC<{ shot: Shot; at: number; stop: number; text: string }> = ({ at, stop, text }) => {
  const t = useT(); const u = enter(t, at - 0.2, 0.4);
  if (u <= 0) return null;
  const v = Math.min(2, Math.max(0, ((Math.min(t, stop) - at) / Math.max(0.1, stop - at)) * 2));
  const stamp = useSpring(stop + 0.15, 12); const R0 = 70; const per = 2 * Math.PI * R0;
  return (
    <div style={{ position: 'absolute', right: 40, top: 300, width: 300, display: 'grid', justifyItems: 'center', gap: 14, opacity: u, transform: `translateY(${(1 - u) * -16}px)` }}>
      <div style={{ position: 'relative', width: 220, height: 220, borderRadius: 110, background: C.forest, boxShadow: '0 2px 6px rgba(0,0,0,0.2), 0 24px 50px -10px rgba(0,0,0,0.45)' }}>
        <svg width="220" height="220" style={{ position: 'absolute', inset: 0 }}><circle cx="110" cy="110" r={R0} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="12" />
          <circle cx="110" cy="110" r={R0} fill="none" stroke={C.lime} strokeWidth="12" strokeLinecap="round" strokeDasharray={per} strokeDashoffset={per * (1 - v / 2)} transform="rotate(-90 110 110)" /></svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', font: `800 54px/1 ${FONT}`, color: C.white, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{v.toFixed(1)}<span style={{ position: 'absolute', top: 146, font: `600 18px/1 ${FONT}`, color: C.mint }}>seconds</span></div>
      </div>
      {t >= stop + 0.15 ? <div style={{ background: C.lime, color: C.forest, font: `800 30px/1 ${FONT}`, padding: '14px 22px', borderRadius: 14, transform: `scale(${0.6 + 0.4 * stamp}) rotate(${(1 - stamp) * -8}deg)`, opacity: Math.min(1, stamp * 1.5), letterSpacing: '-0.01em', whiteSpace: 'nowrap', boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}>{text}</div> : null}
    </div>
  );
};
/** The capture at exactly capture second `src` (beats choose it frame by frame). */
const BeatCapture: FC<{ cap: string; src: number }> = ({ cap, src }) => {
  const { fps } = useVideoConfig();
  const f = Math.max(0, Math.min(Math.round(src * fps), Math.floor((CAP_LENGTH[cap] - 0.1) * fps)));
  return <Freeze frame={f}><OffthreadVideo src={staticFile(`${JOB}/capture/${cap}.mp4`)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} /></Freeze>;
};
const SPEC_STATIC = new Set(STILLS);

const PinMark: FC<{ x: number; y: number; tone: Tone; text?: string; at: number; out?: number; instant?: boolean; k: number }> = ({ x, y, tone, text = '?', at, out, instant, k }) => {
  const sp = useSpring(at, 11); const t = useT();
  if (t < at || (out !== undefined && t >= out)) return null;
  const s = instant ? 1 : sp;
  const pulse = 1 + 0.08 * Math.sin((t - at) * 5);
  const shrug = text === '?' ? 14 * Math.sin((t - at) * 4.2) * Math.exp(-(t - at) * 0.8) : 0;
  return (
    <div style={{ position: 'absolute', left: x * k - 24, top: y * k - 24, width: 48, height: 48, borderRadius: 24, background: toneBg[tone], color: toneInk[tone], display: 'grid', placeItems: 'center', font: `800 28px/1 ${FONT}`, transform: `scale(${s * pulse}) rotate(${shrug}deg)`, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>{text}</div>
  );
};

/** Kashfiq's notes on the right: each note springs in on its word, newest at the bottom, two at most so they never
 *  reach his window below. 380 px wide, text 30 px (owner's notes b001-n6, n25: bigger cards). */
const RAIL = { x: 1512, y: 72, w: 380 };
/** A drawn mark for a note's tone: keep = check, fix = alert, ask = question, info = dot. */
const ToneIcon: FC<{ tone: Tone; size?: number }> = ({ tone, size = 22 }) => {
  const ink = tone === 'keep' || tone === 'ask' ? C.forest : '#FFFFFF'; const bg = tone === 'keep' || tone === 'ask' ? C.lime : tone === 'fix' ? C.fix : C.forest;
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden style={{ flex: 'none' }}>
      <circle cx="11" cy="11" r="11" fill={bg} />
      {tone === 'keep' ? <path d="M6.5 11.4l3 3 6-6.6" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {tone === 'fix' ? <><path d="M11 6v6.2" stroke={ink} strokeWidth="2.4" strokeLinecap="round" /><circle cx="11" cy="15.6" r="1.5" fill={ink} /></> : null}
      {tone === 'ask' ? <><path d="M8.3 8.6a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2.9-1.2 1.8v.4" stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" /><circle cx="11" cy="16" r="1.4" fill={ink} /></> : null}
      {tone === 'info' ? <circle cx="11" cy="11" r="3.4" fill={C.lime} /> : null}
    </svg>
  );
};
const Chip: FC<{ tone: Tone; children: ReactNode; dark?: boolean }> = ({ tone, children, dark }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, font: `600 16px/1 ${FONT}`, letterSpacing: '0.02em', color: dark ? 'rgba(255,255,255,0.86)' : C.grey, marginBottom: 12 }}>
    <ToneIcon tone={tone} size={20} />{children}
  </div>
);
const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/\bcta\b/g, 'CTA').replace(/\bdna\b/g, 'DNA').replace(/fibery/g, 'Fibery');
const NoteCard: FC<{ note: Note; shot: Shot; at: number }> = ({ note, shot, at }) => {
  const t = useT(); const s = useSpring(at, 15);
  const light = note.kind === 'steps' || note.kind === 'dna' || note.kind === 'timer' || note.kind === 'concept' || note.kind === 'contrast' || note.tone === 'info' || note.tone === 'keep';
  const bg = note.kind === 'motion' ? C.fix : light ? '#FFFFFF' : note.tone === 'fix' ? C.fix : C.forest;
  const ink = light ? C.ink : '#FFFFFF';
  const body = (() => {
    if (note.kind === 'timer') {
      const stop = cueOf(shot, note.stop, at + 2);
      const v = Math.min(2, Math.max(0, ((Math.min(t, stop) - at) / Math.max(0.1, stop - at)) * 2));
      return (<><div style={{ font: `700 72px/1 ${FONT}`, color: C.forest, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>{v.toFixed(1)} s</div><div style={{ font: `600 26px/1.25 ${FONT}`, color: C.forest, marginTop: 10, opacity: t >= stop ? 1 : 0.35 }}>{note.text}</div></>);
    }
    if (note.kind === 'steps' || note.kind === 'dna') {
      return (
        <div style={{ display: 'grid', gap: 8 }}>
          {note.kind === 'dna' ? <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>{FIBERY_SWATCHES.map((c) => <div key={c} style={{ flex: 1, height: 44, borderRadius: 9, background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />)}</div> : null}
          {(note.steps ?? []).map((st, i) => { const on = t >= cueOf(shot, st.at, at + i); const active = note.kind === 'steps' && on && (i === (note.steps ?? []).length - 1 || t < cueOf(shot, (note.steps ?? [])[i + 1].at, 1e9));
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 11, background: active ? C.forest : on ? 'rgba(0,45,27,0.08)' : 'rgba(0,45,27,0.03)', color: active ? C.lime : C.forest, font: `600 26px/1 ${FONT}`, opacity: on ? 1 : 0.4 }}>
                {note.kind === 'steps' ? <span style={{ width: 10, height: 10, borderRadius: 5, background: active ? C.lime : C.forest, opacity: on ? 1 : 0.4 }} /> : <span style={{ width: 8, height: 8, borderRadius: 4, background: C.forest, opacity: 0.6 }} />}{st.text}
              </div>
            ); })}
        </div>
      );
    }
    if (note.kind === 'motion') {
      const p = (t * 0.9) % 1;
      return (<><div style={{ font: `600 28px/1.22 ${FONT}`, color: '#FFFFFF' }}>{note.text}</div>
        <div style={{ marginTop: 14, height: 96, borderRadius: 12, background: 'rgba(255,255,255,0.16)', position: 'relative', overflow: 'hidden' }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ position: 'absolute', left: 16, top: 16 + i * 26, height: 12, borderRadius: 6, background: '#FFFFFF', width: `${28 + 60 * Math.max(0, Math.min(1, (p * 3 - i * 0.5)))}%`, opacity: 0.88 }} />)}
        </div>
        <div style={{ marginTop: 10, font: `600 15px/1 ${FONT}`, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.86)' }}>Motion concept · Rubik</div></>);
    }
    if (note.kind === 'contrast' && note.cols) {
      const [a, b] = note.cols; const second = enter(t, at + 1.1, 0.45);
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <div><div style={{ font: `600 17px/1 ${FONT}`, color: C.grey, marginBottom: 8 }}>{a.h}</div><div style={{ font: `700 27px/1.18 ${FONT}`, color: C.forest, letterSpacing: '-0.01em' }}>{a.t}</div></div>
          <div style={{ height: 1, background: C.line }} />
          <div style={{ opacity: second, transform: `translateY(${(1 - second) * 10}px)` }}><div style={{ font: `600 17px/1 ${FONT}`, color: C.grey, marginBottom: 8 }}>{b.h}</div><div style={{ font: `700 27px/1.18 ${FONT}`, color: C.fix, letterSpacing: '-0.01em' }}>{b.t}</div></div>
        </div>
      );
    }
    if (note.kind === 'concept') return (<><div style={{ font: `700 30px/1.18 ${FONT}`, color: C.forest, letterSpacing: '-0.01em' }}>{note.text}</div><div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, font: `600 15px/1 ${FONT}`, color: C.forest, letterSpacing: '0.03em' }}><Logo name="mark-on-light" h={16} />Rubik concept</div></>);
    return <div style={{ font: `600 30px/1.2 ${FONT}`, color: ink, letterSpacing: '-0.01em' }}>{note.text}</div>;
  })();
  return (
    <div style={{ transform: `translateX(${(1 - s) * 60}px)`, opacity: Math.min(1, s * 1.4), background: bg, borderRadius: 18, padding: '18px 22px 22px', boxShadow: '0 2px 6px rgba(0,0,0,0.18), 0 18px 40px -8px rgba(0,0,0,0.45)' }}>
      {note.tag ? <Chip tone={note.kind === 'motion' ? 'fix' : note.tone} dark={!light}>{sentence(note.tag)}</Chip> : null}
      {body}
    </div>
  );
};
const Rail: FC<{ notes: Note[]; shot: Shot; top: number }> = ({ notes, shot, top }) => {
  const t = useT();
  const shown = notes.map((n) => ({ n, at: cueOf(shot, n.at, 0.3) })).filter((x) => t >= x.at).slice(-2);
  return <div style={{ position: 'absolute', left: RAIL.x, top, width: RAIL.w, display: 'grid', gap: 16 }}>{shown.map((x, i) => <NoteCard key={x.n.text + x.n.tag + i} note={x.n} shot={shot} at={x.at} />)}</div>;
};

/** pipIn: Kashfiq's window fades in at this shot's start; false when the shot before already showed it in the same
 *  place (v2 restarted the fade at every cut, so the window blinked out for 2 frames: owner notes b001-n8, n27). */
const SiteShot: FC<{ shot: Shot; spec: Site; cut: FilmCut; d0: number; pipIn: boolean }> = ({ shot, spec, cut, d0, pipIn }) => {
  const t = useT(); const len = shot.end - shot.start;
  const k = PAGE.w / 1920;
  const still = spec.to === undefined && SPEC_STATIC.has(spec.cap + spec.from);
  const z = zoomOf(spec, shot, MARKS, CAP_LENGTH, (c, f) => SPEC_STATIC.has(c + f));
  const beats = resolveBeats(spec, shot, MARKS); const bt = beats ? beatAt(beats, t) : undefined;
  const [vx, vy, vw] = bt ? bt.view : viewAt(z, cueOf(shot, z?.at, 0), len, t);
  // Highlights tied to a capture mark move with the page as it scrolls.
  const srcT = bt ? bt.src : srcAt(capPlan(CAP_LENGTH[spec.cap], spec.from, spec.to, len, spec.rate), spec.from, t, still);
  const page = bt ? <BeatCapture cap={spec.cap} src={bt.src} /> : <Capture cap={spec.cap} from={spec.from} to={spec.to} len={len} rate={spec.rate} />;
  const onPage = (box: Box, mark?: string): Box => { const m = mark ? MARKS[spec.cap]?.marks[mark] : undefined; return m ? markBoxAt(box, m.scroll, MARKS[spec.cap].scroll, srcT) : box; };
  const scale = 1920 / vw;
  const pauseAt = spec.pause ? cueOf(shot, spec.pause.at) : 1e9;
  const patchAt = spec.patch ? cueOf(shot, spec.patch.at) : 1e9; const pw = interpolate(t, [patchAt, patchAt + 0.7], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut });
  const morphAt = spec.morph ? cueOf(shot, spec.morph.at) : 1e9; const mu = enter(t, morphAt, 0.6);
  const stripAt = spec.strip ? cueOf(shot, spec.strip.at) : 1e9; const su = enter(t, stripAt, 0.5);
  return (
    <Stage>
      {spec.presence === 'behind' ? <Behind cut={cut} d0={d0} len={len} fadeIn={pipIn} /> : null}
      <Browser url={spec.url}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: PAGE.w, height: PAGE.h, transform: `scale(${scale}) translate(${-vx * k}px, ${-vy * k}px)`, transformOrigin: '0 0' }}>
          {spec.pause ? <Spotlight box={spec.pause.box} at={pauseAt} k={k} pw={PAGE.w} ph={PAGE.h}>{page}</Spotlight> : page}
          {spec.patch && pw > 0 ? (
            <div style={{ position: 'absolute', left: spec.patch.box[0] * k, top: spec.patch.box[1] * k, width: spec.patch.box[2] * k, height: spec.patch.box[3] * k, background: spec.patch.bg, clipPath: `inset(0 ${(1 - pw) * 100}% 0 0)`, padding: 4 }}>
              <div style={{ display: 'inline-block', marginBottom: 10, background: C.forest, color: C.lime, font: `700 11px/1 ${FONT}`, letterSpacing: '0.1em', padding: '6px 8px', borderRadius: 5 }}>{spec.patch.label.toUpperCase()}</div>
              {spec.patch.lines.map((l) => <div key={l} style={{ font: `800 35px/1.08 ${FONT}`, letterSpacing: '-0.02em', color: spec.patch?.ink }}>{l}</div>)}
            </div>
          ) : null}
          {spec.morph && mu > 0 ? (
            <div style={{ position: 'absolute', left: (spec.morph.box[0] + (spec.morph.anchor === 'right' ? spec.morph.box[2] : spec.morph.box[2] / 2)) * k, top: spec.morph.box[1] * k, height: spec.morph.box[3] * k, transform: spec.morph.anchor === 'right' ? 'translateX(-100%)' : 'translateX(-50%)', background: spec.morph.bg, color: spec.morph.ink, borderRadius: 999, display: 'grid', placeItems: 'center', padding: `0 ${16 + 10 * mu}px`, font: `700 ${15}px/1 ${FONT}`, whiteSpace: 'nowrap', boxShadow: `0 0 0 ${3 * mu}px ${C.lime}` }}>
              <span>{mu < 0.5 ? spec.morph.from : spec.morph.to}</span>
            </div>
          ) : null}
          {(spec.rings ?? []).map((r, i) => <Highlight key={i} box={onPage(r.box, r.mark)} at={cueOf(shot, r.at)} out={r.out !== undefined ? cueOf(shot, r.out) : undefined} k={k} scale={scale} />)}
          {(spec.pins ?? []).map((p, i) => <PinMark key={i} x={p.x} y={p.y} tone={p.tone} text={p.text} at={cueOf(shot, p.at)} out={p.out !== undefined ? cueOf(shot, p.out) : undefined} instant={p.instant} k={k} />)}
        </div>
        {spec.timer ? <Stopwatch shot={shot} at={cueOf(shot, spec.timer.at)} stop={cueOf(shot, spec.timer.stop, 2)} text={spec.timer.text} /> : null}
        {spec.strip && su > 0 ? (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '22px 30px', background: C.forest, color: C.white, font: `700 38px/1.15 ${FONT}`, letterSpacing: '-0.02em', transform: `translateY(${(1 - su) * 100}%)`, display: 'flex', alignItems: 'center', gap: 18 }}>
            <span style={{ width: 10, height: 44, borderRadius: 5, background: C.lime }} />{spec.strip.text}
          </div>
        ) : null}
      </Browser>
      <Rail notes={spec.notes ?? []} shot={shot} top={RAIL.y} />
      {spec.presence === 'front' ? <Front shot={shot} fadeIn={pipIn} /> : null}
      {(spec.presence ?? 'pip') === 'pip' ? <PiP cut={cut} d0={d0} len={len} x={RAIL.x + RAIL.w - 300} y={PAGE.y + PAGE.h - 300 + 4} size={300} at={pipIn ? 0 : -1} /> : null}
      {spec.kinetic ? <KineticLine text={spec.kinetic.text} at={cueOf(shot, spec.kinetic.at)} out={cueOf(shot, spec.kinetic.out, len - 0.05)} /> : null}
    </Stage>
  );
};

// ---------------------------------------------------------------- A-roll shot with its graphics
const ARollShot: FC<{ shot: Shot; spec: Extract<typeof SPEC[number], { type: 'aroll' }>; cut: FilmCut; d0: number }> = ({ shot, spec, cut, d0 }) => {
  const t = useT(); const len = shot.end - shot.start;
  const soft = spec.soft ? enter(t, 0, 0.7) : 1;
  return (
    <AbsoluteFill style={{ fontFamily: FONT, background: C.forest }}>
      <AbsoluteFill style={{ opacity: soft, filter: soft < 1 ? `blur(${(1 - soft) * 18}px)` : undefined, transform: `scale(${1.04 - 0.04 * soft})` }}><ARollAt cut={cut} d0={d0} len={len} /></AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(130% 100% at 50% 40%, transparent 60%, rgba(0,0,0,0.28) 100%)' }} />
      {spec.lower ? (() => { const at = cueOf(shot, spec.lower.at); const u = enter(t, at, 0.6); const out = 1 - enter(t, len - 0.4, 0.35); return (
        <div style={{ position: 'absolute', left: 96, bottom: 150, display: 'flex', alignItems: 'center', gap: 22, background: C.forest, borderRadius: 18, padding: '20px 30px 20px 22px', clipPath: `inset(0 ${(1 - u) * 100}% 0 0 round 18px)`, opacity: out, boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
          <div style={{ width: 64, height: 64, borderRadius: 14, background: C.forest2, display: 'grid', placeItems: 'center' }}><Logo name="mark-on-dark" h={38} /></div>
          <div><div style={{ font: `700 40px/1.05 ${FONT}`, color: C.white, letterSpacing: '-0.02em' }}>{spec.lower.name}</div><div style={{ font: `600 19px/1 ${FONT}`, color: C.lime, letterSpacing: '0.08em', marginTop: 10, textTransform: 'uppercase' }}>{spec.lower.role}</div></div>
        </div>); })() : null}
      {spec.pills ? (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center', gap: 22 }}>
          {spec.pills.map((p, i) => { const s = useSpringSafe(shot, p.at, t, i); return (
            <div key={p.logo} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', borderRadius: 999, padding: '20px 34px', boxShadow: '0 16px 40px rgba(0,0,0,0.3)', transform: `translateY(${(1 - s) * -30}px) scale(${0.9 + 0.1 * s})`, opacity: Math.min(1, s * 1.5) }}>
              <Logo name={p.logo} h={44} />{p.text ? <span style={{ font: `600 24px/1 ${FONT}`, color: C.grey }}>{p.text}</span> : null}
            </div>); })}
        </div>
      ) : null}
      {spec.labels ? (
        <div style={{ position: 'absolute', right: 88, top: 150, display: 'grid', gap: 16, width: 580 }}>
          {spec.labels.map((l, i) => { const at = cueOf(shot, l.at, i); const s = enter(t, at, 0.45); return (
            <div key={l.text} style={{ display: 'flex', alignItems: 'center', gap: 18, background: 'rgba(0,45,27,0.94)', color: C.white, borderRadius: 18, padding: '22px 26px', font: `600 34px/1.15 ${FONT}`, letterSpacing: '-0.01em', boxShadow: '0 2px 6px rgba(0,0,0,0.2), 0 18px 40px -10px rgba(0,0,0,0.5)', transform: `translateX(${(1 - s) * 40}px)`, opacity: s }}>
              <span style={{ width: 12, height: 12, borderRadius: 6, background: C.lime, flex: 'none' }} />{l.text}
            </div>); })}
        </div>
      ) : null}
      {spec.tag ? (() => { const at = cueOf(shot, spec.tag.at); const u = enter(t, at, 0.5); return (
        <div style={{ position: 'absolute', left: 88, top: 88, background: C.lime, color: C.forest, font: `700 40px/1.12 ${FONT}`, borderRadius: 18, padding: '22px 28px', maxWidth: 780, boxShadow: '0 2px 6px rgba(0,0,0,0.2), 0 18px 40px -10px rgba(0,0,0,0.45)', transform: `translateY(${(1 - u) * -20}px)`, opacity: u, letterSpacing: '-0.01em' }}>{spec.tag.text}</div>); })() : null}
      {spec.cta ? (() => { const at = cueOf(shot, spec.cta.at); const s = useSpringSafe(shot, spec.cta.at, t, 0); const typed = Math.floor(Math.max(0, (t - at - 0.5) * 22)); return (
        <div style={{ position: 'absolute', right: 96, top: 150, width: 560, background: C.forest, borderRadius: 24, padding: 32, transform: `translateX(${(1 - s) * 120}px)`, opacity: Math.min(1, s * 1.5), boxShadow: '0 30px 70px rgba(0,0,0,0.4)' }}>
          <div style={{ font: `700 46px/1.05 ${FONT}`, color: C.white, letterSpacing: '-0.025em' }}>{spec.cta.title}</div>
          <div style={{ marginTop: 22, background: '#FFFFFF', borderRadius: 12, padding: '16px 18px', font: `500 24px/1 ${FONT}`, color: C.ink, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ color: C.grey }}>💬</span>{'yourstartup.com'.slice(0, typed)}<span style={{ width: 2, height: 26, background: C.ink, opacity: Math.floor(t * 2) % 2 }} /></div>
          <div style={{ marginTop: 16, font: `600 22px/1.2 ${FONT}`, color: C.lime }}>{spec.cta.sub}</div>
        </div>); })() : null}
      {spec.sign ? <div style={{ position: 'absolute', left: 64, bottom: 56, opacity: enter(t, 0.3, 0.6) }}><Logo name="wordmark-on-dark" h={34} /></div> : null}
      {spec.kinetic ? <KineticLine text={spec.kinetic.text} at={cueOf(shot, spec.kinetic.at)} out={cueOf(shot, spec.kinetic.out, len - 0.05)} /> : null}
    </AbsoluteFill>
  );
};
const useSpringSafe = (shot: Shot, c: Cue, t: number, i: number) => { const at = cueOf(shot, c, i * 0.3); const u = Math.max(0, t - at); return u <= 0 ? 0 : 1 - Math.exp(-u * 9) * Math.cos(u * 11); };

// ---------------------------------------------------------------- cards
/** The cold open (owner's note b001-n1). */
const ColdOpen: FC<{ c: Extract<Card, { type: 'coldopen' }>; shot: Shot; cut: FilmCut; d0: number; len: number }> = ({ c, shot, cut, d0, len }) => {
  const t = useT();
  const side = cueOf(shot, 'Can', 1.4);
  const u = interpolate(t, [side, side + 0.85], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut });
  // Kashfiq: full frame, then a tall panel on the left, his face kept on the panel's centre line.
  const P = { x: 64 * u, y: 64 * u, w: 1920 + (760 - 1920) * u, h: 1080 + (952 - 1080) * u };
  const sc = P.h / 1080;
  // The question types on with his words, then rises to sit over the site.
  const qa = cueOf(shot, 'What', 0.1); const qb = cueOf(shot, 'do?', 1.0) + 0.25;
  const typed = Math.floor(interpolate(t, [qa, qb], [0, c.question.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const qOut = 1 - enter(t, cueOf(shot, 'because', 3.9), 0.35);
  const qx = 960 + (1368 - 960) * u; const qy = 820 + (150 - 820) * u; const qs = 104 + (58 - 104) * u;
  // The site springs in on the right, playing from the start of the tour.
  const b = useSpringSafe(shot, side + 0.2, t, 0); const BW = { x: 880, y: 300, w: 976 };
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 18% 10%, ${C.forest2} 0%, ${C.forest} 58%, #001A10 100%)`, fontFamily: FONT }}>
      <div style={{ position: 'absolute', left: P.x, top: P.y, width: P.w, height: P.h, overflow: 'hidden', borderRadius: 28 * u, boxShadow: u > 0 ? `0 2px 6px rgba(0,0,0,${0.25 * u}), 0 28px 70px -12px rgba(0,0,0,${0.55 * u})` : undefined }}>
        <div style={{ position: 'absolute', left: P.w / 2 - 960 * sc, top: 0, width: 1920, height: 1080, transform: `scale(${sc})`, transformOrigin: '0 0' }}><ARollAt cut={cut} d0={d0} len={len} /></div>
        <AbsoluteFill style={{ background: `linear-gradient(transparent 45%, rgba(0,20,12,${0.7 * (1 - u)}) 100%)` }} />
      </div>
      {t >= side + 0.1 ? (
        <Sequence from={sec(side + 0.1)} layout="none">
          <Browser url={c.url} at={BW} style={{ opacity: Math.min(1, b * 1.4), transform: `translateY(${(1 - b) * 60}px) scale(${0.86 + 0.14 * b})`, transformOrigin: '50% 60%' }}>
            <Capture cap={c.cap} from={c.from} to={c.to} len={len - side - 0.1} />
          </Browser>
        </Sequence>
      ) : null}
      {qOut > 0 ? (
        <div style={{ position: 'absolute', left: qx, top: qy, transform: 'translate(-50%, -50%)', whiteSpace: 'nowrap', opacity: qOut, font: `800 ${qs}px/1 ${FONT}`, letterSpacing: '-0.035em', color: C.white, textShadow: u < 1 ? `0 4px 30px rgba(0,0,0,${0.5 * (1 - u)})` : undefined }}>
          {[...c.question].map((ch, i) => (
            <span key={i} style={{ position: 'relative', opacity: i < typed ? 1 : 0, color: i > c.question.lastIndexOf(' ') ? C.lime : undefined }}>{ch}
              {i === typed - 1 && typed < c.question.length ? <span style={{ position: 'absolute', left: '100%', top: '6%', bottom: '6%', width: '0.06em', marginLeft: '0.04em', background: C.lime, opacity: 1 }} /> : null}
            </span>))}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
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
/** Chapter card (owner's note b001-n7): the site's logo is the hero, large and white; a counter in the corner says
 *  which of the three sites this is; the card pushes out in its last 0.3 s. */
const ChapterCard: FC<{ c: Extract<Card, { type: 'chapter' }>; len: number }> = ({ c, len }) => {
  const t = useT(); const wipe = interpolate(t, [0, 0.45], [100, 0], { extrapolateRight: 'clamp', easing: ease });
  const l = enter(t, 0.2, 0.7); const n = enter(t, 0.45, 0.5); const p = enter(t, 0.6, 0.6);
  const out = enter(t, len - 0.3, 0.3);
  return (
    <AbsoluteFill style={{ clipPath: `inset(${wipe}% 0 0 0)` }}>
      <Stage tone="dark">
        <AbsoluteFill style={{ transform: `scale(${1 + 0.04 * out})`, opacity: 1 - out }}>
          <div style={{ position: 'absolute', left: 150, top: 132, display: 'flex', alignItems: 'baseline', gap: 10, opacity: n, font: `700 44px/1 ${FONT}`, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: C.lime }}>{c.n}</span><span style={{ color: C.mint, opacity: 0.6 }}>/ 03</span>
          </div>
          <div style={{ position: 'absolute', left: 150, top: 380, clipPath: `inset(${(1 - l) * 100}% 0 0 0)`, transform: `translateY(${(1 - l) * 40}px)` }}><Logo name={`${c.logo}-white`} h={170} /></div>
          <div style={{ position: 'absolute', left: 150, top: 640, display: 'flex', gap: 12, opacity: p }}>
            {[1, 2, 3].map((i) => <div key={i} style={{ width: i === c.of ? 72 * p : 18, height: 8, borderRadius: 4, background: i === c.of ? C.lime : i < c.of ? C.mint : 'rgba(255,255,255,0.18)' }} />)}
          </div>
        </AbsoluteFill>
      </Stage>
    </AbsoluteFill>
  );
};
const MaximCard: FC<{ c: Extract<Card, { type: 'maxim' }>; shot: Shot }> = ({ c, shot }) => {
  const t = useT();
  if (c.kinetic) return <Stage tone="dark"><KineticLine text={c.kinetic.text} at={cueOf(shot, c.kinetic.at)} out={cueOf(shot, c.kinetic.out, shot.end - shot.start + 1)} /></Stage>;
  return (
    <Stage tone="dark">
      <AbsoluteFill style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ width: 1500 }}>
          {c.lines.map((l, i) => { const at = cueOf(shot, l.at, i * 0.6); const u = enter(t, at, 0.5); const st = l.strike ? enter(t, at + 0.45, 0.4) : 0; const pop = l.hi ? useSpringSafe(shot, at, t, 0) : 1; return (
            <div key={i} style={{ position: 'relative', display: 'table', font: `800 ${l.hi ? 128 : c.lines.length > 2 ? 96 : 132}px/1.08 ${FONT}`, letterSpacing: '-0.04em', color: l.hi ? C.lime : C.white, opacity: u * (1 - 0.55 * st), transform: `translateY(${(1 - u) * 36}px) scale(${l.hi ? 0.92 + 0.08 * pop : 1})`, transformOrigin: '0 50%', marginTop: l.hi ? 28 : 0 }}>
              {l.text}{l.strike ? <span style={{ position: 'absolute', left: -6, top: '54%', height: 10, width: `calc(${st * 100}% + 12px)`, background: C.lime, borderRadius: 5 }} /> : null}
            </div>); })}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 26, background: '#FFFFFF', borderRadius: 20, padding: '26px 30px', boxShadow: '0 2px 4px rgba(0,0,0,0.05), 0 14px 30px -8px rgba(0,0,0,0.14)', opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
              <Tag tone={r.tone} size={20}>{r.tone === 'keep' ? 'Keep' : 'Fix'}</Tag>
              <span style={{ font: `700 46px/1.1 ${FONT}`, color: C.ink, letterSpacing: '-0.025em' }}>{r.text}</span>
            </div></div>); })}
        </div>
        <PiP cut={cut} d0={d0} len={len} x={1480} y={640} size={340} at={0.3} />
      </Stage>
    </AbsoluteFill>
  );
};
/** How visitors find the price (b001-n32): the two paths as a diagram, and beside each a live example playing in
 *  step with it. Most sites: home, then a click on Pricing loads a new page. Slite: the prices are already on the
 *  homepage, a scroll away. No window of Kashfiq here. */
const PathCard: FC<{ shots: Shot[]; first: Shot }> = ({ shots, first }) => {
  const t = useT();
  const at = (word: string, d: number) => groupCueTime(shots, word, first.start, d);
  const Node: FC<{ text: string; on: number; hi?: boolean }> = ({ text, on, hi }) => (
    <div style={{ background: hi ? C.forest : '#FFFFFF', color: hi ? C.lime : C.ink, borderRadius: 18, padding: '22px 28px', font: `700 36px/1 ${FONT}`, boxShadow: '0 2px 4px rgba(0,0,0,0.05), 0 14px 30px -8px rgba(0,0,0,0.14)', opacity: on, transform: `scale(${0.9 + 0.1 * on})`, whiteSpace: 'nowrap' }}>{text}</div>
  );
  const Arrow: FC<{ on: number; label?: string; tone?: Tone }> = ({ on, label, tone }) => (
    <div style={{ position: 'relative', width: 120, height: 40 }}>
      <div style={{ position: 'absolute', left: 8, top: 18, height: 4, width: 96 * on, background: C.grey, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: 96, top: 10, width: 0, height: 0, borderLeft: `16px solid ${C.grey}`, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', opacity: on }} />
      {label ? <div style={{ position: 'absolute', left: 4, top: -46, opacity: on, whiteSpace: 'nowrap' }}><Tag tone={tone ?? 'fix'} size={17}>{label}</Tag></div> : null}
    </div>
  );
  const r1 = at('most', 0.2); const r1b = at('page.', r1 + 2); const r1c = at('click.', r1 + 4);
  const r2 = at('inserted', 7); const r2b = at('glimpse', r2 + 2); const r2c = at('answers', r2 + 4);
  const B1 = { x: 1210, y: 196, w: 620 }; const B2 = { x: 1210, y: 640, w: 620 }; const k = 620 / 1920;
  // Most sites: the home page; the cursor goes to Pricing and clicks; the pricing page loads.
  const link: Box = [1071.8, 16, 67.8, 32]; const cx = interpolate(t, [r1b - 0.9, r1b - 0.15], [1500, link[0] + link[2] / 2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut });
  const cy = interpolate(t, [r1b - 0.9, r1b - 0.15], [700, link[1] + link[3] / 2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: inOut });
  const onPricing = t >= r1b;
  const b2 = resolveBeats({ cap: 'slite-tour', beats: [{ at: 0, src: 52.0 }, { at: 0, src: 56.4 }] }, { start: 0, words: [] }, MARKS);
  const beats2 = b2 ? [{ ...b2[0], t: r2 }, { ...b2[1], t: r2b }] : [];
  return (
    <Stage tone="light">
      <div style={{ position: 'absolute', left: 110, top: 104, font: `800 52px/1 ${FONT}`, letterSpacing: '-0.03em', color: C.ink }}>How visitors find the price</div>
      <div style={{ position: 'absolute', left: 110, top: 290 }}>
        <div style={{ font: `600 28px/1 ${FONT}`, color: C.grey, marginBottom: 22, opacity: enter(t, r1) }}>Most SaaS sites</div>
        <div style={{ display: 'flex', alignItems: 'center' }}><Node text="Home" on={enter(t, r1)} /><Arrow on={enter(t, r1b)} /><Node text="Pricing page" on={enter(t, r1b)} /><Arrow on={enter(t, r1c)} label="+1 click" /><Node text="Answer" on={enter(t, r1c)} /></div>
      </div>
      <div style={{ position: 'absolute', left: 110, top: 734 }}>
        <div style={{ font: `600 28px/1 ${FONT}`, color: C.forest, marginBottom: 22, opacity: enter(t, r2) }}>Slite</div>
        <div style={{ display: 'flex', alignItems: 'center' }}><Node text="Home" on={enter(t, r2)} /><Arrow on={enter(t, r2b)} label="in the scroll" tone="keep" /><Node text="Answer" on={enter(t, r2c)} hi /></div>
      </div>
      <Browser url={onPricing ? 'folk.app/pricing' : 'folk.app'} at={B1} style={{ opacity: enter(t, r1 - 0.2), transform: `translateY(${(1 - enter(t, r1 - 0.2)) * 30}px)` }}>
        <BeatCapture cap={onPricing ? 'folk-pricing' : 'folk-hero'} src={onPricing ? 13.2 : 0.7} />
        {!onPricing && t >= r1b - 0.9 ? <svg width="22" height="30" viewBox="0 0 22 30" style={{ position: 'absolute', left: cx * k, top: cy * k, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}><path d="M2 2v22l6-6 4 10 4-2-4-10h8z" fill="#111" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg> : null}
        {onPricing ? <Highlight box={[323, 358, 1281, 536]} at={r1c} k={k} scale={1} /> : null}
      </Browser>
      <Browser url="slite.com" at={B2} style={{ opacity: enter(t, r2 - 0.2), transform: `translateY(${(1 - enter(t, r2 - 0.2)) * 30}px)` }}>
        {beats2.length ? <BeatCapture cap="slite-tour" src={beatAt(beats2, t, 1.4).src} /> : null}
        <Highlight box={[350, 730, 1218, 272]} at={r2c} k={k} scale={1} />
      </Browser>
    </Stage>
  );
};
/** What we learned (b001-n38, n39): each lesson with its own proof playing beside it, a real page with what the
 *  lesson is about marked. Number and words share one size and baseline. No window of Kashfiq. */
const LessonsCard: FC<{ c: Extract<Card, { type: 'lessons' }>; shots: Shot[]; first: Shot }> = ({ c, shots, first }) => {
  const t = useT();
  const at = (cue: Cue | undefined, d: number) => (cue === undefined ? d : groupCueTime(shots, cue, first.start, d));
  const live = c.rules.filter((r) => !r.dim && r.proof);
  const BW = { x: 1030, y: 330, w: 800 }; const k = 800 / 1920;
  return (
    <Stage tone="dark">
      <div style={{ position: 'absolute', left: 120, top: 200, width: 840, display: 'grid', gap: 48 }}>
        {c.rules.map((r, i) => { const a = at(r.at, i); const u = enter(t, a, 0.55); const sb = enter(t, at(r.sub_at, a + 1.5), 0.5); const sz = r.dim ? 48 : 72; return (
          <div key={i} style={{ opacity: u * (r.dim ? 0.4 : 1), transform: `translateY(${(1 - u) * 30}px)` }}>
            <div style={{ display: 'flex', gap: 22, alignItems: 'baseline', font: `800 ${sz}px/1.06 ${FONT}`, letterSpacing: '-0.035em' }}>
              <span style={{ color: C.lime, fontVariantNumeric: 'tabular-nums' }}>{r.n}</span><span style={{ color: C.white }}>{r.text}</span>
            </div>
            {r.sub && !r.dim ? <div style={{ marginLeft: sz * 0.6 + 22, marginTop: 18, font: `600 34px/1.25 ${FONT}`, color: C.lime, opacity: sb }}>{r.sub}</div> : null}
          </div>); })}
      </div>
      {live.map((r, i) => { const a = at(r.at, 0); const u = enter(t, a + 0.3, 0.6); const p = r.proof!; const sub = at(r.sub_at, a + 1.5); return (
        <Sequence key={i} from={sec(a + 0.3)} layout="none">
          <Browser url={p.url} at={BW} style={{ opacity: u, transform: `translateX(${(1 - u) * 60}px) rotate(${(1 - u) * 2}deg)` }}>
            <ProofPage p={p} k={k} ringAt={Math.max(0.4, sub - a - 0.3)} />
          </Browser>
        </Sequence>); })}
    </Stage>
  );
};
const ProofPage: FC<{ p: Proof; k: number; ringAt: number }> = ({ p, k, ringAt }) => {
  const t = useT();
  return (
    <>
      <BeatCapture cap={p.cap} src={p.src + t * (p.play ?? 0)} />
      {p.ring ? <Highlight box={p.ring} at={ringAt} k={k} scale={1} /> : null}
      {p.pin ? <PinMark x={p.pin.x} y={p.pin.y} tone={p.pin.tone} text={p.pin.text} at={ringAt + 0.6} k={k} /> : null}
    </>
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
      if (cur.length && (len + w.w.length > 30 || gap > 0.45)) push();
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
    <div style={{ position: 'absolute', left: cx, bottom: onSite ? 30 : 60, transform: 'translateX(-50%)', background: `linear-gradient(${C.forest2}, ${C.forest})`, borderRadius: 18, padding: onSite ? '12px 24px' : '16px 28px', whiteSpace: 'nowrap', font: `${B.captions.weight} ${onSite ? 44 : 56}px/1.15 ${FONT}`, letterSpacing: '-0.01em', boxShadow: '0 12px 30px rgba(0,0,0,0.35)' }}>
      {line.words.map((w, i) => { const said = t >= w.t0; const now = said && t < w.t1 + 0.08; return <span key={i} style={{ color: now ? C.lime : said ? C.white : 'rgba(255,255,255,0.45)' }}>{w.w}{i < line.words.length - 1 ? ' ' : ''}</span>; })}
    </div>
  );
};

// ---------------------------------------------------------------- the film
const Inner: FC<z.infer<typeof RubikEp1Schema>> = ({ captions, audio, plate }) => {
  const cut = useFilmCut();
  const shots = T.shots;
  const dOf = (filmT: number) => { // dialogue time at a film time
    let seg = T.voice[0]; for (const v of T.voice) if (filmT >= v.at - 1e-6) seg = v; return filmT - seg.at + seg.d0;
  };
  const hide = new Set([1, 7, 39]); // S01's question is typed on screen; S07 and S39 are typed lines
  const lines = useMemo(() => buildLines(shots, hide), []); // eslint-disable-line react-hooks/exhaustive-deps
  const siteRanges = useMemo(() => shots.filter((s) => ['site', 'verdict', 'path', 'lessons'].includes((SPEC[s.n] as { type: string }).type) || ((SPEC[s.n] as { type: string }).type === 'cont' && s.n > 3)).map((s) => [s.start, s.end] as [number, number]), [shots]);
  if (!cut) return null;
  const group = (first: number, until: number) => shots.filter((s) => s.n >= first && s.n <= until && s.voice);
  // plate: only the centred A-roll, for cutting Kashfiq out (build/matte_front.sh renders it for the 'front' shots).
  if (plate) return <AbsoluteFill style={{ background: '#000' }}>{shots.map((s, i) => <Sequence key={i} from={sec(s.start)} durationInFrames={Math.max(1, sec(s.end) - sec(s.start))}><ARollAt cut={cut} d0={dOf(s.start)} len={s.end - s.start} /></Sequence>)}</AbsoluteFill>;
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
        if (spec.type === 'site') { const prev = i > 0 ? SPEC[shots[i - 1].n] : undefined; body = <SiteShot shot={s} spec={spec} cut={cut} d0={d0} pipIn={!prev || prev.type !== 'site' || (prev.presence ?? 'pip') !== (spec.presence ?? 'pip')} />; }
        else if (spec.type === 'aroll') body = <ARollShot shot={s} spec={spec} cut={cut} d0={d0} />;
        else if (spec.type === 'title') body = <TitleCard />;
        else if (spec.type === 'coldopen') body = <ColdOpen c={spec} shot={s} cut={cut} d0={d0} len={len} />;
        else if (spec.type === 'chapter') body = <ChapterCard c={spec} len={len} />;
        else if (spec.type === 'maxim') body = <MaximCard c={spec} shot={s} />;
        else if (spec.type === 'verdict') body = <VerdictCard c={spec} shots={group(s.n, spec.until)} first={s} cut={cut} d0={d0} len={len} />;
        else if (spec.type === 'path') body = <PathCard shots={group(s.n, spec.until)} first={s} />;
        else if (spec.type === 'lessons') body = <LessonsCard c={spec} shots={group(s.n, spec.until ?? s.n)} first={s} />;
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
  <BrandProvider brand="rubik"><MotionProvider preset="calm"><Inner {...props} /></MotionProvider></BrandProvider>
);
