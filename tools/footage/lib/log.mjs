// The clip log (FOOTAGE-PLAN.md section 3): one table of every clip with what is said, what is seen, picture and
// sound notes in plain words, each with the repair the tool proposes. Pure: takes the clips' data, returns Markdown.
import { clock } from './common.mjs';

/** The repair proposed for each finding, and the phase that builds it. */
export const REPAIRS = {
  'soft focus': 'light sharpening helps a little; a sharper take is better (phase 5)',
  grainy: 'denoise, strong on backgrounds, light on faces (phase 5)',
  'too dark': 'lift the exposure (phase 5)',
  'too bright': 'bring the exposure down (phase 5)',
  'blown highlights': 'pull the highlights back where anything is left (phase 5)',
  'flat picture': 'restore contrast, or convert from Log with the camera\'s LUT (phase 5)',
  flicker: 'deflicker (phase 5)',
  shaky: 'steady it (phase 4)',
  clipping: 'rebuild the flattened peaks; a different take if it is too damaged (phase 3)',
  clicks: 'click removal (phase 3)',
  noisy: 'noise removal (phase 3)',
  hum: 'hum removal (phase 3)',
  rumble: 'low cut below the voice (phase 3)',
  wind: 'wind reduction (phase 3)',
  echo: 'echo reduction; heavy echo can end up sounding processed (phase 3)',
  'music under speech': 'separate the voice from the music, and check the music\'s rights (phase 3)',
};

const span = (f, total) => (f.from <= 0.5 && f.to >= total - 1 ? 'throughout' : `${clock(f.from)}–${clock(f.to)}`);
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** One clip's row of the log. clip: { name, clip (clip.json), words, shots, quality }. Pure. */
export function row({ name, clip, words, shots, quality }) {
  const m = clip.source.measured;
  const total = m.duration;
  const v = m.video;
  const picture = v
    ? `${v.width}×${v.height}, ${v.target} fps${v.colour.kind === 'normal' ? '' : `, ${{ 'hdr-hlg': 'HDR (HLG)', 'hdr-pq': 'HDR (PQ)', log: 'Log' }[v.colour.kind]}`}${v.rotation ? `, recorded at ${v.rotation}°` : ''}${v.variable ? ', uneven frame rate' : ''}`
    : 'sound only';
  let said = '(no sound)';
  if (words) {
    const list = words.words;
    const fillers = list.filter((w) => w.filler === 'yes').length;
    const maybe = list.filter((w) => w.filler === 'maybe').length;
    const first = list.slice(0, 22).map((w) => w.text).join(' ');
    said = list.length
      ? `"${first}${list.length > 22 ? ' …' : ''}" (${list.length} words${fillers ? `, ${fillers} filler${fillers > 1 ? 's' : ''}` : ''}${maybe ? `, ${maybe} possible` : ''})`
      : 'no speech found';
  }
  let seen = v ? (shots ? (shots.cuts.length ? `${shots.shots.length} shots, cut${shots.cuts.length > 1 ? 's' : ''} at ${shots.cuts.map(clock).join(', ')}` : 'one continuous shot') : 'not measured') : '';
  if (v) seen += '; faces measured in phase 4';
  const pf = quality?.picture?.flags || [];
  const sf = quality?.sound?.flags || [];
  const picNotes = v ? (quality?.picture ? (pf.length ? pf.map((f) => `${f.what} (${span(f, total)})`).join('; ') : 'nothing found') : (clip.skipped?.picture || 'not measured')) : '';
  const ss = quality?.sound?.summary;
  const sndBits = sf.map((f) => (f.what === 'hum' && ss?.hum ? `hum at ${ss.hum.base_hz} Hz` : f.what === 'echo' ? `echo (rings about ${f.value} s)` : f.what === 'clicks' && ss?.clicks?.length ? `${ss.clicks.length} click${ss.clicks.length > 1 ? 's' : ''} at ${ss.clicks.map(clock).join(', ')}` : `${f.what} (${span(f, total)})`));
  if (m.audio?.layoutNote?.note) sndBits.push(m.audio.layoutNote.note.replace(/; it will be copied to both$/, ''));
  if (ss?.clarity_db != null && !sf.some((f) => f.what === 'noisy')) sndBits.push(`voice ${Math.round(ss.clarity_db) > 60 ? 'clean' : `${Math.round(ss.clarity_db)} dB above the background`}`);
  const sndNotes = m.audio ? (quality?.sound ? sndBits.join('; ') || 'nothing found' : 'not measured') : '';
  const repairs = [...pf, ...sf].map((f) => REPAIRS[f.what]).filter(Boolean);
  if (m.audio?.layoutNote?.kind === 'one-side') repairs.push('one-sided sound already copied to both sides (done)');
  if (v && v.colour.kind !== 'normal') repairs.push(v.colour.kind === 'log' && !clip.working.said.some((s) => s.includes('converted')) ? 'needs the camera maker\'s Log LUT beside the clip (<clip>.cube)' : 'HDR already converted to normal colour (done)');
  return `| ${esc(name)} | ${clock(total)} | ${esc(picture)} | ${esc(said)} | ${esc(seen)} | ${esc(picNotes)} | ${esc(sndNotes)} | ${esc([...new Set(repairs)].join('; ') || 'none')} |`;
}

/** The whole log for a job. clips: [{ name, clip, words, shots, quality }]. Pure. */
export function render(job, clips, { made = new Date() } = {}) {
  const total = clips.reduce((n, c) => n + c.clip.source.measured.duration, 0);
  const words = clips.reduce((n, c) => n + (c.words?.words.length || 0), 0);
  const lines = [
    `# Footage log: ${job}`,
    '',
    `Made ${made.toISOString().slice(0, 16).replace('T', ' ')} by \`tools/footage/footage.mjs ingest\`. ${clips.length} clip${clips.length === 1 ? '' : 's'}, ${clock(total)} in all, ${words} words transcribed.`,
    '',
    'Read this before the paper edit. Every clip has a working copy (steady frame rate, upright, normal colour) and its transcript; the originals are untouched. The contact sheet for each clip is `edit/clips/<clip>/sheet.jpg`.',
    '',
    '| Clip | Length | Picture | What is said | What is seen | Picture notes | Sound notes | Proposed repair |',
    '|---|---|---|---|---|---|---|---|',
    ...clips.map(row),
    '',
    '## What was done to the working copies',
    '',
    ...clips.map((c) => `- **${c.name}**: ${c.clip.working.said.length ? c.clip.working.said.join('; ') : 'copied as it was'}.`),
    '',
    '## Not measured yet',
    '',
    '- Faces, who speaks, and blown-out faces: phase 4 (face tracking).',
    '- The speech-quality score: phase 3 (with the sound repairs).',
    '- Thresholds for the notes were set on synthetic test clips and are checked against the first real footage.',
    '',
  ];
  return lines.join('\n');
}
