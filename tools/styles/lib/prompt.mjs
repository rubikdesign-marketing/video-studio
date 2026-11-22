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

// What and when, one energy line per supported energy, then what to avoid.
export function promptText(entry) {
  const isSound = entry.tab === 'sound';
  const lines = [`${entry.prompt.what} ${entry.prompt.when}`.trim()];
  for (const e of ENERGIES) {
    if ((entry.filters?.energy || []).includes(e)) lines.push(energyLine(e, entry.timing?.[e], isSound));
  }
  lines.push(`Avoid: ${entry.prompt.avoid}`);
  return lines.join('\n');
}
