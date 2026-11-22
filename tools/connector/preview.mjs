// Serves the brief page for a look in a local browser, with a stand-in for the Claude app's window.claude.use():
//   node tools/connector/preview.mjs --root <studio> [--port 4417]   a studio folder (or set DAMEX_STUDIO_ROOT)
//   node tools/connector/preview.mjs --scratch [--port 4417]         a throwaway studio in the temp folder
//   --dist <folder>   the publish set to serve (default studio/brief-desk/dist, built by node tools/styles/build-page.mjs)
// The page comes from the dist folder when it has one (else studio/brief-desk/index.html), and the page's supporting
// files (styles/, previews/, lib/) are served from the dist folder by relative path, as the published page loads them.
// It never picks a studio by itself: the handlers write briefs, so the studio is named or it is a scratch one.
// use('mcp') posts to /call, which runs the real connector handlers for that studio; use('sample') is null; use('db')
// keeps documents in memory. Open with ?nohost=1 to see the page as it is outside the app (every call:
// server_not_connected). Binds 127.0.0.1 only, and answers only its own Host (127.0.0.1 or localhost with its port),
// JSON posts to /call, and no foreign Origin. --port 0 picks a free port. node: modules only.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHandlers } from './lib/tools.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.resolve(here, '..', '..', 'studio', 'brief-desk', 'index.html');

function argOf(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const STUDIO = path.resolve(here, '..', '..');
const DIST = path.resolve(argOf('--dist', path.join(STUDIO, 'studio', 'brief-desk', 'dist')));

/** A throwaway studio: the brief and job templates, the frameworks, and one brand (acme) with an approved discovery. */
function scratchStudio() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brief-preview-'));
  for (const rel of ['templates/brief.json', 'templates/job.json', 'library/structure/frameworks.json']) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.copyFileSync(path.join(STUDIO, rel), path.join(dir, rel));
  }
  fs.mkdirSync(path.join(dir, 'brands', 'acme', 'product'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'brands', 'acme', 'brand.json'), JSON.stringify({ name: 'acme' }));
  fs.writeFileSync(path.join(dir, 'brands', 'acme', 'product', 'discovery.md'), '# Product discovery: acme\n\nApproved by: Owner\n');
  // The style library, so picks made on the page are checked against the real entries.
  const styles = path.join(STUDIO, 'library', 'styles');
  if (fs.existsSync(styles)) {
    fs.mkdirSync(path.join(dir, 'library', 'styles'), { recursive: true });
    for (const f of fs.readdirSync(styles)) if (f.endsWith('.json')) fs.copyFileSync(path.join(styles, f), path.join(dir, 'library', 'styles', f));
  }
  return dir;
}

let root;
if (process.argv.includes('--scratch')) root = scratchStudio();
else {
  const named = argOf('--root', process.env.DAMEX_STUDIO_ROOT || '');
  if (!named) {
    process.stderr.write('Say which studio to show: --root <studio folder>, --scratch for a throwaway one, or set DAMEX_STUDIO_ROOT.\n');
    process.exit(2);
  }
  root = path.resolve(named);
}
const port = Number(argOf('--port', '4417'));
const handlers = makeHandlers(root);

// The stand-in. Each use() resolves on a later tick, as in the app, never during the page's first script run.
const STUB = `<script>
(() => {
  const nohost = new URLSearchParams(location.search).has('nohost');
  const later = (v) => new Promise((r) => setTimeout(() => r(v), 150));
  const fail = (code, message) => Object.assign(new Error(message), { code });
  const mcp = {
    async callTool(server, tool, input) {
      if (nohost || server !== 'host:damex-engine') throw fail('server_not_connected', 'No studio connector in this view.');
      const r = await fetch('/call', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tool, input }) });
      const out = await r.json();
      if (out.error) throw fail(out.error.code, out.error.message);
      return { payload: out.payload };
    },
  };
  const docs = new Map();
  const listeners = new Map();
  const snap = (id, data) => ({ id, exists: data !== undefined, data: () => (data === undefined ? undefined : JSON.parse(JSON.stringify(data))), metadata: { fromCache: false, hasPendingWrites: false } });
  const collectionSnap = (name) => {
    const list = [...docs].filter(([p]) => p.startsWith(name + '/')).map(([p, d]) => snap(p.slice(name.length + 1), d));
    return { docs: list, size: list.length, empty: list.length === 0, docChanges: () => [] };
  };
  const tell = (name) => (listeners.get(name) || []).forEach((fn) => fn(collectionSnap(name)));
  const db = {
    collection(name) {
      return {
        path: name,
        doc(id) {
          const p = name + '/' + id;
          return {
            id, path: p,
            async set(data) { docs.set(p, JSON.parse(JSON.stringify(data))); console.info('[preview db] set', p, data); tell(name); },
            async get() { return snap(id, docs.get(p)); },
            onSnapshot(next) { setTimeout(() => next(snap(id, docs.get(p))), 0); return () => {}; },
          };
        },
        async get() { return collectionSnap(name); },
        onSnapshot(next) {
          listeners.set(name, [...(listeners.get(name) || []), next]);
          setTimeout(() => next(collectionSnap(name)), 0);
          return () => listeners.set(name, (listeners.get(name) || []).filter((f) => f !== next));
        },
      };
    },
  };
  window.__previewDocs = docs;
  window.claude = { use: (name) => later(name === 'mcp' ? mcp : name === 'db' ? db : null) };
})();
</script>
`;

// The page is written without its own document skeleton; the Artifact tool wraps it at publish time. This is a close
// copy of that wrapper, so the preview renders in standards mode with the phone viewport.
const HEAD = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  + '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
  + 'body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n';

function pageWithStub() {
  const built = path.join(DIST, 'index.html');
  const html = fs.readFileSync(fs.existsSync(built) ? built : PAGE, 'utf8');
  const at = html.indexOf('<script');
  const page = at < 0 ? html + STUB : html.slice(0, at) + STUB + html.slice(at);
  return `${HEAD}${page}\n</body></html>\n`;
}

const TYPES = { '.json': 'application/json', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

/** One file of the publish set, by its published path; null when it is not a file inside the dist folder. */
function distFile(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname).replace(/^\/+/, ''); } catch { return null; }
  if (!rel || rel.split(/[\\/]/).includes('..')) return null;
  const file = path.resolve(DIST, rel);
  if (!file.startsWith(DIST + path.sep) || !Object.hasOwn(TYPES, path.extname(file).toLowerCase())) return null;
  try { return fs.statSync(file).isFile() ? file : null; } catch { return null; }
}

/** Sends a file, with one byte range when asked (video and audio seek with ranges). */
function sendFile(req, res, file) {
  const size = fs.statSync(file).size;
  const type = TYPES[path.extname(file).toLowerCase()];
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end || start >= size) { res.writeHead(416, { 'content-range': `bytes */${size}` }); res.end(); return; }
    res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

function readBody(req, limit = 1 << 20) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Too large')); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, type, body) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  // Only this machine's own page: a page elsewhere (or a renamed host pointing here) must not run the handlers.
  const own = server.address().port;
  const hosts = [`127.0.0.1:${own}`, `localhost:${own}`];
  if (!hosts.includes(String(req.headers.host || '').toLowerCase())) { send(res, 421, 'text/plain; charset=utf-8', 'Not this host'); return; }
  if (req.headers.origin && !hosts.map((h) => `http://${h}`).includes(String(req.headers.origin).toLowerCase())) { send(res, 403, 'text/plain; charset=utf-8', 'Not this page'); return; }
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    try { send(res, 200, 'text/html; charset=utf-8', pageWithStub()); } catch (e) { send(res, 500, 'text/plain; charset=utf-8', e.message); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/call') {
    if (String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') { send(res, 415, 'text/plain; charset=utf-8', 'Send JSON'); return; }
    let reply;
    try {
      const { tool, input } = JSON.parse(await readBody(req));
      const handler = Object.hasOwn(handlers, tool) ? handlers[tool] : null;
      if (!handler) throw new Error(`Unknown tool ${tool}`);
      reply = { payload: await handler(input ?? {}) };
    } catch (e) {
      reply = { error: { code: 'tool_error', message: e.message } };
    }
    process.stdout.write(`call ${reply.error ? 'error' : 'ok'}\n`);
    send(res, 200, 'application/json', JSON.stringify(reply));
    return;
  }
  if (req.method === 'GET') {
    const file = distFile(url.pathname);
    if (file) { sendFile(req, res, file); return; }
  }
  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Brief page preview: http://127.0.0.1:${server.address().port}/ (studio: ${root})\n`);
});
