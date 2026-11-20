import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast, parseColor, readBlock, resolve, type Tokens } from './contrast';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const night = readBlock(css, ':root');
const themes: Record<string, Tokens> = {
  night,
  paper: { ...night, ...readBlock(css, ':root[data-theme="paper"]') },
};

/** WCAG 2.2 AA for body-size text. */
const AA = 4.5;

// A surface is a stack: the surface itself first, then what shows through it, ending in a solid colour.
const page = ['--surface-page'];
const panel = ['--surface-panel'];
const solid = [page, panel, ['--surface-raised', '--surface-panel'], ['--surface-raised', '--surface-page']];
const hover = [
  ['--surface-hover', '--surface-panel'],
  ['--surface-hover', '--surface-page'],
  ['--surface-hover', '--surface-raised', '--surface-panel'],
];
const glass = [
  ['--surface-glass', '--surface-page'],
  ['--surface-glass', '--surface-panel'],
  ['--surface-glass', '--surface-canvas'],
  ['--surface-glass', '--scrim', '--surface-page'],
  ['--surface-glass', '--scrim', '--surface-canvas'],
];

/** Every text role, and every surface it is allowed to sit on. */
const uses: { text: string; on: string[][] }[] = [
  { text: '--text-strong', on: [...solid, ...hover, ...glass] },
  { text: '--text-body', on: solid },
  { text: '--text-quiet', on: solid },
  { text: '--text-on-canvas', on: [['--surface-canvas']] },
  { text: '--on-accent', on: [['--accent']] },
];

const cases = Object.keys(themes).flatMap((theme) =>
  uses.flatMap(({ text, on }) => on.map((stack) => ({ theme, text, stack, name: stack.join(' over ') }))),
);

describe('text contrast', () => {
  it.each(cases)('$theme: $text on $name is at least 4.5:1', ({ theme, text, stack }) => {
    const tokens = themes[theme] as Tokens;
    const colour = (name: string) => parseColor(resolve(tokens, name));
    const [surface, ...backdrops] = stack.map(colour);
    const ratio = contrast(colour(text), surface as ReturnType<typeof colour>, backdrops);
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA);
  });

  it('measures black on white as 21:1 and a colour on itself as 1:1', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(contrast(black, white)).toBeCloseTo(21, 5);
    expect(contrast(white, white)).toBeCloseTo(1, 5);
    // Half-clear white over black is mid grey, so it reads weaker than solid white.
    expect(contrast({ ...white, a: 0.5 }, black)).toBeLessThan(contrast(white, black));
  });

  it('reads both themes from tokens.css', () => {
    expect(resolve(themes.night as Tokens, '--surface-page')).not.toBe(resolve(themes.paper as Tokens, '--surface-page'));
    expect(Object.keys(readBlock(css, ':root[data-theme="paper"]')).length).toBeGreaterThan(10);
  });
});

describe('tokens', () => {
  it('has the type scale, radii and motion values from the plan', () => {
    expect(night).toMatchObject({
      '--size-12': '0.75rem',
      '--size-13': '0.8125rem',
      '--size-15': '0.9375rem',
      '--size-18': '1.125rem',
      '--size-24': '1.5rem',
      '--radius-control': '4px',
      '--radius-panel': '8px',
      '--ease': 'cubic-bezier(0.2, 0, 0, 1)',
      '--duration-control': '150ms',
      '--duration-panel': '250ms',
      '--numeric-time': 'tabular-nums',
    });
    expect(night['--font']).toMatch(/^'Instrument Sans'/);
  });

  it('removes every transition when reduced motion is asked for', () => {
    const rule = /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*transition: none !important;[^@]*animation: none !important;/;
    expect(css).toMatch(rule);
  });
});
