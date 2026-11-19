#!/usr/bin/env node
// Records a brand's web product in the installed Google Chrome, following plain steps written in the job.
//
//   capture.mjs signin <brand>             open Chrome at the product so a person signs in by hand, once per brand
//   capture.mjs relist                     put every job's best take back where the engine plays it (after a fresh clone)
//   capture.mjs run <job_dir> <id>         record the next numbered take of jobs/<job>/capture/<id>.json
//   capture.mjs rehearse <job_dir> <id>    do the steps in a visible window at half speed, without recording
//   capture.mjs dry <job_dir> <id>         do the steps fast, without recording, to check every target is found
//   capture.mjs check <job_dir> <id>       do the steps again and say which marked moments look different now
//                                          (each mark three ways: the picture, the words, where things sit)
//   capture.mjs compare <job_dir> <id> <take> <take>  the same three-way comparison between two saved takes, no Chrome
//   capture.mjs takes <job_dir> <id>       list the takes and which one is the best
//   capture.mjs best <job_dir> <id> <n>    make take n the best take (the one the engine plays)
//   capture.mjs steps                      list the steps a capture script can use
//   capture.mjs show <job_dir> <id>        open the product; you click through the flow and the tool writes the steps
//   capture.mjs connect [brand]            check that your own Chrome can be reached through the Playwright Extension
//   capture.mjs email <job_dir> <name>     turn an e-mail the product sent (a test inbox, or a folder of .eml files)
//                                          into a still and a short recording, private words blurred
//   capture.mjs answers <job_dir> <id>     say which AI answers a capture replays, from when; --forget records anew
//   capture.mjs kinds                      list the product kinds a brand's capture.json can name
//   capture.mjs site <brand>               build the brand's WordPress demo site from its blueprint and keep it up
//                                          until Ctrl+C (takes build their own, fresh each time, and tear it down)
//
// Options: --browser mine|studio (mine: your own Chrome through the Playwright Extension, the default for run,
// rehearse, dry and show; studio: the studio's own window, the default for check), --chrome-profile "Profile 2"
// (which of your Chrome profiles), --wait <seconds> (how long to wait for you to allow the tab, 180),
// --from <mark> (run, rehearse: replay the steps before that mark fast and unrecorded, then start there),
// --show (studio window: watch it; keep your own mouse off it), --timeout <seconds> (how long a step waits for its
// target, 8 by default), --png (lossless frames, slower), --mark-key Control+M and --start /path (show),
// --as <role> (signin: the sign-in of a second demo user, for "as" steps), --fresh-answers (run: record the AI's
// answers again instead of replaying them), --no-recipes (skip the brand's setup and tidy scripts).
// Reads   brands/<brand>/product/capture.json (where the product lives, the clean screen, the clock, what never to
//         show), the job's job.json and the capture script
// Writes  jobs/<job>/capture/<id>/take-<n>/  recording.mp4, cursor.json, tracks.json, capture.json, marks/,
//         warnings.txt; best.json (the best take); failure/ (when a run stops); check/ (check only)
//         engine/public/jobs/<job>/capture/<id>/  the best take's recording, cursor and tracks, for the engine
// The sign-in lives in .capture/<brand>/ (never synced). The tool never types, reads or keeps a password or code.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { toolEnv } from '../lib/ff.mjs';
import { copyTree } from '../lib/fsx.mjs';
import { brandDir, brandOfJob, rel, STUDIO } from '../brand/lib.mjs';
import { connectYourChrome, EXTENSION_STORE } from './yourchrome.mjs';
import { dresser, nudger, showRecorder, readyFacts, covering, visibleMatches, privacyScan, wordsOnScreen, layoutNow, lookalikes, trackedNow, scrollerOf, FIRST_NAMES } from './inpage.mjs';
import { compareWords, describeWords, wordsChanged, compareLayout, describeLayout } from './freshness.mjs';
import { kindOf as productKind, KIND_LIST } from './kinds.mjs';
import { Answers } from './answers.mjs';
import { layerOn, layerOff, snapshotOf } from './parts.mjs';
import { emailCommand } from './email.mjs';
import { siteOf, startSite, PLAYGROUND_CLI } from './site.mjs';
import { recordTerminal, parseTerminalScript } from './terminal.mjs';
import { recordPhone, parsePhoneScript, phoneTools } from './phone.mjs';

const PAGE = { width: 1920, height: 1080 }; // the window, in page pixels
const SCALE = 2; // device pixels per page pixel: the recording and the stills are 3840 x 2160
const FPS = 60;
const CRF = 12;
const LEAD = 0.5; // the recording holds this long before the first step
const TAIL = 0.8; // and this long after the last one
const GAP = 0.25; // a person's small pause between steps
const SAMPLE = 1 / 60; // the mouse is moved this often while it travels
const NET_QUIET = 0.5; // "ready" needs no network requests for this long
const PICTURE_QUIET = 0.25; // and the picture unchanged for this long
const READY_LIMIT = 20; // seconds a page may take to be ready before the take stops
const SETTLE_LIMIT = 4; // seconds the tool waits for the page to settle after a step before it carries on
const SIGNIN_PATHS = ['/login', '/log-in', '/signin', '/sign-in', '/auth', '/sso'];
const PASSWORD_WORDS = /pass(word|code|phrase)|one[- ]?time|\botp\b|verification code|security code|sign[- ]?in code|2fa|two[- ]factor|\bmfa\b|\bpin\b/i;
const STEP_KINDS = ['open', 'click', 'double-click', 'right-click', 'type', 'paste', 'press', 'select', 'check', 'toggle', 'drag', 'hover', 'scroll', 'upload', 'wait', 'wait for', 'switch', 'back', 'reload', 'size', 'theme', 'mark', 'track', 'mask', 'line', 'layer', 'snapshot', 'as'];
const SIZES = { desktop: [1920, 1080], laptop: [1440, 900], tablet: [820, 1180], phone: [390, 844], 'phone large': [430, 932] };
const MAIN = 'main'; // the first demo user: the brand's own sign-in
const PANEL_SIZE = [360, 900]; // an extension's side panel, unless the brand says otherwise
const PACES = { normal: { move: 1, type: 1, hold: 1 }, slow: { move: 2, type: 2, hold: 2 }, fast: { move: 0.12, type: 0, hold: 0.08 } };
const IGNORED_REQUESTS = new Set(['eventsource', 'websocket', 'ping', 'beacon']);
// Requests that run in the background of most products and never mean the page is still loading: sign-in token
// refreshes, analytics, error reporting, chat and session recorders. Found on Tulvo, 11 Nov 2026 (its Amazon
// sign-in service keeps refreshing). A brand adds its own in capture.json, "background_requests".
const BACKGROUND_HOSTS = [
  'cognito-idp.', 'cognito-identity.', 'securetoken.googleapis.com', 'identitytoolkit.googleapis.com', 'auth0.com', 'clerk.',
  'google-analytics.com', 'googletagmanager.com', 'analytics.google.com', 'doubleclick.net', 'facebook.com/tr', 'connect.facebook.net',
  'segment.io', 'segment.com', 'mixpanel.com', 'amplitude.com', 'posthog.com', 'heap.io', 'hotjar.com', 'clarity.ms', 'fullstory.com',
  'sentry.io', 'datadoghq.com', 'bugsnag.com', 'logrocket.', 'intercom.io', 'intercomcdn.com', 'crisp.chat', 'tawk.to', 'hubspot.com',
  'hs-analytics.net', 'linkedin.com/px', 'ads-twitter.com', 'stripe.com/b', 'm.stripe.network', 'r.stripe.com',
  // Live-update channels that stay open as long as the page is open (Tulvo uses Firestore's).
  'Firestore/Listen/channel', 'Firestore/Write/channel', 'firebaseio.com', '.pusher.com', 'ably.io', 'ably-realtime.com', '/realtime/v1/', 'pubnub.com',
];
const FFMPEG = toolEnv({}).FFMPEG || 'ffmpeg';   // found by setup/runtime/resolve.mjs

// Things most products' pages carry that never belong in a film. A brand turns these off with
// "clean_screen": { "studio_defaults": false }.
const STUDIO_HIDE = [
  ['cookie banner', '#onetrust-consent-sdk, #onetrust-banner-sdk, .onetrust-pc-dark-filter, #CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, #usercentrics-root, #usercentrics-cmp-ui, #truste-consent-track, #consent_blackbar, .truste_overlay, .truste_box_overlay, .qc-cmp2-container, #didomi-host, .osano-cm-window, .cc-window, .cc-banner, .cc-revoke, #cookie-law-info-bar, .cli-modal-backdrop, .cky-consent-container, .cky-overlay, .cky-btn-revisit-wrapper, #cmplz-cookiebanner-container, .cmplz-cookiebanner, #moove_gdpr_cookie_info_bar, #iubenda-cs-banner, #hs-eu-cookie-confirmation, #cookiescript_injected, .fc-consent-root, [id^="sp_message_container"], #cookie-banner, #cookieBanner, .cookie-banner, #cookie-consent, .cookie-consent, #cookie-notice, .cookie-notice, #gdpr-cookie-notice, [aria-label="cookieconsent"]'],
  ['chat widget (Intercom)', '#intercom-container, #intercom-frame, .intercom-lightweight-app, .intercom-namespace, iframe[name^="intercom"]'],
  ['chat widget (Crisp)', '#crisp-chatbox, .crisp-client'],
  ['chat widget (Tawk)', 'iframe[title="chat widget" i], [class*="tawk-"], iframe[src*="tawk.to"]'],
  ['chat widget (Drift)', '#drift-widget, #drift-widget-container, #drift-frame-controller, #drift-frame-chat, iframe[id^="drift"]'],
  ['chat widget (HubSpot)', '#hubspot-messages-iframe-container, #hubspot-conversations-iframe'],
  ['chat widget (Zendesk)', 'iframe#launcher, iframe#webWidget, [data-product="web_widget"], iframe[title*="messaging window" i]'],
  ['chat widget (other)', '#fc_frame, #chat-widget-container, #tidio-chat, #olark-wrapper, .fb_dialog, .fb-customerchat'],
].map(([what, selector]) => ({ what, selector }));

class Stop extends Error {
  constructor(message, info = {}) { super(message); this.info = info; }
}
let brandInUse = '<brand>'; // for messages
const stop = (msg, info) => { throw new Stop(msg, info); };
const sleep = (s) => new Promise((r) => setTimeout(r, Math.max(0, s * 1000)));
const wall = () => (performance.timeOrigin + performance.now()) / 1000; // seconds since 1970, like Chrome's frame times
const round = (n, places = 3) => Math.round(n * 10 ** places) / 10 ** places;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const readJson = (file, what) => {
  if (!fs.existsSync(file)) stop(`${what} is missing: ${rel(file)}`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { stop(`${rel(file)} is not valid JSON: ${e.message}`); }
};
const say = (s) => console.log(s);
const show = (step) => JSON.stringify(step);
const kindOf = (step) => Object.keys(step).find((k) => STEP_KINDS.includes(k));

// ---------------------------------------------------------------- the brand's product

/** brands/<brand>/product/capture.json, checked. */
function productOf(brand) {
  const file = path.join(brandDir(brand), 'product', 'capture.json');
  if (!fs.existsSync(file)) stop(`The brand "${brand}" has no ${rel(file)} yet, so the tool does not know where its product lives. Copy brands/_template/product/capture.json there and fill it in.`);
  const p = readJson(file, 'The product file');
  // A WordPress demo site built from a blueprint gets its address when it is built; a desktop app, phone app or
  // command-line tool may have no web address at all.
  const site = siteOf(file, p);
  const recorder = productKind(p.kind).preset?.recorder;
  let url;
  if (!p.address && (site?.kind === 'blueprint' || recorder)) url = new URL(site?.kind === 'blueprint' ? 'http://127.0.0.1' : `${recorder}://${brand}`);
  else try { url = new URL(p.address); } catch { stop(`${rel(file)}: "address" must be the product's full web address, like https://app.example.com`); }
  if (!/^https?:$/.test(url.protocol) && !(recorder && !p.address)) stop(`${rel(file)}: "address" must start with https:// or http://`);
  const rules = (p.never_show ?? []).map((r) => (typeof r === 'string' ? { what: r } : r));
  const clean = p.clean_screen ?? {};
  const list = (key) => (clean[key] ?? []).map((r, i) => {
    if (typeof r === 'string') return { what: r, text: r };
    if (!r || typeof r !== 'object') stop(`${rel(file)}: clean_screen.${key} item ${i + 1} must be words or { "what": ..., "selector": ... }`);
    return { what: r.what ?? r.selector ?? r.text ?? r.when ?? r.click, ...r };
  });
  const dismiss = list('dismiss');
  dismiss.forEach((d, i) => { if (!d.click && !d.press) stop(`${rel(file)}: clean_screen.dismiss item ${i + 1} ("${d.what}") needs "click" (the words on the button that closes it) or "press" (a key, like "Escape").`); });
  return {
    file,
    address: url.href.replace(/\/$/, ''),
    host: url.host,
    demo: p.demo_account ?? '',
    safe: p.safe_to_show ?? [],
    rules,
    signinPaths: p.signin_paths ?? SIGNIN_PATHS,
    background: [...BACKGROUND_HOSTS, ...(p.background_requests ?? [])],
    clean: { defaults: clean.studio_defaults !== false, hide: list('hide'), dismiss, keep: list('keep') },
    setting: p.setting ?? {},
    clock: p.clock,
    site,
    browser: p.browser || null,
    chromeProfile: p.chrome_profile || null,
    // E-mail domains a never-show e-mail rule already allows are not flagged by the privacy scan either.
    allowEmail: rules.flatMap((r) => (r.pattern && /@/.test(r.pattern) ? r.allow ?? [] : [])),
    raw: p,
  };
}

/**
 * The product with its kind's preset filled in ("kind" in the script, else in the brand's capture.json): page size,
 * touch, waits, clean screen, privacy, which Chrome. The brand's and the script's own settings always win; the
 * preset's lists are added to the brand's.
 */
function withKind(product, script) {
  const p = product.raw;
  const word = script.options.kind ?? p.kind;
  const k = productKind(word);
  if (k.error) stop(`${word === script.options.kind ? rel(script.file) : rel(product.file)}: ${k.error}`);
  const kind = k.preset;
  const out = { ...product, kind: k.name, recorder: kind.recorder ?? 'web' };
  // A desktop app built with Electron: launched from its path and recorded through Playwright's Electron support.
  if (out.recorder === 'desktop') out.app = desktopAppOf(product);
  const clean = product.clean;
  out.clean = {
    ...clean,
    hide: [...(clean.defaults ? kind.hide ?? [] : []), ...clean.hide],
    dismiss: [...(clean.defaults ? kind.dismiss ?? [] : []), ...clean.dismiss],
    keep: [...(kind.keep ?? []), ...clean.keep],
  };
  out.rules = [...product.rules, ...(kind.never_show ?? [])];
  out.signinPaths = p.signin_paths ?? [...SIGNIN_PATHS, ...(kind.signin_paths ?? [])];
  out.background = [...product.background, ...(kind.background ?? [])];
  out.browser = product.browser || kind.browser || null;
  out.limits = { ready: p.ready_limit ?? kind.ready_limit, settle: p.settle_limit ?? kind.settle_limit, stopped: { ...(kind.stopped ?? {}), ...(p.stopped ?? {}) } };
  // The page size the take starts at, and whether touch is on (phone web).
  const size = script.options.size ?? p.size ?? kind.size ?? 'desktop';
  const frame = size === 'popup' || size === 'app' ? size : SIZES[size] ?? (Array.isArray(size) && size.length === 2 && size.every((x) => Number.isInteger(x) && x >= 200 && x <= 3840) ? size : null);
  if (!frame) stop(`The page size "${JSON.stringify(size)}" is not one the tool knows: ${Object.keys(SIZES).join(', ')}, or [width, height] in page pixels.`);
  out.frame = frame;
  out.touch = Boolean(script.options.touch ?? p.touch ?? kind.touch ?? false);
  // AI answers recorded once and replayed: the brand's list of its own calls, else the kind's.
  const ai = p.ai ?? {};
  out.answers = ai.replay === false ? null : ai.answers ?? kind.answers ?? null;
  if (out.answers && (!Array.isArray(out.answers) || !out.answers.every((x) => typeof x === 'string' && x))) stop(`${rel(product.file)}: "ai": { "answers": [...] } is a list of the product's own addresses whose answers are recorded and replayed, like ["/api/chat"].`);
  // A browser extension loaded into the studio's window from a folder.
  // Loaded only for a take that films it (kind "extension", or a step that opens its popup or panel), so the
  // product's own pages are never changed by it in other takes.
  out.extension = null;
  const films = k.name === 'extension' || script.steps?.some((st) => /^extension:/i.test(st.open ?? ''));
  if (p.extension?.folder && films) {
    const folder = path.resolve(path.dirname(product.file), p.extension.folder);
    if (!fs.existsSync(path.join(folder, 'manifest.json'))) stop(`${rel(product.file)}: the extension folder ${folder} has no manifest.json. Name the unpacked extension's folder (the one with manifest.json in it).`);
    out.extension = { folder, popupSize: p.extension.popup_size ?? null, panelSize: p.extension.panel_size ?? PANEL_SIZE };
  } else if (films) stop(`${rel(product.file)}: an "extension" product needs "extension": { "folder": "..." }, the unpacked extension's folder (the one with manifest.json).`);
  // The brand's setup and tidy scripts, run before and after every take.
  out.recipes = {};
  for (const which of ['setup', 'tidy']) {
    const f = p.recipes?.[which];
    if (!f) continue;
    out.recipes[which] = path.resolve(path.dirname(product.file), f);
    if (!fs.existsSync(out.recipes[which])) stop(`${rel(product.file)}: the ${which} script ${rel(out.recipes[which])} named under "recipes" is missing.`);
  }
  return out;
}

const profileDir = (brand, role = MAIN) => role === MAIN ? path.join(STUDIO, '.capture', brand, 'profile') : path.join(STUDIO, '.capture', brand, 'as', role, 'profile');

/** Chrome's address and card autofill off in the studio's own profile (the password manager is left as it is). */
function autofillOff(brand, role = MAIN) {
  const file = path.join(profileDir(brand, role), 'Default', 'Preferences');
  let prefs = {};
  try { prefs = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  if (prefs.autofill?.profile_enabled === false && prefs.autofill?.credit_card_enabled === false) return;
  prefs.autofill = { ...(prefs.autofill ?? {}), profile_enabled: false, credit_card_enabled: false };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(prefs));
}

// ---------------------------------------------------------------- language, place, time

/** Seconds since 1970 for a wall time like "2026-11-20 10:30" in a time zone (or an address with its own offset). */
function zonedEpoch(text, timeZone) {
  const s = String(text).trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) { const t = Date.parse(s); return Number.isNaN(t) ? null : t; }
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [Y, M, D, h = '10', mi = '30', sec = '0'] = m.slice(1).map((v, i) => (v === undefined ? [undefined, undefined, undefined, '10', '30', '0'][i] : v));
  const guess = Date.UTC(+Y, +M - 1, +D, +h, +mi, +sec);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const offset = (t) => { const g = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value])); return Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute, +g.second) - t; };
  const first = guess - offset(guess);
  return guess - offset(first);
}

/** The language, region, time zone, light or dark, reduced motion and clock a take uses: the script's, else the brand's. */
function settingOf(product, script, warnings) {
  const b = product.setting, s = script.options;
  const language = String(s.language ?? b.language ?? 'en');
  const region = String(s.region ?? b.region ?? '');
  const locale = language.includes('-') || !region ? language : `${language}-${region.toUpperCase()}`;
  const timeZone = s.time_zone || b.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  try { new Intl.DateTimeFormat('en', { timeZone }); } catch { stop(`"${timeZone}" is not a time zone the tool knows. Use a name like "Europe/London" or "America/New_York".`); }
  const theme = s.theme ?? b.theme ?? 'light';
  if (!['light', 'dark'].includes(theme)) stop(`The theme must be "light" or "dark", not "${theme}".`);
  const reducedMotion = Boolean(s.reduced_motion ?? b.reduced_motion ?? false);
  let clock;
  const brandClock = product.clock;
  if (s.clock === false || (s.clock === undefined && brandClock === false)) clock = { frozen: false };
  else {
    let demo = typeof s.clock === 'string' ? s.clock : brandClock?.demo_time;
    if (!demo) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      demo = `${today} 10:30`;
      warnings.push(`No demo date and time was set, so the clock was frozen at ${demo} today. Set "clock" in the script or the brand's capture.json so takes on different days match.`);
    }
    const epoch = zonedEpoch(demo, timeZone);
    if (epoch === null) stop(`The demo time "${demo}" is not a date and time the tool can read. Write it like "2026-11-20 10:30".`);
    clock = { frozen: true, demo_time: demo, epoch, note: brandClock?.note };
  }
  return { locale, timeZone, theme, reducedMotion, clock };
}

// ---------------------------------------------------------------- Chrome

async function playwright() {
  try { return (await import('playwright-core')).chromium; }
  catch { stop('The capture tool is not installed yet. Run: node setup/runtime/install.mjs   (or: cd tools/capture && npm ci)'); }
}

/** The installed Chrome's own user agent, without the word "Headless", so the product sees a normal Chrome. */
function chromeAgent() {
  const env = process.env;
  const known = {
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'],
    linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
    win32: [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter(Boolean).map((base) => path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe')),
  }[process.platform] ?? [];
  const bin = [env.DAMEX_CHROME, ...known].filter(Boolean).find((candidate) => fs.existsSync(candidate));
  if (!bin) return undefined;
  try {
    const major = execFileSync(bin, ['--version'], { encoding: 'utf8' }).match(/(\d+)\./)[1];
    const os = { darwin: 'Macintosh; Intel Mac OS X 10_15_7', win32: 'Windows NT 10.0; Win64; x64' }[process.platform] ?? 'X11; Linux x86_64';
    return `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
  } catch { return undefined; }
}

/** A phone browser's identity, with the installed Chrome's version: what a phone-size take tells the product. */
function phoneAgent() {
  const major = chromeAgent()?.match(/Chrome\/(\d+)/)?.[1] ?? '157';
  return `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`;
}

/** The id Chrome gives an unpacked extension: from its folder's real path, as Chrome works it out. */
function extensionIdOf(folder) {
  const hex = createHash('sha256').update(fs.realpathSync(folder)).digest('hex').slice(0, 32);
  return [...hex].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
}

async function openChrome(brand, { show, signin = false, setting = null, role = MAIN, frame = [PAGE.width, PAGE.height], touch = false, extension = null, offset = 0 }) {
  const chromium = await playwright();
  const dir = profileDir(brand, role);
  fs.mkdirSync(dir, { recursive: true });
  const common = {
    channel: 'chrome',
    // Playwright switches extensions off by default; a take that films one keeps them on (only its own is loaded).
    ignoreDefaultArgs: ['--enable-automation', ...(extension ? ['--disable-extensions'] : [])],
    // A window behind another (two demo users side by side) keeps drawing, so both are recorded.
    args: ['--disable-blink-features=AutomationControlled', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', ...(extension ? ['--enable-unsafe-extension-debugging'] : [])],
  };
  const size = { width: frame[0], height: frame[1] };
  let ctx;
  try {
    // Our own handlers close the sign-in window, so Ctrl+C still ends with the sign-in saved.
    if (signin) return await chromium.launchPersistentContext(dir, { ...common, headless: false, viewport: null, handleSIGINT: false, handleSIGTERM: false, args: [...common.args, '--window-size=1440,960'] });
    autofillOff(brand, role);
    ctx = await chromium.launchPersistentContext(dir, {
      ...common,
      headless: !show,
      viewport: size,
      screen: size,
      deviceScaleFactor: SCALE,
      // Phone web: touch events, no hover (the page sees a phone's pointer), a phone browser's identity.
      ...(touch ? { hasTouch: true, isMobile: true, userAgent: phoneAgent() } : { userAgent: show ? undefined : chromeAgent() }),
      locale: setting?.locale,
      timezoneId: setting?.timeZone,
      colorScheme: setting?.theme,
      reducedMotion: setting?.reducedMotion ? 'reduce' : 'no-preference',
      args: [...common.args, '--hide-scrollbars', '--run-all-compositor-stages-before-draw', '--disable-features=AutofillServerCommunication,Translate', `--window-size=${Math.max(frame[0], 500)},${Math.max(frame[1], 400)}`, ...(offset ? [`--window-position=${offset},${Math.round(offset / 3)}`] : [])],
    });
  } catch (e) {
    const m = String(e.message);
    if (/ProcessSingleton|profile.*in use|SingletonLock/i.test(m)) stop(`The sign-in Chrome window for "${brand}" is still open. Close it, then try again.`);
    if (/chrome.*(not found|distribution)|Executable doesn't exist/i.test(m)) stop('Google Chrome is not installed. Install it from google.com/chrome, then try again.');
    stop(`Chrome did not start: ${m.split('\n')[0]}`);
  }
  if (extension) {
    // Chrome 137 and later ignore --load-extension, so the extension is loaded the way Chrome allows a trusted tool to:
    // through its own DevTools connection, from the folder, for this window only.
    try {
      const cdp = await ctx.browser().newBrowserCDPSession();
      const { id } = await cdp.send('Extensions.loadUnpacked', { path: extension.folder });
      ctx.__studioExtension = { ...extension, id, manifest: JSON.parse(fs.readFileSync(path.join(extension.folder, 'manifest.json'), 'utf8')) };
    } catch (e) {
      await ctx.close().catch(() => {});
      stop(`Chrome would not load the extension from ${extension.folder}: ${e.message.split('\n')[0].replace(/^.*?: /, '')}. Check that the folder holds an unpacked extension (manifest.json, version 3) that loads in chrome://extensions with "Load unpacked".`);
    }
  }
  return ctx;
}

// ---------------------------------------------------------------- desktop apps (Electron)

/**
 * Where a desktop app lives, from "app" in the brand's capture.json: a packaged app ("/Applications/Notes.app"), or
 * an app's source folder (the one with package.json) with its own Electron in node_modules, or "electron" naming one.
 */
function desktopAppOf(product) {
  const a = product.raw.app;
  const file = rel(product.file);
  if (!a || typeof a.path !== 'string' || !a.path) stop(`${file}: a "desktop" product needs "app": { "path": "..." }, the app (like "/Applications/Notes.app") or its source folder (the one with package.json).`);
  const where = path.resolve(path.dirname(product.file), a.path.replace(/^~(?=[\/\\]|$)/, os.homedir()));
  if (!fs.existsSync(where)) stop(`${file}: the app ${where} is not on this computer.`);
  const args = Array.isArray(a.args) ? a.args.map(String) : [];
  if (/\.app\/?$/.test(where)) {
    // A packaged Mac app: its program is named in its Info.plist (read with plutil, which only a Mac has).
    if (process.platform !== 'darwin') stop(`${file}: ${path.basename(where)} is a packaged Mac app, which cannot run on this computer. Point "app": { "path": "..." } at the app's source folder (the one with package.json) instead, or record the app yourself and import the recording.`);
    const plist = path.join(where, 'Contents', 'Info.plist');
    const name = spawnSync('/usr/bin/plutil', ['-extract', 'CFBundleExecutable', 'raw', plist], { encoding: 'utf8' }).stdout.trim() || path.basename(where, '.app');
    const bin = path.join(where, 'Contents', 'MacOS', name);
    if (!fs.existsSync(bin)) stop(`${file}: ${where} has no program at Contents/MacOS/${name}.`);
    if (!fs.existsSync(path.join(where, 'Contents', 'Frameworks', 'Electron Framework.framework'))) stop(`${file}: ${path.basename(where)} is not built with Electron, so the capture tool cannot drive it. Record it by hand with Cap (tools/capture/README.md, "Recording by hand with Cap").`);
    return { path: where, bin, args, name: path.basename(where, '.app'), packaged: true };
  }
  if (!fs.existsSync(path.join(where, 'package.json'))) stop(`${file}: ${where} is neither an app (.app) nor an app's source folder (no package.json in it).`);
  const electron = a.electron ? path.resolve(path.dirname(product.file), a.electron) : path.join(where, 'node_modules', 'electron', 'dist', ...(process.platform === 'darwin' ? ['Electron.app', 'Contents', 'MacOS', 'Electron'] : [process.platform === 'win32' ? 'electron.exe' : 'electron']));
  if (!fs.existsSync(electron)) stop(`${file}: no Electron to run ${where} with. Install the app's own packages in its folder (npm install), or name an Electron program with "app": { "electron": "..." }.`);
  let name = path.basename(where);
  try { name = JSON.parse(fs.readFileSync(path.join(where, 'package.json'), 'utf8')).productName ?? JSON.parse(fs.readFileSync(path.join(where, 'package.json'), 'utf8')).name ?? name; } catch {}
  return { path: where, bin: electron, args: [where, ...args], name, packaged: false };
}

/** Starts the desktop app through Playwright's Electron support and waits for its first window. */
async function openElectron(app, setting) {
  let electron;
  try { electron = (await import('playwright-core'))._electron; } catch { stop('The capture tool is not installed yet. Run: node setup/runtime/install.mjs   (or: cd tools/capture && npm ci)'); }
  let handle;
  try {
    handle = await electron.launch({ executablePath: app.bin, args: app.args, cwd: app.packaged ? undefined : app.path, timeout: 45000, locale: setting?.locale, timezoneId: setting?.timeZone, colorScheme: setting?.theme, env: { ...process.env, ELECTRON_ENABLE_LOGGING: '' } });
  } catch (e) {
    const m = e.message.split('\n')[0];
    if (/Timeout|closed|exited/i.test(m)) stop(`${app.name} started but the capture tool could not connect to it (${m}). Some packaged apps switch off the connection tools use (Electron's "fuses"); ask the app's team for a build with them on, or record it by hand with Cap.`);
    stop(`${app.name} did not start: ${m}`);
  }
  const page = await handle.firstWindow({ timeout: 45000 }).catch(() => null);
  if (!page) { await handle.close().catch(() => {}); stop(`${app.name} started but opened no window within 45 seconds.`); }
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  const facts = await handle.evaluate(({ app: a, BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    return { electron: process.versions.electron, chrome: process.versions.chrome, name: a.getName(), version: a.getVersion(), size: w ? w.getContentSize() : null, title: w ? w.getTitle() : null };
  }).catch(() => ({}));
  return { handle, page, facts };
}

/**
 * Which Chrome a command uses: "mine" (the person's own Chrome, through the Playwright Extension) or "studio" (the
 * studio's own window, signed in with capture.mjs signin). --browser wins, then the brand's capture.json "browser",
 * then studio.json "capture_browser", then the owner's default: your own Chrome for recording (run, rehearse, dry,
 * show), the studio's window for freshness checks (check).
 */
function browserFor(mode, product, opts, script = null, answers = null) {
  let studioDefault = null;
  try { studioDefault = JSON.parse(fs.readFileSync(path.join(STUDIO, 'studio.json'), 'utf8')).capture_browser ?? null; } catch {}
  const b = opts.browser || (mode === 'check' ? 'studio' : product.browser || studioDefault || 'mine');
  if (!['mine', 'studio'].includes(b)) stop(`"${b}" is not a browser the capture tool knows. Use --browser mine (your own Chrome) or --browser studio (the studio's own window).`);
  // Some takes need what only the studio's own window can do: load an extension, start at phone size with touch,
  // open a second demo user's window, or record an AI answer with Playwright's HAR recording.
  const needs = product.extension ? 'loads the brand\'s extension' : product.touch ? 'is phone size with touch on' : script?.roles?.size ? 'has a second demo user' : answers?.mode === 'record' ? 'records the AI\'s answers for the first time' : null;
  if (needs && b === 'mine') {
    if (opts.browser === 'mine') stop(`This take ${needs}, which only the studio's own window can do (your own Chrome cannot be set up that way from outside). Run it with --browser studio (sign in there once with: node tools/capture/capture.mjs signin ${brandInUse}).`);
    say(`  this take ${needs}, so it runs in the studio's own window`);
    return 'studio';
  }
  return b;
}

/** The plain steps a person follows when their own Chrome did not connect. */
function notConnected(why, wait, brand) {
  const head = why === 'no-answer'
    ? `Your own Chrome did not connect within ${wait} seconds.`
    : why === 'no-tab' ? 'Your Chrome connected, but the tool could not open its own tab in it.'
    : 'The Playwright Extension in your Chrome refused or dropped the connection.';
  return `${head} To record through your own Chrome:
  1. Install the free Playwright Extension (by Microsoft) in Chrome, once: ${EXTENSION_STORE} and click "Add to Chrome".
  2. Run the same command again. Chrome opens a "Playwright Extension" page: click "Allow & select" next to any tab.
     (The tool then opens a tab of its own next to it and never touches the tab you picked or any other.)
  3. If Chrome showed "This page has been blocked" or an error page instead, the extension is not installed in the
     Chrome profile that opened. Install it there, or name your profile with --chrome-profile "Profile 2" (the last
     part of "Profile Path" on the page chrome://version).
  4. If the extension's page said it needs a newer version, update it: chrome://extensions, then "Update".
You can close the Playwright Extension page in Chrome. Or record in the studio's own window instead: add --browser studio (sign in there once with: node tools/capture/capture.mjs signin ${brand}).`;
}

async function openYourChrome(brand, product, opts) {
  const chromium = await playwright();
  const wait = opts.wait ?? 180;
  say('Connecting to your own Chrome through the Playwright Extension...');
  say('  Chrome now shows a "Playwright Extension" page. Click "Allow & select" next to any tab.');
  say('  The tool opens a tab of its own next to it for this, and leaves the tab you pick and all your other tabs alone.');
  try {
    const mine = await connectYourChrome(chromium, { clientName: `Studio capture (${brand})`, profile: opts.chromeProfile || product.chromeProfile, wait });
    say('  connected: the tool works in its own new tab in your Chrome. Keep your mouse off that window, and keep it uncovered, until it is done.');
    return mine;
  } catch (e) {
    if (['no-answer', 'refused', 'no-tab'].includes(e.message)) stop(notConnected(e.message, wait, brand));
    if (/EPERM|EACCES/.test(e.message)) stop(`The tool could not start its small connection point on this Mac (${e.message.split('\n')[0]}). Something on this Mac blocks local connections; record in the studio's own window instead with --browser studio.`);
    stop(`Connecting to your own Chrome failed: ${e.message.split('\n')[0]}`);
  }
}

/** capture.mjs connect [brand]: tries the connection to your own Chrome once, and says plainly whether it works. */
async function connectTest(brand, opts) {
  brand = brand || null;
  const product = brand ? productOf(brand) : { chromeProfile: null };
  const mine = await openYourChrome(brand ?? 'test', product, opts);
  try {
    const v = await mine.page.evaluate(() => navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]).catch(() => null);
    await sleep(1.5);
    say(`Your own Chrome${v ? ` (version ${v})` : ''} is reachable through the Playwright Extension. The tool opened a tab of its own and is closing it now; the tab you picked was not touched.`);
  } finally {
    await mine.relay.closeOwnTabs().catch(() => {});
    mine.relay.stop();
  }
  return 0;
}

// ---------------------------------------------------------------- signin

async function signin(brand, closeAfter, role = MAIN) {
  if (!brand) stop('Which brand? For example: capture.mjs signin tulvo');
  if (!fs.existsSync(path.join(brandDir(brand), 'brand.json'))) stop(`There is no brand folder brands/${brand}/.`);
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(role)) stop(`A demo user's role is one word made of letters, digits and dashes, like --as customer.`);
  const product = productOf(brand);
  if (product.site?.kind === 'blueprint') { say(`${brand} films a WordPress demo site the studio builds fresh for every take from ${rel(product.site.file)}. Each take signs its demo users in by itself (from the site's own link), so there is nothing to sign in to by hand. To look around the site yourself: node tools/capture/capture.mjs site ${brand}`); return 0; }
  const recorder = productKind(product.raw.kind).preset?.recorder;
  if (recorder && recorder !== 'web') { say(`${brand} is a ${product.raw.kind} product: there is no browser sign-in to keep. Sign in inside the ${recorder === 'desktop' ? 'app' : recorder === 'simulator' ? 'phone app' : 'terminal'} itself before a take, by hand, if it needs one.`); return 0; }
  const ctx = await openChrome(brand, { signin: true, role });
  if (role !== MAIN) say(`This is the sign-in for the second demo user "${role}", used by "as" steps. Sign in as that user, not as yourself.`);
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(product.address, { waitUntil: 'domcontentloaded' }).catch(() => {});
  say(`A Chrome window is open at ${product.address}.`);
  say(`1. Sign in there by hand${product.demo ? `, and open the demo account "${product.demo}"` : ''}.`);
  say('2. Close the window when you are done (or quit Chrome with Cmd+Q). This tool never sees what you type.');
  say(`The sign-in is kept on this Mac only, in ${rel(path.dirname(profileDir(brand, role)))}/ (never synced).`);
  await new Promise((resolve) => {
    let finished = false;
    const done = () => { if (!finished) { finished = true; clearInterval(poll); resolve(); } };
    ctx.on('close', done);
    // On a Mac, closing the last window leaves Chrome running, and a close event is not always sent (seen
    // 11 Nov 2026 on Tulvo), so the window count is also checked every second.
    const check = () => { if (ctx.pages().filter((p) => !p.isClosed()).length === 0) done(); };
    const poll = setInterval(check, 1000);
    page.on('close', check);
    ctx.on('page', (p) => p.on('close', check));
    process.once('SIGINT', done);
    process.once('SIGTERM', done);
    if (closeAfter) setTimeout(() => page.close().catch(done), closeAfter * 1000); // for testing: closes the window as a person would
  });
  await ctx.close().catch(() => {});
  fs.writeFileSync(path.join(path.dirname(profileDir(brand, role)), 'signin.json'), JSON.stringify({ window_closed: new Date().toISOString(), address: product.address, role }, null, 2) + '\n');
  say(role === MAIN ? `Chrome is closed and the sign-in for "${brand}" is saved. Captures for ${brand} will use it.` : `Chrome is closed and the sign-in for ${brand}'s demo user "${role}" is saved. Steps like {"as": "${role}"} will use it.`);
}

// ---------------------------------------------------------------- the script

const SCRIPT_OPTIONS = ['start', 'steps', 'clock', 'theme', 'language', 'region', 'time_zone', 'reduced_motion', 'safe', 'settle_limit', 'ready_limit', 'kind', 'size', 'touch'];
const EXAMPLES = { open: '"/"', click: '"New"', 'double-click': '"Morrowby"', 'right-click': '"Morrowby"', hover: '"Leads"', type: '"Morrowby Coffee"', paste: '"A long note"', press: '"Enter"', select: '"Medium"', check: '"Remember me"', toggle: '"Dark mode"', drag: '"Morrowby"', upload: '"files/logo.png"', 'wait for': '"Saved"', switch: '"new"', track: '"Save"', mask: '"jo@example.com"', mark: '"lead-added"', line: '"v3"', layer: '"#summary"', snapshot: '"Summary"', as: '"customer"' };

/** Reads jobs/<job>/capture/<id>.json: a list of steps, or { "steps": [...], plus options like "clock" and "theme" }. */
function scriptOf(jobDir, id, brand) {
  if (!id || !/^[a-z0-9][a-z0-9-_]*$/i.test(id)) stop('Give the capture a name made of letters, digits and dashes, like: capture.mjs run jobs/my-film lead-form');
  const file = path.join(jobDir, 'capture', `${id}.json`);
  const raw = readJson(file, 'The capture script');
  const steps = Array.isArray(raw) ? raw : raw.steps;
  if (!Array.isArray(steps) || steps.length === 0) stop(`${rel(file)} must be a list of steps, like [{"open": "/"}, {"click": "New"}].`);
  if (steps[0]?.open === undefined) stop(`${rel(file)}: the first step must open a page, like {"open": "/"}.`);
  const options = Array.isArray(raw) ? {} : raw;
  Object.keys(options).filter((k) => !k.startsWith('_') && !SCRIPT_OPTIONS.includes(k)).forEach((k) => stop(`${rel(file)}: "${k}" is not something a capture script can set. It can set: ${SCRIPT_OPTIONS.join(', ')}.`));
  const start = options.start ?? null; // null: 62% across and 66% down the page, whatever its size
  const marks = new Set();
  const tracks = new Set();
  const parts = new Set();
  const roles = new Map(); // a second demo user's role -> the page their window opens on
  const needsWords = Object.keys(EXAMPLES);
  steps.forEach((step, i) => {
    const n = i + 1;
    if (!step || typeof step !== 'object' || Array.isArray(step)) stop(`Step ${n} must be written like {"click": "New"}.`);
    const kinds = Object.keys(step).filter((k) => STEP_KINDS.includes(k));
    if (kinds.length !== 1) stop(`Step ${n} ${show(step)}: each step does one thing, one of: ${STEP_KINDS.join(', ')}.`);
    const kind = kinds[0];
    const v = step[kind];
    const words = Object.values(step).filter((x) => typeof x === 'string').join(' ');
    if (kind !== 'type' && kind !== 'paste' && kind !== 'open' && PASSWORD_WORDS.test(words)) stop(`Step ${n} points at a password or sign-in code field. The capture tool never touches those. Sign in by hand with: node tools/capture/capture.mjs signin ${brand}`);
    if ((kind === 'type' || kind === 'paste') && PASSWORD_WORDS.test([step.into, step.in, step.near].join(' '))) stop(`Step ${n} would type into a password or sign-in code field. The capture tool never does that. Sign in by hand with: node tools/capture/capture.mjs signin ${brand}`);
    const ok = kind === 'switch' ? (typeof v === 'string' && v) || Number.isInteger(v) : typeof v === 'string' && v;
    if (needsWords.includes(kind) && !ok) stop(`Step ${n}: "${kind}" needs words, like {"${kind}": ${EXAMPLES[kind]}}.`);
    if (kind === 'wait' && typeof v !== 'number') stop(`Step ${n}: "wait" needs a number of seconds, like {"wait": 1.2}. To wait for something to happen, use {"wait for": "Saved"}.`);
    if (kind === 'scroll' && !(typeof v === 'number' || (typeof v === 'string' && v))) stop(`Step ${n}: "scroll" needs page pixels, like {"scroll": 400}, or the words of the thing to scroll to, like {"scroll": "Pricing"}.`);
    if ((kind === 'back' || kind === 'reload') && v !== true) stop(`Step ${n}: write it as {"${kind}": true}.`);
    if (kind === 'theme' && !['light', 'dark'].includes(v)) stop(`Step ${n}: "theme" is "light" or "dark".`);
    if (kind === 'size' && !(SIZES[v] || (Array.isArray(v) && v.length === 2 && v.every((x) => Number.isInteger(x) && x >= 320 && x <= 3840)))) stop(`Step ${n}: "size" is one of ${Object.keys(SIZES).join(', ')}, or [width, height] in page pixels, like {"size": [390, 844]}.`);
    if (kind === 'drag' && !(typeof step.to === 'string' || (Array.isArray(step.by) && step.by.length === 2))) stop(`Step ${n}: "drag" needs where to drop it: "to" (the words of the place), like {"drag": "Morrowby", "to": "Done"}, or "by" ([right, down] in page pixels), like {"drag": "Volume", "by": [120, 0]}.`);
    if (kind === 'select' && typeof step.from !== 'string') stop(`Step ${n}: "select" needs "from", the list's label, like {"select": "Medium", "from": "Size"}.`);
    if (kind === 'wait for' && step.limit !== undefined && typeof step.limit !== 'number') stop(`Step ${n}: "limit" is a number of seconds.`);
    if (kind === 'wait for' && /^(stopped|stopped changing)$/i.test(v) && typeof step.in !== 'string') stop(`Step ${n}: to wait until text stops changing, say where with "in" (the area's label or heading), like {"wait for": "stopped", "in": "Answer"}.`);
    if (kind === 'mark') {
      if (!/^[a-z0-9][a-z0-9-_]*$/i.test(v)) stop(`Step ${n}: a mark's name may use letters, digits and dashes only, like "lead-added".`);
      if (marks.has(v)) stop(`Step ${n}: there is already a mark called "${v}".`);
      marks.add(v);
    }
    if (kind === 'track') {
      const name = trackName(step);
      if (tracks.has(name)) stop(`Step ${n}: something is already tracked as "${name}". Give this one "name".`);
      tracks.add(name);
    }
    if (kind === 'line' && i === steps.length - 1) stop(`Step ${n}: a "line" step ties the step after it to a voice line, so it cannot be last.`);
    if (kind === 'layer' || kind === 'snapshot') {
      const name = partName(step);
      if (parts.has(`${kind}:${name}`)) stop(`Step ${n}: there is already a ${kind} called "${name}". Give this one "name".`);
      parts.add(`${kind}:${name}`);
    }
    if (kind === 'as') {
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(v)) stop(`Step ${n}: "as" names a demo user's role in one word, like {"as": "customer"}, or {"as": "main"} to go back to the first user.`);
      if (step.page !== undefined && typeof step.page !== 'string') stop(`Step ${n}: "page" is where that user's window opens, like {"as": "customer", "page": "/inbox"}.`);
      if (v.toLowerCase() !== MAIN && !roles.has(v.toLowerCase())) roles.set(v.toLowerCase(), step.page ?? '/');
      else if (step.page !== undefined) stop(`Step ${n}: "page" only goes on the first {"as": "${v}"} step: that is where the window opens before the take starts. Use an "open" step after it to go somewhere else.`);
    }
  });
  const masks = steps.filter((s) => s.mask !== undefined && !s.thing).map((s) => (s.css ? { css: s.css } : { words: s.mask }));
  return { file, steps, start, options, masks, roles };
}

const partName = (step) => (step.name ?? step.layer ?? step.snapshot).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part';
const trackName = (step) => (step.name ?? step.track).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'thing';

// ---------------------------------------------------------------- easing and paths

/** cubic-bezier(0.4, 0, 0.2, 1), the kit's "travel" easing, so a recorded pointer moves like the drawn one. */
function travel(x) {
  const [x1, y1, x2, y2] = [0.4, 0, 0.2, 1];
  const bx = (t) => 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3;
  const by = (t) => 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 30; i++) { t = (lo + hi) / 2; if (bx(t) < x) lo = t; else hi = t; }
  return by(t);
}

/** Ease in and out (a sine curve), for scrolls: starts and stops softly, never a jump. */
const smooth = (u) => 0.5 - Math.cos(Math.PI * clamp(u, 0, 1)) / 2;

/** A point on a gentle arc from a to b (the same curve the kit's cursor uses). */
function arc(a, b, u, bend) {
  const cx = (a.x + b.x) / 2 - (b.y - a.y) * bend * 2;
  const cy = (a.y + b.y) / 2 + (b.x - a.x) * bend * 2;
  const v = 1 - u;
  return { x: v * v * a.x + 2 * v * u * cx + u * u * b.x, y: v * v * a.y + 2 * v * u * cy + u * u * b.y };
}

/** Seeded random numbers, so the same script moves the same way each time. */
function seeded(text) {
  let a = [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- finding things on the page

/** Runs in the page: facts about each candidate element, for choosing one. */
function describe(els, { inside, viewport }) {
  const CONTAINER = 'dialog,[role=dialog],[role=alertdialog],form,section,aside,nav,header,footer,main,article,fieldset,table,[role=region],[role=group],[role=menu],[role=listbox],[role=grid],[role=tabpanel],li,tr,[role=row],[role=listitem],[role=toolbar],[role=list],ul,ol';
  const own = (a) => {
    const parts = [a.getAttribute('aria-label') ?? '', a.getAttribute('title') ?? ''];
    const by = a.getAttribute('aria-labelledby');
    if (by) by.split(/\s+/).forEach((id) => parts.push(document.getElementById(id)?.textContent ?? ''));
    a.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading],legend,caption,th').forEach((h) => parts.push(h.textContent ?? ''));
    if (a.matches('li,tr,[role=row],[role=listitem]')) parts.push(a.innerText ?? '');
    return parts.join(' ').toLowerCase();
  };
  const secret = (el) => {
    const field = el.closest('input,textarea,[contenteditable]') ?? el.querySelector?.('input');
    if (!field || field.tagName !== 'INPUT') return false;
    const words = [field.type, field.name, field.id, field.autocomplete, field.getAttribute('aria-label'), field.placeholder].join(' ');
    return field.type === 'password' || /current-password|new-password|one-time-code/.test(field.autocomplete ?? '') || /pass(word|code)|one[- ]?time|otp|verification/i.test(words);
  };
  return els.map((el) => {
    const r = el.getBoundingClientRect();
    let container = -1;
    if (inside) {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (a.matches(CONTAINER) && own(a).includes(inside.toLowerCase())) { const b = a.getBoundingClientRect(); container = b.width * b.height; break; }
      }
    }
    const style = getComputedStyle(el);
    return {
      x: r.x, y: r.y, w: r.width, h: r.height,
      shown: r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && Number(style.opacity) > 0.05 && !el.closest('[data-studio-hide]'),
      onScreen: r.bottom > 0 && r.top < viewport.height && r.right > 0 && r.left < viewport.width,
      container,
      secret: secret(el),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') ?? '',
    };
  });
}

const FIELD_ROLES = ['textbox', 'combobox', 'searchbox', 'spinbutton'];
const THING_ROLES = ['button', 'link', 'menuitem', 'tab', 'option', 'checkbox', 'radio', 'switch', 'treeitem', 'menuitemcheckbox', 'menuitemradio', 'listitem', 'row', 'gridcell', 'cell'];
const TICK_ROLES = ['checkbox', 'switch', 'radio', 'menuitemcheckbox', 'menuitemradio'];

/** The ways a target can be named, tried in order: exact names first, then names that contain the words. */
function ways(scope, text, { field = false, roles = null } = {}) {
  const list = [];
  for (const exact of [true, false]) {
    if (roles) list.push(...roles.map((role) => scope.getByRole(role, { name: text, exact })), scope.getByLabel(text, { exact }));
    else if (field) list.push(scope.getByLabel(text, { exact }), ...FIELD_ROLES.map((role) => scope.getByRole(role, { name: text, exact })), scope.getByPlaceholder(text, { exact }));
    else list.push(...THING_ROLES.map((role) => scope.getByRole(role, { name: text, exact })), scope.getByLabel(text, { exact }), scope.getByPlaceholder(text, { exact }), scope.getByTitle(text, { exact }), scope.getByAltText(text, { exact }), scope.getByText(text, { exact }));
  }
  return list;
}

const looksLikeCss = (s) => /^[#.[]/.test(s.trim());

// ---------------------------------------------------------------- the run

/** Everything that happens on the recording's clock: where the pointer was, and every click, key and mark. */
class Log {
  constructor() { this.t0 = null; this.path = []; this.events = []; }
  now() { return this.t0 === null ? 0 : wall() - this.t0; }
  point(p) { if (this.t0 !== null) this.path.push([round(this.now()), round(p.x, 1), round(p.y, 1)]); }
  event(e) { const row = { t: round(this.now()), ...e }; if (this.t0 !== null) this.events.push(row); return row; }
}

/** Watches the page's picture through Chrome's screencast: to know when it has settled, and to record it. */
class Eye {
  constructor(ctx, size = (page) => page.viewportSize() ?? PAGE) { Object.assign(this, { ctx, size, cdp: null, page: null, record: null, frames: [], writes: [], lastChange: wall(), lastHash: '', received: 0, lastFrame: 0, blackout: null, blackouts: [] }); }
  async watch(page) {
    await this.unwatch();
    this.page = page;
    const cdp = await this.ctx.newCDPSession(page);
    this.cdp = cdp;
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      // Acknowledged first, at once: Chrome sends the next picture only after this one is acknowledged.
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
      if (cdp !== this.cdp) return;
      // While a layer is being saved the page is drawn without its background for a moment: those pictures are
      // never kept, and do not count as a change (the picture before simply lasts longer).
      if (this.blackouts.some((b) => metadata.timestamp >= b.from && (b.to === null || metadata.timestamp <= b.to))) { if (this.record) this.leftOut = (this.leftOut ?? 0) + 1; return; }
      this.lastFrame = wall();
      this.lastMeta = metadata;
      const hash = createHash('sha1').update(data).digest('base64');
      const same = hash === this.lastHash;
      if (!same) { this.lastHash = hash; this.lastChange = wall(); }
      if (!this.record) return;
      this.received++;
      // In your own Chrome, the first pictures after the feed starts can be the window's size, not the page's (see
      // feedStarted); those are never kept.
      if (page.__studioMetrics && (Math.abs(metadata.deviceWidth - page.__studioMetrics.width) > 2 || Math.abs(metadata.deviceHeight - page.__studioMetrics.height) > 2)) return;
      // A picture identical to the one before adds nothing (the one before simply lasts longer), so it is not kept.
      // Chrome sends many of those while the nudger keeps the feed current. A scroll always changes the picture.
      if (same && this.frames.length) return;
      const file = path.join(this.record.framesDir, `${String(this.frames.length).padStart(6, '0')}.${this.record.format}`);
      const z = page.__studioZoom ?? 1; // your Chrome's zoom, made up for: pictures report the page size before it
      // The studio's hidden window reports its first few pictures after a restart in device pixels (twice the size).
      const vp = this.size(page);
      const twice = !page.__studioMetrics && Math.abs(metadata.deviceWidth - vp.width * SCALE) < 2 ? SCALE : 1;
      // The picture's real size. Found 12 Nov 2026: the studio's hidden window (no --show) sends most pictures at the
      // page's size, 1920 x 1080, and only a few at full sharpness, around stills; capture.json counts them.
      const px = pictureSize(Buffer.from(data.slice(0, 2000), 'base64'));
      this.frames.push({ file, px, t: metadata.timestamp, sx: metadata.scrollOffsetX, sy: metadata.scrollOffsetY, w: metadata.deviceWidth / z / twice, h: metadata.deviceHeight / z / twice });
      this.writes.push(fs.promises.writeFile(file, Buffer.from(data, 'base64')));
    });
    const vp = this.size(page);
    this.lastChange = wall();
    await cdp.send('Page.startScreencast', this.record
      ? { format: this.record.format, quality: 95, maxWidth: vp.width * SCALE, maxHeight: vp.height * SCALE, everyNthFrame: 1 }
      : { format: 'jpeg', quality: 40, maxWidth: 640, maxHeight: 640, everyNthFrame: 1 });
    if (this.started && this.record) await this.started(page);
  }
  async unwatch() {
    if (!this.cdp) return;
    const cdp = this.cdp;
    this.cdp = null;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
  }
  async startRecording(record) { this.record = record; await this.watch(this.page); }
  async stopRecording() { await this.unwatch(); await Promise.all(this.writes); }
}

class Driver {
  constructor({ ctx, page, product, script, opts, log, setting, brand, jobDir, marksDir, warnings, mine = null, role = MAIN, partsDir = null, app = null }) {
    Object.assign(this, { ctx, page, scope: page, product, script, opts, log, setting, brand, jobDir, marksDir, warnings, mine, role, partsDir, app });
    // Your own Chrome and a desktop app's window are not the studio's own Chrome: their page size and sharpness are
    // set through DevTools for the tab or window the tool works in, whatever size the window itself is.
    this.sized = Boolean(mine || app);
    this.size = Array.isArray(product.frame) ? [...product.frame] : [PAGE.width, PAGE.height];
    this.touch = Boolean(product.touch);
    this.zoomNotes = new Set();
    this.mouse = script.start ? { ...script.start } : { x: Math.round(this.size[0] * 0.62), y: Math.round(this.size[1] * 0.66) };
    this.layers = {};
    this.snapshots = {};
    this.random = seeded(script.file);
    this.allowed = new Set([product.host, ...script.steps.filter((s) => /^https?:/.test(s.open ?? '')).map((s) => new URL(s.open).host)]);
    this.left = null;
    this.pace = PACES.normal;
    this.pages = [page];
    this.inflight = new Map();
    this.lastNet = wall();
    this.violation = null;
    this.tracked = new Map(); // name -> the step that names it
    this.thingMasks = [];
    this.samples = [];
    this.marks = {};
    this.markInfo = {};
    this.privacy = [];
    this.dismissed = [];
    this.pendingLine = null;
    this.theme = setting.theme;
    this.eye = new Eye(ctx, (p) => this.viewport(p));
    if (mine) this.eye.started = (p) => this.feedStarted(p);
    ctx.on('request', (r) => {
      if (IGNORED_REQUESTS.has(r.resourceType())) return;
      const url = r.url();
      if (this.product.background.some((h) => url.includes(h))) return; // background traffic, never "still loading"
      this.inflight.set(r, wall()); this.lastNet = wall();
    });
    const done = (r) => { if (this.inflight.delete(r)) this.lastNet = wall(); };
    ctx.on('requestfinished', done);
    ctx.on('requestfailed', done);
    ctx.on('page', (other) => this.adopt(other));
    this.watchNav(page);
  }

  /**
   * Found 12 Nov 2026 in Chrome 157, in a window narrower than the page: each time the picture feed starts, Chrome
   * sends pictures the size of the window (1280 wide: cropped, then blown up), until the page size is set again
   * once the feed is running. So after every start the size is set again and the next picture is checked.
   */
  async feedStarted(page) {
    const ctl = page.__studioCtl;
    if (!ctl || !page.__studioMetrics) return;
    const [w, h] = this.size;
    const { width: W, height: H } = page.__studioMetrics; // the page size before Chrome's zoom, which the pictures report
    const want = (m) => m && Math.abs(m.deviceWidth - W) <= 2 && Math.abs(m.deviceHeight - H) <= 2;
    for (let attempt = 0; attempt < 4; attempt++) {
      const since = wall();
      while (wall() - since < 0.6 && !(this.eye.lastFrame > since)) { await page.evaluate(() => window.__studioNudge?.poke()).catch(() => {}); await sleep(0.03); }
      await ctl.send('Emulation.setDeviceMetricsOverride', page.__studioMetrics).catch(() => {});
      const check = wall();
      while (wall() - check < 0.8) {
        await page.evaluate(() => window.__studioNudge?.poke()).catch(() => {});
        await sleep(0.05);
        if (this.eye.lastFrame > check && want(this.eye.lastMeta)) return;
      }
    }
    const m = this.eye.lastMeta;
    const z = page.__studioZoom ?? 1;
    stop(`Your Chrome kept sending pictures ${m ? `${Math.round(m.deviceWidth / z)} x ${Math.round(m.deviceHeight / z)}` : 'of the wrong size'} instead of the whole ${w} x ${h} page. Make the Chrome window larger (full screen is best), or record with --browser studio.`);
  }

  /** A full-sharpness still of the page (3840 x 2160 for the usual page size). */
  async still(file) {
    const ctl = this.page.__studioCtl;
    if (!this.sized || !ctl) return this.page.screenshot({ path: file, type: 'png', animations: 'allow', caret: 'hide', scale: 'device' });
    // In your own Chrome the page is drawn at a made-up-for zoom, so the still is taken straight from Chrome and
    // checked; if it is not exactly the take's size it is resized to it.
    const { data } = await ctl.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    const { w, h } = sizeOf(file);
    const [W, H] = [this.size[0] * SCALE, this.size[1] * SCALE];
    if (w !== W || h !== H) {
      const tmp = file.replace(/\.png$/, '.size.png');
      ffmpeg(['-i', file, '-vf', `scale=${W}:${H}:flags=lanczos`, '-frames:v', '1', tmp], 'size a still');
      fs.renameSync(tmp, file);
    }
  }

  /** A warning for the take, said once. */
  note(text) { if (!this.warnings.includes(text)) { this.warnings.push(text); say(`      ${text}`); } }

  viewport(page = this.page) { return this.sized ? { width: this.size[0], height: this.size[1] } : (page.viewportSize() ?? PAGE); }

  // ------------------------------------------------ your own Chrome: the page set up for the take, put back after

  /**
   * In your own Chrome the window is yours, so nothing is set when Chrome starts. Each tab the tool drives gets, through
   * its own DevTools session: the page size locked to the take's size at double sharpness (whatever the window size,
   * and whatever the "being controlled" bar takes), your zoom made up for, focus kept, the language, time zone and
   * light or dark of the take, and no cache. All of it belongs to the tool's own tab and goes when that tab closes.
   */
  async prepare(page) {
    if (!this.sized) return;
    const ctl = page.__studioCtl ?? (page.__studioCtl = await this.ctx.newCDPSession(page));
    await ctl.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    await ctl.send('Network.enable').catch(() => {});
    await ctl.send('Network.setCacheDisabled', { cacheDisabled: true }).catch(() => {});
    // Chrome does not let an extension change a page's language or time zone (found 12 Nov 2026: "only available to
    // trusted clients"), so in your own Chrome the product shows your Chrome's language and this Mac's time zone.
    await ctl.send('Emulation.setLocaleOverride', { locale: this.setting.locale }).catch(() => { page.__studioNoLocale = true; });
    const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await ctl.send('Emulation.setTimezoneOverride', { timezoneId: this.setting.timeZone }).catch(() => {
      if (here !== this.setting.timeZone) this.note(`This Mac's time zone is ${here} and the take asked for ${this.setting.timeZone}; through the extension the tool cannot change it, so times show in ${here}. For ${this.setting.timeZone}, record with --browser studio.`);
    });
    await page.emulateMedia({ colorScheme: this.theme, reducedMotion: this.setting.reducedMotion ? 'reduce' : 'no-preference' }).catch(() => {});
    await this.lockSize(page);
  }

  /**
   * Locks the page to the take's size (1920 x 1080 page pixels at double sharpness unless a "size" step changed it).
   * Chrome's zoom for a site (say 110%) would make the page narrower and blurrier; the tool cannot change your zoom
   * (the extension does not allow it), so it makes up for it instead: the page is laid out and drawn exactly as at
   * 100%, and your zoom setting stays as you left it.
   */
  async lockSize(page = this.page) {
    if (!this.sized) return page.setViewportSize({ width: this.size[0], height: this.size[1] });
    const ctl = page.__studioCtl;
    if (!ctl) return;
    const [w, h] = this.size;
    let z = page.__studioZoom ?? 1;
    if (!/^https?:/.test(page.url())) {
      // A new tab's empty page has nothing to measure (and asking it can hang): the size is set, the zoom is
      // measured once the product's page has opened.
      page.__studioMetrics = { width: Math.round(w * z), height: Math.round(h * z), deviceScaleFactor: SCALE / z, mobile: false, screenWidth: Math.round(w * z), screenHeight: Math.round(h * z) };
      return ctl.send('Emulation.setDeviceMetricsOverride', page.__studioMetrics).catch(() => {});
    }
    if (page.__studioNoLocale && !page.__studioLangSaid) {
      page.__studioLangSaid = true;
      const lang = await page.evaluate(() => navigator.language).catch(() => null);
      if (lang && lang.toLowerCase() !== this.setting.locale.toLowerCase()) this.note(`Your Chrome is in ${lang}, and the take asked for ${this.setting.locale}; through the extension the tool cannot change that, so dates and numbers show as your Chrome shows them. For ${this.setting.locale}, record with --browser studio.`);
    }
    for (let i = 0; i < 4; i++) {
      const W = Math.round(w * z), H = Math.round(h * z);
      page.__studioMetrics = { width: W, height: H, deviceScaleFactor: SCALE / z, mobile: false, screenWidth: W, screenHeight: H };
      await ctl.send('Emulation.setDeviceMetricsOverride', page.__studioMetrics);
      const m = await page.evaluate(() => [innerWidth, innerHeight, devicePixelRatio]).catch(() => null);
      if (!m) return;
      if (Math.abs(m[0] - w) <= 1 && Math.abs(m[2] - SCALE) < 0.02) break;
      z = (m[2] / (SCALE / z)); // the zoom Chrome applies: the pixel ratio the page sees over the one the tool set
    }
    page.__studioZoom = z;
    let host = '';
    try { host = new URL(page.url()).host; } catch {}
    if (Math.abs(z - 1) > 0.01 && host && this.mine) {
      const note = `Your Chrome zoom for ${host} is ${Math.round(z * 100)}%. The take was filmed as at 100%; your zoom setting was left as it is.`;
      if (!this.zoomNotes.has(note)) { this.zoomNotes.add(note); say(`      ${note}`); }
    }
  }

  /** Signs a demo user in to the WordPress demo site the studio built, from the site's own link: no password typed. */
  async signInToSite(who) {
    const url = this.product.siteSignin(who);
    const r = await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => stop(`Could not sign "${who}" in to the demo site: ${e.message.split('\n')[0]}`));
    const text = (await this.page.textContent('body').catch(() => '')) ?? '';
    if (!r || r.status() !== 200 || !/^Signed in as /.test(text.trim())) stop(`The demo site did not sign "${who}" in: ${text.trim().slice(0, 160) || `answer ${r?.status()}`}. Name a demo user or role from the blueprint's "users" (or "admin").`);
    say(`  signed in to the demo site: ${text.trim().replace(/^Signed in as /, '').replace(/\.$/, '')}${this.role === MAIN ? '' : ` (${this.role}'s window)`}`);
  }

  watchNav(page) {
    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      const url = frame.url();
      if (/^https?:/.test(url) && !this.allowed.has(new URL(url).host)) this.left ??= url;
    });
  }

  /** A tab or pop-up window the product opened: followed, kept to the product's site, recorded once switched to. */
  adopt(other) {
    if (this.pages.includes(other)) return;
    this.pages.push(other);
    this.watchNav(other);
    if (this.sized) this.prepare(other).catch(() => {});
    else if (this.theme !== this.setting.theme) other.emulateMedia({ colorScheme: this.theme }).catch(() => {});
    this.log.event({ type: 'tab-opened', url: other.url() });
    other.on('close', () => {
      this.pages = this.pages.filter((p) => p !== other);
      if (other === this.page && this.pages.length) this.closedUnderUs = true;
    });
  }

  /** Stops any page from going to another site before it gets there (pictures and scripts from other sites still load). */
  async fence() {
    const elsewhere = (url) => /^https?:/.test(url.href) && !this.allowed.has(url.host);
    await this.ctx.route(elsewhere, (route) => {
      const request = route.request();
      let main = false;
      try { main = request.isNavigationRequest() && request.frame() === request.frame().page().mainFrame(); } catch {}
      if (main) {
        this.left ??= request.url();
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
  }

  /** Stops the take at once when the never-show watch saw something. */
  checkpoint() { if (this.violation) { const v = this.violation; this.violation = null; throw v; } }
  async hold(seconds) {
    const until = wall() + seconds * this.pace.hold;
    while (wall() < until) { this.checkpoint(); await sleep(Math.min(0.05, until - wall())); }
    this.checkpoint();
  }

  // ------------------------------------------------ pointer

  async glide(to) {
    const from = { ...this.mouse };
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    if (distance < 2) return;
    const seconds = Math.min(1.05, Math.max(0.38, 0.32 + (distance / PAGE.width) * 0.75)) * this.pace.move;
    const bend = (0.04 + this.random() * 0.06) * (this.random() < 0.5 ? -1 : 1);
    const start = wall();
    if (!this.touch) this.log.point(from);
    for (;;) {
      const tick = wall();
      const u = Math.min(1, (tick - start) / seconds);
      const p = arc(from, to, travel(u), bend);
      // With touch on there is no pointer between touches: the finger's way there is logged (the engine draws the
      // touch pointer from it), and the page gets no mouse moves, so nothing hovers.
      if (!this.touch) { this.log.point(p); await this.page.mouse.move(p.x, p.y); }
      this.mouse = p;
      if (u >= 1) break;
      this.checkpoint();
      await sleep(SAMPLE - (wall() - tick));
    }
  }

  /** A point a person would aim at: near the middle of the box, never the same pixel twice. */
  aim(box, field) {
    const vp = this.viewport();
    const jitter = () => (this.random() - 0.5) * 0.3;
    const x = box.x + box.w * (field ? 0.3 + jitter() / 2 : 0.5 + jitter());
    const y = box.y + box.h * (0.5 + jitter() / 2);
    return { x: clamp(x, 1, vp.width - 1), y: clamp(y, 1, vp.height - 1) };
  }

  async click(box, n, { field = false, button = 'left', count = 1 } = {}) {
    if (this.touch) return this.tap(this.aim(box, field), n, { count, long: button === 'right' });
    await this.glide(this.aim(box, field));
    await this.hold(0.12);
    const click = this.log.event({ type: 'click', x: round(this.mouse.x, 1), y: round(this.mouse.y, 1), step: n, ...(button !== 'left' ? { button } : {}), ...(count > 1 ? { count } : {}) });
    for (let c = 1; c <= count; c++) {
      await this.page.mouse.down({ button, clickCount: c });
      await sleep((0.07 + this.random() * 0.03) * Math.max(this.pace.hold, 0.3));
      if (c === 1) click.up = round(this.log.now()); // the button comes back up here; most pages react on the way up
      await this.page.mouse.up({ button, clickCount: c });
      if (c < count) await sleep(0.08);
    }
  }

  // ------------------------------------------------ touch (phone web)

  /** One touch point, sent through Chrome's own touch input (touch events, then the click the page sees). */
  async touchAt(type, points) {
    const cdp = this.page.__studioTouch ?? (this.page.__studioTouch = await this.ctx.newCDPSession(this.page));
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p) => ({ x: p.x, y: p.y, radiusX: 9, radiusY: 9, force: 1 })) });
  }

  /** A tap (or a double tap, or a long press for a right-click), logged as a click made by touch. */
  async tap(at, n, { count = 1, long = false } = {}) {
    await this.glide(at); // the finger's way there takes a person's time; nothing moves on the page
    this.log.point(at);
    await this.hold(0.1);
    const click = this.log.event({ type: 'click', input: 'touch', gesture: long ? 'long press' : count > 1 ? 'double tap' : 'tap', x: round(at.x, 1), y: round(at.y, 1), step: n, ...(count > 1 ? { count } : {}) });
    for (let c = 1; c <= count; c++) {
      await this.touchAt('touchStart', [at]);
      await sleep(long ? 0.65 : 0.06 + this.random() * 0.03);
      if (c === 1) click.up = round(this.log.now());
      await this.touchAt('touchEnd', []);
      if (c < count) await sleep(0.1);
    }
  }

  /**
   * The finger's path for a scroll, logged as a swipe: the page itself scrolls frame by frame (smooth, never a fling),
   * and the finger moves the other way with it, so the engine's touch pointer draws a swipe that matches the page.
   */
  swipeFor(event, dist, frames, k0) {
    const vp = this.viewport();
    const x = clamp(this.mouse.x, vp.width * 0.3, vp.width * 0.7);
    const travelY = clamp(-dist, -vp.height * 0.6, vp.height * 0.6);
    const y0 = clamp(vp.height / 2 - travelY / 2, 40, vp.height - 40);
    return (k) => {
      const u = smooth(k / frames);
      const p = { x, y: y0 + travelY * u };
      this.log.point(p);
      this.mouse = p;
      (event.path ??= []).push([round(this.log.now()), round(p.x, 1), round(p.y, 1)]);
      return p;
    };
  }

  async typeText(text, n) {
    const keys = [];
    const start = this.log.now();
    if (this.pace.type === 0) {
      keys.push(...[...text].map(() => round(this.log.now())));
      await this.page.keyboard.type(text);
    } else {
      for (const ch of text) {
        keys.push(round(this.log.now()));
        await this.page.keyboard.type(ch);
        let pause = 0.055 + this.random() * 0.075;
        if (ch === ' ') pause += 0.035;
        if (/[.,!?]/.test(ch)) pause += 0.12;
        if (this.random() < 0.06) pause += 0.12 + this.random() * 0.12;
        await sleep(pause * this.pace.type);
        this.checkpoint();
      }
    }
    if (this.log.t0 !== null) this.log.events.push({ t: round(start), type: 'type', end: round(this.log.now()), text, keys, step: n });
  }

  async focusedIsSecret() {
    return this.scope.evaluate(() => {
      const el = document.activeElement;
      if (!el || el.tagName !== 'INPUT') return false;
      return el.type === 'password' || /current-password|new-password|one-time-code/.test(el.autocomplete ?? '') || /pass(word|code)|one[- ]?time|otp|verification/i.test([el.name, el.id, el.getAttribute('aria-label'), el.placeholder].join(' '));
    }).catch(() => false);
  }

  // ------------------------------------------------ finding

  /** Finds the one element a step means. Waits up to `timeout` seconds for it to appear. */
  async find(n, step, text, { field = false, roles = null, timeout = this.opts.timeout, quiet = false, css = false } = {}) {
    const scope = this.scope;
    const inside = step.in;
    const near = step.near;
    const until = wall() + timeout;
    const kind = kindOf(step) ?? 'click';
    if (css || looksLikeCss(text)) {
      for (;;) {
        const loc = scope.locator(text).filter({ visible: true });
        const count = await loc.count().catch(() => 0);
        if (count) return { loc: loc.first(), box: null };
        if (wall() > until) { if (quiet) return null; stop(`Step ${n} ${show(step)}: nothing on the page matches ${text} after ${timeout} seconds. The page is ${this.page.url()}.`, { lookedFor: text }); }
        await sleep(0.2);
      }
    }
    for (;;) {
      for (const loc of ways(scope, text, { field, roles })) {
        const count = await loc.count().catch(() => 0);
        if (!count) continue;
        const facts = await loc.evaluateAll(describe, { inside, viewport: this.viewport() }).catch(() => []);
        let options = facts.map((f, i) => ({ ...f, i })).filter((f) => f.shown || (kind === 'upload' && f.type === 'file'));
        if (!options.length) continue;
        if (inside) options = options.filter((f) => f.container >= 0).sort((a, b) => a.container - b.container);
        if (!options.length) continue;
        if (near) {
          const anchors = await scope.getByText(near).evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, ok: r.width > 0 }; })).catch(() => []);
          const shown = anchors.filter((a) => a.ok);
          if (!shown.length) { if (quiet) return null; stop(`Step ${n} ${show(step)}: could not find "${near}" on the page to look near. The page is ${this.page.url()}`, { lookedFor: near }); }
          const distance = (f) => Math.min(...shown.map((a) => Math.hypot(f.x + f.w / 2 - a.x, f.y + f.h / 2 - a.y)));
          options.sort((a, b) => distance(a) - distance(b));
        } else if (!inside && options.length > 1) {
          if (quiet) return null;
          stop(`Step ${n} ${show(step)}: found ${options.length} things called "${text}" on the page. Add "in" (the panel, list or dialog it is in) or "near" (words next to it) to say which, like {"${kind}": "${text}", "near": "..."}.`, { lookedFor: text, found: `${options.length} things called "${text}"` });
        }
        const chosen = options[0];
        if (chosen.secret) stop(`Step ${n} ${show(step)} points at a password or sign-in code field. The capture tool never touches those. Sign in by hand with: node tools/capture/capture.mjs signin ${brandInUse}`);
        return { loc: loc.nth(chosen.i), box: chosen };
      }
      if (wall() > until) {
        if (quiet) return null;
        const where = inside ? ` in "${inside}"` : '';
        stop(`Step ${n} ${show(step)}: could not find ${field ? 'a field called ' : ''}"${text}"${where} on the page after ${timeout} seconds. The page is ${this.page.url()}. Check the words on screen (capital letters do not matter), or wait longer before this step.`, { lookedFor: `${field ? 'a field called ' : 'a button, link, label or words '}"${text}"${where}` });
      }
      this.checkpoint();
      await sleep(0.2);
    }
  }

  /** An area of the page named by its label, heading or a CSS selector, for "in" on scroll and wait for. */
  async area(n, step, words, timeout) {
    const scope = this.scope;
    const until = wall() + timeout;
    for (;;) {
      const tries = looksLikeCss(words)
        ? [scope.locator(words)]
        : [
            ...['region', 'log', 'article', 'status', 'dialog', 'list', 'listbox', 'grid', 'textbox', 'main', 'complementary', 'tabpanel'].map((role) => scope.getByRole(role, { name: words, exact: true })),
            scope.getByLabel(words, { exact: true }),
            scope.getByTestId(words),
            scope.locator('section,article,aside,div,form,ul,ol,[role]').filter({ has: scope.getByRole('heading', { name: words, exact: true }) }).last(),
          ];
      for (const loc of tries) {
        const visible = loc.filter({ visible: true });
        if (await visible.count().catch(() => 0)) return visible.first();
      }
      if (wall() > until) stop(`Step ${n} ${show(step)}: could not find an area called "${words}" (by its label, its heading or a CSS selector) after ${timeout} seconds. The page is ${this.page.url()}.`, { lookedFor: `an area called "${words}"` });
      await sleep(0.2);
    }
  }

  async boxOf(target, n, step) {
    const b = await target.loc.boundingBox().catch(() => null);
    if (!b) stop(`Step ${n} ${show(step)}: the target disappeared before it could be used.`);
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  /** Brings a target into view with a smooth scroll if it is off screen, then measures it again. */
  async reveal(target, n, step) {
    let box = await this.boxOf(target, n, step);
    const vp = this.viewport();
    if (box.y >= 0 && box.y + box.h <= vp.height && box.x >= 0 && box.x + box.w <= vp.width) return box;
    await this.scrollTo(target.loc, n);
    box = await this.boxOf(target, n, step);
    if (box.y + box.h < 0 || box.y > vp.height) stop(`Step ${n} ${show(step)}: the target could not be brought into view.`);
    return box;
  }

  // ------------------------------------------------ scrolling, frame by frame

  /** Scrolls a scrolling box (or the page) by dy page pixels along an eased curve, one small step per frame. */
  async scrollBy(scroller, dy, n, seconds) {
    const [from, max] = await scroller.evaluate((el) => [el.scrollTop, el.scrollHeight - el.clientHeight]);
    const to = clamp(from + dy, 0, Math.max(0, max));
    const dist = to - from;
    if (Math.abs(dist) < 1) return 0;
    const time = (seconds ?? clamp(0.45 + Math.abs(dist) / 1500, 0.6, 2.4)) * this.pace.move;
    const event = this.log.event({ type: 'scroll', from: round(from, 1), to: round(to, 1), step: n });
    // One small step per frame of the recording, locked to its 60-a-second grid: each step is sent in the middle of
    // its frame's slot, so every frame gets exactly one new position and no frame is held or skipped.
    const base = this.log.t0 ?? wall();
    const first = Math.ceil((wall() - base) * FPS);
    const frames = Math.max(1, Math.round(time * FPS));
    let swipe = null, finger = null;
    if (this.touch) {
      // A phone scrolls under a finger: the swipe is logged with the finger's path, on the same frames as the scroll.
      swipe = this.log.event({ type: 'swipe', input: 'touch', step: n });
      finger = this.swipeFor(swipe, dist, frames);
      const p0 = finger(0);
      swipe.from = [round(p0.x, 1), round(p0.y, 1)];
    }
    for (let k = 1; k <= frames; k++) {
      const due = base + (first + k - 0.5) / FPS;
      await sleep(due - wall());
      await scroller.evaluate((el, y) => el.scrollTo({ top: y, behavior: 'instant' }), from + dist * smooth(k / frames));
      if (finger) finger(k);
      if (k % 6 === 0) this.checkpoint();
    }
    this.checkpoint();
    event.end = round(this.log.now());
    if (swipe) { swipe.end = event.end; swipe.to = [round(this.mouse.x, 1), round(this.mouse.y, 1)]; }
    await this.hold(0.12);
    return dist;
  }

  /** Scrolls whatever holds the thing so the thing sits in the middle of its box. */
  async scrollTo(loc, n, seconds) {
    const scroller = await loc.evaluateHandle(scrollerOf);
    const dy = await loc.evaluate((el, sc) => {
      const r = el.getBoundingClientRect();
      const page = sc === document.scrollingElement || sc === document.documentElement;
      const top = page ? 0 : sc.getBoundingClientRect().top;
      const h = page ? innerHeight : sc.clientHeight;
      return r.top - top - Math.max(0, (h - r.height) / 2);
    }, scroller);
    return this.scrollBy(scroller, dy, n, seconds);
  }

  // ------------------------------------------------ waiting

  busy() {
    const now = wall();
    return [...this.inflight].filter(([r, t]) => {
      if (now - t > 10) return false; // a request open for 10 s is a long poll, not loading
      try { return this.pages.includes(r.frame().page()); } catch { return false; }
    }).map(([r]) => r.url());
  }

  /** Waits until fonts are loaded, pictures decoded, the network quiet for 0.5 s and the picture still for 0.25 s. */
  async settled(limit) {
    const start = wall();
    const until = start + limit;
    let facts = { fonts: true, loading: 0 };
    let placeholdersAt = 0;
    for (;;) {
      this.checkpoint();
      facts = await this.page.evaluate(readyFacts).catch(() => ({ fonts: false, loading: 0, failed: true }));
      const busy = this.busy();
      const now = wall();
      if (facts.placeholders) placeholdersAt = now;
      const net = !busy.length && now - this.lastNet >= NET_QUIET;
      // The picture must also have been still since the placeholders went: the real content is in the page at once,
      // but its picture comes a frame or two later, and an older still picture must not count.
      const still = now - Math.max(this.eye.lastChange, placeholdersAt) >= PICTURE_QUIET;
      if (facts.fonts && !facts.loading && !facts.placeholders && !facts.failed && net && still) return { ok: true, waited: now - start };
      if (now > until) {
        const why = [];
        if (!facts.fonts) why.push('fonts were still loading');
        if (facts.loading) why.push(`${facts.loading} picture${facts.loading > 1 ? 's were' : ' was'} still loading`);
        if (facts.placeholders) why.push(`${facts.placeholders} loading placeholder${facts.placeholders > 1 ? 's were' : ' was'} still showing (grey skeletons, a spinner or a busy area; if one never goes, add it to "keep" under "clean_screen")`);
        if (!net) why.push(busy.length ? `the network was still busy (${busy.length} request${busy.length > 1 ? 's' : ''}, like ${busy[0].slice(0, 90)})` : 'the network had only just gone quiet');
        if (!still) why.push('the picture kept changing (an animation that never stops?)');
        if (facts.failed) why.push('the page was still loading');
        return { ok: false, waited: now - start, why: why.join(', ') };
      }
      await sleep(0.05);
    }
  }

  /** The page must be ready before a take starts and after a new page opens: gives up with a plain message. */
  async ready(n, what) {
    if (this.sized) await this.lockSize(this.page).catch(() => {});
    const limit = this.script.options.ready_limit ?? this.product.limits?.ready ?? READY_LIMIT;
    const r = await this.settled(limit);
    if (!r.ok) stop(`${what} the page was not ready after ${limit} seconds: ${r.why}. The page is ${this.page.url()}. If the product keeps something moving all the time, raise "ready_limit" in the script.`);
    this.markWait(r.waited, 'the page loading', n);
  }

  markWait(seconds, what, n) {
    if (seconds <= 0.6 || this.log.t0 === null) return;
    const end = this.log.now();
    // Real waits over 0.6 s are marked so the engine can speed them up with a "Sped up" label.
    this.log.events.push({ t: round(end - seconds), type: 'wait', end: round(end), what, speed_up: true, step: n });
  }

  // ------------------------------------------------ the clean screen and the never-show list

  /** Pop-ups the brand lists to dismiss: closed if they are up (waiting a moment for them first, before a take). */
  async dismissAll(n, { waitFirst = false } = {}) {
    for (const rule of this.product.clean.dismiss) {
      const limit = waitFirst ? rule.wait ?? 1 : 0;
      const until = wall() + limit;
      let up = false;
      for (;;) {
        up = rule.when
          ? (await this.page.getByText(rule.when).filter({ visible: true }).count().catch(() => 0)) > 0
          : Boolean(await this.find(n, { click: rule.click, in: rule.in }, rule.click, { timeout: 0, quiet: true }).catch(() => null));
        if (up || wall() >= until) break;
        await sleep(0.15);
      }
      if (!up) continue;
      if (rule.click) {
        const target = await this.find(n, { click: rule.click, in: rule.in }, rule.click, { timeout: 2, quiet: true }).catch(() => null);
        if (!target) continue;
        await target.loc.click({ timeout: 3000 }).catch(() => {});
        await this.page.mouse.move(this.mouse.x, this.mouse.y).catch(() => {});
      } else {
        await this.page.keyboard.press(rule.press).catch(() => {});
      }
      const during = this.log.t0 !== null;
      this.dismissed.push({ what: rule.what, ...(during ? { at: round(this.log.now()), step: n } : { before_recording: true }) });
      if (during) {
        this.log.event({ type: 'dismissed', what: rule.what, step: n });
        this.warnings.push(`"${rule.what}" popped up during the take (after step ${n}, at ${this.log.now().toFixed(1)} s) and was dismissed, so it shows briefly in the recording.`);
      }
      say(`      dismissed: ${rule.what}`);
      await sleep(0.3);
    }
  }

  /** After the clean screen is applied: everything it should hide is hidden, and nothing unlisted covers the page. */
  async checkClean(n, what) {
    const report = await this.page.evaluate(() => window.__studio?.report()).catch(() => null);
    if (report?.wholePage?.length) stop(`${what} ${report.wholePage[0]} is changing the whole page in your Chrome, so it cannot be hidden. Switch it off for this site (for a translation: click the translate icon in the address bar and choose the original language; for an extension: click its icon and pause it on this site), then run the command again.`, { kind: 'cover' });
    const yours = report?.still?.find((x) => /your Chrome extension/.test(x));
    if (yours) stop(`${what} ${yours.replace(' (drawn by your Chrome extension)', '')}, drawn on the page by one of your Chrome extensions, could not be hidden. Pause that extension on this site (click its icon in Chrome), then run the command again.`, { kind: 'cover' });
    if (report?.still?.length) stop(`${what} the clean-screen rule for "${report.still[0]}" did not hide it: it is still on screen. The page is ${this.page.url()}.`, { kind: 'cover' });
    const over = await this.page.evaluate(covering).catch(() => []);
    if (over.length) {
      const o = over[0];
      stop(`${what} the page shows ${o.what}${o.words ? ` ("${o.words.slice(0, 70)}")` : ''}, which the brand's clean-screen list does not mention. Add it to "hide", "dismiss" or "keep" under "clean_screen" in ${rel(this.product.file)}.`, { kind: 'cover', boxes: over.map((x) => x.box) });
    }
    return report;
  }

  /** Stops if the page left the product, landed on a sign-in screen, or shows something the brand never shows. */
  async guard(n) {
    this.checkpoint();
    const page = this.page;
    const again = `Sign in first with: node tools/capture/capture.mjs signin ${this.brand}`;
    const url = page.url();
    const password = await page.locator('input[type=password]').filter({ visible: true }).count().catch(() => 0);
    const onSignin = password > 0 || (/^https?:/.test(url) && this.product.signinPaths.some((p) => new URL(url).pathname.toLowerCase().startsWith(p)));
    if (this.left) {
      if (onSignin || /login|signin|sign-in|auth|sso|accounts\./i.test(this.left)) stop(`After step ${n} the product sent the browser to a sign-in page (${this.left}). ${again}`, { kind: 'never-show-path' });
      stop(`After step ${n} the page tried to go to another site (${this.left}) and was held back. The tool never leaves ${this.product.host} unless a step opens a full address.`);
    }
    if (onSignin) stop(`After step ${n} the page is a sign-in screen (${url}). ${again}`, { kind: 'never-show-path' });
    for (const p of this.pages) {
      const u = p.url();
      if (!/^https?:/.test(u)) continue;
      const where = new URL(u).pathname.toLowerCase();
      for (const rule of this.product.rules) {
        if ((rule.paths ?? []).some((x) => where.includes(x.toLowerCase()))) stop(`After step ${n} ${p === page ? 'the page' : 'another open tab'} is ${u}, and the brand says never to show "${rule.what}" (${rel(this.product.file)}). Change the steps so they stay away from it.`, { kind: 'never-show-path' });
      }
    }
    const shown = await this.neverShown();
    if (shown.length) stop(`After step ${n} the screen shows ${shown.map((s) => `"${s.found}"`).join(', ')}, and the brand says never to show "${shown[0].what}". Scroll it out of view, use other demo data, or change the steps.`, { kind: 'never-show', rects: shown.flatMap((s) => s.rects) });
  }

  /** Never-show words on screen, in the page and in every frame inside it. */
  async neverShown() {
    const rules = this.product.rules.map((r) => ({ what: r.what, text: r.text ?? [], pattern: r.pattern ?? null, allow: r.allow ?? [] }));
    if (!rules.some((r) => r.text.length || r.pattern)) return [];
    const found = [];
    for (const frame of this.page.frames()) found.push(...(await frame.evaluate(visibleMatches, rules).catch(() => [])));
    return found;
  }

  /** While recording, the never-show list is checked about three times a second, not only between steps. */
  startWatch() {
    this.watching = true;
    (async () => {
      while (this.watching) {
        await sleep(0.3);
        if (!this.watching || this.violation) continue;
        const shown = await this.neverShown().catch(() => []);
        if (shown.length && this.watching) this.violation = new Stop(`At ${this.log.now().toFixed(1)} s into the take the screen showed ${shown.map((s) => `"${s.found}"`).join(', ')}, and the brand says never to show "${shown[0].what}". Scroll it out of view, use other demo data, or change the steps.`, { kind: 'never-show', rects: shown.flatMap((s) => s.rects) });
      }
    })();
  }

  // ------------------------------------------------ tracking, every frame

  startTracking() {
    this.trackingOn = true;
    (async () => {
      while (this.trackingOn) {
        const tick = wall();
        if (this.tracked.size) {
          const r = await this.page.evaluate(trackedNow).catch(() => null);
          if (r) this.samples.push([this.log.now(), r.at]);
        }
        await sleep(SAMPLE - (wall() - tick));
      }
    })();
  }

  /** Tags a tracked or masked thing again after the page redrew it (best effort, never stops the take). */
  async retag(n) {
    for (const [name, step] of this.tracked) {
      const here = await this.page.locator(`[data-studio-track="${name}"]`).count().catch(() => 0);
      if (here) continue;
      const t = step.css ? { loc: this.page.locator(step.css).first() } : await this.find(n, step, step.track, { timeout: 0, quiet: true }).catch(() => null);
      if (t) await t.loc.evaluate((el, nm) => el.setAttribute('data-studio-track', nm), name).catch(() => {});
    }
    for (const step of this.thingMasks) {
      const t = await this.find(n, step, step.mask, { timeout: 0, quiet: true }).catch(() => null);
      if (t) await t.loc.evaluate((el) => el.setAttribute('data-studio-mask', '')).catch(() => {});
    }
  }

  // ------------------------------------------------ marks, privacy

  async mark(step, n) {
    await this.dismissAll(n);
    await this.hold(0.15);
    await this.guard(n);
    const name = step.mark;
    this.log.event({ type: 'mark', name, step: n });
    this.marks[name] = round(this.log.now());
    const hits = await this.page.evaluate(privacyScan, { safe: [...this.product.safe, ...(this.script.options.safe ?? [])], allowEmail: this.product.allowEmail, firstNames: FIRST_NAMES }).catch(() => []);
    const tracked = this.tracked.size ? (await this.page.evaluate(trackedNow).catch(() => ({ at: {} }))).at : {};
    if (this.marksDir) {
      const file = path.join(this.marksDir, `${name}.png`);
      await this.still(file);
      if (hits.length) blurStill(file, hits.flatMap((h) => h.rects));
      const words = await this.page.evaluate(wordsOnScreen).catch(() => '');
      fs.writeFileSync(path.join(this.marksDir, `${name}.txt`), redact(words, hits) + '\n');
      // Where the named and tracked things sit, for the freshness check's layout comparison (freshness.mjs).
      const layout = await this.page.evaluate(layoutNow).catch(() => null);
      if (layout) {
        const flagged = hits.map((h) => h.line ?? h.text ?? h.found).filter(Boolean);
        for (const t of layout.things) if (flagged.some((f) => t.name.includes(f))) t.name = '[private]';
        fs.writeFileSync(path.join(this.marksDir, `${name}.layout.json`), JSON.stringify(layout) + '\n');
      }
    }
    this.markInfo[name] = { t: this.marks[name], url: this.page.url(), tracked, privacy_flags: hits.length };
    for (const h of hits) {
      this.privacy.push({ mark: name, kind: h.kind, text: h.text });
      say(`      privacy: ${h.kind} "${h.text}" at mark ${name}${this.marksDir ? ' (blurred in the still)' : ''}`);
    }
  }

  // ------------------------------------------------ layers and snapshots

  /** Private words on screen now (not on the brand's safe list), with where they are. */
  async privateWords() {
    return this.page.evaluate(privacyScan, { safe: [...this.product.safe, ...(this.script.options.safe ?? [])], allowEmail: this.product.allowEmail, firstNames: FIRST_NAMES }).catch(() => []);
  }

  /**
   * layer: one thing on its own, as a see-through PNG at full sharpness, and where it was. The page is drawn without
   * everything else for a moment while the picture is taken; those pictures are left out of the recording (the frame
   * before simply lasts longer) and the moment is logged as a wait the engine can cut.
   */
  async layer(step, n) {
    const name = partName(step);
    const target = await this.find(n, step, step.css ?? step.layer, { timeout: this.opts.timeout, css: Boolean(step.css) });
    await this.reveal(target, n, step);
    const hits = await this.privateWords();
    await target.loc.evaluate((el) => el.setAttribute('data-studio-layer', ''));
    const t = this.log.now();
    const out = { from: wall(), to: null };
    this.eye.blackouts.push(out);
    let info = null, file = null, clip = null;
    try {
      info = await this.page.evaluate(layerOn);
      if (!info) stop(`Step ${n} ${show(step)}: the thing to lift went away before its layer could be saved.`);
      const vp = this.viewport();
      const pad = clamp(info.reach + 4, 4, 96);
      const x0 = Math.max(0, Math.floor(info.x - pad)), y0 = Math.max(0, Math.floor(info.y - pad));
      const x1 = Math.min(vp.width, Math.ceil(info.x + info.w + pad)), y1 = Math.min(vp.height, Math.ceil(info.y + info.h + pad));
      clip = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
      if (this.partsDir) {
        fs.mkdirSync(path.join(this.partsDir, 'layers'), { recursive: true });
        file = path.join(this.partsDir, 'layers', `${name}.png`);
        await this.page.screenshot({ path: file, clip, omitBackground: true, type: 'png', scale: 'device', animations: 'allow', caret: 'hide' });
      }
    } finally {
      await this.page.evaluate(layerOff).catch(() => {});
      // The page draws itself again; pictures from before this moment are not kept.
      for (let i = 0; i < 6; i++) { await this.page.evaluate(() => window.__studioNudge?.poke()).catch(() => {}); await sleep(1 / FPS); }
      out.to = wall();
    }
    // Private words inside the layer are blurred in it, as in a mark's still.
    const inside = hits.flatMap((h) => h.rects).filter((r) => r.x < clip.x + clip.width && r.x + r.w > clip.x && r.y < clip.y + clip.height && r.y + r.h > clip.y);
    if (file && inside.length) blurStill(file, inside.map((r) => ({ ...r, x: r.x - clip.x, y: r.y - clip.y })));
    for (const h of hits.filter((h) => h.rects.some((r) => inside.includes(r)))) this.privacy.push({ layer: name, kind: h.kind, text: h.text });
    const box = [info.x, info.y, info.w, info.h].map((v) => round(v, 1));
    const record = {
      name, t: round(t), step: n,
      box, // the thing itself, page pixels from the top left of the window
      picture: { file: file ? `parts/layers/${name}.png` : null, box: [clip.x, clip.y, clip.width, clip.height], scale: SCALE }, // the PNG covers this area (with room for the thing's shadow)
      page_scroll: info.scroll.map((v) => round(v, 1)), page: info.viewport, corner_radius: info.radius, private_words_blurred: inside.length,
    };
    this.layers[name] = record;
    if (this.log.t0 !== null) {
      this.log.events.push({ t: round(t), type: 'wait', end: round(this.log.now()), what: `saving the layer "${name}"`, speed_up: true, cut: true, step: n });
      this.log.event({ type: 'layer', name, box, step: n });
    }
    if (file) fs.writeFileSync(path.join(this.partsDir, 'layers', `${name}.json`), JSON.stringify(record, null, 2) + '\n');
    return record;
  }

  /**
   * snapshot: the code of one area (its HTML and the CSS that styles it, scoped to one class), so the engine can move
   * single rows or numbers in it. Nothing on screen changes while it is taken.
   */
  async snapshot(step, n) {
    const name = partName(step);
    const words = step.css ?? step.snapshot;
    let loc = null;
    try { loc = await this.area(n, step, words, Math.min(2, this.opts.timeout)); } catch {}
    if (!loc) loc = (await this.find(n, step, words, { timeout: this.opts.timeout, css: Boolean(step.css) })).loc;
    await loc.evaluate((el) => el.setAttribute('data-studio-snap', ''));
    const scope = `studio-snap-${name}`;
    const snap = await this.page.evaluate(snapshotOf, { scope }).finally(() => this.page.evaluate(() => document.querySelectorAll('[data-studio-snap]').forEach((el) => el.removeAttribute('data-studio-snap'))).catch(() => {}));
    if (!snap) stop(`Step ${n} ${show(step)}: the area went away before its code could be saved.`);
    // Private words never go into the code: each one is replaced, and listed for a person.
    const box = { x: snap.box[0], y: snap.box[1], w: snap.box[2], h: snap.box[3] };
    const hits = (await this.privateWords()).filter((h) => h.rects.some((r) => r.x < box.x + box.w && r.x + r.w > box.x && r.y < box.y + box.h && r.y + r.h > box.y));
    let html = snap.html;
    for (const h of hits) { html = html.split(h.text).join('[blurred]'); this.privacy.push({ snapshot: name, kind: h.kind, text: h.text }); }
    if (snap.unread.length) this.note(`Snapshot "${name}": ${snap.unread.length} style sheet${snap.unread.length > 1 ? 's' : ''} from another site could not be read (${snap.unread[0]}), so its look may be incomplete.`);
    const record = {
      name, t: round(this.log.now()), step: n, scope,
      box: snap.box, page_scroll: snap.scroll, page: snap.viewport, background: snap.background,
      file: `parts/snapshots/${name}.html`,
      css_rules: snap.rules, unread_style_sheets: snap.unread, private_words_replaced: hits.length,
      parts: snap.parts,
    };
    this.snapshots[name] = record;
    if (this.partsDir) {
      const dir = path.join(this.partsDir, 'snapshots');
      fs.mkdirSync(dir, { recursive: true });
      const page = `<!doctype html>\n<html><head><meta charset="utf-8"><title>${name}</title>\n<!-- Snapshot "${name}" from the capture tool: the area's code as it was at ${record.t} s, with the CSS that styles it, scoped to .${scope}. Rows and numbers carry data-studio-part (listed in ${name}.json). -->\n<style>\n${snap.css.replace(/<\/style/gi, '<\\/style')}\n</style></head>\n<body style="margin:0;background:${snap.background}">\n<div class="${scope}" style="position:relative;width:${snap.box[2]}px">${html}</div>\n</body></html>\n`;
      fs.writeFileSync(path.join(dir, `${name}.html`), page);
      fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(record, null, 2) + '\n');
    }
    if (this.log.t0 !== null) this.log.event({ type: 'snapshot', name, box: snap.box, step: n });
    return { name, parts: snap.parts.length, rules: snap.rules };
  }

  // ------------------------------------------------ the steps

  async step(step, n) {
    const kind = kindOf(step);
    const page = this.page;
    const timeout = this.opts.timeout;
    const entry = { n, step };
    const at = (box) => { entry.target = { x: round(box.x, 1), y: round(box.y, 1), w: round(box.w, 1), h: round(box.h, 1) }; return box; };
    const field = async (words) => {
      const target = await this.find(n, step, words, { field: true, timeout });
      await this.click(at(await this.reveal(target, n, step)), n, { field: true });
      await this.hold(0.18);
      return target;
    };
    switch (kind) {
      case 'open': {
        await this.open(step.open, n);
        await this.ready(n, `After step ${n} (open)`);
        break;
      }
      case 'click': case 'double-click': case 'right-click': {
        const target = await this.find(n, step, step[kind], { timeout });
        const box = at(await this.reveal(target, n, step));
        await this.click(box, n, { button: kind === 'right-click' ? 'right' : 'left', count: kind === 'double-click' ? 2 : 1 });
        if (kind === 'right-click') entry.note = 'A menu the product draws is filmed; the system\'s own right-click menu never appears in a recording.';
        break;
      }
      case 'hover': {
        if (this.touch) stop(`Step ${n} ${show(step)}: a phone has no hover, and touch is on for this take. Tap it instead, or record this part at desktop size.`);
        const target = await this.find(n, step, step.hover, { timeout });
        await this.glide(this.aim(at(await this.reveal(target, n, step))));
        await this.hold(0.35);
        break;
      }
      case 'type': case 'paste': {
        if (step.into) await field(step.into);
        if (await this.focusedIsSecret()) stop(`Step ${n} would type into a password or sign-in code field. The capture tool never does that. Sign in by hand with: node tools/capture/capture.mjs signin ${this.brand}`);
        if (step.clear) {
          // Empties the field first (select all, delete), for a field that already had words in it.
          await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
          await page.keyboard.press('Backspace');
          this.log.event({ type: 'press', key: 'Backspace', step: n, cleared: true });
          await this.hold(0.15);
        }
        if (kind === 'type') await this.typeText(step.type, n);
        else {
          this.log.event({ type: 'paste', text: step.paste, step: n });
          await page.keyboard.insertText(step.paste);
        }
        break;
      }
      case 'press': {
        if (await this.focusedIsSecret()) stop(`Step ${n} would press a key in a password or sign-in code field. The capture tool never does that.`);
        const keys = step.press.length > 1 && step.press.includes('+') ? step.press.split('+') : null;
        this.log.event({ type: 'press', key: step.press, step: n, ...(keys ? { shortcut: true, keys } : {}) });
        await page.keyboard.press(step.press).catch((e) => stop(`Step ${n}: "${step.press}" is not a key or shortcut the browser knows (try Enter, Tab, Escape, ArrowDown, Meta+K). ${e.message.split('\n')[0]}`));
        break;
      }
      case 'select': {
        const list = await this.find(n, { ...step, select: step.from }, step.from, { roles: ['combobox', 'listbox', 'button'], timeout });
        const box = at(await this.reveal(list, n, step));
        if (list.box?.tag === 'select') {
          await this.glide(this.aim(box, true));
          await this.hold(0.2);
          const done = await list.loc.selectOption({ label: step.select }).catch(() => list.loc.selectOption(step.select).catch(() => null));
          if (!done) stop(`Step ${n} ${show(step)}: the list "${step.from}" has no option "${step.select}".`, { lookedFor: `the option "${step.select}" in "${step.from}"` });
          this.log.event({ type: 'select', value: step.select, step: n });
          const warning = `Step ${n} picks "${step.select}" from "${step.from}", a list the system draws: its open menu is not in the recording, only the result. Show the result, or use a list the product draws.`;
          this.warnings.push(warning);
          entry.note = warning;
        } else {
          await this.click(box, n);
          await this.hold(0.3);
          const option = await this.find(n, step, step.select, { roles: ['option', 'menuitem', 'menuitemradio', 'treeitem', 'gridcell'], timeout });
          await this.click(await this.reveal(option, n, step), n);
          this.log.event({ type: 'select', value: step.select, step: n });
        }
        break;
      }
      case 'check': case 'toggle': {
        const target = await this.find(n, step, step[kind], { roles: TICK_ROLES, timeout });
        const box = at(await this.reveal(target, n, step));
        const want = kind === 'check' ? step.off !== true : null;
        const now = kind === 'check' ? await target.loc.isChecked().catch(() => null) : null;
        if (want !== null && now === want) {
          entry.note = `"${step.check}" was already ${want ? 'ticked' : 'clear'}, so nothing was clicked.`;
          this.warnings.push(`Step ${n}: ${entry.note}`);
        } else await this.click(box, n);
        break;
      }
      case 'drag': {
        const target = await this.find(n, step, step.drag, { timeout });
        const from = this.aim(at(await this.reveal(target, n, step)));
        let to;
        if (step.to) {
          const dest = await this.find(n, { drag: step.to }, step.to, { timeout });
          const b = await this.boxOf(dest, n, step);
          to = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
        } else to = { x: from.x + step.by[0], y: from.y + step.by[1] };
        await this.drag(from, to, n, step.seconds);
        break;
      }
      case 'scroll': {
        if (typeof step.scroll === 'number') {
          let scroller;
          if (step.in) {
            const box = await this.area(n, step, step.in, timeout);
            const b = await box.boundingBox();
            if (b) await this.glide(this.aim({ x: b.x, y: b.y, w: b.width, h: b.height }));
            // The area itself if it scrolls, else the first box inside it that scrolls, else the one around it.
            scroller = await box.evaluateHandle((el) => {
              const scrolls = (a) => /(auto|scroll|overlay)/.test(getComputedStyle(a).overflowY) && a.scrollHeight > a.clientHeight + 1;
              if (scrolls(el)) return el;
              const inner = [...el.querySelectorAll('*')].find(scrolls);
              if (inner) return inner;
              for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) if (scrolls(a)) return a;
              return document.scrollingElement ?? document.documentElement;
            });
          } else scroller = await page.evaluateHandle(() => document.scrollingElement ?? document.documentElement);
          const moved = await this.scrollBy(scroller, step.scroll, n, step.seconds);
          if (Math.abs(moved) < 1) this.warnings.push(`Step ${n}: there was nothing more to scroll${step.in ? ` in "${step.in}"` : ''}.`);
        } else {
          const target = await this.find(n, step, step.scroll, { timeout });
          await this.scrollTo(target.loc, n, step.seconds);
          at(await this.boxOf(target, n, step));
        }
        break;
      }
      case 'upload': {
        const file = path.resolve(this.jobDir, step.upload);
        if (!file.startsWith(path.resolve(this.jobDir) + path.sep)) stop(`Step ${n}: the file to upload must be inside the job folder, like "files/logo.png".`);
        if (!fs.existsSync(file)) stop(`Step ${n}: the file to upload is missing: ${rel(file)}`);
        let done = false;
        if (step.into) {
          const target = await this.find(n, step, step.into, { timeout });
          // A hidden file field is usually opened by its label or button: that is clicked on screen, and the
          // system's file window is answered by the tool, so it never appears.
          const label = target.box?.type === 'file' && !target.box.shown ? await target.loc.evaluate((el) => {
            const l = [...(el.labels ?? [])].map((x) => x.getBoundingClientRect()).find((r) => r.width > 0 && r.height > 0);
            return l ? { x: l.x, y: l.y, w: l.width, h: l.height } : null;
          }).catch(() => null) : null;
          if (label) {
            const chooser = page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null);
            await this.click(at(label), n);
            const fc = await chooser;
            if (fc) { await fc.setFiles(file); done = true; }
          }
          if (!done && target.box?.type === 'file') { await target.loc.setInputFiles(file); done = true; }
          else if (!done) {
            const chooser = page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null);
            await this.click(at(await this.reveal(target, n, step)), n);
            const fc = await chooser;
            if (fc) { await fc.setFiles(file); done = true; }
          }
        }
        if (!done) {
          const inputs = this.scope.locator('input[type=file]');
          const count = await inputs.count();
          if (count !== 1) stop(`Step ${n} ${show(step)}: ${count ? `there are ${count} file fields on the page; say which with "into" (the words on its button or label)` : 'there is no file field on the page'}.`, { lookedFor: 'a file field', found: `${count} file fields` });
          await inputs.first().setInputFiles(file);
        }
        this.log.event({ type: 'upload', file: path.basename(file), step: n });
        break;
      }
      case 'wait': await this.hold(step.wait); break;
      case 'wait for': await this.waitFor(step, n); break;
      case 'switch': await this.switchTo(step, n); break;
      case 'back': case 'reload': {
        const go = kind === 'back' ? page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 }) : page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
        const r = await go.catch((e) => stop(`Step ${n} (${kind}) did not work: ${e.message.split('\n')[0]}`));
        if (kind === 'back' && r === null) stop(`Step ${n}: there is no earlier page to go back to.`);
        this.log.event({ type: kind, url: page.url(), step: n });
        await this.ready(n, `After step ${n} (${kind})`);
        break;
      }
      case 'size': {
        const [width, height] = SIZES[step.size] ?? step.size;
        this.size = [width, height];
        await this.lockSize(page);
        this.log.event({ type: 'size', width, height, step: n });
        await this.eye.watch(page);
        this.mouse = { x: Math.min(this.mouse.x, width - 2), y: Math.min(this.mouse.y, height - 2) };
        entry.note = 'The page size changed; touch is not switched on mid-take.';
        await this.hold(0.3);
        break;
      }
      case 'theme': {
        this.theme = step.theme;
        for (const p of this.pages) await p.emulateMedia({ colorScheme: step.theme }).catch(() => {});
        this.log.event({ type: 'theme', theme: step.theme, step: n });
        break;
      }
      case 'mark': await this.mark(step, n); break;
      case 'layer': entry.layer = await this.layer(step, n); at({ x: entry.layer.box[0], y: entry.layer.box[1], w: entry.layer.box[2], h: entry.layer.box[3] }); break;
      case 'snapshot': entry.snapshot = await this.snapshot(step, n); break;
      case 'as': break; // the switch between demo users' windows is made by the take itself (follow)
      case 'track': {
        const name = trackName(step);
        const target = step.css ? await this.find(n, step, step.css, { timeout, css: true }) : await this.find(n, step, step.track, { timeout });
        await target.loc.evaluate((el, nm) => el.setAttribute('data-studio-track', nm), name);
        this.tracked.set(name, step);
        this.log.event({ type: 'track', name, step: n });
        break;
      }
      case 'mask': {
        if (step.thing) {
          const target = await this.find(n, step, step.mask, { timeout });
          await target.loc.evaluate((el) => el.setAttribute('data-studio-mask', ''));
          this.thingMasks.push(step);
        } else {
          await this.scope.evaluate(() => window.__studio?.sweep()).catch(() => {});
          const masked = await this.scope.locator('[data-studio-mask]').count().catch(() => 0);
          if (!masked && !step.css) {
            const shown = await this.scope.getByText(step.mask).count().catch(() => 0);
            if (!shown) stop(`Step ${n} ${show(step)}: "${step.mask}" is not on the page, so there is nothing to blur here. It is blurred wherever it appears in the take.`, { lookedFor: `the words "${step.mask}"` });
          }
        }
        this.log.event({ type: 'mask', what: step.mask, step: n });
        break;
      }
      case 'line': {
        this.pendingLine = step.line;
        this.log.event({ type: 'line', id: step.line, step: n + 1 });
        break;
      }
      default: stop(`Step ${n}: "${kind}" is not built.`);
    }
    return entry;
  }

  /**
   * Opens a step's address. "extension:popup" and "extension:side panel" open the loaded extension's popup or side
   * panel as a page in this tab, at its real size: a popup is as big as its content (as Chrome sizes it, at most
   * 800 x 600), a side panel 360 x 900 unless the brand says otherwise.
   */
  async open(open, n) {
    if (this.app && /^(app|window)$/i.test(open.trim())) {
      // A desktop app's own first window, as it opened: loaded once more so the clean screen and the clock apply.
      await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => stop(`Step ${n} could not reload the app's window: ${e.message.split('\n')[0]}`));
      return;
    }
    if (this.app && !/^https?:/.test(open)) stop(`Step ${n} {"open": ${JSON.stringify(open)}}: in a desktop app, "open" is "app" (the app's own window, as it opened) or a full web address the app shows.`);
    const ext = open.match(/^extension:\s*(popup|side ?panel|panel|options|page:(.+))$/i);
    if (!ext) {
      await this.page.goto(addressOf(this.product, open, n), { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => stop(`Step ${n} could not open ${open}: ${e.message.split('\n')[0]}`));
      return;
    }
    const x = this.ctx.__studioExtension;
    if (!x) stop(`Step ${n} opens the extension's ${ext[1]}, but no extension is loaded. Set "extension": { "folder": "..." } in ${rel(this.product.file)} (and "kind": "extension").`);
    const m = x.manifest;
    const which = ext[2] ? 'page' : /panel/i.test(ext[1]) ? 'side panel' : ext[1].toLowerCase();
    const file = ext[2]?.trim() ?? (which === 'popup' ? m.action?.default_popup ?? m.browser_action?.default_popup : which === 'side panel' ? m.side_panel?.default_path : m.options_ui?.page ?? m.options_page);
    if (!file) stop(`Step ${n}: the extension "${m.name}" has no ${which} in its manifest.json (${which === 'popup' ? 'action.default_popup' : which === 'side panel' ? 'side_panel.default_path' : 'options_ui.page'}).`);
    await this.page.goto(`chrome-extension://${x.id}/${file.replace(/^\//, '')}`, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch((e) => stop(`Step ${n} could not open the extension's ${which}: ${e.message.split('\n')[0]}`));
    let size;
    if (which === 'popup') size = x.popupSize ?? await this.popupSize();
    else size = which === 'side panel' ? x.panelSize : this.size;
    this.size = [Math.round(size[0]), Math.round(size[1])];
    this.largest = [...this.size];
    await this.lockSize(this.page);
    this.mouse = { x: Math.round(this.size[0] * 0.62), y: Math.round(this.size[1] * 0.66) };
    this.extensionPage = { page: which, file, extension: m.name, version: m.version, id: x.id, size: this.size, follows_content: which === 'popup' && !x.popupSize };
    if (this.log.t0 !== null) this.log.event({ type: 'size', width: this.size[0], height: this.size[1], step: n, why: `the extension's ${which}` });
  }

  /**
   * A popup's real size: Chrome sizes a popup to its content, between 25 x 25 and 800 x 600, and resizes it when the
   * content grows or shrinks. Measured the same way here.
   */
  async popupSize() {
    return this.page.evaluate(async () => {
        await document.fonts?.ready;
        const root = document.documentElement;
        const keep = root.style.width;
        root.style.width = 'max-content';
        const w = Math.ceil(root.getBoundingClientRect().width);
        root.style.width = `${w}px`;
        // The content's own height (the page's scroll height is never less than the window, so it is not used).
        const body = document.body;
        const h = Math.ceil(Math.max(root.getBoundingClientRect().height, body ? body.getBoundingClientRect().bottom + (parseFloat(getComputedStyle(body).marginBottom) || 0) : 0));
        root.style.width = keep;
        return [Math.min(800, Math.max(25, w)), Math.min(600, Math.max(25, h))];
      });
  }

  /** After a step in a popup: if its content grew or shrank, the popup follows it, as Chrome's own does. */
  async refitPopup(n) {
    if (!this.extensionPage?.follows_content || this.page.isClosed()) return;
    const size = await this.popupSize().catch(() => null);
    if (!size || (Math.abs(size[0] - this.size[0]) <= 1 && Math.abs(size[1] - this.size[1]) <= 1)) return;
    this.size = size.map(Math.round);
    this.largest = [Math.max(this.largest[0], this.size[0]), Math.max(this.largest[1], this.size[1])];
    await this.lockSize(this.page);
    if (this.log.t0 !== null) this.log.event({ type: 'size', width: this.size[0], height: this.size[1], step: n, why: 'the popup followed its content' });
    await this.eye.watch(this.page); // Chrome's picture feed is sized when it starts, so it starts again at the new size
    // and is kept current while the page draws itself at that size (its first picture can still be the old one).
    for (let i = 0; i < 18; i++) { await this.page.evaluate(() => window.__studioNudge?.poke()).catch(() => {}); await sleep(1 / FPS); }
  }

  /** Presses on a thing and moves it along an eased path in small moves, one per frame, then lets go. */
  async drag(from, to, n, seconds) {
    await this.glide(from);
    await this.hold(0.1);
    const start = this.log.now();
    const route = [[round(start), round(from.x, 1), round(from.y, 1)]];
    if (this.touch) { this.log.point(from); await this.touchAt('touchStart', [from]); await this.hold(0.45); } // a long press picks a thing up on a phone
    else await this.page.mouse.down();
    await this.hold(0.18);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const time = (seconds ?? clamp(0.55 + distance / 1400, 0.7, 1.6)) * this.pace.move;
    const bend = (0.02 + this.random() * 0.03) * (this.random() < 0.5 ? -1 : 1);
    // One small move per frame of the recording, locked to its grid like a scroll, so a dragged card glides evenly.
    const base = this.log.t0 ?? wall();
    const first = Math.ceil((wall() - base) * FPS);
    const frames = Math.max(1, Math.round(time * FPS));
    for (let k = 1; k <= frames; k++) {
      await sleep(base + (first + k - 0.5) / FPS - wall());
      const p = arc(from, to, smooth(k / frames), bend);
      if (this.touch) await this.touchAt('touchMove', [p]);
      else await this.page.mouse.move(p.x, p.y);
      this.mouse = p;
      this.log.point(p);
      route.push([round(this.log.now()), round(p.x, 1), round(p.y, 1)]);
      if (k % 6 === 0) this.checkpoint();
    }
    await this.hold(0.15);
    if (this.touch) await this.touchAt('touchEnd', []);
    else await this.page.mouse.up();
    if (this.log.t0 !== null) this.log.events.push({ t: round(start), type: 'drag', ...(this.touch ? { input: 'touch' } : {}), end: round(this.log.now()), from: [round(from.x, 1), round(from.y, 1)], to: [round(to.x, 1), round(to.y, 1)], path: route, step: n });
  }

  /** Waits until words appear or go, a thing appears or goes, the page settles, or text in an area stops changing. */
  async waitFor(step, n) {
    const what = step['wait for'];
    const start = wall();
    let label;
    if (/^settled$/i.test(what)) {
      const limit = step.limit ?? 10;
      const r = await this.settled(limit);
      if (!r.ok) stop(`Step ${n} ${show(step)}: the page had not settled after ${limit} seconds: ${r.why}.`);
      label = 'the page to settle';
    } else if (/^(stopped|stopped changing)$/i.test(what)) {
      const limit = step.limit ?? this.product.limits?.stopped?.limit ?? 60;
      const quiet = step.quiet ?? this.product.limits?.stopped?.quiet ?? 1;
      const area = await this.area(n, step, step.in, Math.min(limit, this.opts.timeout));
      let last = null, since = wall(), changes = 0;
      for (;;) {
        const text = await area.innerText().catch(() => null);
        if (text !== last) { if (last !== null) changes++; last = text; since = wall(); }
        if (wall() - since >= quiet && (changes > 0 || wall() - start >= quiet * 1.5)) break;
        if (wall() - start > limit) stop(`Step ${n} ${show(step)}: the text in "${step.in}" was still changing after ${limit} seconds. Raise "limit" if the answer is long.`, { lookedFor: `the text in "${step.in}" to stop changing` });
        this.checkpoint();
        await sleep(0.1);
      }
      label = `the text in "${step.in}" to stop changing`;
    } else {
      const limit = step.limit ?? this.opts.timeout;
      const gone = step.gone === true;
      for (;;) {
        const here = step.thing
          ? Boolean(await this.find(n, step, what, { timeout: 0, quiet: true }).catch(() => null))
          : (await this.scope.getByText(what).filter({ visible: true }).count().catch(() => 0)) > 0;
        if (here !== gone) break;
        if (wall() - start > limit) stop(`Step ${n} ${show(step)}: waited ${limit} seconds for ${step.thing ? 'the thing called ' : 'the words '}"${what}" to ${gone ? 'go' : 'appear'}, and ${gone ? 'it is still there' : 'it did not'}. The page is ${this.page.url()}.`, { lookedFor: `${step.thing ? 'the thing called' : 'the words'} "${what}" to ${gone ? 'go' : 'appear'}` });
        this.checkpoint();
        await sleep(0.1);
      }
      label = `${step.thing ? 'the thing called' : 'the words'} "${what}" to ${gone ? 'go' : 'appear'}`;
    }
    const waited = wall() - start;
    this.markWait(waited, label, n);
    return label;
  }

  /** Moves to a new tab or pop-up window (and records it), a numbered tab, or a frame inside the page. */
  async switchTo(step, n) {
    const to = step.switch;
    const timeout = step.limit ?? this.opts.timeout;
    if (to === 'frame') {
      if (typeof step.to !== 'string') stop(`Step ${n}: say which frame with "to" (its title or name, or a CSS selector), like {"switch": "frame", "to": "Payment"}.`);
      const until = wall() + timeout;
      for (;;) {
        const handle = looksLikeCss(step.to)
          ? await this.page.locator(step.to).first().elementHandle({ timeout: 200 }).catch(() => null)
          : await this.page.locator(`iframe[title="${step.to}" i], iframe[name="${step.to}" i], iframe[aria-label="${step.to}" i], frame[name="${step.to}" i]`).first().elementHandle({ timeout: 200 }).catch(() => null);
        const frame = handle ? await handle.contentFrame() : null;
        if (frame) { this.scope = frame; break; }
        if (wall() > until) stop(`Step ${n} ${show(step)}: no frame called "${step.to}" on the page after ${timeout} seconds.`, { lookedFor: `a frame called "${step.to}"` });
        await sleep(0.2);
      }
      this.log.event({ type: 'switch', to: 'frame', name: step.to, step: n });
      return;
    }
    if (to === 'page' || to === 'main') { this.scope = this.page; this.log.event({ type: 'switch', to: 'page', step: n }); return; }
    let target;
    if (['new', 'tab', 'window', 'popup'].includes(to)) {
      const until = wall() + timeout;
      while (!(target = this.pages.filter((p) => p !== this.page).at(-1))) {
        if (wall() > until) stop(`Step ${n} ${show(step)}: no new tab or window opened within ${timeout} seconds.`, { lookedFor: 'a new tab or window' });
        await sleep(0.1);
      }
    } else {
      const i = to === 'first' ? 1 : Number(to);
      target = this.pages[i - 1];
      if (!target) stop(`Step ${n} ${show(step)}: there ${this.pages.length === 1 ? 'is only 1 tab' : `are only ${this.pages.length} tabs`} open.`);
    }
    if (target === this.page) return;
    this.page = target;
    this.scope = target;
    this.closedUnderUs = false;
    await target.bringToFront().catch(() => {});
    await this.eye.watch(target);
    await target.waitForLoadState('domcontentloaded').catch(() => {});
    await target.mouse.move(this.mouse.x, this.mouse.y).catch(() => {});
    this.log.event({ type: 'switch', to: 'tab', tab: this.pages.indexOf(target) + 1, url: target.url(), step: n });
    await this.ready(n, `After step ${n} (switch)`);
    await this.dismissAll(n);
    await this.checkClean(n, `After step ${n} (switch),`);
  }

  /** If the tab being filmed closed itself (a pop-up that finished), carry on in the tab before it. */
  async afterClose(n) {
    if (!this.closedUnderUs || !this.page.isClosed()) return;
    const back = this.pages.at(-1);
    if (!back) stop(`After step ${n} the last tab closed.`);
    this.page = back;
    this.scope = back;
    this.closedUnderUs = false;
    await this.eye.watch(back);
    this.log.event({ type: 'switch', to: 'tab', tab: this.pages.indexOf(back) + 1, url: back.url(), step: n, why: 'the tab being filmed closed' });
  }
}

/** Opens a step's address: a path inside the product, or a full address the step names. */
function addressOf(product, open, n) {
  const url = /^https?:/.test(open) ? new URL(open) : new URL(open.startsWith('/') ? open : '/' + open, product.address + '/');
  for (const rule of product.rules) {
    const hit = (rule.paths ?? []).find((p) => url.pathname.toLowerCase().includes(p.toLowerCase()));
    if (hit) stop(`Step ${n} opens ${url.href}, and the brand says never to show "${rule.what}".`);
  }
  return url.href;
}

const LOADS = new Set(['open', 'back', 'reload']);
const QUIET_STEPS = new Set(['wait', 'mark', 'line', 'track', 'mask', 'theme', 'wait for', 'switch', 'layer', 'snapshot', 'as']);

/**
 * Follows the steps. `mode` is "take" (recorded), "rehearse", "dry" or "check". With `fromMark`, the steps before
 * that mark are replayed fast and unrecorded first. With "as" steps, a second demo user's window (their own saved
 * sign-in) is opened too and recorded on the same clock.
 */
async function follow({ brand, product, script, opts, mode, marksDir, record, failureDir, fromMark, jobDir, resumeClock = null, answers = null, partsDir = null }) {
  const warnings = [];
  const setting = settingOf(product, script, warnings);
  // A desktop app is its own window, opened through Playwright's Electron support; anything else is a Chrome.
  const where = product.recorder === 'desktop' ? 'app' : browserFor(mode, product, opts, script, answers);
  if (where === 'app' && script.roles.size) stop('A desktop app take films one app window; "as" steps (a second demo user) are for web products.');
  // Your own Chrome: the tool's own new tab in it, through the Playwright Extension. Else the studio's own window.
  const mine = where === 'mine' ? await openYourChrome(brand, product, opts) : null;
  // A recorded take is shown by default: out of sight, Chrome sends most pictures at normal sharpness, which makes
  // zooms soft (measured 12 Nov 2026). --hidden records out of sight anyway, for a quick take nobody will zoom into.
  // check is shown too, so its stills are as sharp as the take it compares against (a hidden check against a shown
  // take reported text edges as changes; 12 Nov 2026).
  const show = opts.show || mode === 'rehearse' || ((mode === 'take' || mode === 'check') && !opts.hidden);
  const frame = Array.isArray(product.frame) ? product.frame : [PAGE.width, PAGE.height];
  // Each second demo user needs their own saved sign-in, made by hand once.
  for (const role of script.roles.keys()) {
    if (!product.siteSignin && !fs.existsSync(profileDir(brand, role))) stop(`The script has steps as the demo user "${role}", who has not signed in yet. Sign in as that user once, by hand: node tools/capture/capture.mjs signin ${brand} --as ${role}`);
  }
  const app = where === 'app' ? await openElectron(product.app, setting) : null;
  if (app) say(`  desktop app: ${app.facts.name ?? product.app.name}${app.facts.version ? ` ${app.facts.version}` : ''} (Electron ${app.facts.electron ?? '?'}), its window ${app.facts.size ? app.facts.size.join(' x ') : 'of unknown size'}; keep your own mouse off it`);
  const ctx = app ? app.handle.context() : mine ? mine.context : await openChrome(brand, { show, setting, frame, touch: product.touch, extension: product.extension });
  const page = app ? app.page : mine ? mine.page : ctx.pages()[0] ?? (await ctx.newPage());
  const log = new Log();
  const drive = new Driver({ ctx, page, product, script, opts, log, setting, brand, jobDir, marksDir, warnings, mine, partsDir, app: app?.handle ?? null });
  if (app) {
    // The take's page size: the app window's own size unless the brand or the script names one. The window on screen
    // is set to it too (macOS may keep it smaller on a small screen; the recording is the full size either way).
    drive.size = product.frame === 'app' && app.facts.size ? [...app.facts.size] : Array.isArray(product.frame) ? [...product.frame] : [PAGE.width, PAGE.height];
    drive.mouse = script.start ? { ...script.start } : { x: Math.round(drive.size[0] * 0.62), y: Math.round(drive.size[1] * 0.66) };
    await app.handle.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0]?.setContentSize(w, h), drive.size).catch(() => {});
  }
  const users = new Map([[MAIN, drive]]);
  const contexts = [];
  let cur = drive;
  const ran = [];
  const steps = script.steps;
  const fromIndex = fromMark ? steps.findIndex((s) => s.mark === fromMark) : 0;
  const recipes = { setup: null, tidy: null };
  let clean = null;
  const settleLimit = script.options.settle_limit ?? product.limits?.settle ?? SETTLE_LIMIT;

  /** Everything a window gets before its first page: clock, clean screen, no cache, the fence around the product. */
  const dress = async (d, c, p) => {
    if (setting.clock.frozen) {
      // The product's clock is set to the demo time and runs on from there, so "2 minutes ago" reads the same every take.
      await c.clock.install({ time: setting.clock.epoch });
      await c.clock.resume();
    }
    const defaults = product.clean.defaults ? STUDIO_HIDE : [];
    await c.addInitScript(nudger);
    await c.addInitScript(dresser, { hide: [...defaults, ...product.clean.hide], keep: product.clean.keep, masks: script.masks, cookieWords: product.clean.defaults, yours: Boolean(d.mine) });
    // Always today's product: nothing comes from the browser's cache, so a check never compares old copies.
    if (d.sized) await d.prepare(p);
    else {
      const net = await c.newCDPSession(p);
      await net.send('Network.enable');
      await net.send('Network.setCacheDisabled', { cacheDisabled: true });
    }
    await d.fence();
    await d.eye.watch(p);
    if (!d.touch) await p.mouse.move(d.mouse.x, d.mouse.y);
  };

  /** Opens a window's first page before the recording starts, so a film never opens on a blank or half-drawn page. */
  const firstPage = async (d, open, what) => {
    await d.open(open, 1);
    await d.ready(1, what);
    await d.dismissAll(1, { waitFirst: true });
    await d.guard(1);
    return d.checkClean(1, `${what},`);
  };

  try {
    if (answers?.mode === 'record' || answers?.mode === 'replay') {
      await answers.attach(ctx, {
        workDir: record ? path.dirname(record.framesDir) : path.join(jobDir, 'capture'),
        onMiss: (info) => {
          const saved = answers.saved?.made ? ` (made ${answers.saved.made})` : '';
          drive.violation ??= new Stop(`The product asked its AI something the saved answer${saved} does not cover: ${info.method} ${info.url}. The product changed how it asks, or the script asks something else, so the saved answer is not used.`, { kind: 'answers-changed', info });
        },
      });
    }
    await dress(drive, ctx, page);
    // A WordPress demo site the studio built signs its demo user in by itself (a link with the site's own key).
    if (product.siteSignin) await drive.signInToSite(product.site.signinAs);

    // The brand's setup script: demo data made before the take, fast and unrecorded.
    if (product.recipes.setup && !opts.noRecipes) recipes.setup = await runRecipe(drive, product.recipes.setup, 'setup', brand);

    clean = await firstPage(drive, steps[0].open, 'Before the take started');
    if (drive.extensionPage) say(`  extension: ${drive.extensionPage.extension} ${drive.extensionPage.page}, opened as a page at its real size, ${drive.size[0]} x ${drive.size[1]}`);
    const hid = Object.entries(clean?.hidden ?? {}).map(([k, v]) => (v > 1 ? `${k} (${v})` : k));
    say(`  clean screen: ${hid.length ? `hid ${hid.join(', ')}` : 'nothing to hide'}${drive.dismissed.length ? `; dismissed ${drive.dismissed.map((d) => d.what).join(', ')}` : ''}`);
    say(`  clock: ${setting.clock.frozen ? `frozen at ${setting.clock.demo_time} (${setting.timeZone}), running from there` : 'real time'}; ${setting.locale}, ${setting.theme}${setting.reducedMotion ? ', reduced motion' : ''}${product.touch ? `; phone size ${drive.size[0]} x ${drive.size[1]} with touch on` : ''}`);
    if (answers && answers.mode !== 'off') say(`  AI answers: ${answers.mode === 'replay' ? `replaying the answers made ${answers.saved.made} (take ${answers.saved.made_in_take})` : answers.mode === 'record' ? 'recording the real answers (retakes replay them)' : 'real answers, not kept (nothing is saved outside a take)'}`);
    if (mine) {
      const yours = Object.entries(clean?.extensions ?? {}).map(([k, v]) => (v > 1 ? `${k} (${v})` : k));
      say(`  your Chrome: page locked to ${drive.size[0]} x ${drive.size[1]} at double sharpness; autofill suggestions off; ${yours.length ? `hid what your extensions drew: ${yours.join(', ')}` : 'nothing drawn by your extensions'}`);
      await page.bringToFront().catch(() => {});
      const seen = await page.evaluate(() => document.visibilityState).catch(() => 'visible');
      if (seen !== 'visible') stop('Your Chrome window is minimised or covered, so Chrome is not drawing the page. Bring that Chrome window to the front, keep it uncovered until the tool is done, and run the command again.');
    }

    // Second demo users: a window each, with their own sign-in, at the page their first "as" step names.
    let offset = 0;
    for (const [role, open] of script.roles) {
      offset += 140;
      const c = await openChrome(brand, { show, setting, frame, touch: product.touch, role, offset });
      contexts.push(c);
      const p = c.pages()[0] ?? (await c.newPage());
      const d = new Driver({ ctx: c, page: p, product, script, opts, log: new Log(), setting, brand, jobDir, marksDir, warnings, role, partsDir });
      users.set(role, d);
      await dress(d, c, p);
      if (product.siteSignin) await d.signInToSite(role);
      await firstPage(d, open, `Before the take started, in ${role}'s window`);
      say(`  demo user "${role}": own window, own sign-in, at ${p.url()}`);
    }
    ran.push({ n: 1, step: steps[0], start: 0, end: 0, note: 'opened before the recording started' });

    if (fromIndex > 1) {
      say(`  replaying steps 2 to ${fromIndex} fast, unrecorded, to reach mark "${fromMark}"`);
      for (const d of users.values()) d.pace = PACES.fast;
      for (let i = 1; i < fromIndex; i++) {
        const n = i + 1;
        if (steps[i].mark !== undefined || steps[i].line !== undefined) continue;
        if (steps[i].as !== undefined) { cur = users.get(steps[i].as.toLowerCase()) ?? drive; continue; }
        await cur.step(steps[i], n);
        if (!QUIET_STEPS.has(kindOf(steps[i]))) await cur.settled(settleLimit);
        await cur.afterClose(n);
        await cur.guard(n);
        await cur.dismissAll(n);
        say(`  ${String(n).padStart(2)}   (replayed) ${label(steps[i])}`);
      }
      await cur.ready(fromIndex, `Before mark "${fromMark}"`);
    }
    for (const d of users.values()) d.pace = { take: PACES.normal, check: PACES.normal, rehearse: PACES.slow, dry: PACES.fast }[mode];

    if (resumeClock && setting.clock.frozen) {
      // A resumed take puts the product's clock where the earlier take had it at this mark, so "2 minutes ago"
      // and the like read the same as they did there.
      for (const d of users.values()) await d.ctx.clock.setSystemTime(resumeClock);
    }
    // Every window is recorded from the same moment, on one clock.
    for (const d of users.values()) {
      d.frameAtStart = [...d.size];
      if (record) await d.eye.startRecording({ ...record, framesDir: d.role === MAIN ? record.framesDir : `${record.framesDir}-${d.role}` });
    }
    const t0 = wall();
    for (const d of users.values()) { d.log.t0 = t0; d.log.point(d.mouse); d.startWatch(); d.startTracking(); }
    const pageTime = setting.clock.frozen ? await page.evaluate(() => Date.now()).catch(() => null) : null;
    await drive.hold(LEAD);

    for (let i = Math.max(1, fromIndex); i < steps.length; i++) {
      const n = i + 1;
      const step = steps[i];
      const kind = kindOf(step);
      const start = log.now();
      if (kind === 'as') {
        // Moves to the other demo user's window: the next steps happen there.
        const role = step.as.toLowerCase();
        cur = users.get(role) ?? drive;
        for (const d of users.values()) d.log.event({ type: 'as', to: cur.role, step: n });
        if (show) await cur.page.bringToFront().catch(() => {});
        ran.push({ n, step, start: round(start), end: round(log.now()), user: cur.role });
        say(`  ${String(n).padStart(2)}  ${start.toFixed(2)}s  ${label(step)}`);
        continue;
      }
      const entry = await cur.step(step, n);
      entry.start = round(start);
      entry.end = round(log.now());
      if (users.size > 1) entry.user = cur.role;
      if (cur.pendingLine && kind !== 'line') { entry.line = cur.pendingLine; cur.pendingLine = null; }
      ran.push(entry);
      say(`  ${String(n).padStart(2)}  ${entry.start.toFixed(2)}s  ${label(step)}`);
      if (!QUIET_STEPS.has(kind)) {
        await cur.hold(GAP); // also gives a click time to start loading a page
        const s = await cur.settled(settleLimit);
        entry.settled = s.ok ? round(s.waited, 2) : false;
        if (!s.ok) { warnings.push(`After step ${n} the page did not settle within ${settleLimit} seconds (${s.why}); the take carried on.`); say(`      did not settle: ${s.why}`); }
        else cur.markWait(s.waited, 'the page settling', n);
      }
      await cur.afterClose(n);
      await cur.refitPopup(n);
      await cur.guard(n);
      for (const d of users.values()) if (d !== cur) d.checkpoint();
      await cur.dismissAll(n, { waitFirst: LOADS.has(kind) });
      if (LOADS.has(kind)) await cur.checkClean(n, `After step ${n} (${kind}),`);
      if (cur.tracked.size || cur.thingMasks.length) await cur.retag(n);
    }
    await drive.hold(TAIL);
    const seconds = log.now();
    for (const d of users.values()) { d.watching = false; d.trackingOn = false; }
    if (record) for (const d of users.values()) await d.eye.stopRecording();
    const served = answers ? await answers.servedIn(page) : 0;
    if (answers?.mode === 'replay' && answers.saved.calls.length && !served) warnings.push(`The saved AI answers (made ${answers.saved.made}) were not asked for in this take: the product did not make the call. Check the take shows the answer you expect.`);
    // The brand's tidy script: what the setup and the take added is taken away again.
    if (product.recipes.tidy && !opts.noRecipes) recipes.tidy = await runRecipe(drive, product.recipes.tidy, 'tidy', brand).catch((e) => { const w = `The tidy script stopped: ${e.message.split('\n')[0]}. Demo data the take added may still be there; tidy it by hand.`; warnings.push(w); say(`  ${w}`); return { ran: false, error: e.message.split('\n')[0] }; });
    const chrome = !record ? null : app ? `${app.facts.name ?? product.app.name} ${app.facts.version ?? ''} (Electron ${app.facts.electron}, Chromium ${app.facts.chrome})`.replace('  ', ' ') : mine
      ? await drive.page.evaluate(() => navigator.userAgent.match(/Chrome\/(\d+)/)?.[1]).then((v) => `Your own Chrome ${v ?? ''}, through the Playwright Extension`.replace(' ,', ',')).catch(() => 'Your own Chrome, through the Playwright Extension')
      : await ctx.newCDPSession(drive.page).then((c) => c.send('Browser.getVersion')).then((v) => v.product).catch(() => null);
    return { log, ran, drive, users, seconds, chrome, finalUrl: drive.page.url(), setting, warnings, clean, pageTime, where, recipes, served };
  } catch (e) {
    for (const d of users.values()) { d.watching = false; d.trackingOn = false; }
    if (failureDir && e instanceof Stop) await failureScreen(cur, e, failureDir, { mode, steps, ran }).catch((err) => say(`  (the failure screen could not be saved: ${err.message.split('\n')[0]})`));
    // Demo data the setup or the first steps added is tidied even when the take stopped.
    if (product.recipes.tidy && !opts.noRecipes && recipes.setup !== null) await runRecipe(drive, product.recipes.tidy, 'tidy', brand).then(() => say('  the tidy script ran after the stop')).catch(() => say('  the tidy script could not run after the stop: tidy the demo data by hand'));
    throw e;
  } finally {
    for (const d of users.values()) { d.watching = false; d.trackingOn = false; await d.eye.unwatch().catch(() => {}); }
    for (const c of contexts) await c.close().catch(() => {});
    if (mine) {
      // Your Chrome is put back as it was: the tool's own tab (and any pop-up it opened) closes, which takes the page
      // size lock, light or dark, language and everything else set for the take with it. The tab you picked and
      // your other tabs were never touched. Then the extension lets go of Chrome.
      await mine.relay.closeOwnTabs().catch(() => {});
      mine.relay.stop();
    } else if (app) await app.handle.close().catch(() => {});
    else await ctx.close().catch(() => {});
  }
}

/** Reads a brand's setup or tidy script: a capture script whose steps make or take away demo data. */
function recipeOf(file, brand) {
  const raw = readJson(file, 'The recipe');
  const steps = Array.isArray(raw) ? raw : raw.steps ?? [];
  if (!steps.length) return { file, steps: [], placeholder: raw.placeholder ?? raw._about ?? 'no steps yet' };
  if (steps[0]?.open === undefined) stop(`${rel(file)}: the first step must open a page, like {"open": "/"}.`);
  const not = steps.map((s, i) => [i + 1, Object.keys(s).find((k) => ['mark', 'as', 'layer', 'snapshot', 'line', 'track'].includes(k))]).find(([, k]) => k);
  if (not) stop(`${rel(file)} step ${not[0]}: "${not[1]}" steps belong in a capture script, not in a setup or tidy script.`);
  for (const s of steps) {
    const words = Object.values(s).filter((x) => typeof x === 'string').join(' ');
    if (PASSWORD_WORDS.test(words)) stop(`${rel(file)}: a step points at a password or sign-in code field. Setup and tidy scripts never touch those. Sign in by hand with: node tools/capture/capture.mjs signin ${brand}`);
  }
  return { file, steps };
}

/** Runs a setup or tidy script in the main window, fast and unrecorded, with the same guards as a take. */
async function runRecipe(drive, file, which, brand) {
  const recipe = recipeOf(file, brand);
  if (!recipe.steps.length) { say(`  ${which} script: ${rel(file)} has no steps yet, so nothing was done (its notes say what to add)`); return { file: rel(file), ran: 0, placeholder: true }; }
  const keep = drive.pace, t0 = drive.log.t0;
  drive.pace = PACES.fast;
  drive.log.t0 = null; // nothing a setup or tidy script does goes into the take's log
  const start = wall();
  try {
    for (const [i, step] of recipe.steps.entries()) {
      const n = i + 1;
      await drive.step(step, n);
      if (!QUIET_STEPS.has(kindOf(step))) await drive.settled(drive.product.limits?.settle ?? SETTLE_LIMIT);
      await drive.afterClose(n);
      await drive.guard(n);
      await drive.dismissAll(n);
    }
  } catch (e) {
    if (e instanceof Stop) e.message = `The ${which} script (${rel(file)}) stopped: ${e.message}`;
    throw e;
  } finally { drive.pace = keep; drive.log.t0 = t0; }
  say(`  ${which} script: ${recipe.steps.length} step${recipe.steps.length > 1 ? 's' : ''} from ${rel(file)}, in ${(wall() - start).toFixed(1)} s, unrecorded`);
  return { file: rel(file), ran: recipe.steps.length, seconds: round(wall() - start, 1) };
}

const label = (step) => Object.entries(step).map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(', ');

/** Replaces flagged words in a words file with a plain note. */
function redact(text, hits) {
  let out = text;
  for (const h of hits) out = out.split(h.line ?? h.text ?? h.found).join(`[blurred: ${h.kind ?? h.what}]`);
  return out;
}

/** When a run stops: a still of the screen, the words on it, and what was looked for and found, in failure/. */
async function failureScreen(drive, error, dir, { mode, steps, ran }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const page = drive.page;
  const info = error.info ?? {};
  const lines = [];
  const lastN = ran.at(-1)?.n ?? 0;
  const failing = steps[lastN] ? lastN + 1 : null;
  const marksBefore = steps.slice(0, failing ? failing - 1 : steps.length).map((s, i) => ({ s, n: i + 1 })).filter((x) => x.s.mark !== undefined);
  lines.push(`The ${mode === 'take' ? 'take' : mode} stopped${failing ? ` at step ${failing} of ${steps.length}: ${show(steps[failing - 1])}` : ''}.`);
  lines.push(`When: ${localStamp()}`);
  lines.push(`Page: ${page.url()}`);
  lines.push('');
  lines.push(`What went wrong: ${error.message}`);
  if (info.lookedFor) lines.push(`Looked for: ${info.lookedFor}`);
  let found = info.found ? [info.found] : [];
  const wanted = String(info.lookedFor ?? '').match(/"([^"]+)"/)?.[1];
  if (!info.found && wanted) {
    const like = await drive.scope.evaluate(lookalikes, wanted).catch(() => []);
    found = like.map((l) => `"${l.text}" (${l.kind})`);
    lines.push(`Found instead: ${found.length ? found.join(', ') : 'nothing with similar words on screen'}`);
  } else if (info.found) lines.push(`Found instead: ${info.found}`);
  const hits = await page.evaluate(privacyScan, { safe: [...drive.product.safe, ...(drive.script.options.safe ?? [])], allowEmail: drive.product.allowEmail, firstNames: FIRST_NAMES }).catch(() => []);
  const blurHits = [...hits, ...(info.kind === 'never-show' ? (await drive.neverShown().catch(() => [])).map((s) => ({ ...s, kind: 'never-show' })) : [])];
  lines.push('');
  if (info.kind === 'never-show-path') lines.push('No still was saved: the page is one the brand never shows.');
  else {
    const still = path.join(dir, 'still.png');
    await page.screenshot({ path: still, type: 'png', caret: 'hide', scale: 'device' }).catch(() => null);
    if (fs.existsSync(still)) {
      const rects = [...blurHits.flatMap((h) => h.rects ?? []), ...(info.rects ?? [])];
      if (rects.length) blurStill(still, rects);
      if (info.boxes?.length) outlineStill(still, info.boxes);
      lines.push(`Still: ${rel(still)}${rects.length ? ' (private words blurred)' : ''}${info.boxes?.length ? ' (what covers the page is boxed in red)' : ''}`);
    }
  }
  const words = info.kind === 'never-show-path' ? '' : await page.evaluate(wordsOnScreen).catch(() => '');
  if (words) {
    fs.writeFileSync(path.join(dir, 'words.txt'), redact(words, blurHits) + '\n');
    lines.push(`Words on screen: ${rel(path.join(dir, 'words.txt'))}`);
  }
  if (marksBefore.length && mode !== 'dry') lines.push(`To try again from the last mark before it: node tools/capture/capture.mjs run ${rel(path.resolve(drive.jobDir))} ${path.basename(drive.script.file, '.json')} --from ${marksBefore.at(-1).s.mark}`);
  fs.writeFileSync(path.join(dir, 'report.txt'), lines.join('\n') + '\n');
  error.message += `\nThe failure screen is in ${rel(dir)}/ (report.txt${info.kind === 'never-show-path' ? '' : ', still.png'}${words ? ', words.txt' : ''}).`;
  if (found.length && !info.found) error.message += `\nOn screen instead: ${found.join(', ')}.`;
}

// ---------------------------------------------------------------- pictures

function ffmpeg(args, what) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) stop(`ffmpeg could not ${what}: ${(r.stderr || '').trim().split('\n').slice(-3).join(' ')}`);
  return r;
}

/** Size of a still, in pixels. */
function sizeOf(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [w, h] = r.stdout.trim().split(',').map(Number);
  return { w, h };
}

/** Blurs areas of a still (page pixels, so twice as many in the still) beyond reading. */
function blurStill(file, rects) {
  const { w, h } = sizeOf(file);
  const boxes = rects.map((r) => {
    const x = clamp(Math.floor((r.x - 6) * SCALE), 0, w - 2), y = clamp(Math.floor((r.y - 4) * SCALE), 0, h - 2);
    return { x, y, w: clamp(Math.ceil((r.w + 12) * SCALE), 2, w - x), h: clamp(Math.ceil((r.h + 8) * SCALE), 2, h - y) };
  });
  if (!boxes.length) return;
  const parts = [`[0:v]split=${boxes.length + 1}[base]${boxes.map((_, i) => `[c${i}]`).join('')}`];
  let last = 'base';
  boxes.forEach((b, i) => {
    parts.push(`[c${i}]crop=${b.w}:${b.h}:${b.x}:${b.y},gblur=sigma=18,gblur=sigma=12[b${i}]`);
    parts.push(`[${last}][b${i}]overlay=${b.x}:${b.y}[o${i}]`);
    last = `o${i}`;
  });
  const tmp = file.replace(/\.png$/, '.blur.png');
  ffmpeg(['-i', file, '-filter_complex', parts.join(';'), '-map', `[${last}]`, '-frames:v', '1', tmp], 'blur private words in a still');
  fs.renameSync(tmp, file);
}

/** Draws red boxes on a still (page pixels). */
function outlineStill(file, boxes) {
  const draw = boxes.map((b) => `drawbox=x=${Math.round(b.x * SCALE)}:y=${Math.round(b.y * SCALE)}:w=${Math.round(b.w * SCALE)}:h=${Math.round(b.h * SCALE)}:color=red@0.9:t=8`).join(',');
  const tmp = file.replace(/\.png$/, '.box.png');
  ffmpeg(['-i', file, '-vf', draw, '-frames:v', '1', tmp], 'mark a still');
  fs.renameSync(tmp, file);
}

/** The width and height in pixels of a JPEG or PNG picture, read from its header. */
function pictureSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/**
 * Turns Chrome's frames (sent only when the page changes, each with its real time) into a steady 60 fps video.
 * `frames` must be in the order of their times (see run). Pictures of different sizes (a "size" step, or a picture
 * Chrome sent at another sharpness) are each scaled into the frame as they come: ffmpeg is told not to rebuild its
 * filters when the size changes, because rebuilding them drops the pictures waiting in them (found 12 Nov 2026: a
 * take with 8 pictures of another size came out 1 s short, with everything after them early).
 */
function assemble(frames, t0, seconds, out, dir, page = PAGE, anchor = 'middle') {
  if (!frames.length) stop('Chrome sent no picture at all. Try again with --show to watch what happens.');
  const [W, H] = [page.width * SCALE, page.height * SCALE];
  if (anchor === 'top') {
    // A popup that changed size: each smaller picture is first set in the full frame, hanging from the top, so the
    // video never has to change size on the way (found 12 Nov 2026: ffmpeg kept the first picture's size otherwise).
    for (const f of frames) {
      if (!f.px || (f.px.w === W && f.px.h === H)) continue;
      // Kept in the take's own picture format: ffmpeg reads every picture of a recording with one decoder.
      const out = f.file.replace(/(\.\w+)$/, '.framed$1');
      ffmpeg(['-i', f.file, '-vf', `pad=${W}:${H}:(ow-iw)/2:0:color=black`, ...(/\.jpe?g$/.test(out) ? ['-q:v', '1'] : []), '-frames:v', '1', out], 'set a popup picture in its frame');
      f.file = out;
    }
  }
  const list = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const from = i === 0 ? 0 : f.t - t0;
    const to = i + 1 < frames.length ? frames[i + 1].t - t0 : seconds;
    // Each picture is read on a 1/600 s clock: by default ffmpeg reads a still picture on a 1/25 s clock, which moved
    // every picture to the nearest 40 ms and dropped those that landed on the same one (found 12 Nov 2026: of 11
    // pictures 1/60 s apart, 6 were lost, and pictures on exact frames came out a frame early or late).
    list.push(`file '${path.basename(f.file)}'`, 'option framerate 600', `duration ${Math.max(0.001, to - from).toFixed(6)}`);
  });
  list.push(`file '${path.basename(frames.at(-1).file)}'`, 'option framerate 600');
  const listFile = path.join(dir, 'frames.txt');
  fs.writeFileSync(listFile, list.join('\n') + '\n');
  // A page made smaller mid-take (a "size" step) sits in the middle of the frame on black, never stretched.
  ffmpeg(['-reinit_filter', '0', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos+accurate_rnd+full_chroma_int:in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,pad=${W}:${H}:(ow-iw)/2:${anchor === 'top' ? '0' : '(oh-ih)/2'}:color=black,fps=${FPS},format=yuv420p`,
    '-t', seconds.toFixed(3), '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF), '-profile:v', 'high', '-tune', 'stillimage',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-r', String(FPS), out], 'make the recording');
}

function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=width,height,r_frame_rate,nb_read_packets:format=duration,size', '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout);
  const s = j.streams[0];
  const [a, b] = s.r_frame_rate.split('/').map(Number);
  return { width: s.width, height: s.height, fps: a / b, frames: Number(s.nb_read_packets), seconds: Number(j.format.duration), bytes: Number(j.format.size) };
}

/**
 * tracks.json: for every frame of the recording (60 a second), the page's scroll and size as they were in that very
 * picture, and where each tracked thing was.
 */
function buildTracks(frames, samples, t0, seconds, drive, page = PAGE) {
  const rows = [];
  let f = 0, s = 0;
  const total = Math.floor(seconds * FPS);
  for (let k = 0; k <= total; k++) {
    const t = k / FPS;
    while (f + 1 < frames.length && frames[f + 1].t - t0 <= t) f++;
    while (s + 1 < samples.length && samples[s + 1][0] <= t) s++;
    const fr = frames[f];
    const at = samples.length && samples[s][0] <= t + 1 / FPS ? samples[s][1] : {};
    rows.push({ t: round(t, 4), scroll: fr ? [round(fr.sx, 1), round(fr.sy, 1)] : [0, 0], page: fr ? [Math.round(fr.w), Math.round(fr.h)] : [page.width, page.height], at });
  }
  return {
    about: 'One row per frame of recording.mp4 (60 a second), on the recording clock. t: seconds. scroll: the page scroll [x, y] in page pixels, as it was in that frame. page: the page size [width, height] in page pixels (it changes after a "size" step). at: each tracked thing as [x, y, width, height] in page pixels from the top left of the window, or null when it was not on the page; a name is missing before its "track" step. Things are followed in the page being filmed, not inside frames.',
    fps: FPS,
    scale: SCALE,
    seconds: round(seconds),
    things: Object.fromEntries([...drive.tracked].map(([name, step]) => [name, { found_by: step.css ? `CSS ${step.css}` : `the words "${step.track}"`, step: drive.script.steps.indexOf(step) + 1 }])),
    frames: rows,
  };
}

// ---------------------------------------------------------------- takes

const slugOf = (jobDir) => path.basename(path.resolve(jobDir)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function takesOf(capDir) {
  if (!fs.existsSync(capDir)) return [];
  return fs.readdirSync(capDir).map((d) => d.match(/^take-(\d+)$/)?.[1]).filter(Boolean).map(Number).filter((n) => fs.existsSync(path.join(capDir, `take-${n}`, 'capture.json'))).sort((a, b) => a - b);
}

function bestOf(capDir) {
  const file = path.join(capDir, 'best.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function setBest(capDir, take, chosen) {
  fs.writeFileSync(path.join(capDir, 'best.json'), JSON.stringify({ take, folder: `take-${take}`, chosen, at: localStamp() }, null, 2) + '\n');
}

/** A capture recorded by version 1 kept its files directly in capture/<id>/: they become take 1. */
function migrate(capDir) {
  if (!fs.existsSync(path.join(capDir, 'capture.json')) || takesOf(capDir).length) return;
  const dest = path.join(capDir, 'take-1');
  fs.mkdirSync(dest, { recursive: true });
  for (const name of ['recording.mp4', 'cursor.json', 'capture.json', 'marks']) if (fs.existsSync(path.join(capDir, name))) fs.renameSync(path.join(capDir, name), path.join(dest, name));
  setBest(capDir, 1, 'recorded before numbered takes');
  say(`  (the earlier recording is now take 1)`);
}

/** Puts the best take's recording, cursor and tracks where the engine can play them, and lists the capture for the preview. */
function publish(jobDir, id, takeDir, info) {
  const slug = slugOf(jobDir);
  const dest = path.join(STUDIO, 'engine/public/jobs', slug, 'capture', id);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  try { fs.linkSync(path.join(takeDir, 'recording.mp4'), path.join(dest, 'recording.mp4')); } // no second copy on disk
  catch { fs.copyFileSync(path.join(takeDir, 'recording.mp4'), path.join(dest, 'recording.mp4')); }
  for (const f of fs.readdirSync(takeDir).filter((f) => /^(cursor|tracks)(-[\w-]+)?\.json$|^events\.json$/.test(f))) fs.copyFileSync(path.join(takeDir, f), path.join(dest, f));
  // A second demo user's recording, and the layers and snapshots, go with it.
  for (const f of fs.readdirSync(takeDir).filter((f) => /^recording-[\w-]+\.mp4$/.test(f))) {
    try { fs.linkSync(path.join(takeDir, f), path.join(dest, f)); } catch { fs.copyFileSync(path.join(takeDir, f), path.join(dest, f)); }
  }
  if (fs.existsSync(path.join(takeDir, 'parts'))) copyTree(path.join(takeDir, 'parts'), path.join(dest, 'parts'));
  const listFile = path.join(STUDIO, 'engine/public/captures.json');
  const list = fs.existsSync(listFile) ? JSON.parse(fs.readFileSync(listFile, 'utf8')) : [];
  const name = `${slug}/${id}`;
  const entry = { capture: name, job: rel(path.resolve(jobDir)), id, take: info.take, brand: info.brand, captured: info.captured, seconds: info.seconds };
  // A listed capture "<job>/<id>" lives in engine/public/jobs/<job>/capture/<id>/ (the old check looked one folder
  // too high, so every other capture was dropped each time one was published; found 12 Nov 2026).
  const onDisk = (c) => { const [j, ...rest] = c.capture.split('/'); return fs.existsSync(path.join(STUDIO, 'engine/public/jobs', j, 'capture', rest.join('/'), 'cursor.json')); };
  const kept = list.filter((c) => c.capture !== name && onDisk(c));
  fs.writeFileSync(listFile, JSON.stringify([entry, ...kept], null, 2) + '\n');
  return { name, dest };
}

/**
 * Puts every job's best take where the engine can play it again, and rebuilds engine/public/captures.json.
 * Those files are made by the tool and never synced, so after a fresh clone, or if they are tidied away, this brings
 * them back from the takes kept in each job. The health check runs it.
 */
function relist() {
  const jobsDir = path.join(STUDIO, 'jobs');
  let n = 0;
  const missing = [];
  for (const job of fs.existsSync(jobsDir) ? fs.readdirSync(jobsDir) : []) {
    const jobDir = path.join(jobsDir, job);
    const capRoot = path.join(jobDir, 'capture');
    if (!fs.existsSync(path.join(jobDir, 'job.json')) || !fs.existsSync(capRoot)) continue;
    for (const id of fs.readdirSync(capRoot)) {
      const capDir = path.join(capRoot, id);
      const best = bestOf(capDir);
      if (!best) continue;
      const takeDir = path.join(capDir, best.folder ?? `take-${best.take}`);
      if (!fs.existsSync(path.join(takeDir, 'recording.mp4'))) { missing.push(rel(takeDir)); continue; }
      let info = {};
      try { info = JSON.parse(fs.readFileSync(path.join(takeDir, 'capture.json'), 'utf8')); } catch {}
      let brand = info.brand;
      try { brand = brand ?? brandOfJob(JSON.parse(fs.readFileSync(path.join(jobDir, 'job.json'), 'utf8'))); } catch {}
      publish(jobDir, id, takeDir, { take: best.take, brand, captured: info.captured ?? info.date ?? best.at, seconds: info.seconds ?? info.video?.seconds });
      n++;
    }
  }
  say(`Listed ${n} capture${n === 1 ? '' : 's'} for the engine.`);
  if (missing.length) say(`No recording on this Mac for: ${missing.join(', ')} (recordings are never synced; record it again with run).`);
  return 0;
}

function localStamp(date = new Date()) {
  const off = -date.getTimezoneOffset();
  const pad = (v) => String(Math.floor(Math.abs(v))).padStart(2, '0');
  return new Date(date.getTime() + off * 60000).toISOString().slice(0, 19) + (off >= 0 ? '+' : '-') + pad(off / 60) + ':' + pad(off % 60);
}

function jobOf(jobDir, id) {
  if (!jobDir || !fs.existsSync(path.join(jobDir, 'job.json'))) stop(`Not a job folder (no job.json): ${jobDir ?? '(none given)'}`);
  const job = readJson(path.join(jobDir, 'job.json'), 'job.json');
  let brand;
  try { brand = brandOfJob(job); } catch (e) { stop(e.message); }
  brandInUse = brand;
  const base = productOf(brand);
  // A terminal or phone app script has its own steps (run, tap, swipe ...): the kind decides how it is read.
  const file = path.join(jobDir, 'capture', `${id}.json`);
  let kindWord = base.raw.kind;
  if (id && /^[a-z0-9][a-z0-9-_]*$/i.test(id) && fs.existsSync(file)) { try { const r = JSON.parse(fs.readFileSync(file, 'utf8')); if (!Array.isArray(r) && r?.kind) kindWord = r.kind; } catch {} }
  const recorder = productKind(kindWord).preset?.recorder;
  let script;
  if (recorder === 'terminal' || recorder === 'simulator') {
    if (!id || !/^[a-z0-9][a-z0-9-_]*$/i.test(id)) stop('Give the capture a name made of letters, digits and dashes, like: capture.mjs run jobs/my-film setup-cli');
    script = (recorder === 'terminal' ? parseTerminalScript : parsePhoneScript)(file, { stop, rel, readJson });
  } else script = scriptOf(jobDir, id, brand);
  const product = withKind(base, script);
  return { brand, product, script, capDir: path.join(jobDir, 'capture', id) };
}

/**
 * Builds the brand's WordPress demo site before Chrome opens (when it has a blueprint), points the take at it, and
 * gives back a function that tears it down. Brands that bring their own environment use their address as it is.
 */
async function siteUp(product, brand) {
  if (product.site?.kind !== 'blueprint') return async () => {};
  const site = await startSite({ site: product.site, studio: STUDIO, brand, say, stop });
  product.address = site.address;
  product.host = new URL(site.address).host;
  product.siteSignin = site.signinUrl;
  product.siteInfo = site;
  return async () => { await site.stop(); say(`  the demo site at ${site.address} is torn down`); };
}

/** Runs `fn` with the brand's demo site up (if it has one), and always tears it down after. */
async function withSite(product, brand, fn) {
  const down = await siteUp(product, brand);
  try { return await fn(); } finally { await down(); }
}

function checkFrom(script, from) {
  if (!from) return;
  const marks = script.steps.filter((s) => s.mark !== undefined).map((s) => s.mark);
  if (!marks.includes(from)) stop(`There is no mark called "${from}" in ${rel(script.file)}. Its marks are: ${marks.join(', ') || 'none'}.`);
}

/** Records the next numbered take. */
async function run(jobDir, id, opts) {
  const job = jobOf(jobDir, id);
  if (job.product.recorder === 'terminal' || job.product.recorder === 'simulator') return recordOther(jobDir, id, opts, job, 'take');
  return withSite(job.product, job.brand, () => runTake(jobDir, id, opts, job));
}

async function runTake(jobDir, id, opts, job) {
  const { brand, product, script, capDir } = job;
  checkFrom(script, opts.from);
  fs.mkdirSync(capDir, { recursive: true });
  migrate(capDir);
  const take = (takesOf(capDir).at(-1) ?? 0) + 1;
  const work = path.join(jobDir, 'capture', `.${id}.new`);
  const fresh = () => {
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(path.join(work, 'marks'), { recursive: true });
    fs.mkdirSync(path.join(work, '.frames'), { recursive: true });
    for (const role of script.roles.keys()) fs.mkdirSync(path.join(work, `.frames-${role}`), { recursive: true });
  };
  fresh();
  const frame = Array.isArray(product.frame) ? `${product.frame[0]} x ${product.frame[1]}` : product.frame === 'app' ? 'the app window\'s own size' : 'the extension\'s own size';
  say(`Recording take ${take} of "${id}" for ${brand} ${product.recorder === 'desktop' ? `in ${product.app.name}` : `at ${product.address}`} (${product.kind ? `${product.kind}, ` : ''}page ${frame}, sharpness x${SCALE}${product.touch ? ', touch' : ''})${opts.from ? `, from mark "${opts.from}"` : ''}${script.roles.size ? `, with ${script.roles.size + 1} demo users` : ''}`);
  product.rules.filter((r) => !r.paths && !r.text && !r.pattern).forEach((r) => say(`  remember: never show ${r.what}`));
  const captured = localStamp();
  let resumeClock = null;
  if (opts.from) {
    // The take the resume continues: the best one that has this mark, else the newest that does.
    const best = bestOf(capDir);
    const order = [best?.take, ...takesOf(capDir).reverse()].filter(Boolean);
    for (const t of order) {
      const c = JSON.parse(fs.readFileSync(path.join(capDir, `take-${t}`, 'capture.json'), 'utf8'));
      if (c.marks?.[opts.from] !== undefined && c.clock?.page_time_at_start) { resumeClock = c.clock.page_time_at_start + (c.marks[opts.from] - LEAD - 0.15) * 1000; say(`  the clock picks up where take ${t} had it at "${opts.from}"`); break; }
    }
  }
  try {
    const format = opts.png ? 'png' : 'jpeg';
    let answers = Answers.plan({ capDir, product, mode: 'take', fresh: opts.freshAnswers });
    let retired = null;
    let result;
    for (let attempt = 1; ; attempt++) {
      try {
        result = await follow({ brand, product, script, opts, mode: 'take', marksDir: path.join(work, 'marks'), record: { framesDir: path.join(work, '.frames'), format }, failureDir: path.join(capDir, 'failure'), fromMark: opts.from, jobDir, resumeClock, answers, partsDir: path.join(work, 'parts') });
        break;
      } catch (e) {
        // A replay the product no longer matches is refused, and a fresh answer is recorded (once).
        if (!(e instanceof Stop) || e.info?.kind !== 'answers-changed' || attempt > 1) throw e;
        say('');
        say(`  ${e.message.split('\n')[0]}`);
        retired = answers.retire(`Refused ${localStamp()}: ${e.message.split('\n')[0]}`);
        say(`  The old answers are kept aside in ${rel(retired)}. Recording a fresh answer now (take ${take} again)...`);
        say('');
        fresh();
        answers = Answers.plan({ capDir, product, mode: 'take', fresh: true });
      }
    }
    const { log, ran, drive, users, seconds, setting, warnings } = result;
    say(`Making the video${users.size > 1 ? 's' : ''} from the pictures Chrome sent...`);
    // One recording per window, all on the take's clock; the first demo user's is recording.mp4.
    const made = {};
    for (const [role, d] of users) {
      // Chrome's pictures can arrive in a different order from the one they were drawn in (found 12 Nov 2026 in the
      // studio's hidden window: 18 to 46 of about 300 in a take). Each carries the time it was drawn, so they are put
      // back in that order; taken as they arrived, every one out of place pushed the rest of the take later.
      const outOfOrder = d.eye.frames.filter((f, i, all) => i && f.t < all[i - 1].t).length;
      const frames = d.eye.frames.sort((a, b) => a.t - b.t);
      const sharp = frames.filter((f) => f.px && Math.abs(f.px.w - f.w * SCALE) <= 2).length;
      const suffix = role === MAIN ? '' : `-${role}`;
      const framesDir = path.join(work, `.frames${suffix}`);
      // A popup that grew with its content is filmed in a frame as big as it ever was, hanging from the top as a popup does.
      const grows = d.extensionPage?.follows_content;
      const size = grows ? d.largest : d.frameAtStart;
      const pageSize = { width: size[0], height: size[1] };
      assemble(frames, log.t0, seconds, path.join(work, `recording${suffix}.mp4`), framesDir, pageSize, grows ? 'top' : 'middle');
      fs.rmSync(framesDir, { recursive: true, force: true });
      const video = probe(path.join(work, `recording${suffix}.mp4`));
      const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t);
      const cursor = {
        about: `Pointer position in page pixels (the page is ${pageSize.width} x ${pageSize.height}; the recording is twice that) on the recording clock, in seconds. path rows are [seconds, x, y]; between rows the pointer moves in a straight line, and after a row it stays put. events: clicks (with up, and button or count when not a single left click; input "touch" and gesture "tap", "double tap" or "long press" when touch is on), type (every key time), paste, press (shortcut and keys for key combinations), drag (its path), scroll, swipe (touch: the finger's path, on the same frames as the scroll), select, upload, wait (speed_up: a real wait the engine may play faster; cut: a moment the engine should leave out, such as saving a layer), switch, size, theme, mark, track, mask, line (the voice line the next step belongs to), layer, snapshot, as (the take moved to another demo user's window), dismissed.`,
        page: pageSize,
        scale: SCALE,
        seconds: round(seconds),
        ...(d.touch ? { input: 'touch' } : {}),
        ...(d.extensionPage ? { frame_as: `extension ${d.extensionPage.page}` } : {}),
        ...(users.size > 1 ? { user: role } : {}),
        path: d.log.path,
        events: d.log.events.sort((a, b) => a.t - b.t),
      };
      fs.writeFileSync(path.join(work, `cursor${suffix}.json`), JSON.stringify(cursor) + '\n');
      const tracks = buildTracks(frames, d.samples, log.t0, seconds, d, pageSize);
      fs.writeFileSync(path.join(work, `tracks${suffix}.json`), JSON.stringify({ ...tracks, frames: undefined }, null, 2).replace(/\n}$/, `,\n  "frames": [\n${tracks.frames.map((r) => '    ' + JSON.stringify(r)).join(',\n')}\n  ]\n}`) + '\n');
      made[role] = { d, video, frames, sharp, outOfOrder, gaps, cursor, tracks, recording: `recording${suffix}.mp4`, pageSize };
    }
    if (users.size > 1) {
      // One event log for the whole take: every window's events on one clock, each with the demo user it happened to.
      const events = [...users].flatMap(([role, d]) => d.log.events.map((e) => ({ ...e, user: role }))).filter((e, i, all) => e.type !== 'as' || all.findIndex((x) => x.type === 'as' && x.t === e.t && x.step === e.step) === i).sort((a, b) => a.t - b.t);
      fs.writeFileSync(path.join(work, 'events.json'), JSON.stringify({ about: 'Every demo user\'s events in one list, on the take\'s one clock (seconds). user: whose window it happened in. Each user\'s own recording, pointer path and events are recording[-<user>].mp4 and cursor[-<user>].json; the first user has no suffix.', seconds: round(seconds), users: Object.fromEntries([...users.keys()].map((r) => [r, { recording: made[r].recording, cursor: r === MAIN ? 'cursor.json' : `cursor-${r}.json`, tracks: r === MAIN ? 'tracks.json' : `tracks-${r}.json` }])), events }, null, 1) + '\n');
    }
    const main = made[MAIN];
    const video = main.video;
    const privacy = [...users.values()].flatMap((d) => d.privacy.map((p) => (users.size > 1 ? { ...p, user: d.role } : p)));
    const allWarnings = [...warnings, ...privacyWarnings(privacy, 'It is blurred in the mark stills and layers and replaced in snapshots; it is not blurred in the recording, so check the recording before it is used, mask it, or add it to "safe_to_show" if it is made up.')];
    const aiAnswers = answers.mode === 'record' ? answers.save({ made: captured, take }) : answers.replayed(result.served);
    if (aiAnswers?.answers) aiAnswers.answers = rel(aiAnswers.answers);
    if (retired) aiAnswers.refused_replay = { kept_in: rel(retired), why: 'the product asked something the saved answers did not cover' };
    const layers = Object.assign({}, ...[...users.values()].map((d) => d.layers));
    const snapshots = Object.assign({}, ...[...users.values()].map((d) => d.snapshots));
    const info = {
      captured,
      brand,
      take,
      from: opts.from ?? null,
      address: product.address,
      script: rel(script.file),
      kind: product.kind,
      source: sourceOf(product, result),
      chrome: result.chrome,
      browser_kind: result.where,
      browser: result.where === 'mine' ? 'your own Chrome, through the Playwright Extension (the tool worked in a tab of its own and closed it after)' : result.where === 'app' ? `the desktop app's own window, through Playwright's Electron support (${product.app.packaged ? 'the packaged app' : 'run from its source folder'})` : 'the studio\'s own Chrome window',
      ...(result.where === 'mine' ? { your_chrome: { page_locked_to: drive.size, zoom: [...drive.zoomNotes], extension_drawings_hidden: result.clean?.extensions ?? {}, autofill_suggestions: 'off for the take' } } : {}),
      setting: { language: setting.locale, time_zone: setting.timeZone, theme: setting.theme, reduced_motion: setting.reducedMotion },
      clock: setting.clock.frozen
        ? { frozen: true, demo_time: setting.clock.demo_time, time_zone: setting.timeZone, page_time_at_start: result.pageTime, ...(resumeClock ? { resumed_from_take_clock: true } : {}), note: 'The product\'s clock was set to the demo time before the first page opened and ran on from there. Times the product takes from its own server are not changed.' + (setting.clock.note ? ` Brand note: ${setting.clock.note}` : '') }
        : { frozen: false, note: 'Real time, as the script asked.' },
      clean_screen: { studio_defaults: product.clean.defaults, hidden: result.clean?.hidden ?? {}, dismissed: drive.dismissed, masked: script.masks.map((m) => m.words ?? m.css) },
      frame: { page: main.pageSize, scale: SCALE, recording: { width: video.width, height: video.height }, fps: FPS, crf: CRF, started_epoch: round(log.t0, 4) },
      ...(product.touch ? { input: { kind: 'touch', note: 'Phone size with touch on: touch events, no hover, a phone browser\'s identity. Clicks are taps (cursor.json events with input "touch"), scrolls are logged as swipes with the finger\'s path.' } } : {}),
      ...(drive.extensionPage ? { extension: { ...drive.extensionPage, frame_as: `extension ${drive.extensionPage.page}`, note: 'The extension\'s popup or side panel, opened as a page in its own tab at its real size. Frame it as a popup (or side panel) in the engine; the browser around it is not in the recording.' } } : {}),
      ...(users.size > 1 ? { users: Object.fromEntries([...users].map(([r, d]) => [r, { recording: made[r].recording, cursor: r === MAIN ? 'cursor.json' : `cursor-${r}.json`, tracks: r === MAIN ? 'tracks.json' : `tracks-${r}.json`, signed_in_as: r === MAIN ? 'the brand\'s own sign-in' : `the "${r}" sign-in (capture.mjs signin ${brand} --as ${r})`, ended_on: d.page.url() }])), events: 'events.json' } : {}),
      ...(aiAnswers ? { ai_answers: aiAnswers } : {}),
      ...(Object.keys(layers).length ? { layers } : {}),
      ...(Object.keys(snapshots).length ? { snapshots: Object.fromEntries(Object.entries(snapshots).map(([k, v]) => [k, { file: v.file, box: v.box, t: v.t, parts: v.parts.length, details: `parts/snapshots/${k}.json` }])) } : {}),
      ...(result.recipes.setup || result.recipes.tidy ? { recipes: result.recipes } : {}),
      seconds: round(seconds),
      pictures_from_chrome: { count: main.frames.length, received: drive.eye.received, format, longest_gap_seconds: round(Math.max(0, ...main.gaps)), full_sharpness: main.sharp, out_of_order: main.outOfOrder, ...(drive.eye.blackouts.length ? { left_out_while_saving_layers: { pictures: drive.eye.leftOut ?? 0, seconds: drive.eye.blackouts.map((b) => [round(b.from - log.t0), round(b.to - log.t0)]) } } : {}), note: 'count: pictures kept (each one different from the one before); received: all Chrome sent, including repeats while the page might be changing. full_sharpness: pictures Chrome sent at double sharpness (the rest were scaled up). out_of_order: pictures that arrived after one drawn later than them; they are put back in the order they were drawn.' },
      marks: Object.assign({}, ...[...users.values()].map((d) => d.marks)),
      mark_details: Object.assign({}, ...[...users.values()].map((d) => d.markInfo)),
      privacy_flags: privacy,
      warnings: allWarnings,
      steps: ran,
      tabs: drive.pages.map((p) => p.url()),
      ended_on: result.finalUrl,
    };
    fs.writeFileSync(path.join(work, 'capture.json'), JSON.stringify(info, null, 2) + '\n');
    if (allWarnings.length) fs.writeFileSync(path.join(work, 'warnings.txt'), `Warnings for take ${take} of "${id}", recorded ${captured}. A person reads these before the footage is used.\n\n` + allWarnings.map((w) => `- ${w}`).join('\n') + '\n');
    const takeDir = path.join(capDir, `take-${take}`);
    fs.renameSync(work, takeDir);
    fs.rmSync(path.join(capDir, 'failure'), { recursive: true, force: true });
    const best = bestOf(capDir);
    // The newest take becomes the best one, unless a person chose one, or this take only covers the part from a mark
    // and a whole take already exists.
    const bestGone = !best || !fs.existsSync(path.join(capDir, best.folder ?? ''));
    if (bestGone || (best.chosen !== 'by a person' && !opts.from)) setBest(capDir, take, opts.from ? `newest take (from mark "${opts.from}")` : 'newest take');
    const nowBest = bestOf(capDir);
    let published = null;
    if (nowBest.take === take) published = publish(jobDir, id, takeDir, info);
    say('');
    for (const [role, m] of Object.entries(made)) say(`Done${users.size > 1 ? ` (${role})` : ''}: take ${take}, ${rel(path.join(takeDir, m.recording))}  ${m.video.width} x ${m.video.height}, ${round(m.video.fps, 2)} fps, ${m.video.seconds.toFixed(2)} s, ${(m.video.bytes / 1e6).toFixed(1)} MB`);
    say(`  marks: ${Object.keys(info.marks).length ? Object.entries(info.marks).map(([k, v]) => `${k} at ${v.toFixed(2)}s`).join(', ') : 'none'}`);
    say(`  cursor: ${log.path.length} positions, ${log.events.filter((e) => e.type === 'click').length} ${product.touch ? 'taps' : 'clicks'}${product.touch ? `, ${log.events.filter((e) => e.type === 'swipe').length} swipes` : ''} (cursor.json); tracks.json: ${main.tracks.frames.length} frames${drive.tracked.size ? `, following ${[...drive.tracked.keys()].join(', ')}` : ''}`);
    if (users.size > 1) say(`  one event log for all ${users.size} demo users: ${rel(path.join(takeDir, 'events.json'))}`);
    if (Object.keys(layers).length) say(`  layers: ${Object.values(layers).map((l) => `${l.name} (${l.box[2]} x ${l.box[3]})`).join(', ')}`);
    if (Object.keys(snapshots).length) say(`  snapshots: ${Object.values(snapshots).map((s) => `${s.name} (${s.parts.length} rows, numbers and words; ${s.css_rules} CSS rules)`).join(', ')}`);
    if (aiAnswers) say(`  AI answers: ${aiAnswers.mode === 'recorded' ? `recorded ${aiAnswers.calls} call${aiAnswers.calls === 1 ? '' : 's'}, saved for retakes in ${aiAnswers.answers ?? '(nothing saved)'}` : `replayed the answers made ${aiAnswers.made}; label the footage with that date`}`);
    if (allWarnings.length) say(`  ${allWarnings.length} warning${allWarnings.length > 1 ? 's' : ''} for a person to read: ${rel(path.join(takeDir, 'warnings.txt'))}`);
    say(nowBest.take === take ? `  this is now the best take; the engine plays it (capture "${published.name}")` : `  the best take is still take ${nowBest.take} (${nowBest.chosen === 'by a person' ? 'chosen by a person' : 'a whole take; this one starts at a mark'}). To use this one: node tools/capture/capture.mjs best ${rel(path.resolve(jobDir))} ${id} ${take}`);
  } catch (e) {
    fs.rmSync(work, { recursive: true, force: true });
    throw e;
  }
}

/**
 * A take of a command-line tool (a terminal the studio draws) or a phone app (the iOS Simulator or Android emulator):
 * the same numbered takes, files and hand-over to the engine as a web take. "dry" and "rehearse" do the steps without
 * recording; "check" records the marks again and compares them with the best take's.
 */
async function recordOther(jobDir, id, opts, job, mode) {
  const { brand, product, script, capDir } = job;
  const terminal = product.recorder === 'terminal';
  const what = terminal ? 'terminal' : 'phone app';
  const h = { say, stop, round, rel, ffmpeg, probe, assemble, playwright, FPS, SCALE, LEAD, TAIL };
  const recorder = terminal ? recordTerminal : recordPhone;
  const setting = settingOf(product, { options: {}, file: script.file }, []);
  if (opts.from) stop(`--from is for web takes; a ${what} take always runs every step.`);
  if (mode === 'dry' || mode === 'rehearse') {
    say(`${mode === 'dry' ? 'Dry run' : 'Rehearsal'} of the ${what} take "${id}": every step${terminal ? ', commands run for real' : ''}, without recording.`);
    const r = await recorder({ brand, product, script, opts, mode, work: null, h, setting });
    say('');
    say(`All ${script.steps.length} steps worked, in ${r.seconds.toFixed(1)} s.`);
    r.warnings.forEach((w) => say(`  warning: ${w}`));
    return 0;
  }
  fs.mkdirSync(capDir, { recursive: true });
  migrate(capDir);
  if (mode === 'check') {
    const best = bestOf(capDir);
    if (!best) stop(`The capture "${id}" has not been recorded yet, so there is nothing to compare.`);
    const takeDir = path.join(capDir, best.folder ?? `take-${best.take}`);
    const work = path.join(capDir, 'check', '.now');
    fs.rmSync(path.join(capDir, 'check'), { recursive: true, force: true });
    fs.mkdirSync(path.join(work, 'marks'), { recursive: true });
    say(`Checking the ${what} take "${id}" (take ${best.take}) against today`);
    await recorder({ brand, product, script, opts, mode: 'take', work, h, setting });
    const changed = [];
    let compared = 0;
    const savedCapture = fs.existsSync(path.join(takeDir, 'capture.json')) ? JSON.parse(fs.readFileSync(path.join(takeDir, 'capture.json'), 'utf8')) : {};
    for (const name of script.steps.filter((st) => st.mark).map((st) => st.mark)) {
      const before = path.join(takeDir, 'marks', `${name}.png`);
      const after = path.join(work, 'marks', `${name}.png`);
      if (!fs.existsSync(before) || !fs.existsSync(after)) { say(`  ${name}: nothing saved to compare with`); continue; }
      const f = markFreshness(name, path.join(takeDir, 'marks'), path.join(work, 'marks'), savedCapture.mark_details?.[name], path.join(capDir, 'check'));
      compared++;
      if (f.changed) changed.push(name);
      say(`  ${name}: ${f.changed ? 'CHANGED' : 'no change'}`);
      f.lines.forEach((l) => say(`      ${l}`));
    }
    fs.rmSync(work, { recursive: true, force: true });
    if (!changed.length) fs.rmSync(path.join(capDir, 'check'), { recursive: true, force: true });
    if (!compared) stop('There were no marks to compare.');
    say(changed.length ? `${changed.length} of ${compared} moments look different now.` : `No change: all ${compared} moments look the same as when they were recorded.`);
    return changed.length ? 1 : 0;
  }
  const take = (takesOf(capDir).at(-1) ?? 0) + 1;
  const work = path.join(jobDir, 'capture', `.${id}.new`);
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(path.join(work, 'marks'), { recursive: true });
  const captured = localStamp();
  say(`Recording take ${take} of "${id}" for ${brand} (${product.kind}${terminal ? ', drawn by the studio' : ''})`);
  try {
    const r = await recorder({ brand, product, script, opts, mode: 'take', work, h, setting });
    const video = probe(path.join(work, 'recording.mp4'));
    // tracks.json in the same form as a web take's (nothing is tracked; the page never scrolls).
    const total = Math.floor(r.seconds * FPS);
    const rows = Array.from({ length: total + 1 }, (_, k) => '    ' + JSON.stringify({ t: round(k / FPS, 4), scroll: [0, 0], page: [r.page.width, r.page.height], at: {} }));
    fs.writeFileSync(path.join(work, 'tracks.json'), JSON.stringify({ about: `One row per frame of recording.mp4 (60 a second). A ${what} take: nothing is tracked and nothing scrolls, so every row is the same.`, fps: FPS, scale: SCALE, seconds: round(r.seconds), things: {} }, null, 2).replace(/\n}$/, `,\n  "frames": [\n${rows.join(',\n')}\n  ]\n}`) + '\n');
    const info = {
      captured,
      brand,
      take,
      address: product.address,
      script: rel(script.file),
      kind: product.kind,
      source: r.source,
      frame: { page: r.page, scale: SCALE, recording: { width: video.width, height: video.height }, fps: FPS },
      seconds: round(r.seconds),
      ...(r.pictures ? { pictures_drawn: r.pictures } : {}),
      marks: r.marks,
      mark_details: r.mark_details,
      warnings: r.warnings,
      steps: script.steps.map((st, i) => ({ n: i + 1, step: st })),
    };
    fs.writeFileSync(path.join(work, 'capture.json'), JSON.stringify(info, null, 2) + '\n');
    if (r.warnings.length) fs.writeFileSync(path.join(work, 'warnings.txt'), `Warnings for take ${take} of "${id}", recorded ${captured}. A person reads these before the footage is used.\n\n` + r.warnings.map((w) => `- ${w}`).join('\n') + '\n');
    const takeDir = path.join(capDir, `take-${take}`);
    fs.renameSync(work, takeDir);
    const best = bestOf(capDir);
    if (!best || !fs.existsSync(path.join(capDir, best.folder ?? '')) || best.chosen !== 'by a person') setBest(capDir, take, 'newest take');
    const nowBest = bestOf(capDir);
    const published = nowBest.take === take ? publish(jobDir, id, takeDir, info) : null;
    const typed = r.events.filter((e) => e.type === 'type');
    say('');
    say(`Done: take ${take}, ${rel(path.join(takeDir, 'recording.mp4'))}  ${video.width} x ${video.height}, ${round(video.fps, 2)} fps, ${video.seconds.toFixed(2)} s, ${(video.bytes / 1e6).toFixed(1)} MB`);
    say(`  marks: ${Object.keys(r.marks).length ? Object.entries(r.marks).map(([k, v]) => `${k} at ${v.toFixed(2)}s`).join(', ') : 'none'}`);
    say(`  cursor.json: ${terminal ? `no pointer; ${typed.length} typed line${typed.length === 1 ? '' : 's'}, ${typed.reduce((a, e) => a + e.keys.length, 0)} key times, ${r.events.filter((e) => e.type === 'command').length} commands` : `${r.events.filter((e) => e.type === 'click').length} taps, ${r.events.filter((e) => e.type === 'swipe').length} swipes, ${typed.reduce((a, e) => a + e.keys.length, 0)} key times`}`);
    if (r.warnings.length) say(`  ${r.warnings.length} warning${r.warnings.length > 1 ? 's' : ''} for a person to read: ${rel(path.join(takeDir, 'warnings.txt'))}`);
    say(published ? `  this is now the best take; the engine plays it (capture "${published.name}")` : `  the best take is still take ${nowBest.take} (chosen by a person)`);
    return 0;
  } catch (e) {
    fs.rmSync(work, { recursive: true, force: true });
    throw e;
  }
}

/** Where a take's pictures came from, for capture.json: a web page, a demo site the studio built, or a desktop app. */
function sourceOf(product, result) {
  const s = product.siteInfo;
  if (s) return { type: 'wordpress demo site', built_from: s.built_from, by: `WordPress Playground (${s.tool}, through npx)`, wordpress: s.wordpress, php: s.php, plugins: s.plugins, demo_users: s.users, address: s.address, built_in_seconds: s.seconds, signed_in_as: s.signinAs, note: 'A throwaway site built fresh for this take on this Mac and torn down after; demo users were signed in from the site\'s own link (no password typed).' };
  if (result.where === 'app') return { type: 'desktop app', app: product.app.path, packaged: product.app.packaged, program: product.app.bin, by: 'Playwright Electron support', window: result.chrome };
  if (product.site?.kind === 'own') return { type: 'the brand\'s own environment', address: product.address, note: 'A staging or local site the brand named, signed in by hand.' };
  return { type: 'web page', address: product.address };
}

/** One warning per private thing found, naming every mark it was seen at. */
function privacyWarnings(flags, after) {
  const seen = new Map();
  for (const f of flags) {
    const key = `${f.kind}|${f.text}`;
    if (!seen.has(key)) seen.set(key, { ...f, marks: [] });
    seen.get(key).marks.push(f.mark !== undefined ? `mark ${f.mark}` : f.layer !== undefined ? `layer ${f.layer}` : `snapshot ${f.snapshot}`);
  }
  return [...seen.values()].map((f) => `${f.kind[0].toUpperCase()}${f.kind.slice(1)} not on the brand's safe list: "${f.text}", at ${f.marks.join(', ')}. ${after}`);
}

/** Does the steps without recording: visibly at half speed (rehearse) or fast (dry). */
async function walk(jobDir, id, opts, mode) {
  const job = jobOf(jobDir, id);
  if (job.product.recorder === 'terminal' || job.product.recorder === 'simulator') return recordOther(jobDir, id, opts, job, mode);
  return withSite(job.product, job.brand, () => walkSteps(jobDir, id, opts, mode, job));
}

async function walkSteps(jobDir, id, opts, mode, job) {
  const { brand, product, script, capDir } = job;
  checkFrom(script, opts.from);
  say(mode === 'rehearse' ? `Rehearsing "${id}" in a visible Chrome window at half speed, without recording. Keep your own mouse off it.` : `Dry run of "${id}": every step, fast, without recording.`);
  const answers = Answers.plan({ capDir, product, mode, fresh: false });
  const result = await follow({ brand, product, script, opts, mode, marksDir: null, record: null, failureDir: path.join(capDir, 'failure'), fromMark: opts.from, jobDir, answers });
  fs.rmSync(path.join(capDir, 'failure'), { recursive: true, force: true });
  const targets = result.ran.filter((r) => r.target).length;
  say('');
  say(`All ${script.steps.length} steps worked${targets ? `; ${targets} things were found on screen` : ''}, in ${result.seconds.toFixed(1)} s.`);
  const w = [...result.warnings, ...privacyWarnings(result.drive.privacy, 'A take blurs it in the mark stills and lists it for a person.')];
  w.forEach((x) => say(`  warning: ${x}`));
  return 0;
}

function listTakes(jobDir, id) {
  const { capDir } = jobOf(jobDir, id);
  migrate(capDir);
  const takes = takesOf(capDir);
  const best = bestOf(capDir);
  if (!takes.length) { say(`"${id}" has no takes yet. Record one with: node tools/capture/capture.mjs run ${rel(path.resolve(jobDir))} ${id}`); return 0; }
  for (const t of takes) {
    const c = JSON.parse(fs.readFileSync(path.join(capDir, `take-${t}`, 'capture.json'), 'utf8'));
    say(`  take ${t}${best?.take === t ? '  (best)' : ''}  ${c.captured}  ${c.seconds}s  marks: ${Object.keys(c.marks ?? {}).join(', ') || 'none'}${c.from ? `  from ${c.from}` : ''}${c.warnings?.length ? `  ${c.warnings.length} warnings` : ''}`);
  }
  return 0;
}

function chooseBest(jobDir, id, n) {
  const { capDir, brand } = jobOf(jobDir, id);
  migrate(capDir);
  const take = Number(n);
  if (!takesOf(capDir).includes(take)) stop(`"${id}" has no take ${n}. Its takes: ${takesOf(capDir).join(', ') || 'none'}.`);
  setBest(capDir, take, 'by a person');
  const takeDir = path.join(capDir, `take-${take}`);
  const info = JSON.parse(fs.readFileSync(path.join(takeDir, 'capture.json'), 'utf8'));
  const published = publish(jobDir, id, takeDir, { ...info, brand, take });
  say(`Take ${take} is now the best take of "${id}". The engine plays it (capture "${published.name}").`);
  return 0;
}

// ---------------------------------------------------------------- recording by showing

/** "Control+M" as the recorder wants it. */
function markKeyOf(text) {
  const parts = String(text || 'Control+M').split('+').map((p) => p.trim());
  const key = parts.pop();
  if (!key) stop('--mark-key needs a key, like --mark-key Control+M');
  const has = (w) => parts.some((p) => p.toLowerCase() === w);
  return { key: key.toLowerCase(), ctrl: has('control') || has('ctrl'), meta: has('meta') || has('cmd') || has('command'), alt: has('alt') || has('option'), shift: has('shift'), label: [...parts, key.toUpperCase()].join('+') };
}

/** Words for a thing in a step, plus "near" when two things share them. Null when the thing cannot be named. */
function aimOf(d) {
  if (!d || d.secret) return null;
  if (d.words) return { words: d.words, ...(d.near ? { near: d.near } : {}), twins: d.twins && !d.near ? d.twins : 0 };
  if (d.css) return { words: d.css, css: true };
  return null;
}

/**
 * Turns what the person did into clean capture steps. Drops, and counts for the person: stray clicks (on nothing
 * that reacts, with no change), things opened and closed again at once (a menu, a panel, a page), hovers before a
 * click on the same thing, scrolls that came back to where they started, repeated clicks, and typing corrections
 * (only the final text is kept).
 */
function cleanShown(events, startUrl, product) {
  const dropped = { stray: 0, undone: 0, pageBack: 0, hover: 0, scroll: 0, repeat: 0, unnamed: 0, secret: 0 };
  const notes = [];
  const pathOf = (url) => { try { const u = new URL(url); return u.host === product.host ? (u.pathname + u.search + u.hash) || '/' : url; } catch { return url; } };
  const raw = [];
  const effects = new Map(events.filter((e) => e.kind === 'effect').map((e) => [`${e.page}:${e.id}`, e]));
  const ticks = new Map(events.filter((e) => e.kind === 'ticked').map((e) => [`${e.page}:${e.id}`, e.checked]));
  let currentPage = 0, pages = new Set([0]), lastAction = -Infinity, seenFirst = false;
  const history = {}, actedSince = {};
  for (const e of events) {
    if (['click', 'rightclick', 'press', 'type', 'select', 'drag'].includes(e.kind)) actedSince[e.page] = true;
    const fx = e.id !== undefined ? effects.get(`${e.page}:${e.id}`) : null;
    const changed = fx ? fx.after !== e.before : true;
    if (e.page !== currentPage && !['effect', 'ticked'].includes(e.kind)) {
      if (!pages.has(e.page)) { pages.add(e.page); raw.push({ step: { switch: 'new' }, t: e.t, kind: 'switch' }); }
      else raw.push({ step: { switch: e.page + 1 }, t: e.t, kind: 'switch' });
      currentPage = e.page;
    }
    switch (e.kind) {
      case 'page': {
        // A new page in the tab: caused by the last click or key (nothing to write), or by the person: the back
        // button (Chrome says so, or it is the page before the last one), reload, or an address typed in.
        const list = (history[e.page] ??= []);
        const acted = actedSince[e.page];
        actedSince[e.page] = false;
        if (!seenFirst && e.page === 0) { seenFirst = true; list.push(e.url); break; }
        if (!list.length) { list.push(e.url); break; } // a new tab's first page
        if (e.how === 'reload') raw.push({ step: { reload: true }, t: e.t, kind: 'reload' });
        else if (e.how === 'back_forward' || (!acted && e.url === list.at(-2))) raw.push({ step: { back: true }, t: e.t, kind: 'back', url: e.url });
        else if (!acted && e.t - lastAction > 1.5) raw.push({ step: { open: pathOf(e.url) }, t: e.t, kind: 'open', url: e.url });
        list.push(e.url);
        break;
      }
      case 'click': case 'rightclick': {
        lastAction = e.t;
        const d = e.target;
        if (d?.secret) { dropped.secret++; break; }
        const aim = aimOf(d);
        if (!aim) { dropped.unnamed++; notes.push('A click on something with no words, label or id was left out; add it by hand if it mattered.'); break; }
        if (e.kind === 'click' && d.plain && !changed) { dropped.stray++; break; }
        const near = aim.near ? { near: aim.near } : {};
        let step;
        if (e.kind === 'rightclick') step = { 'right-click': aim.words, ...near };
        else if (d.tick === 'checkbox') step = { check: aim.words, ...near, ...(ticks.get(`${e.page}:${e.id}`) === false ? { off: true } : {}) };
        else if (d.tick === 'switch') step = { toggle: aim.words, ...near };
        else step = { click: aim.words, ...near };
        raw.push({ step, t: e.t, kind: e.kind, target: aim.words, field: d.field, before: e.before, after: fx?.after, changed, twins: aim.twins, url: fx?.url });
        break;
      }
      case 'dblclick': {
        const last = raw.at(-1), prev = raw.at(-2);
        const aim = aimOf(e.target);
        if (aim && last?.kind === 'click' && last.target === aim.words) {
          if (prev?.kind === 'click' && prev.target === aim.words) raw.splice(raw.length - 2, 1);
          last.step = { 'double-click': aim.words, ...(last.step.near ? { near: last.step.near } : {}) };
          last.kind = 'double-click';
        }
        break;
      }
      case 'drag': {
        lastAction = e.t;
        const from = aimOf(e.from);
        if (!from) { dropped.unnamed++; break; }
        const to = aimOf(e.to);
        raw.push({ step: to ? { drag: from.words, to: to.words } : { drag: from.words, by: e.by }, t: e.t, kind: 'drag', before: e.before, after: fx?.after, changed });
        break;
      }
      case 'type': {
        lastAction = e.t;
        const into = aimOf(e.into);
        if (!into || e.into?.secret) { dropped.secret++; break; }
        const prior = raw.at(-1);
        if (prior?.kind === 'type' && prior.into === into.words) raw.pop(); // typed, left, came back: the final text only
        const keep = e.initial && e.text.startsWith(e.initial) ? e.text.slice(e.initial.length) : e.text;
        if (!keep) { if (e.initial) notes.push(`The field "${into.words}" was emptied; add that by hand if it mattered.`); break; }
        const step = { type: keep, into: into.words, ...(into.near ? { near: into.near } : {}), ...(e.initial && !e.text.startsWith(e.initial) ? { clear: true } : {}) };
        raw.push({ step, t: e.t, kind: 'type', into: into.words });
        break;
      }
      case 'secret': dropped.secret++; notes.push('A password or sign-in code field was used: nothing typed there was read or written down. Sign in before you show the flow.'); break;
      case 'select': {
        lastAction = e.t;
        const from = aimOf(e.from);
        if (from && e.value) raw.push({ step: { select: e.value, from: from.words }, t: e.t, kind: 'select' });
        break;
      }
      case 'press': {
        lastAction = e.t;
        raw.push({ step: { press: e.key }, t: e.t, kind: 'press', key: e.key, before: e.before, after: fx?.after, changed });
        break;
      }
      case 'scroll': {
        const step = { scroll: e.dy, ...(e.area ? { in: e.area } : {}) };
        if (!e.pageScroll && !e.area) { notes.push(`A scroll of ${e.dy} pixels in a panel with no name was left out; add {"scroll": ${e.dy}, "in": "..."} by hand if it mattered.`); dropped.unnamed++; break; }
        raw.push({ step, t: e.t, kind: 'scroll', area: e.area ?? null });
        break;
      }
      case 'hover': {
        const aim = aimOf(e.target);
        if (aim) raw.push({ step: { hover: aim.words, ...(aim.near ? { near: aim.near } : {}) }, t: e.t, kind: 'hover', target: aim.words });
        break;
      }
      case 'mark': raw.push({ step: { mark: null }, t: e.t, kind: 'mark' }); break;
    }
  }
  // Things undone at once: a click or key, then within 4 s another click or Escape that puts the page back exactly as
  // it was before the first (a menu opened and closed, a panel opened and shut). Only scrolls and hovers between.
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (!['click', 'press', 'double-click'].includes(a.kind) || a.before === undefined || !a.changed) continue;
    for (let j = i + 1; j < raw.length; j++) {
      const b = raw[j];
      if (['scroll', 'hover'].includes(b.kind)) continue;
      if (b.t - a.t > 4) break;
      if (['click', 'press'].includes(b.kind) && b.after !== undefined && b.after === a.before) {
        raw.splice(i, j - i + 1);
        dropped.undone += 1;
        i--;
      }
      break;
    }
  }
  // A page opened and closed: a click that went to another page, then "back" within 8 s, with only looking between.
  for (let i = 0; i < raw.length; i++) {
    if (raw[i].kind !== 'back') continue;
    let j = i - 1;
    while (j >= 0 && ['scroll', 'hover'].includes(raw[j].kind)) j--;
    if (j >= 0 && ['click', 'open'].includes(raw[j].kind) && raw[i].t - raw[j].t < 8) { raw.splice(j, i - j + 1); dropped.pageBack++; i = j - 1; }
  }
  // Hovers right before a click on the same thing (the click glides there anyway), and repeated hovers.
  for (let i = raw.length - 2; i >= 0; i--) {
    const a = raw[i], b = raw[i + 1];
    if (a.kind === 'hover' && (['click', 'double-click', 'right-click'].includes(b.kind) || b.kind === 'hover') && (b.target === a.target || b.kind === 'hover')) { raw.splice(i, 1); dropped.hover++; }
  }
  // A click into a field just before typing in it: the "type" step clicks into the field itself.
  for (let i = raw.length - 2; i >= 0; i--) {
    const a = raw[i];
    if (a.kind !== 'click' || !a.field) continue;
    const next = raw.slice(i + 1).find((r) => !['hover', 'scroll'].includes(r.kind));
    if (next?.kind === 'type' && next.into === a.target) raw.splice(i, 1);
  }
  // Scrolls: one step per stretch in the same place; a stretch that ends where it began is dropped.
  for (let i = raw.length - 2; i >= 0; i--) {
    const a = raw[i], b = raw[i + 1];
    if (a.kind === 'scroll' && b.kind === 'scroll' && a.area === b.area) { a.step.scroll += b.step.scroll; raw.splice(i + 1, 1); }
  }
  for (let i = raw.length - 1; i >= 0; i--) if (raw[i].kind === 'scroll' && Math.abs(raw[i].step.scroll) < 40) { raw.splice(i, 1); dropped.scroll++; }
  // The same click twice in a row with nothing changing in between.
  for (let i = raw.length - 1; i > 0; i--) {
    const a = raw[i - 1], b = raw[i];
    if (a.kind === 'click' && b.kind === 'click' && a.target === b.target && b.t - a.t < 1.2 && !b.changed) { raw.splice(i, 1); dropped.repeat++; }
  }
  for (const r of raw) if (r.twins) notes.push(`"${r.target}" appears ${r.twins} times on the page and no words near it tell them apart: add "in" (the panel it is in) to that step.`);
  let m = 0;
  const steps = [{ open: pathOf(startUrl) }];
  for (const r of raw) {
    if (r.kind === 'mark') r.step.mark = `mark-${++m}`;
    steps.push(r.step);
  }
  return { steps, dropped, notes: [...new Set(notes)] };
}

/** capture.mjs show: opens the product, writes down what a person does, cleans it and saves the capture script. */
async function showFlow(jobDir, id, opts) {
  if (!jobDir || !fs.existsSync(path.join(jobDir, 'job.json'))) stop(`Not a job folder (no job.json): ${jobDir ?? '(none given)'}`);
  if (!id || !/^[a-z0-9][a-z0-9-_]*$/i.test(id)) stop('Give the capture a name made of letters, digits and dashes, like: capture.mjs show jobs/my-film lead-form');
  const job = readJson(path.join(jobDir, 'job.json'), 'job.json');
  let brand;
  try { brand = brandOfJob(job); } catch (e) { stop(e.message); }
  brandInUse = brand;
  const product = productOf(brand);
  const rec = productKind(product.raw.kind).preset?.recorder;
  if (rec && rec !== 'web') stop(`Recording by showing works for web products. For a ${product.raw.kind} product, write the steps in ${rel(path.join(jobDir, 'capture', `${id}.json`))} (tools/capture/README.md says which steps it can use).`);
  return withSite(product, brand, () => showSteps(jobDir, id, opts, brand, product));
}

async function showSteps(jobDir, id, opts, brand, product) {
  const file = path.join(jobDir, 'capture', `${id}.json`);
  const before = fs.existsSync(file) ? readJson(file, 'The capture script') : null;
  const options = before && !Array.isArray(before) ? Object.fromEntries(Object.entries(before).filter(([k]) => k !== 'steps')) : {};
  const firstOpen = (Array.isArray(before) ? before : before?.steps)?.[0]?.open;
  const start = opts.start || firstOpen || '/';
  const script = { file, steps: [{ open: start }], start: { x: 0, y: 0 }, options, masks: [] };
  const warnings = [];
  const setting = settingOf(product, script, warnings);
  const where = browserFor('show', product, opts);
  const markKey = markKeyOf(opts.markKey);
  const mine = where === 'mine' ? await openYourChrome(brand, product, opts) : null;
  const ctx = mine ? mine.context : await openChrome(brand, { show: true, setting });
  const page = mine ? mine.page : ctx.pages()[0] ?? (await ctx.newPage());
  const pagesSeen = [page];
  const events = [];
  const t0 = wall();
  await ctx.exposeBinding('__studioShowEvent', ({ page: from }, ev) => {
    if (!ev || typeof ev !== 'object') return;
    let n = pagesSeen.indexOf(from);
    if (n < 0) { pagesSeen.push(from); n = pagesSeen.length - 1; }
    ev.page = n;
    ev.t = wall() - t0;
    events.push(ev);
    if (ev.kind === 'mark') say(`  mark ${events.filter((e) => e.kind === 'mark').length} noted`);
    if (ev.kind === 'secret') say('  a password or sign-in code field: nothing typed there is read or written down');
  });
  if (setting.clock.frozen) { await ctx.clock.install({ time: setting.clock.epoch }); await ctx.clock.resume(); }
  const defaults = product.clean.defaults ? STUDIO_HIDE : [];
  await ctx.addInitScript(dresser, { hide: [...defaults, ...product.clean.hide], keep: product.clean.keep, masks: [], cookieWords: product.clean.defaults, yours: Boolean(mine) });
  await ctx.addInitScript(showRecorder, { markKey });
  if (product.siteSignin) {
    // The demo site signs its demo user in by itself, before you start showing.
    const r = await page.goto(product.siteSignin(product.site.signinAs), { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
    if (!r || r.status() !== 200) stop('The demo site did not sign its demo user in.');
  }
  const address = addressOf(product, start, 1);
  if (mine) await page.emulateMedia({ colorScheme: setting.theme }).catch(() => {});
  await page.goto(address, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => stop(`Could not open ${start}: ${e.message.split('\n')[0]}`));
  if (mine) {
    // Your own Chrome: the page is laid out at the take's size (1920 x 1080), shrunk to fit your window so you see it
    // all, so scrolls and positions match the takes.
    const ctl = await ctx.newCDPSession(page);
    const [iw, ih] = await page.evaluate(() => [innerWidth, innerHeight]).catch(() => [1440, 800]);
    const fit = Math.min(1, iw / PAGE.width, ih / PAGE.height);
    await ctl.send('Emulation.setDeviceMetricsOverride', { width: PAGE.width, height: PAGE.height, deviceScaleFactor: 1, mobile: false, scale: fit }).catch(() => {});
    const z = await page.evaluate(() => devicePixelRatio).catch(() => 1); // your Chrome's zoom for the site, made up for
    if (Math.abs(z - 1) > 0.01) await ctl.send('Emulation.setDeviceMetricsOverride', { width: Math.round(PAGE.width * z), height: Math.round(PAGE.height * z), deviceScaleFactor: 1 / z, mobile: false, scale: fit / z }).catch(() => {});
  }
  say('');
  say(`Show the flow for "${id}" in the ${mine ? 'new tab in your Chrome' : 'Chrome window that just opened'} (${address}).`);
  say('  Click, type and scroll through it as you would for a viewer. Take your time: pauses are not kept.');
  say(`  Press ${markKey.label} at each moment the film should be able to point at (a mark).`);
  say(`  When you are done, close that ${mine ? 'tab' : 'window'}${mine ? '' : ' (or quit Chrome)'}, or press Ctrl+C here.`);
  say('  Nothing you type into a password or sign-in code field is read or written down.');
  await new Promise((resolve) => {
    let finished = false;
    const done = () => { if (!finished) { finished = true; clearInterval(poll); resolve(); } };
    const poll = setInterval(() => { if (!ctx.pages().some((p) => pagesSeen.includes(p) && !p.isClosed())) done(); }, 500);
    page.on('close', () => setTimeout(() => { if (!ctx.pages().some((p) => !p.isClosed() && pagesSeen.includes(p))) done(); }, 300));
    ctx.on('close', done);
    process.once('SIGINT', done);
    if (opts.closeAfter) setTimeout(done, opts.closeAfter * 1000);
  });
  // A field still being typed in when the window closed: its text is taken now (never from a password field).
  await sleep(1.0);
  if (mine) { await mine.relay.closeOwnTabs().catch(() => {}); mine.relay.stop(); }
  else await ctx.close().catch(() => {});
  const { steps, dropped, notes } = cleanShown(events, address, product);
  if (steps.length < 2) stop('Nothing was shown: no clicks, typing or scrolls were noted, so the capture script was not changed.');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (before) fs.copyFileSync(file, `${file}.before-show`);
  const out = Object.keys(options).length ? { ...options, steps } : steps;
  fs.writeFileSync(file, Array.isArray(out)
    ? `[\n${steps.map((st) => '  ' + JSON.stringify(st)).join(',\n')}\n]\n`
    : JSON.stringify({ ...options, steps: '__STEPS__' }, null, 2).replace('"__STEPS__"', `[\n${steps.map((st) => '    ' + JSON.stringify(st)).join(',\n')}\n  ]`) + '\n');
  const lost = [
    dropped.stray && `${dropped.stray} stray click${dropped.stray > 1 ? 's' : ''}`,
    dropped.undone && `${dropped.undone} thing${dropped.undone > 1 ? 's' : ''} opened and closed again at once`,
    dropped.pageBack && `${dropped.pageBack} page${dropped.pageBack > 1 ? 's' : ''} opened and left again`,
    dropped.hover && `${dropped.hover} hover${dropped.hover > 1 ? 's' : ''} before a click`,
    dropped.repeat && `${dropped.repeat} repeated click${dropped.repeat > 1 ? 's' : ''}`,
    dropped.scroll && `${dropped.scroll} scroll${dropped.scroll > 1 ? 's' : ''} that went nowhere`,
    dropped.unnamed && `${dropped.unnamed} thing${dropped.unnamed > 1 ? 's' : ''} with no words to find ${dropped.unnamed > 1 ? 'them' : 'it'} by`,
  ].filter(Boolean);
  say('');
  say(`The capture script, cleaned (${steps.length} steps), is saved in ${rel(file)}${before ? ` (the old one is kept as ${rel(file)}.before-show)` : ''}:`);
  say('');
  steps.forEach((st, i) => say(`  ${String(i + 1).padStart(2)}  ${label(st)}`));
  say('');
  if (lost.length) say(`Left out: ${lost.join(', ')}.`);
  notes.forEach((x) => say(`Note: ${x}`));
  say('Marks are named mark-1, mark-2 and so on: rename them in the file to say what each moment is.');
  say(`Read it, then watch it played back: node tools/capture/capture.mjs rehearse ${rel(path.resolve(jobDir))} ${id}`);
  return 0;
}

// ---------------------------------------------------------------- check

/** How different two stills are: the share of the picture that changed, and where. */
function compare(saved, now) {
  const [w, h] = [960, 540];
  const r = spawnSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-i', saved, '-i', now, '-filter_complex',
    `[0:v]scale=${w}:${h}:flags=area,format=rgb24[a];[1:v]scale=${w}:${h}:flags=area,format=rgb24[b];[a][b]blend=all_mode=difference`,
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) stop(`ffmpeg could not compare ${rel(saved)}: ${String(r.stderr).trim()}`);
  const px = r.stdout;
  let changed = 0, x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 3;
    if (Math.max(px[i], px[i + 1], px[i + 2]) > 24) { changed++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  const share = changed / (w * h);
  return { share, box: changed ? { x: x0 / w, y: y0 / h, w: (x1 - x0 + 1) / w, h: (y1 - y0 + 1) / h } : null };
}

function whereIs(box) {
  if (box.w > 0.6 && box.h > 0.6) return 'across most of the screen';
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const row = cy < 0.33 ? 'top' : cy > 0.67 ? 'bottom' : '';
  const col = cx < 0.33 ? 'left' : cx > 0.67 ? 'right' : '';
  return `in the ${[row, col].filter(Boolean).join(' ') || 'middle'} of the screen`;
}

/** Things that moved or changed size by more than this many page pixels count as a change (freshness by layout). */
const LAYOUT_TOLERANCE = 3;

/**
 * One mark compared three ways (CAPTURE-PLAN.md section 8): the picture, the words on screen and where the named and
 * tracked things sit. `saved` and `now` are marks folders; `savedInfo` is the saved take's capture.json mark entry
 * (its tracked things, for takes recorded before layouts were saved). Writes the side-by-side picture into `outDir`
 * when the picture changed. Returns { changed, lines, picture, words, layout }.
 */
function markFreshness(name, saved, now, savedInfo, outDir) {
  const result = { changed: false, lines: [], picture: null, words: null, layout: null };
  const before = path.join(saved, `${name}.png`);
  const after = path.join(now, `${name}.png`);
  if (fs.existsSync(before) && fs.existsSync(after)) {
    const diff = compare(before, after);
    result.picture = { share: diff.share };
    if (diff.share >= 0.00003) {
      result.changed = true;
      const out = path.join(outDir, `${name}.png`);
      fs.mkdirSync(outDir, { recursive: true });
      sideBySide(before, after, diff.box, out);
      fs.copyFileSync(after, path.join(outDir, `${name}-now.png`));
      result.lines.push(`picture: about ${(diff.share * 100).toFixed(diff.share < 0.01 ? 2 : 1)}% changed, ${whereIs(diff.box)}. Saved on the left, today on the right: ${rel(out)}`);
    } else result.lines.push(`picture: no change (${(diff.share * 100).toFixed(3)}% differs)`);
  } else result.lines.push('picture: not compared (no still saved)');
  const readText = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
  const wa = readText(path.join(saved, `${name}.txt`));
  const wb = readText(path.join(now, `${name}.txt`));
  if (wa !== null && wb !== null) {
    const w = compareWords(wa, wb);
    result.words = w;
    if (wordsChanged(w)) {
      result.changed = true;
      describeWords(w).forEach((l) => result.lines.push(`words: ${l}`));
    } else result.lines.push('words: no change');
  } else result.lines.push('words: not compared (no words saved with this mark)');
  const readLayout = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
  const la = readLayout(path.join(saved, `${name}.layout.json`));
  const lb = readLayout(path.join(now, `${name}.layout.json`));
  if (lb && (la || savedInfo?.tracked)) {
    // A take recorded before layouts were saved still has its tracked things in capture.json.
    const l = compareLayout(la ?? { things: [], tracked: savedInfo.tracked }, la ? lb : { things: [], tracked: lb.tracked }, { tolerance: LAYOUT_TOLERANCE });
    result.layout = l;
    if (l.changes.length) {
      result.changed = true;
      describeLayout(l).forEach((x) => result.lines.push(`layout: ${x}`));
    } else result.lines.push(la ? `layout: no change (${lb.things.length} named things, within ${LAYOUT_TOLERANCE} px)` : 'layout: tracked things unchanged; named things not compared (this take was recorded before layouts were saved: record again to compare them)');
  } else result.lines.push('layout: not compared (no layout saved with this mark)');
  return result;
}

/**
 * capture.mjs compare <job> <id> <take> <take>: two saved takes compared mark by mark, three ways, without opening
 * Chrome (the first take is "saved", the second "today"). For checking a re-take against the one in the film.
 */
function compareTakes(jobDir, id, first, second) {
  if (!jobDir || !id || !first || !second) stop('Say the job, the capture and two takes, like: node tools/capture/capture.mjs compare jobs/<job> <id> 1 2');
  const capDir = path.join(path.resolve(jobDir), 'capture', id);
  const dirOf = (t) => {
    const d = path.join(capDir, /^\d+$/.test(String(t)) ? `take-${t}` : String(t));
    if (!fs.existsSync(path.join(d, 'marks'))) stop(`There is no take "${t}" of "${id}" with marks in ${rel(capDir)}.`);
    return d;
  };
  const a = dirOf(first);
  const b = dirOf(second);
  const ca = fs.existsSync(path.join(a, 'capture.json')) ? JSON.parse(fs.readFileSync(path.join(a, 'capture.json'), 'utf8')) : {};
  const names = [...new Set(fs.readdirSync(path.join(a, 'marks')).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')))];
  const outDir = path.join(capDir, 'compare');
  fs.rmSync(outDir, { recursive: true, force: true });
  say(`Comparing ${path.basename(a)} (saved) with ${path.basename(b)} (as today) of "${id}"`);
  let changed = 0;
  let compared = 0;
  for (const name of names) {
    if (!fs.existsSync(path.join(b, 'marks', `${name}.png`))) { say(`  ${name}: not in ${path.basename(b)}`); continue; }
    const f = markFreshness(name, path.join(a, 'marks'), path.join(b, 'marks'), ca.mark_details?.[name], outDir);
    compared++;
    if (f.changed) changed++;
    say(`  ${name}: ${f.changed ? 'CHANGED' : 'no change'}`);
    f.lines.forEach((l) => say(`      ${l}`));
  }
  say('');
  say(changed ? `${changed} of ${compared} moments differ.` : `No change: all ${compared} moments match.`);
  return changed ? 1 : 0;
}

/** Saved still on the left, today's on the right, with the changed area boxed on both. */
function sideBySide(saved, now, box, out) {
  const draw = box ? `,drawbox=x=${Math.round(box.x * 1920) - 6}:y=${Math.round(box.y * 1080) - 6}:w=${Math.round(box.w * 1920) + 12}:h=${Math.round(box.h * 1080) + 12}:color=red@0.9:t=4` : '';
  ffmpeg(['-i', saved, '-i', now, '-filter_complex', `[0:v]scale=1920:1080${draw}[a];[1:v]scale=1920:1080${draw}[b];[a][b]hstack=inputs=2`, '-frames:v', '1', out], 'draw the side-by-side picture');
}

async function check(jobDir, id, opts) {
  const job = jobOf(jobDir, id);
  if (job.product.recorder === 'terminal' || job.product.recorder === 'simulator') return recordOther(jobDir, id, opts, job, 'check');
  return withSite(job.product, job.brand, () => checkSteps(jobDir, id, opts, job));
}

async function checkSteps(jobDir, id, opts, job) {
  const { brand, product, script, capDir } = job;
  migrate(capDir);
  const best = bestOf(capDir);
  if (!best) stop(`The capture "${id}" has not been recorded yet, so there is nothing to compare. Record it with: node tools/capture/capture.mjs run ${rel(path.resolve(jobDir))} ${id}`);
  const takeDir = path.join(capDir, best.folder ?? `take-${best.take}`);
  const saved = readJson(path.join(takeDir, 'capture.json'), `The best take (take ${best.take}) of "${id}"`);
  const names = script.steps.filter((s) => s.mark).map((s) => s.mark);
  if (!names.length) stop(`${rel(script.file)} has no marks, so there is nothing to compare. Add steps like {"mark": "lead-added"}.`);
  // Your own Chrome draws text edges a little differently from the studio's hidden window (tested 12 Nov 2026: about
  // 0.6% of the picture, more than a small real change such as one renamed button), so a check compares like with like.
  const takenIn = saved.browser_kind ?? 'studio';
  const checkIn = product.recorder === 'desktop' ? 'app' : browserFor('check', product, opts);
  if (takenIn !== checkIn) stop(`The best take (take ${best.take}) was recorded in ${takenIn === 'mine' ? 'your own Chrome' : "the studio's own window"}, and this check would run in ${checkIn === 'mine' ? 'your own Chrome' : "the studio's own window"}. The two draw text edges slightly differently, so every moment would look changed. Either check in the same one: add --browser ${takenIn}; or record a reference take in the studio's window (node tools/capture/capture.mjs run ${rel(path.resolve(jobDir))} ${id} --browser studio), make it the best take, and check against that.`);
  const checkDir = path.join(capDir, 'check');
  const fresh = path.join(checkDir, '.now');
  fs.rmSync(checkDir, { recursive: true, force: true });
  fs.mkdirSync(fresh, { recursive: true });
  say(`Checking "${id}" (take ${best.take}, recorded ${saved.captured}) against ${product.address} today`);
  await follow({ brand, product, script, opts, mode: 'check', marksDir: fresh, record: null, failureDir: path.join(capDir, 'failure'), jobDir, answers: Answers.plan({ capDir, product, mode: 'check', fresh: false }) });
  say('');
  const changed = [];
  let compared = 0;
  const report = { capture: id, take: best.take, recorded: saved.captured, checked: localStamp(), marks: {} };
  for (const name of names) {
    if (!fs.existsSync(path.join(takeDir, 'marks', `${name}.png`))) { say(`  ${name}: new mark, nothing saved to compare with`); continue; }
    const f = markFreshness(name, path.join(takeDir, 'marks'), fresh, saved.mark_details?.[name], checkDir);
    compared++;
    report.marks[name] = { changed: f.changed, picture: f.picture, words: f.words, layout: f.layout?.changes ?? null, lines: f.lines };
    if (f.changed) changed.push(name);
    say(`  ${name}: ${f.changed ? 'CHANGED' : 'no change'}`);
    f.lines.forEach((l) => say(`      ${l}`));
  }
  fs.rmSync(fresh, { recursive: true, force: true });
  if (!changed.length) fs.rmSync(checkDir, { recursive: true, force: true });
  else fs.writeFileSync(path.join(checkDir, 'report.json'), JSON.stringify(report, null, 1) + '\n');
  say('');
  if (changed.length) {
    say(`${changed.length} of ${compared} moments look different now. If the product changed, record again with: node tools/capture/capture.mjs run ${rel(path.resolve(jobDir))} ${id}`);
    return 1;
  }
  if (!compared) stop(`The best take (take ${best.take}) has none of these marks, so there was nothing to compare.`);
  say(`No change: all ${compared} moments ${compared < names.length ? `the best take has (of ${names.length}) ` : ''}look the same as when they were recorded.`);
  return 0;
}

// ---------------------------------------------------------------- command line

const STEPS_HELP = `Steps, one per line of the list in jobs/<job>/capture/<id>.json (full list: tools/capture/README.md):
  {"open": "/"}                                a page of the product (or a full address)
  {"click": "New"}                             a button, link, tab or text on screen, by its words
  {"click": "Save", "in": "New lead"}          ... inside the panel, list or dialog with that title
  {"click": "Edit", "near": "Morrowby"}        ... the one closest to those words
  {"double-click": "Morrowby"}                 {"right-click": "Morrowby"}
  {"type": "Morrowby Coffee", "into": "Name"}  click into the field called Name and type at a person's pace ("clear": true empties it first)
  {"paste": "A long prompt", "into": "Ask"}    put a long text in at once
  {"press": "Enter"}                           a key or a shortcut (Enter, Tab, Escape, Meta+K ...)
  {"select": "Medium", "from": "Size"}         pick an option from a list
  {"check": "Remember me"}                     tick a box ("off": true clears it); {"toggle": "Dark mode"} flips a switch
  {"drag": "Morrowby", "to": "Done"}           drag a thing to a place ("by": [right, down] moves it by page pixels)
  {"hover": "Leads"}                           rest the pointer on something
  {"scroll": 400}                              scroll down 400 page pixels, smoothly ("in": "Messages" for a panel)
  {"scroll": "Pricing"}                        scroll smoothly until that thing is in the middle
  {"upload": "files/logo.png", "into": "Add a logo"}  a file from the job folder into a file field
  {"wait": 1.2}                                hold for 1.2 seconds
  {"wait for": "Saved"}                        until the words appear ("gone": true: until they go; "thing": true: a button or field)
  {"wait for": "settled"}                      until the page has settled
  {"wait for": "stopped", "in": "Answer"}      until the text in that area stops changing (streamed AI answers)
  {"switch": "new"}                            to the newest tab or pop-up window (also a tab number, "frame" with "to", "page")
  {"back": true}  {"reload": true}             the browser's back, and reload
  {"size": "phone"}                            change the page size (desktop, laptop, tablet, phone, or [width, height])
  {"theme": "dark"}                            light or dark
  {"mark": "lead-added"}                       a named moment: a sharp still and the words on screen are saved
  {"track": "Save"}                            log where that thing is in every frame (tracks.json)
  {"mask": "jo@example.com"}                   blur those words for the whole take ("thing": true or "css" for a thing)
  {"line": "v3"}                               the next step belongs to voice line v3
  {"layer": "#summary", "name": "card"}        save that thing alone as a see-through PNG, with where it was
  {"snapshot": "Summary", "name": "stats"}     save that area's code (HTML and its CSS), so single rows and numbers can move
  {"as": "customer", "page": "/inbox"}         the next steps happen in the second demo user's window ({"as": "main"}: back)
  {"open": "extension:popup"}                  the brand's extension's popup (or "extension:side panel") at its real size
Most steps that wait take "limit" (seconds).`;

/** capture.mjs answers <job> <id>: which AI answers a capture replays, from when, and what they say. */
function answersCommand(jobDir, id, opts) {
  const { capDir, product } = jobOf(jobDir, id);
  const file = path.join(capDir, 'answers', 'answers.json');
  if (!fs.existsSync(file)) { say(`"${id}" has no saved AI answers${product.answers ? '. The next take records them' : ' (the brand names no AI answer addresses: "ai": { "answers": [...] } in its capture.json, or "kind": "ai product")'}.`); return 0; }
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (opts.forget) {
    const a = new Answers({ mode: 'off', dir: path.join(capDir, 'answers') });
    const aside = a.retire(`Set aside by a person ${localStamp()} (capture.mjs answers --forget).`);
    say(`The saved answers (made ${saved.made}) are set aside in ${rel(aside)}. The next take records fresh ones.`);
    return 0;
  }
  say(`"${id}" replays ${saved.calls.length} AI answer${saved.calls.length === 1 ? '' : 's'} made ${saved.made} (take ${saved.made_in_take}). Label the footage with that date.`);
  for (const c of saved.calls) say(`  ${c.method} ${c.address.split('?')[0]}: ${c.chunks.length} pieces over ${(c.total_ms / 1000).toFixed(1)} s
    "${c.answer.replace(/\s+/g, ' ').slice(0, 300)}${c.answer.length > 300 ? '...' : ''}"`);
  say('A person reads every answer before the footage is used. To record a fresh one: run ... --fresh-answers, or answers ... --forget.');
  return 0;
}

/**
 * capture.mjs site <brand>: builds the brand's WordPress demo site and keeps it up until Ctrl+C, to look around it,
 * write steps or record by showing against it. Takes build their own, fresh each time.
 */
async function siteCommand(brand, opts) {
  if (!brand || !fs.existsSync(path.join(brandDir(brand), 'brand.json'))) stop('Which brand? For example: capture.mjs site acme');
  brandInUse = brand;
  const product = productOf(brand);
  if (product.site?.kind === 'own' || !product.site) { say(`${brand} has no WordPress blueprint (brands/${brand}/product/blueprint.json), so the studio builds no demo site for it. ${product.site?.kind === 'own' ? `It brings its own environment: ${product.address}. Sign in there once by hand with: node tools/capture/capture.mjs signin ${brand}` : 'To have one built, add a WordPress Playground blueprint there (tools/capture/README.md, "WordPress demo sites").'}`); return 0; }
  const down = await siteUp(product, brand);
  const site = product.siteInfo;
  say('');
  say(`The demo site is up at ${site.address} (on this Mac only).`);
  say(`  Signed in as ${site.signinAs}: ${site.signinUrl(site.signinAs)}`);
  for (const u of site.users) { const login = u.split(' ')[0]; say(`  Signed in as ${u}: ${site.signinUrl(login)}`); }
  say('  Open one of those links in any browser on this Mac. Each works only while this site is up.');
  say('  Press Ctrl+C here to tear the site down. Takes build their own, fresh each time.');
  await new Promise((resolve) => { process.once('SIGINT', resolve); process.once('SIGTERM', resolve); if (opts.closeAfter) setTimeout(resolve, opts.closeAfter * 1000); });
  await down();
  return 0;
}

/** Puts an e-mail capture where the engine can show it. */
function publishEmail(jobDir, name, out) {
  const dest = path.join(STUDIO, 'engine/public/jobs', slugOf(jobDir), 'capture', name, 'email');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['recording.mp4', 'still.png', 'email.json']) if (fs.existsSync(path.join(out, f))) fs.copyFileSync(path.join(out, f), path.join(dest, f));
  return rel(dest);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf('--' + name); if (i < 0) return false; args.splice(i, 1); return true; };
  const value = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args.splice(i, 2)[1] : fallback; };
  const mailpitAt = args.indexOf('--mailpit');
  const mailpit = mailpitAt < 0 ? false : /^https?:/.test(args[mailpitAt + 1] ?? '') ? args.splice(mailpitAt, 2)[1] : (args.splice(mailpitAt, 1), true);
  const opts = { show: flag('show'), hidden: flag('hidden'), png: flag('png'), timeout: Number(value('timeout', 8)), closeAfter: Number(value('close-after', 0)), from: value('from', null), browser: value('browser', null), chromeProfile: value('chrome-profile', null), wait: Number(value('wait', 180)), markKey: value('mark-key', 'Control+M'), start: value('start', null),
    as: value('as', MAIN).toLowerCase(), freshAnswers: flag('fresh-answers'), noRecipes: flag('no-recipes'), forget: flag('forget'),
    file: value('file', null), folder: value('folder', null), pick: value('pick', null), size: value('size', null), seconds: value('seconds', null), images: flag('images'), mailpit };
  if (!(opts.wait > 0)) stop('--wait needs a number of seconds, like --wait 120');
  if (!(opts.timeout >= 0)) stop('--timeout needs a number of seconds, like --timeout 12');
  const [cmd, a, b, c] = args;
  if (cmd === 'signin') return signin(a, opts.closeAfter, opts.as);
  if (cmd === 'site') return siteCommand(a, opts);
  if (cmd === 'kinds') { say(`Product kinds a brand's capture.json can name ("kind": "..."), each with its own defaults:\n${KIND_LIST}`); return 0; }
  if (cmd === 'answers') return answersCommand(a, b, opts);
  if (cmd === 'email') {
    return emailCommand(a, b, opts, {
      stop, say, rel, SCALE, FPS, FIRST_NAMES, privacyScan, visibleMatches, blurStill, ffmpeg, playwright, localStamp, publishEmail,
      jobLite: (jobDir) => {
        if (!jobDir || !fs.existsSync(path.join(jobDir, 'job.json'))) stop(`Not a job folder (no job.json): ${jobDir ?? '(none given)'}`);
        let brand;
        try { brand = brandOfJob(readJson(path.join(jobDir, 'job.json'), 'job.json')); } catch (e) { stop(e.message); }
        brandInUse = brand;
        const base = productOf(brand);
        let product = base;
        try { product = withKind(base, { options: {}, file: base.file }); } catch {}
        return { brand, product };
      },
    });
  }
  if (cmd === 'run') return run(a, b, opts);
  if (cmd === 'rehearse') return walk(a, b, opts, 'rehearse');
  if (cmd === 'dry') { if (opts.from) stop('A dry run always does every step; --from is for run and rehearse.'); return walk(a, b, opts, 'dry'); }
  if (cmd === 'check') return check(a, b, opts);
  if (cmd === 'compare') return compareTakes(a, b, c, args[4]);
  if (cmd === 'show') return showFlow(a, b, opts);
  if (cmd === 'connect') return connectTest(a, opts);
  if (cmd === 'takes') return listTakes(a, b);
  if (cmd === 'best') return chooseBest(a, b, c);
  if (cmd === 'steps') { say(STEPS_HELP); return 0; }
  if (cmd === 'relist') return relist();
  say(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 37).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  return cmd ? 2 : 0;
}

main().then((code) => process.exit(code ?? 0)).catch((e) => {
  if (e instanceof Stop) { console.error(`\nStopped. ${e.message}`); process.exit(1); }
  console.error(e.stack ?? e);
  process.exit(1);
});
