// Episode 1's shared look: brand tokens and the pieces every scene uses (the browser window, highlights, cards).
// Colours, fonts and logos come only from brands/rubik/brand.json.
import type { FC, ReactNode } from 'react';
import { brandFiles } from '../../brands';
import { getBrand } from '../../kit/brand';
import type { Tone } from './spec';

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
export const Browser: FC<{ url: string; children: ReactNode }> = ({ url, children }) => (
  <div style={{ position: 'absolute', left: PAGE.x, top: PAGE.y - BAR, width: PAGE.w, height: PAGE.h + BAR, borderRadius: 20, overflow: 'hidden', background: '#FFFFFF',
    boxShadow: '0 2px 6px rgba(0,0,0,0.22), 0 28px 70px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.10)' }}>
    <div style={{ position: 'relative', height: BAR, background: 'linear-gradient(#FAFAF8, #F1F2EE)', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', padding: '0 18px' }}>
      <div style={{ display: 'flex', gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 6, background: '#DADDD6', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }} />)}</div>
      <div style={{ position: 'absolute', left: '50%', top: 7, transform: 'translateX(-50%)', height: 30, minWidth: 440, borderRadius: 9, background: '#FFFFFF', boxShadow: `inset 0 0 0 1px ${C.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '0 18px', font: `500 16px/1 ${FONT}`, color: C.ink, letterSpacing: '0.005em' }}>
        <svg width="11" height="13" viewBox="0 0 12 14" aria-hidden><rect x="1" y="6" width="10" height="7" rx="1.8" fill={C.grey} /><path d="M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6" stroke={C.grey} strokeWidth="1.6" fill="none" /></svg>
        {url}
      </div>
    </div>
    <div style={{ position: 'absolute', left: 0, top: BAR, width: PAGE.w, height: PAGE.h, overflow: 'hidden', background: '#FFFFFF' }}>{children}</div>
  </div>
);
