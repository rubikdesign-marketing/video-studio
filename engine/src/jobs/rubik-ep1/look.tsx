// Episode 1's shared look: brand tokens and the pieces every scene uses (the browser window, highlights, cards).
// Colours, fonts and logos come only from brands/rubik/brand.json.
import type { CSSProperties, FC, ReactNode } from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { brandFiles } from '../../brands';
import { getBrand } from '../../kit/brand';
import { perimeterPoint } from './lib';
import type { Box, Tone } from './spec';

// ---------------------------------------------------------------- brand (brands/rubik/brand.json)
export const B = getBrand('rubik');
const other = (brandFiles.rubik as unknown as { colours: { other: Record<string, string> } }).colours.other;
export const C = {
  forest: B.stages.dark.page, forest2: B.stages.dark.soft, lime: B.stages.dark.accent, canvas: B.stages.light.page,
  ink: B.stages.light.ink, grey: B.stages.light.second, line: B.stages.light.line, chip: B.stages.light.soft,
  white: B.stages.dark.ink, mint: B.stages.dark.second, fix: other.fix, ask: other.question,
};
export const FONT = `${B.fonts.headline.family}, Inter, system-ui, sans-serif`;
export const toneBg: Record<Tone, string> = { keep: C.lime, fix: C.fix, ask: C.ask, info: C.white };
export const toneInk: Record<Tone, string> = { keep: C.forest, fix: '#FFFFFF', ask: '#FFFFFF', info: C.ink };
export const toneLine: Record<Tone, string> = { keep: C.lime, fix: C.fix, ask: C.ask, info: C.white };


// ---------------------------------------------------------------- the browser window
/** The page area of the browser window (16:9). Every page box in spec.ts is drawn inside it. */
export const PAGE = { x: 64, y: 108, w: 1424, h: 801 };
export const BAR = 44;

/** A quiet browser window: hairline chrome, the address centred, a soft two-layer shadow. No date label (the owner's
 *  note b001-n4). */
export const Browser: FC<{ url: string; children: ReactNode; at?: { x: number; y: number; w: number }; style?: CSSProperties }> = ({ url, children, at = PAGE, style }) => (
  <div style={{ position: 'absolute', left: at.x, top: at.y - BAR, width: at.w, height: (at.w * 9) / 16 + BAR, borderRadius: 20, overflow: 'hidden', background: '#FFFFFF', ...style,
    boxShadow: '0 2px 6px rgba(0,0,0,0.22), 0 28px 70px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10)' }}>
    <div style={{ position: 'relative', height: BAR, background: 'linear-gradient(#FAFAF8, #F1F2EE)', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', padding: '0 18px' }}>
      <div style={{ display: 'flex', gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: '#DADDD6', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }} />)}</div>
      <div style={{ position: 'absolute', left: '50%', top: 7, transform: 'translateX(-50%)', height: 30, minWidth: 440, borderRadius: 9, background: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '0 18px', font: `500 16px/1 ${FONT}`, color: C.ink, letterSpacing: '0.005em' }}>
        <svg width="11" height="13" viewBox="0 0 12 14" aria-hidden><rect x="1" y="6" width="10" height="7" rx="1.8" fill={C.grey} /><path d="M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6" stroke={C.grey} strokeWidth="1.6" fill="none" /></svg>
        {url}
      </div>
    </div>
    <div style={{ position: 'absolute', left: 0, top: BAR, width: at.w, height: (at.w * 9) / 16, overflow: 'hidden', background: '#FFFFFF' }}>{children}</div>
  </div>
);

// ---------------------------------------------------------------- highlight and spotlight (drawn inside the page)
const useSec = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const outE = Easing.bezier(0.22, 1, 0.36, 1);
const span = (t: number, a: number, d: number, e = inOut) => interpolate(t, [a, a + d], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e });
/** The gap the line leaves around what it marks, in page-area px (tools/checks/outline_clear.py checks it is clear). */
export const HL_PAD = 10;

/** The highlight (owner's note b001-n23): a lime dot appears at the top-left corner, runs clockwise and draws the
 *  whole border in one stroke, then rests as a thin neon line. No fill, the same for every tone (the notes say
 *  keep or fix). `k` maps page px to the page area; `scale` is the zoom, so the line stays the same width on screen. */
export const Highlight: FC<{ box: Box; at: number; out?: number; k: number; scale: number }> = ({ box, at, out, k, scale }) => {
  const t = useSec();
  const u = span(t, at, 0.9); const gone = out !== undefined ? 1 - span(t, out, 0.35, outE) : 1;
  if (t < at || gone <= 0) return null;
  const sw = 4 / scale; const rx = 14; const pad = HL_PAD;
  const [x, y, w, h] = [box[0] * k - pad, box[1] * k - pad, box[2] * k + pad * 2, box[3] * k + pad * 2];
  const per = 2 * (w + h);
  const [dx, dy] = perimeterPoint(w, h, (u * per + rx) / per);
  const dot = u < 1 ? 1 : 1 - span(t, at + 0.9, 0.25, outE);
  const appear = span(t, at, 0.12, outE);
  const m = 12 / scale;
  return (
    <svg style={{ position: 'absolute', left: x - m, top: y - m, width: w + m * 2, height: h + m * 2, overflow: 'visible', opacity: gone, filter: `drop-shadow(0 0 ${5 / scale}px ${C.lime}AA)` }}>
      <rect x={m} y={m} width={w} height={h} rx={rx} fill="none" stroke={C.lime} strokeWidth={sw} strokeDasharray={per} strokeDashoffset={per * (1 - u)} strokeLinecap="round" />
      {dot > 0 ? <circle cx={m + dx} cy={m + dy} r={(5.5 / scale) * appear} fill="#FFFFFF" stroke={C.lime} strokeWidth={2.5 / scale} opacity={dot} /> : null}
    </svg>
  );
};

/** Spotlight (owner's note b001-n33): the page sinks into a dark blur and only the box stays sharp, with no border
 *  and no badge. It takes the page itself as children and draws it twice: blurred and dimmed underneath, sharp
 *  through a rounded hole (a backdrop blur also softened what showed through the hole). pw x ph is the page area. */
export const Spotlight: FC<{ box: Box; at: number; k: number; pw: number; ph: number; children: ReactNode }> = ({ box, at, k, pw, ph, children }) => {
  const t = useSec(); const u = span(t, at, 0.5, outE);
  if (u <= 0) return <>{children}</>;
  const p = 8; const r = 14;
  const [x, y, w, h] = [box[0] * k - p, box[1] * k - p, box[2] * k + p * 2, box[3] * k + p * 2];
  const hole = `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  const layer = { position: 'absolute', left: 0, top: 0, width: pw, height: ph } as const;
  return (
    <>
      <div style={{ ...layer, filter: `blur(${7 * u}px) brightness(${1 - 0.62 * u}) saturate(${1 - 0.4 * u})` }}>{children}</div>
      <div style={{ ...layer, clipPath: `path('${hole}')` }}>{children}</div>
    </>
  );
};

// ---------------------------------------------------------------- kinetic line (owner's note b001-n24)
/** One important line on a full-frame forest scrim: typed in left to right at 90% size, then, once the sentence is
 *  complete, it grows to fill the frame and its starred words (*word*) turn lime. ' / ' breaks the line. Typing
 *  takes at most 45% of the time it has (never more than 1.3 s), so it always finishes while he is still on the
 *  line; the type is sized so the longest line spans about 1550 px. `out` is when it leaves (0.3 s fade). */
export const KineticLine: FC<{ text: string; at: number; out: number }> = ({ text, at, out }) => {
  const t = useSec();
  const lines = text.split(' / ').map((l) => l.split(/(\*[^*]+\*)/).filter(Boolean).map((p) => ({ s: p.replace(/\*/g, ''), hi: p.startsWith('*') })));
  const plain = lines.map((l) => l.map((p) => p.s).join(''));
  const total = plain.reduce((a, l) => a + l.length, 0);
  const typeFor = Math.min(1.3, Math.max(0.5, (out - at) * 0.45));
  const typed = Math.floor(span(t, at, typeFor, (x) => x) * total + 1e-6);
  const grow = span(t, at + typeFor + 0.08, 0.5, outE);
  const scrim = span(t, at - 0.25, 0.3, outE) * (1 - span(t, out, 0.3, outE));
  if (scrim <= 0) return null;
  const size = Math.min(190, Math.max(96, 1550 / (0.47 * Math.max(...plain.map((l) => l.length)))));
  let n = 0;
  return (
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(120% 100% at 50% 40%, ${C.forest2}F2, ${C.forest}FA 70%)`, opacity: scrim, display: 'grid', placeItems: 'center' }}>
      <div style={{ transform: `scale(${0.9 + 0.1 * grow})`, textAlign: 'center', font: `800 ${size}px/1.02 ${FONT}`, letterSpacing: '-0.04em', color: C.white }}>
        {lines.map((l, i) => (
          <div key={i} style={{ whiteSpace: 'nowrap' }}>
            {l.map((p, j) => (
              <span key={j} style={{ color: p.hi && grow > 0 ? `color-mix(in srgb, ${C.lime} ${Math.round(grow * 100)}%, ${C.white})` : undefined }}>
                {[...p.s].map((ch, k) => { const idx = n++; const on = idx < typed; const caret = grow < 1 && idx === typed - 1;
                  return <span key={k} style={{ position: 'relative', opacity: on ? 1 : 0 }}>{ch}{caret ? <span style={{ position: 'absolute', left: '100%', top: '8%', bottom: '8%', width: '0.06em', marginLeft: '0.04em', background: C.lime }} /> : null}</span>; })}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
