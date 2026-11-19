// Phone apps, recorded in the iOS Simulator (Xcode) or the Android emulator (Android Studio), on this Mac.
//
// iOS:     xcrun simctl boots the simulator, installs and opens the app or a link, cleans the status bar (9:41, full
//          battery, full signal), sets light or dark, and records the screen (simctl io recordVideo). simctl cannot
//          tap or type, so taps, typing, swipes and finding things by their accessibility label go through idb
//          (Meta's free iOS tool: idb-companion and fb-idb). Without idb a take can still open, wait and mark.
// Android: adb does all of it: am start, input tap / swipe / text / keyevent, uiautomator for accessibility labels,
//          the status bar's demo mode, and screenrecord (at most 3 minutes a take).
//
// The take hands the engine what a phone-size web take does: recording.mp4 at twice the screen's points (from the
// device's own pixels), cursor.json with input "touch" (taps, swipes with the finger's path, typing with every key's
// time), marks, and capture.json. Positions in a script are in the screen's points (iOS) or dp (Android): what a
// screenshot shows, divided by the screen's scale.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import { which as findOnPath } from '../../setup/runtime/resolve.mjs';

export const PHONE_STEPS = ['open', 'tap', 'type', 'swipe', 'press', 'wait', 'wait for', 'mark', 'line'];
const OPTIONS = ['kind', 'steps', 'theme', 'platform', 'device', '_about'];
const KEYS = { home: ['HOME', 'KEYCODE_HOME'], back: [null, 'KEYCODE_BACK'], enter: [null, 'KEYCODE_ENTER'], return: [null, 'KEYCODE_ENTER'], lock: ['LOCK', 'KEYCODE_POWER'] };
const SWIPES = { up: [0.5, 0.75, 0.5, 0.3], down: [0.5, 0.3, 0.5, 0.75], left: [0.8, 0.5, 0.2, 0.5], right: [0.2, 0.5, 0.8, 0.5] };

const which = (bin) => findOnPath(bin);   // PATH lookup without a shell; honours PATHEXT on Windows

/** Where the Android SDK's adb may be: ANDROID_HOME / ANDROID_SDK_ROOT first, then the default folder for this OS. */
export function adbCandidates({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  const exe = platform === 'win32' ? 'adb.exe' : 'adb';
  const roots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT];
  if (platform === 'darwin') roots.push(path.join(home, 'Library', 'Android', 'sdk'));
  else if (platform === 'win32') roots.push(path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Android', 'Sdk'));
  else roots.push(path.join(home, 'Android', 'Sdk'));
  return roots.filter(Boolean).map((r) => path.join(r, 'platform-tools', exe));
}
const run = (bin, args, opts = {}) => spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: opts.timeout ?? 60000, ...opts });

/** What this computer has for phone apps: for the health check and for plain stops. */
export function phoneTools() {
  const simctl = run('xcrun', ['--find', 'simctl']).status === 0;
  const adb = which('adb') ?? adbCandidates().find((p) => fs.existsSync(p)) ?? null;
  const idb = which('idb');
  return { simctl, adb, idb };
}

/** Reads and checks a phone app capture script. */
export function parsePhoneScript(file, { stop, rel, readJson }) {
  const raw = readJson(file, 'The capture script');
  const steps = Array.isArray(raw) ? raw : raw.steps;
  if (!Array.isArray(steps) || !steps.length) stop(`${rel(file)} must be a list of steps, like [{"open": "app"}, {"tap": "Sign up"}].`);
  const options = Array.isArray(raw) ? {} : raw;
  Object.keys(options).filter((k) => !k.startsWith('_') && !OPTIONS.includes(k)).forEach((k) => stop(`${rel(file)}: "${k}" is not something a phone app capture script can set. It can set: ${OPTIONS.filter((o) => !o.startsWith('_')).join(', ')}.`));
  if (steps[0]?.open === undefined) stop(`${rel(file)}: the first step must open the app or a link, like {"open": "app"}.`);
  const marks = new Set();
  steps.forEach((step, i) => {
    const n = i + 1;
    const kinds = Object.keys(step ?? {}).filter((k) => PHONE_STEPS.includes(k));
    if (kinds.length !== 1) stop(`Step ${n} ${JSON.stringify(step)}: in a phone app, each step does one thing, one of: ${PHONE_STEPS.join(', ')}.`);
    const kind = kinds[0];
    const v = step[kind];
    const isPoint = Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number');
    if (kind === 'open' && (typeof v !== 'string' || !v)) stop(`Step ${n}: "open" is "app" (the brand's app), "app:com.example.other", or a link (https://... or a deep link like myapp://inbox).`);
    if (kind === 'tap' && !(isPoint || (typeof v === 'string' && v))) stop(`Step ${n}: "tap" is the words of a button (its accessibility label), like {"tap": "Sign up"}, or a place in screen points, like {"tap": [200, 640]}.`);
    if (kind === 'tap' && step.hold !== undefined && typeof step.hold !== 'number') stop(`Step ${n}: "hold" is how long the finger stays down, in seconds (a long press).`);
    if (kind === 'type' && (typeof v !== 'string' || !v)) stop(`Step ${n}: "type" needs words, like {"type": "Morrowby Coffee"}. Tap the field first.`);
    if (kind === 'type' && /pass(word|code)|\bpin\b|one[- ]?time|verification/i.test(String(step.into ?? ''))) stop(`Step ${n}: the capture tool never types into a password or code field.`);
    if (kind === 'swipe' && !(SWIPES[v] || (Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number')))) stop(`Step ${n}: "swipe" is up, down, left or right, or [from x, from y, to x, to y] in screen points.`);
    if (kind === 'press' && !KEYS[String(v).toLowerCase()]) stop(`Step ${n}: "press" is one of ${Object.keys(KEYS).join(', ')}.`);
    if (kind === 'wait' && typeof v !== 'number') stop(`Step ${n}: "wait" needs a number of seconds, like {"wait": 1.2}.`);
    if (kind === 'wait for' && (typeof v !== 'string' || !v)) stop(`Step ${n}: "wait for" needs words on screen, like {"wait for": "Welcome"}.`);
    if (kind === 'mark') {
      if (!/^[a-z0-9][a-z0-9-_]*$/i.test(v)) stop(`Step ${n}: a mark's name may use letters, digits and dashes only.`);
      if (marks.has(v)) stop(`Step ${n}: there is already a mark called "${v}".`);
      marks.add(v);
    }
  });
  return { file, steps, options, start: null, masks: [], roles: new Map() };
}

// ---------------------------------------------------------------- the two platforms

/** The iOS Simulator, through xcrun simctl (and idb for touch). */
class IOS {
  constructor(cfg, tools, h) { Object.assign(this, { cfg, tools, h, name: 'iOS Simulator' }); }
  simctl(args, what, opts) {
    const r = run('xcrun', ['simctl', ...args], opts);
    if (r.status !== 0) this.h.stop(`The iOS Simulator could not ${what}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' ')}`);
    return r.stdout;
  }
  idb(args, what) {
    if (!this.tools.idb) this.h.stop(`To ${what} in the iOS Simulator the capture tool needs idb, Meta's free iOS tool (simctl cannot tap or type). Install it once: brew tap facebook/fb && brew install idb-companion, then: pip3 install fb-idb. Without it, a take can open the app or a link, wait and mark.`);
    const r = run(this.tools.idb, [...args, '--udid', this.udid]);
    if (r.status !== 0) this.h.stop(`idb could not ${what}: ${(r.stderr || '').trim().split('\n').slice(-2).join(' ')}`);
    return r.stdout;
  }
  async boot() {
    const list = JSON.parse(this.simctl(['list', 'devices', 'available', '-j'], 'list its devices'));
    const all = Object.values(list.devices).flat();
    const want = this.cfg.device;
    let dev = want && want !== 'booted' ? all.find((d) => d.udid === want || d.name === want) : all.find((d) => d.state === 'Booted');
    if (!dev && want && want !== 'booted') this.h.stop(`There is no iOS Simulator device called "${want}" on this Mac. Its devices: ${[...new Set(all.map((d) => d.name))].slice(0, 12).join(', ')}.`);
    if (!dev) dev = all.find((d) => /iPhone/.test(d.name));
    if (!dev) this.h.stop('This Mac has no iPhone simulator. Add one in Xcode: Window, Devices and Simulators, Simulators, +.');
    this.udid = dev.udid;
    this.device = dev.name;
    if (dev.state !== 'Booted') { this.simctl(['boot', dev.udid], `start ${dev.name}`); run('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', dev.udid]); }
    run('xcrun', ['simctl', 'bootstatus', dev.udid, '-b'], { timeout: 180000 });
    // The screen's points and scale, from the device type's own profile.
    const types = JSON.parse(this.simctl(['list', 'devicetypes', '-j'], 'list its device types')).devicetypes;
    const type = types.find((t) => t.identifier === dev.deviceTypeIdentifier);
    const plist = type ? path.join(type.bundlePath, 'Contents', 'Resources', 'profile.plist') : null;
    // plutil is a macOS program, and the iOS Simulator exists only on a Mac; elsewhere the defaults below are used.
    const read = (k) => (process.platform === 'darwin' ? Number(run('/usr/bin/plutil', ['-extract', k, 'raw', plist]).stdout.trim()) : NaN);
    this.scale = plist ? read('mainScreenScale') || 3 : 3;
    const px = plist ? [read('mainScreenWidth'), read('mainScreenHeight')] : null;
    this.points = px?.every((x) => x > 0) ? px.map((x) => Math.round(x / this.scale)) : [402, 874];
  }
  async install(file) { this.simctl(['install', this.udid, file], `install ${file}`); }
  async dress(theme) {
    this.simctl(['ui', this.udid, 'appearance', theme === 'dark' ? 'dark' : 'light'], 'set light or dark');
    this.simctl(['status_bar', this.udid, 'override', '--time', this.cfg.status_bar?.time ?? '9:41', '--dataNetwork', 'wifi', '--wifiMode', 'active', '--wifiBars', '3', '--cellularMode', 'active', '--cellularBars', '4', '--batteryState', 'charged', '--batteryLevel', '100'], 'clean the status bar');
  }
  async undress() { run('xcrun', ['simctl', 'status_bar', this.udid, 'clear']); }
  async open(target) {
    if (/^app(:|$)/i.test(target)) {
      const id = target.includes(':') ? target.split(':').slice(1).join(':') : this.cfg.app;
      if (!id) this.h.stop('"open": "app" needs the app\'s bundle id: "phone": { "app": "com.example.app" } in the brand\'s capture.json.');
      this.simctl(['launch', '--terminate-running-process', this.udid, id], `open ${id} (is it installed? "phone": { "install": "path/to/App.app" })`);
    } else this.simctl(['openurl', this.udid, target], `open ${target}`);
  }
  async tap(x, y, hold) { this.idb(['ui', 'tap', String(Math.round(x)), String(Math.round(y)), ...(hold ? ['--duration', String(hold)] : [])], 'tap'); }
  async swipe(a, b, seconds) { this.idb(['ui', 'swipe', ...[a.x, a.y, b.x, b.y].map((v) => String(Math.round(v))), '--duration', String(seconds)], 'swipe'); }
  async key(ch) { this.idb(['ui', 'text', ch], 'type'); }
  async press(name) {
    const k = KEYS[name.toLowerCase()][0];
    if (!k) { if (name.toLowerCase() === 'enter' || name.toLowerCase() === 'return') return this.key('\n'); this.h.stop(`The iOS Simulator has no "${name}" button.`); }
    this.idb(['ui', 'button', k], `press ${name}`);
  }
  /** Things on screen with their accessibility labels and boxes, in points. */
  async things() {
    if (!this.tools.idb) return null;
    const out = this.idb(['ui', 'describe-all', '--json'], 'read the screen');
    let list = [];
    try { list = JSON.parse(out); } catch { list = out.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); }
    return list.map((e) => ({ words: [e.AXLabel, e.AXValue, e.title].filter(Boolean).join(' '), box: e.frame ? [e.frame.x, e.frame.y, e.frame.width, e.frame.height] : null })).filter((e) => e.words && e.box);
  }
  async still(file) { this.simctl(['io', this.udid, 'screenshot', '--type=png', file], 'take a still'); }
  startRecording(file) {
    const child = spawn('xcrun', ['simctl', 'io', this.udid, 'recordVideo', '--codec=h264', '--force', file], { stdio: ['ignore', 'pipe', 'pipe'] });
    return new Promise((resolve, reject) => {
      let said = '';
      const seen = (b) => { said += b.toString(); if (/Recording started/i.test(said)) resolve({ child, started: Date.now() / 1000, stop: () => this.stopRecording(child) }); };
      child.stdout.on('data', seen);
      child.stderr.on('data', seen);
      child.on('exit', (code) => reject(new Error(`the recorder stopped (${code}): ${said.trim().slice(-200)}`)));
      setTimeout(() => reject(new Error('the recorder did not start within 20 seconds')), 20000);
    });
  }
  stopRecording(child) {
    return new Promise((resolve) => { child.removeAllListeners('exit'); child.on('exit', () => resolve()); child.kill('SIGINT'); setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 15000); });
  }
}

/** The Android emulator (or a phone plugged in with USB debugging), through adb. */
class Android {
  constructor(cfg, tools, h) { Object.assign(this, { cfg, tools, h, name: 'Android emulator' }); }
  adb(args, what, opts) {
    const r = run(this.tools.adb, [...(this.serial ? ['-s', this.serial] : []), ...args], opts);
    if (r.status !== 0) this.h.stop(`The Android emulator could not ${what}: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' ')}`);
    return r.stdout;
  }
  sh(cmd, what) { return this.adb(['shell', cmd], what); }
  async boot() {
    const lines = this.adb(['devices'], 'list its devices').split('\n').slice(1).map((l) => l.trim().split(/\s+/)).filter((p) => p[1] === 'device');
    const want = this.cfg.device;
    const found = want ? lines.find((p) => p[0] === want) : lines[0];
    if (!found) this.h.stop(want ? `The Android device "${want}" is not running. Start it in Android Studio (Device Manager), then try again.` : 'No Android emulator is running. Start one in Android Studio (Device Manager), then try again.');
    this.serial = found[0];
    this.device = this.adb(['shell', 'getprop', 'ro.product.model'], 'read its name').trim() || this.serial;
    const size = this.sh('wm size', 'read its screen size').match(/(\d+)x(\d+)\s*$/m);
    const density = Number(this.sh('wm density', 'read its screen density').match(/(\d+)\s*$/m)?.[1] ?? 420);
    this.scale = density / 160;
    this.px = size ? [Number(size[1]), Number(size[2])] : [1080, 2400];
    this.points = this.px.map((v) => Math.round(v / this.scale));
  }
  async install(file) { this.adb(['install', '-r', file], `install ${file}`, { timeout: 180000 }); }
  async dress(theme) {
    this.sh(`cmd uimode night ${theme === 'dark' ? 'yes' : 'no'}`, 'set light or dark');
    const time = (this.cfg.status_bar?.time ?? '9:41').replace(':', '').padStart(4, '0');
    for (const c of ['settings put global sysui_demo_allowed 1', 'am broadcast -a com.android.systemui.demo -e command enter', `am broadcast -a com.android.systemui.demo -e command clock -e hhmm ${time}`, 'am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false', 'am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 -e mobile show -e datatype none -e level 4', 'am broadcast -a com.android.systemui.demo -e command notifications -e visible false']) this.sh(c, 'clean the status bar');
  }
  async undress() { run(this.tools.adb, ['-s', this.serial, 'shell', 'am broadcast -a com.android.systemui.demo -e command exit']); }
  async open(target) {
    if (/^app(:|$)/i.test(target)) {
      const id = target.includes(':') ? target.split(':').slice(1).join(':') : this.cfg.app;
      if (!id) this.h.stop('"open": "app" needs the app\'s package name: "phone": { "app": "com.example.app" } in the brand\'s capture.json.');
      this.sh(`am force-stop ${id}; monkey -p ${id} -c android.intent.category.LAUNCHER 1`, `open ${id} (is it installed? "phone": { "install": "path/to/app.apk" })`);
    } else this.sh(`am start -a android.intent.action.VIEW -d '${target.replace(/'/g, '')}'`, `open ${target}`);
  }
  async tap(x, y, hold) {
    const [px, py] = [Math.round(x * this.scale), Math.round(y * this.scale)];
    this.sh(hold ? `input swipe ${px} ${py} ${px} ${py} ${Math.round(hold * 1000)}` : `input tap ${px} ${py}`, 'tap');
  }
  async swipe(a, b, seconds) { this.sh(`input swipe ${[a.x, a.y, b.x, b.y].map((v) => Math.round(v * this.scale)).join(' ')} ${Math.round(seconds * 1000)}`, 'swipe'); }
  async key(ch) {
    if (ch === ' ') return this.sh('input keyevent KEYCODE_SPACE', 'type');
    this.sh(`input text '${ch.replace(/'/g, `'\\''`).replace(/%/g, '\\%')}'`, 'type');
  }
  async press(name) { this.sh(`input keyevent ${KEYS[name.toLowerCase()][1]}`, `press ${name}`); }
  async things() {
    this.sh('uiautomator dump /sdcard/studio-ui.xml >/dev/null', 'read the screen');
    const xml = this.sh('cat /sdcard/studio-ui.xml', 'read the screen');
    const out = [];
    for (const m of xml.matchAll(/<node [^>]*?>/g)) {
      const a = (k) => m[0].match(new RegExp(`${k}="([^"]*)"`))?.[1] ?? '';
      const words = [a('text'), a('content-desc')].filter(Boolean).join(' ');
      const b = a('bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (words && b) out.push({ words, box: [b[1] / this.scale, b[2] / this.scale, (b[3] - b[1]) / this.scale, (b[4] - b[2]) / this.scale] });
    }
    return out;
  }
  async still(file) {
    const r = spawnSync(this.tools.adb, ['-s', this.serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 128 * 1024 * 1024 });
    if (r.status !== 0) this.h.stop('The Android emulator could not take a still.');
    fs.writeFileSync(file, r.stdout);
  }
  startRecording(file) {
    this.remote = '/sdcard/studio-take.mp4';
    this.local = file;
    const child = spawn(this.tools.adb, ['-s', this.serial, 'shell', 'screenrecord', '--bit-rate', '20000000', this.remote], { stdio: 'ignore' });
    // screenrecord starts drawing about a third of a second after it is asked (not measured on this Mac).
    return new Promise((resolve) => setTimeout(() => resolve({ child, started: Date.now() / 1000, stop: () => this.stopRecording(child) }), 350));
  }
  async stopRecording(child) {
    run(this.tools.adb, ['-s', this.serial, 'shell', 'pkill -INT screenrecord']);
    await new Promise((r) => { child.on('exit', r); setTimeout(r, 8000); });
    await new Promise((r) => setTimeout(r, 800));
    this.adb(['pull', this.remote, this.local], 'hand over the recording', { timeout: 120000 });
    run(this.tools.adb, ['-s', this.serial, 'shell', `rm -f ${this.remote}`]);
  }
}

/** Where to tap for words: the accessibility label that matches best, or a stop that says what is there. */
function findThing(list, words, n, stop) {
  if (!list) stop(`Step ${n}: finding "${words}" by its words needs the screen's accessibility labels, which on the iOS Simulator come from idb (see "Phone apps" in tools/capture/README.md). Or tap a place: {"tap": [x, y]} in screen points.`);
  const w = words.toLowerCase();
  const hits = list.filter((t) => t.words.toLowerCase() === w).concat(list.filter((t) => t.words.toLowerCase().includes(w) && t.words.toLowerCase() !== w));
  if (!hits.length) stop(`Step ${n}: nothing on the phone's screen says "${words}". On screen: ${[...new Set(list.map((t) => t.words))].slice(0, 15).map((x) => `"${x}"`).join(', ') || 'nothing with a label'}.`);
  const [x, y, bw, bh] = hits[0].box;
  return { x: x + bw / 2, y: y + bh / 2, box: hits[0].box, words: hits[0].words };
}

function seeded(text) {
  let s = createHash('sha1').update(text).digest().readUInt32LE(0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Does the steps on the phone; mode "take" records them. Writes recording.mp4, cursor.json and marks/ into `work`. */
export async function recordPhone({ product, script, opts, mode, work, h, setting }) {
  const { say, stop, round } = h;
  const cfg = { ...(product.raw.phone ?? {}), ...(script.options.platform ? { platform: script.options.platform } : {}), ...(script.options.device ? { device: script.options.device } : {}) };
  const tools = phoneTools();
  const platform = (cfg.platform ?? (tools.simctl ? 'ios' : 'android')).toLowerCase();
  if (!['ios', 'android'].includes(platform)) stop(`"phone": { "platform": "${cfg.platform}" } is "ios" or "android".`);
  if (platform === 'ios' && process.platform !== 'darwin') stop('Phone app takes on iOS need the iOS Simulator, which only exists on a Mac with Xcode. On this computer, record the app yourself (an Android emulator or a phone) and import the recording.');
  if (platform === 'ios' && !tools.simctl) stop('Phone app takes on iOS need the iOS Simulator, which comes with Xcode (free, from the Mac App Store, about 15 GB). This Mac has only the command line tools. Install Xcode, open it once to finish, then run: sudo xcode-select -s /Applications/Xcode.app. Until then, record the app by hand with Cap.');
  if (platform === 'android' && !tools.adb) stop('Phone app takes on Android need the Android emulator, which comes with Android Studio (free, from developer.android.com/studio). Install it, make a virtual device in its Device Manager and start it. Until then, record the app by hand with Cap.');
  const phone = platform === 'ios' ? new IOS(cfg, tools, h) : new Android(cfg, tools, h);
  await phone.boot();
  say(`  ${phone.name}: ${phone.device}, screen ${phone.points.join(' x ')} points at x${phone.scale}${platform === 'ios' && !tools.idb ? ' (no idb: taps, typing and swipes are not possible)' : ''}`);
  if (cfg.install) await phone.install(path.resolve(path.dirname(product.file), cfg.install));
  await phone.dress(script.options.theme ?? setting?.theme ?? 'light');
  const random = seeded(script.file);
  const events = [];
  const pathRows = [];
  const marks = {};
  const details = {};
  const warnings = [];
  let t0 = null;
  const now = () => (t0 === null ? 0 : Date.now() / 1000 - t0);
  const sleep = (s) => new Promise((r) => setTimeout(r, Math.max(0, s * 1000)));
  const event = (e) => { const row = { t: round(now()), ...e }; events.push(row); return row; };
  const [W, H] = phone.points;
  const raw = work ? path.resolve(work, platform === 'ios' ? 'phone.mov' : 'phone.mp4') : null;
  let rec = null;
  try {
    // The first step (open) happens before the recording starts, so a take never opens on the home screen.
    await phone.open(script.steps[0].open);
    await sleep(2.5);
    if (mode === 'take') {
      rec = await phone.startRecording(raw).catch((e) => stop(`The ${phone.name} could not start recording: ${e.message}`));
      t0 = rec.started;
    } else t0 = Date.now() / 1000;
    await sleep(h.LEAD);
    for (const [i, step] of script.steps.entries()) {
      if (i === 0) continue;
      const n = i + 1;
      const kind = Object.keys(step).find((k) => PHONE_STEPS.includes(k));
      const start = now();
      if (kind === 'open') { await phone.open(step.open); event({ type: 'open', target: step.open, step: n }); await sleep(1.5); }
      else if (kind === 'tap') {
        const at = Array.isArray(step.tap) ? { x: step.tap[0], y: step.tap[1] } : findThing(await phone.things(), step.tap, n, stop);
        if (at.x < 0 || at.y < 0 || at.x > W || at.y > H) stop(`Step ${n}: [${step.tap}] is outside the screen (${W} x ${H} points).`);
        pathRows.push([round(now()), round(at.x, 1), round(at.y, 1)]);
        const click = event({ type: 'click', input: 'touch', gesture: step.hold ? 'long press' : 'tap', x: round(at.x, 1), y: round(at.y, 1), step: n, ...(at.words ? { target: at.words } : {}) });
        await phone.tap(at.x, at.y, step.hold);
        click.up = round(now());
        await sleep(0.6);
      } else if (kind === 'type') {
        const keys = [];
        for (const ch of step.type) {
          keys.push(round(now()));
          await phone.key(ch);
          await sleep(0.04 + random() * 0.06);
        }
        events.push({ t: round(start), type: 'type', end: round(now()), text: step.type, keys, step: n });
      } else if (kind === 'swipe') {
        const v = SWIPES[step.swipe] ? SWIPES[step.swipe].map((f, k) => f * (k % 2 ? H : W)) : step.swipe;
        const [a, b] = [{ x: v[0], y: v[1] }, { x: v[2], y: v[3] }];
        const seconds = step.seconds ?? 0.45;
        const e = event({ type: 'swipe', input: 'touch', from: [round(a.x, 1), round(a.y, 1)], to: [round(b.x, 1), round(b.y, 1)], step: n });
        await phone.swipe(a, b, seconds);
        // The finger's path, eased as the device moves it, one row a frame.
        const t = e.t;
        const rowsN = Math.max(2, Math.round(seconds * h.FPS));
        e.path = Array.from({ length: rowsN + 1 }, (_, k) => { const u = k / rowsN; const s = 0.5 - Math.cos(Math.PI * u) / 2; return [round(t + u * seconds), round(a.x + (b.x - a.x) * s, 1), round(a.y + (b.y - a.y) * s, 1)]; });
        pathRows.push(...e.path);
        e.end = round(Math.max(now(), t + seconds));
        await sleep(0.5);
      } else if (kind === 'press') { event({ type: 'press', key: step.press, step: n }); await phone.press(step.press); await sleep(0.6); }
      else if (kind === 'wait') await sleep(step.wait);
      else if (kind === 'wait for') {
        const limit = step.limit ?? 20;
        for (;;) {
          const list = await phone.things();
          if (!list) stop(`Step ${n}: waiting for words needs the screen's accessibility labels (idb on iOS). Use {"wait": seconds} instead.`);
          if (list.some((t) => t.words.toLowerCase().includes(step['wait for'].toLowerCase()))) break;
          if (now() - start > limit) stop(`Step ${n}: "${step['wait for']}" did not appear on the phone within ${limit} seconds.`);
          await sleep(0.4);
        }
        if (now() - start > 1.5) events.push({ t: round(start), type: 'wait', end: round(now()), what: `"${step['wait for']}"`, speed_up: true, step: n });
      } else if (kind === 'mark') {
        await sleep(0.3);
        marks[step.mark] = round(now());
        event({ type: 'mark', name: step.mark, step: n });
        if (work) {
          const file = path.join(work, 'marks', `${step.mark}.png`);
          await phone.still(file);
          // Stills are kept at twice the screen's points, like the recording.
          h.ffmpeg(['-i', file, '-vf', `scale=${W * h.SCALE}:${H * h.SCALE}:flags=lanczos`, '-frames:v', '1', file + '.png'], 'size a still');
          fs.renameSync(file + '.png', file);
          const words = await phone.things().catch(() => null);
          details[step.mark] = { t: marks[step.mark], step: n, ...(words ? { words: [...new Set(words.map((x) => x.words))].join('\n') } : {}) };
        }
      } else if (kind === 'line') event({ type: 'line', id: step.line, step: n + 1 });
      say(`  ${String(n).padStart(2)}  ${start.toFixed(2)}s  ${kind} ${JSON.stringify(step[kind])}`);
    }
    await sleep(h.TAIL);
  } finally {
    if (rec) await rec.stop();
    await phone.undress().catch(() => {});
  }
  const seconds = now();
  if (!work) return { seconds, events, marks, warnings };
  if (!fs.existsSync(raw) || fs.statSync(raw).size < 1000) stop(`The ${phone.name} made no recording.`);
  // The device's own recording, at its own pixels and a changing frame rate, made into a steady 60 fps at twice the
  // screen's points (an iPhone's own pixels are three times its points, so this is a small, sharp step down).
  say(`Making the video from the ${phone.name}'s recording...`);
  h.ffmpeg(['-i', raw, '-t', seconds.toFixed(3), '-vf', `scale=${W * h.SCALE}:${H * h.SCALE}:flags=lanczos,fps=${h.FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-profile:v', 'high', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-movflags', '+faststart', '-r', String(h.FPS), path.join(work, 'recording.mp4')], 'make the recording');
  const source = h.probe(raw);
  fs.rmSync(raw, { force: true });
  const cursor = {
    about: `A phone app take, by touch: positions in screen points (the screen is ${W} x ${H}; the recording is twice that), on the recording clock, in seconds. path rows are [seconds, x, y] where the finger touched. events: click (input "touch", gesture "tap" or "long press", up when the finger lifted, target: the words tapped), swipe (from, to and the finger's path), type (every key time), press (a phone button), open, wait (speed_up: the engine may play it faster), mark, line.`,
    page: { width: W, height: H },
    scale: h.SCALE,
    seconds: round(seconds),
    input: 'touch',
    frame_as: platform === 'ios' ? 'phone ios' : 'phone android',
    path: pathRows.sort((a, b) => a[0] - b[0]),
    events: events.sort((a, b) => a.t - b.t),
  };
  fs.writeFileSync(path.join(work, 'cursor.json'), JSON.stringify(cursor) + '\n');
  return {
    seconds,
    page: { width: W, height: H },
    marks,
    mark_details: details,
    warnings,
    events: cursor.events,
    source: { type: 'phone app', platform, device: phone.device, screen_points: [W, H], device_scale: phone.scale, recorded_by: platform === 'ios' ? 'xcrun simctl io recordVideo' : 'adb shell screenrecord', touch_by: platform === 'ios' ? (tools.idb ? 'idb' : 'none (no idb)') : 'adb shell input', app: cfg.app ?? null, status_bar: 'cleaned (9:41, full battery and signal)', device_recording: { width: source.width, height: source.height, seconds: h.round(source.seconds) }, clock_note: platform === 'ios' ? 'The recording clock starts when the simulator said "Recording started".' : 'The recording clock starts about 0.35 s after screenrecord was asked to start (an estimate).' },
  };
}
