// The editor's endpoints: the film with its on-screen text, direct changes, export requests, live events and the
// built app at /editor.   node --test "studio/tests/*.test.mjs"
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { film, makeRoot, startServer, videoBytes } from './helpers.mjs';

/** Opens the live events and collects them. `next(test)` resolves with the first event that passes the test. */
function listen(server, job) {
  const events = []; const waiting = [];
  let request;
  const opened = new Promise((resolve, reject) => {
    request = http.get(`${server.base}/api/events?job=${job}`, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        text += chunk;
        let cut;
        while ((cut = text.indexOf('\n\n')) >= 0) {
          const block = text.slice(0, cut); text = text.slice(cut + 2);
          const data = block.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6)).join('');
          if (!data) continue;
          const event = JSON.parse(data); events.push(event);
          for (const w of [...waiting]) if (w.test(event)) { waiting.splice(waiting.indexOf(w), 1); w.resolve(event); }
        }
      });
      resolve(res);
    });
    request.on('error', reject);
  });
  return {
    opened, events,
    next: (test, ms = 4000) => new Promise((resolve, reject) => {
      const found = events.find(test); if (found) return resolve(found);
      const w = { test, resolve }; waiting.push(w);
      setTimeout(() => reject(new Error(`No such event within ${ms} ms. Got: ${JSON.stringify(events)}`)), ms).unref();
    }),
    close: () => request.destroy(),
  };
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

describe('the editor endpoints', () => {
  let root; let server; let modified;
  before(async () => {
    root = makeRoot();
    root.write('app/index.html', '<!doctype html><title>Editor</title><div id="root"></div>');
    root.write('app/assets/app-abc123.js', 'console.log("editor")');
    root.write('app/assets/app-abc123.css', 'body{margin:0}');
    root.write('secret.txt', 'outside the app folder');
    server = await startServer(root.root, { STUDIO_APP_DIST: root.path('app'), STUDIO_EVENTS_MS: '40' });
  });
  after(async () => { await server.stop(); root.remove(); });

  it('gives the film with on-screen text, its versions and when it last changed', async () => {
    const r = await server.get('/api/film?job=demo');
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.deepEqual(Object.keys(d.film), ['job', 'slug', 'fps', 'width', 'height', 'brand', 'stage', 'duration', 'scenes']);
    assert.deepEqual(d.film.scenes[1], { id: 'S02', title: 'Closing', start: 3, end: 8, energy: 5,
      lines: [{ id: '02', start: 3.2, end: 7.5, text: 'That is all.' }],
      texts: [{ lines: ['First cue.'], at: 0.2, out: 2 }, { lines: ['Second', 'cue here.'], at: 2.5, out: 4.5 }] });
    assert.equal(d.film.scenes[0].lines[0].text, 'Meet  friends today.');
    assert.deepEqual(d.videos.map((v) => v.file), ['preview.mp4']);
    assert.equal(d.film_modified, fs.statSync(root.path('engine/src/jobs/demo/film.json')).mtimeMs);
    modified = d.film_modified;
  });

  it('keeps the job check on every new endpoint', async () => {
    for (const p of ['/api/film', '/api/edits', '/api/events', '/api/film?job=..', '/api/edits?job=nope', '/api/events?job=a%2Fb']) {
      const r = await server.get(p);
      assert.equal(r.status, 404, p);
      assert.deepEqual(await r.json(), { error: 'unknown job' });
    }
    for (const p of ['/api/edits?job=nope', '/api/export?job=..']) assert.equal((await server.post(p, {})).status, 404, p);
    const none = await server.get('/api/film?job=novideo');
    assert.equal(none.status, 404);
    assert.deepEqual(await none.json(), { error: 'This job has no film yet.' });
  });

  it('starts with no changes, then saves a valid list beside the film', async () => {
    assert.deepEqual(await (await server.get('/api/edits?job=demo')).json(), { film_modified: modified, edits: [] });
    const edits = [
      { op: 'text.words', scene: 'S02', cue: 1, lines: ['A new', 'set of *seven* words here'] },
      { op: 'text.time', scene: 'S02', cue: 0, at: 0, out: 5 },
    ];
    const r = await server.post('/api/edits?job=demo', { film_modified: modified, edits });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, film_modified: modified, edits });
    assert.deepEqual(root.read('jobs/demo/review/edits.json'), { film_modified: modified, edits });
    assert.deepEqual(await (await server.get('/api/edits?job=demo')).json(), { film_modified: modified, edits });
    assert.deepEqual(root.read('engine/src/jobs/demo/film.json'), film());        // the film itself is never written
  });

  it('refuses a change that does not fit the film, naming the problem', async () => {
    const cases = [
      [{ op: 'text.words', scene: 'S09', cue: 0, lines: ['Hi'] }, /scene "S09", which is not in this film/],
      [{ op: 'text.words', scene: 'S01', cue: 1, lines: ['Hi'] }, /on-screen text 2 in scene S01, which has only 1 on-screen text\./],
      [{ op: 'text.time', scene: 'S02', cue: -1, at: 0, out: 1 }, /scene S02, which has only 2 on-screen texts/],
      [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['one two three four', 'five six seven eight'] }, /puts 8 words on screen in scene S01.*at most seven words/],
      [{ op: 'text.words', scene: 'S01', cue: 0, lines: ['  ', '**'] }, /with no words/],
      [{ op: 'text.words', scene: 'S01', cue: 0, lines: 'Hi' }, /no lines of text/],
      [{ op: 'text.time', scene: 'S01', cue: 0, at: -0.1, out: 1 }, /before scene S01 begins/],
      [{ op: 'text.time', scene: 'S01', cue: 0, at: 2, out: 2 }, /before it starts/],
      [{ op: 'text.time', scene: 'S01', cue: 0, at: 1, out: 3.2 }, /ends the text at 3\.2s, but scene S01 is only 3s long/],
      [{ op: 'text.time', scene: 'S01', cue: 0, at: 1, out: '2' }, /needs a start and an end time/],
      [{ op: 'scene.move', scene: 'S01', cue: 0 }, /Only the words and the timing of on-screen text/],
    ];
    const before = root.read('jobs/demo/review/edits.json');
    for (const [edit, problem] of cases) {
      const r = await server.post('/api/edits?job=demo', { film_modified: modified, edits: [edit] });
      assert.equal(r.status, 400, JSON.stringify(edit));
      const d = await r.json();
      assert.match(d.error, problem);
      assert.match(d.error, /^Change 1 /);
      assert.deepEqual(d.problems, [d.error]);
    }
    const two = await (await server.post('/api/edits?job=demo', { film_modified: modified, edits: [{ op: 'text.time', scene: 'S01', cue: 0, at: 0, out: 3 }, { op: 'text.words', scene: 'S09', cue: 0, lines: ['Hi'] }] })).json();
    assert.match(two.error, /^Change 2 points at scene "S09"/);
    const shape = await server.post('/api/edits?job=demo', { edits: [] });
    assert.equal(shape.status, 400);
    assert.deepEqual(root.read('jobs/demo/review/edits.json'), before);            // nothing was saved
  });

  it('refuses changes made against an older film with 409', async () => {
    const before = root.read('jobs/demo/review/edits.json');
    const file = root.path('engine/src/jobs/demo/film.json');
    const later = new Date(Date.now() + 5000); fs.utimesSync(file, later, later);  // the film was rendered again
    const r = await server.post('/api/edits?job=demo', { film_modified: modified, edits: [] });
    assert.equal(r.status, 409);
    const d = await r.json();
    assert.match(d.error, /film has changed since these changes were made.*Reload the film/);
    assert.equal(d.film_modified, fs.statSync(file).mtimeMs);
    assert.notEqual(d.film_modified, modified);
    assert.deepEqual(root.read('jobs/demo/review/edits.json'), before);
    assert.equal((await server.post('/api/edits?job=demo', { film_modified: d.film_modified, edits: [] })).status, 200);
  });

  it('writes an export request as a numbered file', async () => {
    const r = await server.post('/api/export?job=demo', { ratio: '9:16', height: 1080, quality: 'master', extra: 'ignored' });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.deepEqual({ ...d.export, requested_at: null }, { export: 1, job: 'demo', requested_at: null, status: 'requested', ratio: '9:16', height: 1080, quality: 'master' });
    assert.ok(!Number.isNaN(Date.parse(d.export.requested_at)));
    assert.deepEqual(root.read('jobs/demo/review/export-001.json'), d.export);
    const second = await (await server.post('/api/export?job=demo', { ratio: '1:1', height: 720, quality: 'preview' })).json();
    assert.equal(second.export.export, 2);
    assert.ok(fs.existsSync(root.path('jobs/demo/review/export-002.json')));
    for (const bad of [{ ratio: '4:3', height: 1080, quality: 'master' }, { ratio: '16:9', height: 1081, quality: 'master' }, { ratio: '16:9', height: 1080, quality: 'best' }, {}]) {
      const refused = await server.post('/api/export?job=demo', bad);
      assert.equal(refused.status, 400);
      assert.match((await refused.json()).error, /An export needs a shape/);
    }
    assert.equal(fs.existsSync(root.path('jobs/demo/review/export-003.json')), false);
  });

  it('tells a listening page about a new version, a changed batch and a render', async () => {
    const live = listen(server, 'demo');
    const res = await live.opened;
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /^text\/event-stream/);
    await pause(150);
    assert.deepEqual(live.events, []);                                            // nothing changed, nothing said

    root.write('jobs/demo/out/demo.mp4', videoBytes);
    assert.deepEqual(await live.next((e) => e.type === 'version'), { type: 'version', file: 'demo.mp4' });
    root.write('jobs/demo/out/raw.mp4', Buffer.concat([videoBytes, videoBytes]));  // the raw render is never a version

    root.write('jobs/demo/review/batch-007.json', { batch: 7, job: 'demo', status: 'sent', notes: [] });
    assert.deepEqual(await live.next((e) => e.type === 'batch'), { type: 'batch', n: 7, status: 'sent' });
    await pause(100);
    root.write('jobs/demo/review/batch-007.json', { batch: 7, job: 'demo', status: 'done', notes: [], reply: 'All fixed.' });
    assert.deepEqual(await live.next((e) => e.type === 'batch' && e.status === 'done'), { type: 'batch', n: 7, status: 'done' });

    root.write('engine/out/.render.lock/pid', '999999999');                       // what render.sh holds while it renders
    const rendering = await live.next((e) => e.type === 'rendering');
    assert.equal(rendering.active, true);
    assert.equal(typeof rendering.elapsed, 'number');
    fs.rmSync(root.path('engine/out/.render.lock'), { recursive: true });
    assert.deepEqual(await live.next((e) => e.type === 'rendering' && !e.active), { type: 'rendering', active: false, elapsed: 0 });

    assert.equal(live.events.filter((e) => e.type === 'version').length, 1);
    live.close();
  });

  it('serves the built app at /editor with the right content types', async () => {
    for (const p of ['/editor', '/editor/', '/editor/index.html', '/editor/some/deep/page']) {
      const r = await server.get(p);
      assert.equal(r.status, 200, p);
      assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.match(await r.text(), /<div id="root">/);
    }
    const js = await server.get('/editor/assets/app-abc123.js');
    assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
    assert.equal(await js.text(), 'console.log("editor")');
    assert.equal((await server.get('/editor/assets/app-abc123.css')).headers.get('content-type'), 'text/css; charset=utf-8');
    assert.equal((await server.get('/editor/assets/missing.js')).status, 404);
  });

  it('never serves a file from outside the app folder', async () => {
    for (const p of ['/editor/..%2Fsecret.txt', '/editor/%2e%2e/secret.txt', '/editor/assets/..%2F..%2Fsecret.txt', '/editor/..%2F..%2F..%2F..%2Fetc%2Fpasswd', '/editor/%00', '/editor/%E0%A4%A', '/editor/..%5Csecret.txt', '/editorsecret.txt']) {
      const r = await server.get(p);
      const text = await r.text();
      assert.ok(!text.includes('outside the app folder'), p);
      assert.ok(r.status === 404 || text.includes('<div id="root">'), p);
    }
  });

  it('still serves the old pages next to the editor', async () => {
    assert.equal(await (await server.get('/')).text(), fs.readFileSync(new URL('../review.html', import.meta.url), 'utf8'));
    assert.equal((await server.get('/api/jobs')).status, 200);
  });
});

describe('the editor before the app has been built', () => {
  let root; let server;
  before(async () => { root = makeRoot(); server = await startServer(root.root, { STUDIO_APP_DIST: root.path('no-app-here') }); });
  after(async () => { await server.stop(); root.remove(); });

  it('says so in plain words and points back to the review page', async () => {
    for (const p of ['/editor', '/editor/assets/app.js']) {
      const r = await server.get(p);
      assert.equal(r.status, 503);
      assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
      const text = await r.text();
      assert.match(text, /The editor is not ready on this computer yet/);
      assert.match(text, /npm run build/);
      assert.match(text, /href="\/"/);
    }
    assert.equal((await server.get('/')).status, 200);
  });
});
