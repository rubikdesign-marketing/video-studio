#!/usr/bin/env node
// Captions for a Tulvo video, cut from the voice's word timings.
//
//   captions.mjs <job_dir>      reads audio/words.json and audio/script.json, writes audio/captions.json
//
// One caption line at a time, at most 42 characters. A longer voice line is split where the parts are most
// even, preferring a pause or punctuation, and never leaves one word alone.
// A script line may name one phrase to highlight:
//   { "id": "02", "text": "Toolvo keeps work in one place.", "highlight": "one place" }
// Words written phonetically for the voice (brands/<the job's brand>/pronunciation.md) are shown with their real spelling.
// The result is the engine's captions format (captionsSchema in engine/src/kit/Captions.tsx).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brandDir, brandOfJob } from '../brand/lib.mjs';

const MAX_CHARS = 42;
const PAUSE = 0.25; // a silence this long between two words is a good place to break
const BREAK_BONUS = 14; // a break at a pause or after punctuation may be this many characters less even
const ENDS_CLAUSE = /[,.;:!?…—–]["'’”)\]]*$/;

const die = (msg) => { console.error(msg); process.exit(1); };
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : die(`Missing ${file}`));
const textOf = (words) => words.map((w) => w.text).join(' ');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A word reduced to its letters and digits, for comparing. */
const bare = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** The brand's pronunciation table as [{ real: "Tulvo", written: "Toolvo" }]. No file means no respelled words. */
function spellings(brand) {
  const file = path.join(brandDir(brand), 'pronunciation.md');
  if (!fs.existsSync(file)) return [];
  const table = fs.readFileSync(file, 'utf8');
  return table.split('\n')
    .map((row) => row.split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 4 && cells[2] && cells[1] !== 'Word' && !/^-+$/.test(cells[1]))
    .map((cells) => ({ real: cells[1], written: cells[2] }));
}

/** Puts the real spelling back. A word written as several ("Too El Vo") becomes one word again. */
function withRealSpelling(words, rules) {
  const out = [...words];
  for (const { real, written } of rules) {
    const count = written.split(/\s+/).length;
    const pattern = new RegExp(`^(\\W*)${escapeRegex(written).replace(/\s+/g, ' ')}((?:['’]s)?\\W*)$`, 'i');
    for (let i = 0; i + count <= out.length; i++) {
      const run = out.slice(i, i + count);
      const found = pattern.exec(textOf(run));
      if (found) out.splice(i, count, { ...run[0], text: found[1] + real + found[2], end: run.at(-1).end });
    }
  }
  return out;
}

/** Marks the words of the line's highlight phrase (its first occurrence only, so a line has one at most). */
function withHighlight(words, phrase, lineId) {
  const wanted = phrase.split(/\s+/).map(bare).filter(Boolean);
  const at = words.findIndex((_, i) => wanted.every((w, k) => words[i + k] && bare(words[i + k].text) === w));
  if (at < 0) die(`Line ${lineId}: the highlight "${phrase}" is not in the spoken text "${textOf(words)}".`);
  return words.map((word, i) => (i >= at && i < at + wanted.length ? { ...word, highlight: true } : word));
}

/** Splits one voice line into caption lines of at most MAX_CHARS, as even as possible. */
function split(words) {
  const length = textOf(words).length;
  if (length <= MAX_CHARS || words.length < 4) return [words]; // under four words, any split leaves one alone
  // Aim for the fewest lines that fit: the first cut goes where the left part holds its share of them.
  const lines = Math.ceil(length / MAX_CHARS);
  const target = (length * Math.floor(lines / 2)) / lines;
  let best = 2;
  let bestCost = Infinity;
  for (let i = 2; i <= words.length - 2; i++) {
    const [before, after] = [words[i - 1], words[i]];
    const natural = ENDS_CLAUSE.test(before.text) || after.start - before.end >= PAUSE;
    const insideHighlight = before.highlight && after.highlight;
    const cost = Math.abs(textOf(words.slice(0, i)).length - target) - (natural ? BREAK_BONUS : 0) + (insideHighlight ? 1000 : 0);
    if (cost < bestCost) [best, bestCost] = [i, cost];
  }
  return [...split(words.slice(0, best)), ...split(words.slice(best))];
}

const jobDir = process.argv[2];
if (!jobDir) {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(0);
}
const audio = path.join(path.resolve(jobDir), 'audio');
const script = readJson(path.join(audio, 'script.json'));
const spoken = readJson(path.join(audio, 'words.json')); // [{ w, s, e, line }] as written by tools/audio/voice.mjs
const jobFile = path.join(path.resolve(jobDir), 'job.json');
let rules;
try {
  rules = spellings(brandOfJob(fs.existsSync(jobFile) ? JSON.parse(fs.readFileSync(jobFile, 'utf8')) : {}));
} catch (error) {
  die(error.message);
}

const stray = spoken.find((word) => !script.some((line) => line.id === word.line));
if (stray) die(`words.json has a word ("${stray.w}") on line ${stray.line}, which is not in script.json. Join the voice again.`);

const captions = { lines: [] };
for (const line of script) {
  let words = spoken.filter((word) => word.line === line.id).map((word) => ({ text: word.w, start: word.s, end: word.e }));
  if (!words.length) die(`Line ${line.id} has no words in words.json. Join the voice again.`);
  words = withRealSpelling(words, rules);
  if (line.highlight) words = withHighlight(words, textOf(withRealSpelling(line.highlight.split(/\s+/).map((text) => ({ text })), rules)), line.id);
  for (const part of split(words)) captions.lines.push({ start: part[0].start, end: part.at(-1).end, words: part });
}

fs.writeFileSync(path.join(audio, 'captions.json'), JSON.stringify(captions, null, 1) + '\n');
for (const { start, end, words } of captions.lines) {
  const text = words.map((w, i) => (w.highlight && !words[i - 1]?.highlight ? '[' : '') + w.text + (w.highlight && !words[i + 1]?.highlight ? ']' : '')).join(' ');
  const length = textOf(words).length;
  console.log(`${start.toFixed(2).padStart(7)} - ${end.toFixed(2).padStart(6)}  ${String(length).padStart(2)}  ${text}${length > MAX_CHARS ? '   TOO LONG: reword the line' : ''}`);
}
console.log(`Wrote audio/captions.json: ${captions.lines.length} caption lines from ${script.length} voice lines. [ ] marks the highlight.`);
