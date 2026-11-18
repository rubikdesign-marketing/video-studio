// How a shortcut's `keys` are written: parts joined with "+", for example "Mod+Z", "Shift+Mod+Z", "Space", "?".
// "Mod" is Command on a Mac and Ctrl elsewhere. The last part is the key: a letter, a sign, or a name such as
// Space, Enter, Escape, Backspace, ArrowLeft.

/** The parts of a keyboard event this file reads, so tests can pass a plain object. */
export interface KeyPress { key: string; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }

export function isMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
}

interface Combo { mod: boolean; shift: boolean; alt: boolean; key: string }
function parse(keys: string): Combo {
  const parts = keys === '+' ? ['+'] : keys.split('+').map((p) => p.trim()).filter(Boolean);
  const key = parts.at(-1) ?? '';
  const mods = new Set(parts.slice(0, -1).map((p) => p.toLowerCase()));
  return { mod: mods.has('mod'), shift: mods.has('shift'), alt: mods.has('alt'), key };
}
const pressed = (key: string) => (key === ' ' || key === 'Spacebar' ? 'space' : key.toLowerCase());
const isSign = (key: string) => key.length === 1 && !/[\p{L}\p{N}]/u.test(key);

/** True when the key press is this shortcut. */
export function matchKeys(keys: string, e: KeyPress, mac: boolean = isMac()): boolean {
  const combo = parse(keys);
  if (pressed(e.key) !== combo.key.toLowerCase()) return false;
  const mod = mac ? !!e.metaKey : !!e.ctrlKey;
  const otherMod = mac ? !!e.ctrlKey : !!e.metaKey;
  if (mod !== combo.mod || otherMod || !!e.altKey !== combo.alt) return false;
  // A sign such as "?" needs Shift on some keyboards and not on others, so Shift is not held against it.
  return isSign(combo.key) && !combo.shift ? true : !!e.shiftKey === combo.shift;
}

const NAMES: Record<string, string> = { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', escape: 'Esc', backspace: '⌫', enter: '↵', space: 'Space' };
/** The shortcut as separate key caps, for example ["⇧", "⌘", "Z"] on a Mac and ["Ctrl", "Shift", "Z"] elsewhere. */
export function keyCaps(keys: string, mac: boolean = isMac()): string[] {
  const combo = parse(keys);
  const key = NAMES[combo.key.toLowerCase()] ?? (combo.key.length === 1 ? combo.key.toUpperCase() : combo.key);
  return mac
    ? [...(combo.alt ? ['⌥'] : []), ...(combo.shift ? ['⇧'] : []), ...(combo.mod ? ['⌘'] : []), key]
    : [...(combo.mod ? ['Ctrl'] : []), ...(combo.alt ? ['Alt'] : []), ...(combo.shift ? ['Shift'] : []), key];
}
/** The shortcut as one string for a tooltip or a screen reader: "⇧⌘Z" or "Ctrl+Shift+Z". */
export const formatKeys = (keys: string, mac: boolean = isMac()): string => keyCaps(keys, mac).join(mac ? '' : '+');

/** True when the key press is going into a field, where it means typing and not a shortcut. */
export function isTyping(target: unknown): boolean {
  const el = target as { tagName?: string; type?: string; isContentEditable?: boolean } | null;
  if (!el || typeof el !== 'object') return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? '').toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes((el.type ?? 'text').toLowerCase());
}
