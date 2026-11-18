/** Colour maths for the contrast check (WCAG 2.2). Pure, no colours of its own. */

export interface Rgba { r: number; g: number; b: number; a: number }
export type Tokens = Record<string, string>;

/** Reads a hex colour, or one written as red, green, blue and an optional alpha. Anything else is an error. */
export function parseColor(value: string): Rgba {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(text)?.[1];
  if (hex && (hex.length === 3 || hex.length === 6 || hex.length === 8)) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    const part = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return { r: part(0), g: part(2), b: part(4), a: full.length === 8 ? part(6) / 255 : 1 };
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(text)?.[1];
  if (fn) {
    const [r, g, b, a = 1] = fn.split(/[\s,/]+/).filter(Boolean).map(Number);
    if ([r, g, b, a].every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return { r: r as number, g: g as number, b: b as number, a };
    }
  }
  throw new Error(`Cannot read the colour "${value}"`);
}

/** Lays a colour over an opaque backdrop. */
export function over(top: Rgba, backdrop: Rgba): Rgba {
  const mix = (t: number, b: number) => t * top.a + b * (1 - top.a);
  return { r: mix(top.r, backdrop.r), g: mix(top.g, backdrop.g), b: mix(top.b, backdrop.b), a: 1 };
}

export function luminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Contrast of text on a surface. `backdrops` sit under the surface, nearest first, ending in an opaque one. */
export function contrast(text: Rgba, surface: Rgba, backdrops: Rgba[] = []): number {
  const stack = [surface, ...backdrops];
  let ground = stack[stack.length - 1] as Rgba;
  for (let i = stack.length - 2; i >= 0; i--) ground = over(stack[i] as Rgba, ground);
  const a = luminance(over(text, ground));
  const b = luminance(ground);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** The custom properties of every rule whose selector is exactly `selector`, later rules winning. */
export function readBlock(css: string, selector: string): Tokens {
  const tokens: Tokens = {};
  const rule = /(?<=^|\})\s*([^{}@]+?)\s*\{([^{}]*)\}/g;
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of plain.matchAll(rule)) {
    if (match[1]?.trim() !== selector) continue;
    for (const declaration of (match[2] ?? '').split(';')) {
      const at = declaration.indexOf(':');
      const name = declaration.slice(0, at).trim();
      if (at > 0 && name.startsWith('--')) tokens[name] = declaration.slice(at + 1).trim();
    }
  }
  return tokens;
}

/** Follows var() until a real value is left. */
export function resolve(tokens: Tokens, name: string, depth = 0): string {
  const value = tokens[name];
  if (value === undefined) throw new Error(`No token called ${name}`);
  const inner = /^var\((--[\w-]+)\)$/.exec(value)?.[1];
  if (!inner) return value;
  if (depth > 10) throw new Error(`${name} points at itself`);
  return resolve(tokens, inner, depth + 1);
}
