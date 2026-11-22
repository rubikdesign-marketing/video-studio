// The expert prompt as a customer copies it, shared by the library tools and the brief page.
// This file imports nothing at all: the browser page loads it as is (tools/styles/build-page.mjs copies it).

const ENERGIES = ['calm', 'confident', 'hype'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (n) => String(n);

function energyLine(energy, t, isSound) {
  if (!t) return `${cap(energy)}: no timing given.`;
  if (isSound) return `${cap(energy)}: ${num(t.bpm)} bpm, hit ${num(t.hit_s)} s, duck ${num(t.duck_db)} dB, still ${num(t.still_pct)}%.`;
  return `${cap(energy)}: one beat every ${num(t.beat_s)} s, ease ${t.ease}, overshoot ${num(t.overshoot)}, hold ${num(t.hold_s)} s, motion ${num(t.motion)}, still ${num(t.still_pct)}%.`;
}

const words = (v) => (typeof v === 'string' ? v.trim() : '');
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// What and when, one energy line per supported energy, then what to avoid. A part an entry does not have is left out
// (an entry with no prompt gives only its energy lines), so a malformed entry never breaks the page or the tools.
export function promptText(entry) {
  const e0 = isObj(entry) ? entry : {};
  const p = isObj(e0.prompt) ? e0.prompt : {};
  const isSound = e0.tab === 'sound';
  const lines = [`${words(p.what)} ${words(p.when)}`.trim()];
  const energies = isObj(e0.filters) && Array.isArray(e0.filters.energy) ? e0.filters.energy : [];
  for (const e of ENERGIES) {
    if (energies.includes(e)) lines.push(energyLine(e, isObj(e0.timing) ? e0.timing[e] : undefined, isSound));
  }
  if (words(p.avoid)) lines.push(`Avoid: ${words(p.avoid)}`);
  return lines.filter(Boolean).join('\n');
}
