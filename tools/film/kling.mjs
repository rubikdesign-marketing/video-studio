// Kling AI: generated images and video clips, from the official Kling API. Small, no packages.
//
// Checked against Kling's official API documentation on 14 Nov 2026:
//   https://kling.ai/document-api/api/get-started/authentication
//   https://kling.ai/document-api/api/video/2-6/image-to-video   (and /text-to-video; 3.0 and 4.0 pages use the same shape)
//   https://kling.ai/document-api/api/image/3-0-omni/image-generation
//   https://kling.ai/document-api/api/video/lip-sync   (and /lip-sync/face-detection)
// What the docs said that day:
//   - Domain https://api-singapore.klingai.com (the old api.klingai.com moved).
//   - Auth "Authorization: Bearer <key>". An API key (KLING_API_KEY) works for every model. An access key + secret key
//     pair signs a JWT (HS256, iss = access key, exp = now + 1800, nbf = now - 5), which the docs say only works on the
//     legacy-design endpoints. This client prefers KLING_API_KEY when both are set.
//   - Video (upgraded design): POST /image-to-video/<model> { contents: [{type:"prompt",text}, {type:"first_frame",url},
//     {type:"last_frame",url}], settings: {resolution, duration, audio}, options: {external_task_id, watermark_info} }
//     POST /text-to-video/<model> { prompt, settings: {resolution, aspect_ratio, duration, audio}, options }
//     Models: kling-2.6 (5 or 10 s, 720p/1080p, aspect 16:9 9:16 1:1), kling-3.0, kling-4.0 (3-30 s).
//     Image-to-video takes the aspect ratio of its image. Results: GET /tasks?task_ids=<id> -> data[].status
//     (submitted, processing, succeeded, failed), data[].outputs[] {type:"video", url}. Results are kept 30 days.
//   - Images: POST /v1/images/generations { model_name (kling-v3 default, kling-v2-1), prompt, negative_prompt, image,
//     image_reference, resolution 1k|2k, n 1-9, aspect_ratio (9:16 ...) } -> data.task_id;
//     GET /v1/images/generations/<id> -> data.task_status (submitted, processing, succeed, failed), data.task_result.images[].url
//   - Lip-sync: POST /v1/videos/identify-face { video_id | video_url } -> data.session_id, data.face_data[] {face_id, start_time, end_time};
//     POST /v1/videos/advanced-lip-sync { session_id, face_choose: [{face_id, sound_file, sound_start_time, sound_end_time,
//     sound_insert_time, sound_volume, original_audio_volume}] } -> data.task_id;
//     GET /v1/videos/advanced-lip-sync/<id> -> data.task_status, data.task_result.videos[].url.
//     The video: .mp4/.mov, 2-60 s, 720p or 1080p, sides 512-2160 px, as a public URL or a Kling video id. The sound: a
//     URL or base64, .mp3/.wav/.m4a/.aac, 2-60 s, at most 5 MB. Times are milliseconds.
// Re-check the docs before relying on a field this file does not list; Kling changes the API often.
//
// Usage: node tools/film/kling.mjs <command> ... [--dry-run]   (each command prints its own usage with no arguments)
//   image     <prompt> --out <dir>           text to image (optionally from a reference image)
//   i2v       <image> <prompt>               image to video (first frame, optional last frame)
//   t2v       <prompt>                       text to video
//   lipsync   <video> <sound>                find the face in a video, then lip-sync it to a sound
//   status    <task_id> [--kind video|image|lipsync]
//   wait      <task_id> --out <dir> [--kind video|image|lipsync]    poll until done, then download every result
//   download  <url> <file>
// --dry-run prints the request (method, URL, headers with the key hidden, body with long base64 cut short) and sends nothing.
// Keys come from the studio's .env: KLING_API_KEY, or KLING_ACCESS_KEY and KLING_SECRET_KEY.
// Every request that costs money is logged to the file given by --log (JSON lines), for the job's usage.md.
// Every paid request is also written to the studio's generation ledger (.generations/ledger.json, tools/film/lib/ledger.mjs)
// before it is sent, with its task id as soon as Kling answers. Sending the same request again (same settings, same
// images, same --take) does not pay twice: it prints the task that already exists. --take 2 asks for a deliberate second
// take. --job <job_dir> files the request under a job for its costs. `ledger` lists every request and, with
// --reconcile, asks Kling for the state of the ones still open.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ledgerPath, requestKey, load as loadLedger, update as updateLedger, findByTask, decide, claim } from './lib/ledger.mjs';

const STUDIO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// KLING_BASE_URL points the client at a stand-in server for the tests; nothing else should set it.
const BASE = process.env.KLING_BASE_URL || 'https://api-singapore.klingai.com';

// Inside Claude's command sandbox the network goes through a proxy, which Node only uses when told to.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const again = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
  process.exit(again.status ?? 1);
}

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const VALUE_FLAGS = new Set(['out', 'model', 'duration', 'resolution', 'aspect', 'audio', 'last', 'n', 'negative', 'ref', 'ref-type',
  'kind', 'face', 'start', 'end', 'insert', 'volume', 'original-volume', 'id', 'log', 'every', 'timeout', 'video-id', 'job', 'take']);
const flags = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dry-run') continue;
  if (a.startsWith('--')) {
    const name = a.slice(2);
    if (VALUE_FLAGS.has(name)) { flags[name] = argv[++i]; continue; }
    flags[name] = true; continue;
  }
  pos.push(a);
}
const [cmd, ...args] = pos;
const die = (msg) => { console.error(msg); process.exit(1); };

// ---------------------------------------------------------------- keys

function env() {
  const file = path.join(STUDIO, '.env');
  const out = {};
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  return out;
}
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
/** HS256 JWT from an access key and secret key, as Kling's authentication page shows. */
function jwt(ak, sk) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: ak, exp: now + 1800, nbf: now - 5 }));
  const sig = b64url(crypto.createHmac('sha256', sk).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}
function auth() {
  const e = { ...env(), ...(process.env.KLING_API_KEY ? { KLING_API_KEY: process.env.KLING_API_KEY } : {}) };
  if (e.KLING_API_KEY) return { token: e.KLING_API_KEY, kind: 'API key' };
  if (e.KLING_ACCESS_KEY && e.KLING_SECRET_KEY) return { token: jwt(e.KLING_ACCESS_KEY, e.KLING_SECRET_KEY), kind: 'access key + secret key (JWT)' };
  if (DRY) return { token: '<no key in .env yet>', kind: 'none' };
  return die('No Kling key in .env. Add KLING_API_KEY, or KLING_ACCESS_KEY and KLING_SECRET_KEY.');
}

// ---------------------------------------------------------------- requests

/** A local file becomes raw base64 (no data: prefix, as the docs ask); a URL or a Kling id passes through. */
function media(ref) {
  if (/^https?:\/\//.test(ref)) return ref;
  const file = path.resolve(ref);
  if (!fs.existsSync(file)) die(`No such file: ${ref}`);
  return fs.readFileSync(file).toString('base64');
}
const shorten = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === 'string' && x.length > 200 && !/^https?:/.test(x) ? `${x.slice(0, 24)}... (${x.length} chars of base64)` : x)));

function log(entry) {
  if (!flags.log) return;
  fs.appendFileSync(path.resolve(flags.log), JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
}

async function call(method, route, body, { paid = false, onRefuse = null } = {}) {
  const url = BASE + route;
  const a = auth();
  if (DRY) {
    console.log(JSON.stringify({ dry_run: true, method, url, headers: { Authorization: `Bearer <${a.kind}, hidden>`, 'Content-Type': 'application/json' }, body: body ? shorten(body) : undefined }, null, 1));
    return null;
  }
  const r = await fetch(url, {
    method, headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { die(`Kling answered ${r.status} with something that is not JSON: ${text.slice(0, 300)}`); }
  if (!r.ok || (json.code !== undefined && json.code !== 0)) {
    const message = `Kling refused (${r.status}, code ${json.code}): ${json.message || text.slice(0, 300)}`;
    if (onRefuse) onRefuse(message);
    die(message);
  }
  if (paid) log({ method, route, body: shorten(body), response: json.data });
  return json;
}

// ---------------------------------------------------------------- the ledger

const LEDGER = ledgerPath(STUDIO);
const jobName = () => (flags.job ? path.basename(path.resolve(flags.job)) : null);

/**
 * Sends a paid POST through the ledger. setExternal(body, id) puts our request id into the body where this endpoint
 * expects it, so the request can be found in Kling's own task list. Returns Kling's answer, or null if not sent.
 */
/** The ledger key of a request, and whether it may be sent. keyBody: what identifies the request when the body holds
 * something that changes on every run (lip-sync's face session). */
function gate(kind, route, keyBody) {
  const take = Number(flags.take || 1);
  const key = flags.id ? `id-${flags.id}` : requestKey({ provider: 'kling', route, body: keyBody, take });
  const prior = loadLedger(LEDGER).requests[key];
  const d = decide(prior);
  const send = d.send || (flags.resend && prior?.status === 'sending');
  if (!send && !DRY) {
    console.log(`Not sent: ${d.why}.`);
    if (d.task_id) console.log(`Next: node tools/film/kling.mjs wait ${d.task_id} --kind ${kind === 'video' ? 'video' : kind} --out <dir>`);
  }
  return { key, take, prior, d, send: send || DRY };
}

async function paid(kind, route, body, units, setExternal, keyBody = body) {
  const g = gate(kind, route, structuredClone(keyBody));
  if (!g.send) return null;
  const { key, take, prior, d } = g;
  // Each attempt gets its own id in Kling's task list (Kling may refuse a repeated one); the ledger keeps them all.
  const attempt = (prior?.attempts || 0) + 1;
  const external = flags.id || `vs-${key.slice(0, 16)}-${attempt}`;
  if (!flags.id) setExternal(body, external);
  if (DRY) return call('POST', route, body, { paid: true });
  if (d.why) console.log(`Sending again: ${d.why}.`);
  const c = claim(LEDGER, key, { provider: 'kling', kind, route, job: jobName(), take, units, status: 'sending', task_id: null, external_id: external, attempts: attempt, external_ids: [...(prior?.external_ids || []), external], sent_at: new Date().toISOString(), message: null }, { force: !!flags.resend });
  if (!c.ok) { console.log(`Not sent: ${c.why}.`); return null; }
  const r = await call('POST', route, body, { paid: true, onRefuse: (message) => updateLedger(LEDGER, key, { status: 'refused', message }) });
  const taskId = r.data.task_id ?? r.data.id;
  updateLedger(LEDGER, key, { status: 'submitted', task_id: taskId, provider_status: r.data.task_status ?? r.data.status ?? null });
  return r;
}

/** Records a task's latest state in the ledger, if the ledger knows the task. */
function noteTask(id, s, extra = {}) {
  const e = findByTask(loadLedger(LEDGER), id);
  if (!e || !s) return;
  updateLedger(LEDGER, e.key, { status: s.status, message: s.message || null, ...extra });
}

async function ledger() {
  const all = Object.values(loadLedger(LEDGER).requests).filter((e) => !flags.job || e.job === jobName());
  if (flags.reconcile) {
    for (const e of all.filter((x) => ['submitted', 'running'].includes(x.status) && x.task_id)) {
      const s = await check(e.task_id, e.kind === 'video' ? 'video' : e.kind);
      if (s) { noteTask(e.task_id, s); e.status = s.status; }
    }
  }
  if (!all.length) { console.log(`No paid requests in ${path.relative(STUDIO, LEDGER)}${flags.job ? ` for ${jobName()}` : ''}.`); return; }
  for (const e of all.sort((a, b) => String(a.sent_at).localeCompare(String(b.sent_at)))) {
    console.log(`${e.sent_at || '?'}  ${String(e.status || '?').padEnd(9)}  ${String(e.kind || '?').padEnd(7)}  ${e.task_id || '(no task id)'}  ${e.job || '-'}  take ${e.take}  ${JSON.stringify(e.units)}`);
  }
  const open = all.filter((e) => e.status === 'sending');
  if (open.length) console.log(`\n${open.length} request(s) were sent without an answer and may have been charged. Check Kling's task list for their ids (${open.map((e) => e.external_id).join(', ')}).`);
}

// ---------------------------------------------------------------- commands

const USAGE = {
  image: `image <prompt> --out <dir> [--aspect 9:16] [--resolution 1k|2k] [--n 1] [--model kling-v3|kling-v2-1]
       [--negative "..."] [--ref <image file or URL> --ref-type subject|face] [--log usage.jsonl] [--dry-run]
  Starts an image task and prints its task id. Then: wait <task_id> --kind image --out <dir>`,
  i2v: `i2v <image file or URL> <prompt> [--model kling-2.6|kling-3.0|kling-4.0] [--duration 5] [--resolution 720p|1080p]
     [--audio off|native] [--last <end image>] [--id <your own task id>] [--log usage.jsonl] [--dry-run]
  Image to video. The clip takes the image's aspect ratio (use a 9:16 image for a vertical clip).
  kling-2.6 takes 5 or 10 s; kling-3.0 and kling-4.0 take 3 to 30 s. Then: wait <task_id> --out <dir>`,
  t2v: `t2v <prompt> [--model kling-2.6] [--aspect 9:16|16:9|1:1] [--duration 5] [--resolution 720p|1080p] [--audio off|native]
     [--id <your own task id>] [--log usage.jsonl] [--dry-run]
  Text to video. Then: wait <task_id> --out <dir>`,
  lipsync: `lipsync <video URL, or --video-id <Kling video id>> <sound file or URL> [--face 0] [--start 0] [--end <ms>] [--insert 0]
         [--volume 1] [--original-volume 0] [--log usage.jsonl] [--dry-run]
  Two requests: finds the faces in the video (identify-face), then lip-syncs the chosen face (advanced-lip-sync).
  --start/--end crop the sound (ms, end defaults to the sound's length), --insert is where it starts in the video (ms).
  The video must be a public URL or a Kling video id (the id is in the wait output of a finished clip).
  Then: wait <task_id> --kind lipsync --out <dir>`,
  status: `status <task_id> [--kind video|image|lipsync]   (video is the default: the upgraded /tasks endpoint)`,
  wait: `wait <task_id> --out <dir> [--kind video|image|lipsync] [--every 10] [--timeout 900]
  Polls every --every seconds until the task succeeds or fails, then downloads each result into <dir>
  as <task_id>-<n>.<ext> and writes <task_id>.json beside them.`,
  download: `download <url> <file>`,
};
const usage = (name) => { console.log(`node tools/film/kling.mjs ${USAGE[name]}`); process.exit(0); };

async function image() {
  if (args.length < 1) usage('image');
  const body = {
    model_name: flags.model || 'kling-v3',
    prompt: args[0],
    ...(flags.negative && !flags.ref ? { negative_prompt: flags.negative } : {}),
    ...(flags.ref ? { image: media(flags.ref), ...(flags['ref-type'] ? { image_reference: flags['ref-type'] } : {}) } : {}),
    resolution: flags.resolution || '2k',
    n: Number(flags.n || 1),
    aspect_ratio: flags.aspect || '9:16',
    ...(flags.id ? { external_task_id: flags.id } : {}),
  };
  if (!flags.out && !DRY) die('Give --out <dir> (where the results will go; the wait command downloads them).');
  const r = await paid('image', '/v1/images/generations', body, { images: body.n, resolution: body.resolution, model: body.model_name },
    (b, id) => { b.external_task_id = id; });
  if (r) console.log(`image task ${r.data.task_id} (${r.data.task_status}). Next: node tools/film/kling.mjs wait ${r.data.task_id} --kind image --out ${flags.out}`);
}

async function i2v() {
  if (args.length < 2) usage('i2v');
  const model = flags.model || 'kling-2.6';
  const contents = [{ type: 'prompt', text: args[1] }, { type: 'first_frame', url: media(args[0]) }];
  if (flags.last) contents.push({ type: 'last_frame', url: media(flags.last) });
  const body = {
    contents,
    settings: { resolution: flags.resolution || '1080p', duration: Number(flags.duration || 5), audio: flags.audio || 'off' },
    options: { ...(flags.id ? { external_task_id: flags.id } : {}), watermark_info: { enabled: false } },
  };
  const r = await paid('video', `/image-to-video/${model}`, body, { seconds: body.settings.duration, resolution: body.settings.resolution, model, audio: body.settings.audio },
    (b, id) => { b.options.external_task_id = id; });
  if (r) console.log(`video task ${r.data.id} (${r.data.status}). Next: node tools/film/kling.mjs wait ${r.data.id} --out <dir>`);
}

async function t2v() {
  if (args.length < 1) usage('t2v');
  const model = flags.model || 'kling-2.6';
  const body = {
    prompt: args[0],
    settings: { resolution: flags.resolution || '1080p', aspect_ratio: flags.aspect || '9:16', duration: Number(flags.duration || 5), audio: flags.audio || 'off' },
    options: { ...(flags.id ? { external_task_id: flags.id } : {}), watermark_info: { enabled: false } },
  };
  const r = await paid('video', `/text-to-video/${model}`, body, { seconds: body.settings.duration, resolution: body.settings.resolution, model, audio: body.settings.audio },
    (b, id) => { b.options.external_task_id = id; });
  if (r) console.log(`video task ${r.data.id} (${r.data.status}). Next: node tools/film/kling.mjs wait ${r.data.id} --out <dir>`);
}

function soundMs(ref) {
  if (/^https?:\/\//.test(ref)) return null;
  const s = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.resolve(ref)], { encoding: 'utf8' });
  const sec = parseFloat(s.stdout);
  return Number.isFinite(sec) ? Math.floor(sec * 1000) : null;
}

async function lipsync() {
  const videoId = flags['video-id'];
  const [video, sound] = videoId ? [null, args[0]] : args;
  if (!sound || (!video && !videoId)) usage('lipsync');
  if (video && !/^https?:\/\//.test(video)) die('Kling needs the video as a public URL or a Kling video id (--video-id). A local file cannot be sent.');
  // What identifies this lip-sync, without the face session (new on every run): checked before identify-face is sent.
  const keyBody = { video: videoId || video, sound: crypto.createHash('sha256').update(media(sound)).digest('hex'), face: flags.face ?? null, start: Number(flags.start || 0), end: flags.end ?? null, insert: Number(flags.insert || 0), volume: Number(flags.volume ?? 1), original: Number(flags['original-volume'] ?? 0) };
  if (!gate('lipsync', '/v1/videos/advanced-lip-sync', keyBody).send) return;
  const face = await call('POST', '/v1/videos/identify-face', videoId ? { video_id: videoId } : { video_url: video }, { paid: true });
  const session = face ? face.data.session_id : '<session_id from identify-face>';
  if (face) console.log(`faces found: ${face.data.face_data.map((f) => `${f.face_id} (${f.start_time}-${f.end_time} ms)`).join(', ') || 'none'}`);
  const faceId = flags.face ?? (face ? face.data.face_data[0]?.face_id : '0');
  if (faceId === undefined) die('No face was found in the video.');
  const end = flags.end !== undefined ? Number(flags.end) : soundMs(sound);
  if (end == null) die('Give --end <ms>: the length of the sound to use (it could not be measured from a URL).');
  const body = {
    session_id: session,
    face_choose: [{
      face_id: String(faceId), sound_file: media(sound),
      sound_start_time: Number(flags.start || 0), sound_end_time: end, sound_insert_time: Number(flags.insert || 0),
      sound_volume: Number(flags.volume ?? 1), original_audio_volume: Number(flags['original-volume'] ?? 0),
    }],
    ...(flags.id ? { external_task_id: flags.id } : {}),
  };
  const r = await paid('lipsync', '/v1/videos/advanced-lip-sync', body, { ms: end - Number(flags.start || 0) },
    (b, id) => { b.external_task_id = id; }, keyBody);
  if (r) console.log(`lip-sync task ${r.data.task_id} (${r.data.task_status}). Next: node tools/film/kling.mjs wait ${r.data.task_id} --kind lipsync --out <dir>`);
}

/** One status check, in one shape for every kind: { status: 'running' | 'succeeded' | 'failed', message, urls, ids, raw }. */
async function check(id, kind) {
  if (kind === 'image' || kind === 'lipsync') {
    const route = kind === 'image' ? `/v1/images/generations/${id}` : `/v1/videos/advanced-lip-sync/${id}`;
    const r = await call('GET', route);
    if (!r) return null;
    const d = r.data;
    const list = kind === 'image' ? d.task_result?.images || [] : d.task_result?.videos || [];
    const status = d.task_status === 'succeed' ? 'succeeded' : d.task_status === 'failed' ? 'failed' : 'running';
    return { status, message: d.task_status_msg || '', urls: list.map((x) => x.url).filter(Boolean), ids: list.map((x) => x.id).filter(Boolean), raw: d };
  }
  const r = await call('GET', `/tasks?task_ids=${encodeURIComponent(id)}`);
  if (!r) return null;
  const d = (r.data || [])[0];
  if (!d) die(`No task ${id}.`);
  const outs = (d.outputs || []).filter((o) => o.type === 'video' || o.type === 'image');
  const status = d.status === 'succeeded' ? 'succeeded' : d.status === 'failed' ? 'failed' : 'running';
  return { status, message: d.message || '', urls: outs.map((o) => o.url).filter(Boolean), ids: outs.map((o) => o.id).filter(Boolean), raw: d };
}

async function status() {
  if (args.length < 1) usage('status');
  const s = await check(args[0], flags.kind || 'video');
  noteTask(args[0], s);
  if (s) console.log(JSON.stringify({ status: s.status, message: s.message, urls: s.urls, ids: s.ids }, null, 1));
}

async function save(url, file) {
  if (DRY) { console.log(JSON.stringify({ dry_run: true, method: 'GET', url, save_to: file })); return; }
  const r = await fetch(url);
  if (!r.ok) die(`Download failed (${r.status}): ${url}`);
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  console.log(`saved ${file}`);
}

async function wait() {
  if (args.length < 1 || !flags.out) usage('wait');
  const id = args[0]; const kind = flags.kind || 'video';
  const every = Number(flags.every || 10) * 1000; const until = Date.now() + Number(flags.timeout || 900) * 1000;
  for (;;) {
    const s = await check(id, kind);
    if (!s) return; // dry run
    if (s.status === 'failed') { noteTask(id, s); die(`Task ${id} failed: ${s.message}`); }
    if (s.status === 'succeeded') {
      fs.mkdirSync(path.resolve(flags.out), { recursive: true });
      fs.writeFileSync(path.join(flags.out, `${id}.json`), JSON.stringify(s.raw, null, 1));
      for (const [i, url] of s.urls.entries()) {
        const ext = (url.split('?')[0].match(/\.(mp4|mov|png|jpe?g|webp)$/i) || [, kind === 'image' ? 'png' : 'mp4'])[1];
        await save(url, path.join(flags.out, `${id}-${i + 1}.${ext}`));
      }
      if (s.ids.length) console.log(`Kling ids of the results (for --video-id): ${s.ids.join(', ')}`);
      noteTask(id, s, { outputs: s.urls.map((u, i) => path.join(flags.out, `${id}-${i + 1}.${(u.split('?')[0].match(/\.(mp4|mov|png|jpe?g|webp)$/i) || [, kind === 'image' ? 'png' : 'mp4'])[1]}`)) });
      return;
    }
    if (Date.now() > until) die(`Still running after ${flags.timeout || 900} s. Run wait again later; the task keeps going.`);
    process.stdout.write('.');
    await new Promise((res) => setTimeout(res, every));
  }
}

async function download() {
  if (args.length < 2) usage('download');
  await save(args[0], args[1]);
}

const COMMANDS = { image, i2v, t2v, lipsync, status, wait, download, ledger };
if (!cmd || !COMMANDS[cmd]) {
  console.log(`Kling AI client (official API, checked 14 Nov 2026). Usage: node tools/film/kling.mjs <command> ... [--dry-run]
  image     <prompt> --out <dir>           text to image (optionally from a reference image)
  i2v       <image> <prompt>               image to video (first frame, optional last frame)
  t2v       <prompt>                       text to video
  lipsync   <video> <sound>                find the face in a video, then lip-sync it to a sound
  status    <task_id> [--kind video|image|lipsync]
  wait      <task_id> --out <dir> [--kind video|image|lipsync]    poll until done, then download every result
  download  <url> <file>
  ledger    [--job <job_dir>] [--reconcile]   every paid request, its task and state; --reconcile asks Kling about open ones
Each command prints its own usage with no arguments. --dry-run prints the request and sends nothing.
Keys come from the studio's .env: KLING_API_KEY, or KLING_ACCESS_KEY and KLING_SECRET_KEY.
--log <file> appends every paid request to a JSON-lines file, for the job's usage.md.
Paid requests go through the ledger: the same request is never paid for twice. --take <n> asks for a new take on purpose.`);
  process.exit(cmd ? 2 : 0);
}
await COMMANDS[cmd]();
