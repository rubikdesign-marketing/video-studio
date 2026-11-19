// Command-line tools, recorded as a terminal the studio draws itself. The commands in the capture script run for
// real, in a folder of their own, in a real terminal session (a pseudo-terminal, so colours and progress bars look as
// they do for a person); what they print is kept with its real timing. Then the session is drawn, frame by frame,
// by xterm.js (the terminal VS Code uses) in the installed Chrome at double sharpness, and made into a 60 fps video.
// The engine gets what a web take gives it: recording.mp4, cursor.json (every typed key's time, for typing sounds,
// with no pointer), marks, and capture.json. A terminal.cast file (the asciinema format) keeps the session too.
//
// VHS (charmbracelet/vhs) is not needed: this does the same job with what the studio already has, and logs each key.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { copyTree } from '../lib/fsx.mjs';
import { killTree, groupLeader } from '../lib/proc.mjs';

const require = createRequire(import.meta.url);
export const TERMINAL_STEPS = ['open', 'run', 'type', 'press', 'wait', 'wait for', 'mark', 'clear', 'line'];
const OPTIONS = ['kind', 'steps', 'columns', 'rows', 'folder', 'prompt', 'theme', 'font_size', 'title', '_about'];
const SPEED_UP = 2; // a silence longer than this (seconds) while a command runs is logged as a wait the engine may play faster
const RUN_LIMIT = 120; // seconds a command may take, unless the step says "limit"
const THEMES = {
  dark: { background: '#16181d', foreground: '#e6e6e6', cursor: '#e6e6e6', selectionBackground: '#3a3f4b', black: '#1e2127', red: '#e06c75', green: '#98c379', yellow: '#d19a66', blue: '#61afef', magenta: '#c678dd', cyan: '#56b6c2', white: '#dcdfe4', brightBlack: '#5c6370', brightRed: '#e06c75', brightGreen: '#98c379', brightYellow: '#e5c07b', brightBlue: '#61afef', brightMagenta: '#c678dd', brightCyan: '#56b6c2', brightWhite: '#ffffff' },
  light: { background: '#fbfbfa', foreground: '#24292f', cursor: '#24292f', selectionBackground: '#d0d7de', black: '#24292f', red: '#cf222e', green: '#116329', yellow: '#7d4e00', blue: '#0550ae', magenta: '#8250df', cyan: '#1b7c83', white: '#6e7781', brightBlack: '#57606a', brightRed: '#a40e26', brightGreen: '#1a7f37', brightYellow: '#633c01', brightBlue: '#218bff', brightMagenta: '#a475f9', brightCyan: '#3192aa', brightWhite: '#8c959f' },
};
const PASSWORD_ASK = /(password|passphrase|passcode|verification code|one-time code)[^\n]{0,40}:\s*$/i;

/** Reads and checks a terminal capture script. */
export function parseTerminalScript(file, { stop, rel, readJson }) {
  const raw = readJson(file, 'The capture script');
  const steps = Array.isArray(raw) ? raw : raw.steps;
  if (!Array.isArray(steps) || !steps.length) stop(`${rel(file)} must be a list of steps, like [{"run": "npm init -y"}, {"mark": "made"}].`);
  const options = Array.isArray(raw) ? {} : raw;
  Object.keys(options).filter((k) => !k.startsWith('_') && !OPTIONS.includes(k)).forEach((k) => stop(`${rel(file)}: "${k}" is not something a terminal capture script can set. It can set: ${OPTIONS.filter((o) => !o.startsWith('_')).join(', ')}.`));
  const marks = new Set();
  let typed = false;
  steps.forEach((step, i) => {
    const n = i + 1;
    const kinds = Object.keys(step ?? {}).filter((k) => TERMINAL_STEPS.includes(k));
    if (kinds.length !== 1) stop(`Step ${n} ${JSON.stringify(step)}: in a terminal, each step does one thing, one of: ${TERMINAL_STEPS.join(', ')}.`);
    const kind = kinds[0];
    const v = step[kind];
    if (kind === 'open' && (n !== 1 || !/^(terminal|shell)$/i.test(String(v)))) stop(`Step ${n}: in a terminal take, "open" may only be the first step, as {"open": "terminal"}.`);
    if ((kind === 'run' || kind === 'type') && (typeof v !== 'string' || !v.trim())) stop(`Step ${n}: "${kind}" needs the command's words, like {"${kind}": "npm init -y"}.`);
    if (kind === 'run' && /(^|[;&|]\s*)sudo\b/.test(v)) stop(`Step ${n}: the capture tool never runs a command with sudo (it would ask for a password). Show the command with {"type": ...} and leave it unrun, or film it by hand.`);
    if (kind === 'run' && step.until !== undefined && typeof step.until !== 'string') stop(`Step ${n}: "until" is the words to wait for while the command keeps running, like {"run": "npm run dev", "until": "ready"}.`);
    if (kind === 'type') typed = true;
    if (kind === 'run') typed = false;
    if (kind === 'press') {
      if (!['Enter', 'Return'].includes(v)) stop(`Step ${n}: in a terminal, "press" is "Enter" (it runs what was typed). Use {"clear": true} to clear the screen.`);
      if (!typed) stop(`Step ${n}: {"press": "Enter"} runs what a "type" step typed, and nothing was typed before it.`);
      typed = false;
    }
    if (kind === 'wait' && typeof v !== 'number') stop(`Step ${n}: "wait" needs a number of seconds, like {"wait": 1.5}.`);
    if (kind === 'wait for' && (typeof v !== 'string' || !v)) stop(`Step ${n}: "wait for" needs the words to wait for, like {"wait for": "Server ready"}.`);
    if (kind === 'clear' && v !== true) stop(`Step ${n}: write it as {"clear": true}.`);
    if (kind === 'mark') {
      if (!/^[a-z0-9][a-z0-9-_]*$/i.test(v)) stop(`Step ${n}: a mark's name may use letters, digits and dashes only, like "installed".`);
      if (marks.has(v)) stop(`Step ${n}: there is already a mark called "${v}".`);
      marks.add(v);
    }
  });
  const cols = options.columns ?? 96, rows = options.rows ?? 26;
  if (!Number.isInteger(cols) || cols < 20 || cols > 240 || !Number.isInteger(rows) || rows < 5 || rows > 80) stop(`${rel(file)}: "columns" is 20 to 240 and "rows" 5 to 80.`);
  return { file, steps, options, start: null, masks: [], roles: new Map() };
}

/** The brand's terminal settings, with the script's own winning. */
function settingsOf(product, script) {
  const t = product.raw.terminal ?? {};
  const o = script.options;
  const theme = o.theme ?? t.theme ?? 'dark';
  return {
    cols: o.columns ?? t.columns ?? 96,
    rows: o.rows ?? t.rows ?? 26,
    prompt: o.prompt ?? t.prompt ?? null,
    theme: THEMES[theme] ? theme : 'dark',
    fontSize: o.font_size ?? t.font_size ?? 17,
    font: t.font ?? '"SF Mono", Menlo, Monaco, "Cascadia Mono", monospace',
    folder: o.folder ?? t.folder ?? null,
    shell: t.shell ?? defaultShell(),
    env: t.env ?? {},
  };
}

function seeded(text) {
  let h = createHash('sha1').update(text).digest().readUInt32LE(0) || 1;
  return () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
}

const shq = (x) => `'${String(x).replace(/'/g, `'\\''`)}'`;   // one word for a POSIX shell, whatever it holds

export function defaultShell({ platform = process.platform, env = process.env, exists = fs.existsSync } = {}) {
  if (platform === 'darwin') return '/bin/zsh';
  return env.SHELL && exists(env.SHELL) ? env.SHELL : '/bin/bash';
}

/**
 * The program and arguments that give a command a real terminal (colours, progress bars, its width), or null where there is
 * none. macOS: BSD `script -q /dev/null cmd args...`. Linux: util-linux `script -q -c "<cmd>" /dev/null`, the command built
 * as one string with every word quoted. Windows has no `script`.
 */
export function scriptCommand(shell, inner, cwd, command, { platform = process.platform } = {}) {
  if (platform === 'darwin') return { cmd: '/usr/bin/script', args: ['-q', '/dev/null', shell, '-f', '-c', inner, 'studio', cwd, command] };
  if (platform === 'win32') return null;
  const words = [shell, ...(/(^|\/)zsh$/.test(shell) ? ['-f'] : []), '-c', inner, 'studio', cwd, command].map(shq).join(' ');
  return { cmd: 'script', args: ['-q', '-c', words, '/dev/null'] };
}

/**
 * Runs the steps for real (mode "take" also draws them into recording.mp4). Returns what the take's capture.json
 * needs; writes cursor.json, tracks.json, marks/, terminal.cast and recording.mp4 into `work`.
 */
export async function recordTerminal({ brand, product, script, opts, mode, work, h }) {
  const { say, stop, round, rel } = h;
  if (process.platform === 'win32') stop('Terminal capture needs macOS or Linux (it uses the system `script` program). On Windows, record the terminal yourself and import the recording.');
  const s = settingsOf(product, script);
  const random = seeded(script.file);
  // The folder the commands run in: the brand's demo folder, copied fresh for the take, or an empty one.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `studio-terminal-${brand}-`));
  let cwd = scratch;
  if (s.folder) {
    const from = path.resolve(path.dirname(product.file), s.folder);
    if (!fs.existsSync(from)) stop(`${rel(product.file)}: the terminal folder ${from} is missing.`);
    copyTree(from, path.join(scratch, path.basename(from)));
    cwd = path.join(scratch, path.basename(from));
  }
  const home = os.homedir();
  const shown = (text) => text.split(home).join('~').split(fs.realpathSync(scratch)).join('~/demo').split(scratch).join('~/demo');
  const promptFor = (dir) => s.prompt ?? `\x1b[38;5;110m${shown(dir).replace(/^~\/demo\/?/, '') || 'demo'}\x1b[0m \x1b[38;5;245m$\x1b[0m `;
  const pace = { take: 1, check: 1, rehearse: 1, dry: 0 }[mode] ?? 1;

  // ---- doing the steps, for real, on one clock
  const ops = []; // [seconds, "w", text] writes, [seconds, "c"] clears, [seconds, "m", name, step] marks: in order
  const events = [];
  const marks = {};
  const warnings = [];
  const background = [];
  let output = ''; // everything every command printed, for "wait for"
  const t0 = Date.now() / 1000;
  const now = () => Date.now() / 1000 - t0;
  const sleep = (sec) => new Promise((r) => setTimeout(r, Math.max(0, sec * 1000)));
  const write = (text) => ops.push([now(), 'w', text]);
  let pending = '';
  let pendingStart = 0;
  let pendingKeys = [];
  let lineFor = null;
  const event = (e) => { const row = { t: round(now()), ...e }; if (lineFor && e.type !== 'line') { row.line = lineFor; lineFor = null; } events.push(row); return row; };

  const typeOut = async (text, n) => {
    if (!pending) { pendingStart = now(); pendingKeys = []; }
    for (const ch of text) {
      pendingKeys.push(round(now()));
      write(ch);
      pending += ch;
      let pause = 0.055 + random() * 0.075;
      if (ch === ' ') pause += 0.035;
      if (/[.,;|&]/.test(ch)) pause += 0.06;
      if (random() < 0.06) pause += 0.12 + random() * 0.12;
      await sleep(pause * pace);
    }
    events.push({ t: round(pendingStart), type: 'type', end: round(now()), text: pending, keys: [...pendingKeys], step: n });
  };

  /** Runs a command in a real terminal session; resolves when it ends (or, with "until", when those words appear). */
  const execute = (command, n, step) => new Promise((resolve) => {
    const started = now();
    const inner = `stty cols ${s.cols} rows ${s.rows} 2>/dev/null; cd "$1" && eval "$2"; s=$?; printf '\\033]1337;studio=%s;%s\\007' "$s" "$PWD"`;
    const env = { ...process.env, ...s.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', CLICOLOR: '1', CLICOLOR_FORCE: '1', FORCE_COLOR: '1', COLUMNS: String(s.cols), LINES: String(s.rows), PS1: '$ ' };
    // The system `script` program gives the command a real terminal (colours, progress bars, its width).
    const sc = scriptCommand(s.shell, inner, cwd, command);
    const child = spawn(sc.cmd, sc.args, { cwd, env, ...groupLeader(), stdio: ['ignore', 'pipe', 'pipe'] });
    let lastOut = now();
    let done = false;
    let buffer = '';
    let first = true;
    const finish = (code) => {
      if (done) return;
      done = true;
      clearInterval(watch);
      const silent = [];
      resolve({ code, seconds: now() - started, silent });
    };
    const take = (b) => {
      let text = b.toString('utf8');
      // `script` echoes the end of its (empty) input as "^D" first: never shown.
      if (first) { text = text.replace(/^\^D\x08\x08/, ''); first = false; }
      if (/^script: /.test(text) && !buffer) { killTree(child, 'SIGKILL'); done = true; clearInterval(watch); resolve({ error: `the system could not open a terminal session for it (${text.trim()})` }); return; }
      buffer += text;
      // The end marker carries the exit code and the folder the command left the shell in.
      const end = buffer.match(/\x1b\]1337;studio=(\d+);([^\x07]*)\x07/);
      if (end) { text = text.replace(/\x1b\]1337;studio=\d+;[^\x07]*\x07/, ''); cwd = end[2] || cwd; }
      text = shown(text);
      if (text) {
        const t = now();
        if (t - lastOut > SPEED_UP) events.push({ t: round(lastOut), type: 'wait', end: round(t), what: `"${command}" working`, speed_up: true, step: n });
        lastOut = t;
        ops.push([t, 'w', text]);
        output += text;
        if (PASSWORD_ASK.test(output.slice(-200))) { killTree(child, 'SIGKILL'); child.__asked = true; }
      }
      if (end) finish(Number(end[1]));
      if (step.until && output.includes(step.until) && !done) { background.push(child); finish(null); }
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', (e) => { done = true; resolve({ error: e.message }); });
    child.on('exit', (code) => { if (child.__asked) { done = true; clearInterval(watch); resolve({ asked: true }); } else if (!background.includes(child)) finish(code); });
    const limit = step.limit ?? RUN_LIMIT;
    const watch = setInterval(() => {
      if (now() - started > limit && !done) { killTree(child, 'SIGKILL'); done = true; clearInterval(watch); resolve({ timeout: limit }); }
    }, 100);
  });

  const runPending = async (n, step) => {
    const command = pending;
    event({ type: 'press', key: 'Enter', step: n });
    write('\r\n');
    pending = '';
    const r = await execute(command, n, step);
    if (r.error) stop(`Step ${n}: the terminal could not start (${r.error}).`);
    if (r.asked) stop(`Step ${n}: "${command}" asked for a password or a code. The capture tool never types those: run a command that does not ask, or film it by hand.`);
    if (r.timeout) stop(`Step ${n}: "${command}" was still running after ${r.timeout} seconds. Give the step a longer "limit", or use "until" for a command that keeps running (like a server).`);
    events.push({ t: round(now() - r.seconds), type: 'command', text: command, end: round(now()), ...(r.code === null ? { still_running: true } : { exit_code: r.code }), step: n });
    if (r.code !== null && r.code !== 0) warnings.push(`Step ${n}: "${command}" ended with an error (exit code ${r.code}). Check the take shows what the film needs.`);
    if (r.code !== null) write(promptFor(cwd));
    say(`  ${String(n).padStart(2)}  ${(now() - r.seconds).toFixed(2)}s  ${command}  (${r.code === null ? `running on, "${step.until}" seen` : `${r.seconds.toFixed(1)} s, exit ${r.code}`})`);
  };

  // The commands and what they print go into the take; nothing outside the folder is shown with its real path.
  if (mode === 'take' || mode === 'check') say(`  commands run for real in a fresh folder of their own (${s.folder ? `a copy of ${s.folder}` : 'empty'}); your home folder shows as ~`);
  write(promptFor(cwd));
  await sleep(h.LEAD);
  try {
    for (const [i, step] of script.steps.entries()) {
      const n = i + 1;
      const kind = Object.keys(step).find((k) => TERMINAL_STEPS.includes(k));
      if (kind === 'open') continue;
      if (kind === 'run') {
        await typeOut(step.run, n);
        await sleep((0.25 + random() * 0.15) * pace);
        await runPending(n, step);
      } else if (kind === 'type') {
        await typeOut(step.type, n);
        say(`  ${String(n).padStart(2)}  ${now().toFixed(2)}s  typed: ${step.type}`);
      } else if (kind === 'press') {
        await runPending(n, step);
      } else if (kind === 'wait') {
        await sleep(step.wait * (mode === 'dry' ? 0 : 1));
      } else if (kind === 'wait for') {
        const limit = step.limit ?? 60;
        const from = now();
        while (!output.includes(step['wait for'])) {
          if (now() - from > limit) stop(`Step ${n}: "${step['wait for']}" did not appear in the terminal within ${limit} seconds.`);
          await sleep(0.05);
        }
        if (now() - from > SPEED_UP) events.push({ t: round(from), type: 'wait', end: round(now()), what: `"${step['wait for']}"`, speed_up: true, step: n });
      } else if (kind === 'clear') {
        ops.push([now(), 'c']);
        write(promptFor(cwd) + pending);
        event({ type: 'clear', step: n });
      } else if (kind === 'mark') {
        await sleep(0.15 * pace);
        ops.push([now(), 'm', step.mark, n]);
        marks[step.mark] = round(now());
        event({ type: 'mark', name: step.mark, step: n });
      } else if (kind === 'line') {
        lineFor = step.line;
        event({ type: 'line', id: step.line, step: n + 1 });
      }
      if (kind !== 'line' && kind !== 'run' && kind !== 'type' && kind !== 'press') say(`  ${String(n).padStart(2)}  ${now().toFixed(2)}s  ${kind} ${JSON.stringify(step[kind])}`);
    }
    await sleep(h.TAIL);
  } finally {
    for (const c of background) killTree(c, 'SIGTERM');
  }
  const seconds = now();
  fs.rmSync(scratch, { recursive: true, force: true });
  // A real e-mail address or a private-looking path in the output is flagged for a person.
  const emails = [...new Set(output.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])].filter((e) => !(product.allowEmail ?? []).some((a) => e.endsWith(a)) && !/@example\.(com|org|test)$/.test(e));
  for (const e of emails) warnings.push(`E-mail address in the terminal: "${e}". Check it is made up before the footage is used, or change the command.`);
  if (!work) return { seconds, events, marks, warnings };

  // ---- drawing it: xterm.js in the installed Chrome, one picture per change, at double sharpness
  const cast = [{ version: 2, width: s.cols, height: s.rows, timestamp: Math.round(t0), title: s.prompt ? 'terminal' : 'demo', env: { TERM: 'xterm-256color' } }, ...ops.filter((o) => o[1] !== 'm').map((o) => (o[1] === 'w' ? [round(o[0], 4), 'o', o[2]] : [round(o[0], 4), 'o', '\x1b[2J\x1b[H']))];
  fs.writeFileSync(path.join(work, 'terminal.cast'), cast.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const chromium = await h.playwright();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const framesDir = path.join(work, '.frames');
  fs.mkdirSync(framesDir, { recursive: true });
  try {
    const pageCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: h.SCALE });
    const page = await pageCtx.newPage();
    const xtermJs = fs.readFileSync(require.resolve('@xterm/xterm/lib/xterm.js'), 'utf8');
    const xtermCss = fs.readFileSync(require.resolve('@xterm/xterm/css/xterm.css'), 'utf8');
    const theme = THEMES[s.theme];
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${xtermCss}
      html,body{margin:0;background:${theme.background}}#wrap{display:inline-block;padding:28px 32px}.xterm-viewport{overflow:hidden!important}</style></head>
      <body><div id="wrap"><div id="t"></div></div><script>${xtermJs}</script></body></html>`);
    const size = await page.evaluate(async ({ cols, rows, theme, fontSize, font }) => {
      await document.fonts.ready;
      const term = new window.Terminal({ cols, rows, theme, fontSize, fontFamily: font, lineHeight: 1.25, cursorBlink: false, cursorStyle: 'block', allowProposedApi: true, scrollback: 2000, convertEol: false, customGlyphs: true });
      term.open(document.getElementById('t'));
      term.focus(); // a terminal in use: its cursor is a solid block, not an outline
      window.__term = term;
      window.__write = (text) => new Promise((r) => term.write(text, r));
      window.__words = () => { const b = term.buffer.active; const out = []; for (let y = 0; y < term.rows; y++) out.push(b.getLine(b.viewportY + y)?.translateToString(true) ?? ''); return out.join('\n').replace(/\s+$/, ''); };
      const r = document.getElementById('wrap').getBoundingClientRect();
      return [Math.ceil(r.width / 2) * 2, Math.ceil(r.height / 2) * 2];
    }, { cols: s.cols, rows: s.rows, theme, fontSize: s.fontSize, font: s.font });
    await page.setViewportSize({ width: size[0], height: size[1] });
    const frames = [];
    let last = '';
    let k = 0;
    const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const shoot = async (t) => {
      await settle();
      const buf = await page.screenshot({ type: 'png', scale: 'device', animations: 'disabled', caret: 'initial' });
      const hash = createHash('sha1').update(buf).digest('hex');
      if (hash === last) return buf;
      last = hash;
      const file = path.join(framesDir, `${String(frames.length).padStart(6, '0')}.png`);
      fs.writeFileSync(file, buf);
      frames.push({ file, t, px: { w: size[0] * h.SCALE, h: size[1] * h.SCALE } });
      return buf;
    };
    // Every change that falls in the same 60th of a second is drawn together, then photographed once.
    const marksDir = path.join(work, 'marks');
    const details = {};
    const frameOf = (t) => Math.floor(t * h.FPS + 1e-6);
    await shoot(0);
    const flush = async (text) => { if (text) await page.evaluate((x) => window.__write(x), text); return ''; };
    while (k < ops.length) {
      const f = frameOf(ops[k][0]);
      let text = '';
      while (k < ops.length && frameOf(ops[k][0]) === f) {
        const o = ops[k++];
        if (o[1] === 'w') text += o[2];
        else if (o[1] === 'c') { text = await flush(text); await page.evaluate(() => window.__term.reset()); }
        else if (o[1] === 'm') {
          // A mark is photographed with exactly what was on screen when it was made, nothing after it.
          text = await flush(text);
          await shoot(f / h.FPS);
          fs.copyFileSync(frames.at(-1).file, path.join(marksDir, `${o[2]}.png`));
          details[o[2]] = { t: round(o[0]), step: o[3], words: await page.evaluate(() => window.__words()) };
        }
      }
      await flush(text);
      await shoot(f / h.FPS);
    }
    say(`Drawing the terminal: ${frames.length} pictures of ${size[0]} x ${size[1]} at sharpness x${h.SCALE}...`);
    h.assemble(frames, 0, seconds, path.join(work, 'recording.mp4'), framesDir, { width: size[0], height: size[1] });
    fs.rmSync(framesDir, { recursive: true, force: true });
    const cursor = {
      about: 'A terminal take: no pointer. Times in seconds on the recording clock. events: type (the words and every key time, for typing sounds), press (Enter), command (the command, when it ran, its exit code), wait (speed_up: a silence while a command worked, which the engine may play faster), clear, mark, line.',
      page: { width: size[0], height: size[1] },
      scale: h.SCALE,
      seconds: round(seconds),
      input: 'keyboard',
      frame_as: 'terminal',
      path: [],
      events: events.sort((a, b) => a.t - b.t),
    };
    fs.writeFileSync(path.join(work, 'cursor.json'), JSON.stringify(cursor) + '\n');
    return {
      seconds,
      page: { width: size[0], height: size[1] },
      marks,
      mark_details: details,
      warnings,
      pictures: frames.length,
      events: cursor.events,
      source: { type: 'command line', drawn_by: 'the studio: commands run for real in a pseudo-terminal, drawn by xterm.js 6.0.0 in Chrome', columns: s.cols, rows: s.rows, theme: s.theme, font_size: s.fontSize, folder: s.folder ? `a fresh copy of ${s.folder}` : 'a fresh empty folder', home_shown_as: '~', session: 'terminal.cast (asciinema format)' },
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
