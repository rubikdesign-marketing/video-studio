// Pins how the review server behaved before the editor's endpoints were added. These tests were written first and
// must keep passing unchanged:   node --test studio/tests/
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, before, describe, it } from 'node:test';
import { makeRoot, startServer, videoBytes } from './helpers.mjs';

describe('the review server as it was', () => {
  let root; let server;
  before(async () => { root = makeRoot(); server = await startServer(root.root); });
  after(async () => { await server.stop(); root.remove(); });

  it('serves the review page at / and the transcript page at /paper', async () => {
    for (const [p, file] of [['/', 'review.html'], ['/index.html', 'review.html'], ['/paper', 'paper.html'], ['/paper.html', 'paper.html']]) {
      const r = await server.get(p);
      assert.equal(r.status, 200);
      assert.equal(r.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assert.equal(await r.text(), fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
    }
  });

  it('lists only jobs that have a film to watch, with scenes and cleaned voice lines', async () => {
    const r = await server.get('/api/jobs');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'application/json');
    const { jobs } = await r.json();
    assert.equal(jobs.length, 1);
    const [job] = jobs;
    assert.deepEqual(Object.keys(job), ['job', 'name', 'type', 'stage_next', 'videos', 'duration', 'scenes']);
    assert.deepEqual({ job: job.job, name: job.name, type: job.type, stage_next: job.stage_next, duration: job.duration }, { job: 'demo', name: 'Demo film', type: 'promo', stage_next: 'review', duration: 8 });
    assert.deepEqual(job.videos.map((v) => v.file), ['preview.mp4']);           // raw.mp4 is left out
    assert.equal(typeof job.videos[0].modified, 'number');
    assert.deepEqual(job.scenes[0], { id: 'S01', title: 'Opening', start: 0, end: 3, energy: 3,
      lines: [{ start: 0.2, end: 2.8, text: 'Meet  friends today.' }] });         // no texts, no line id, and the [tags] removed
    assert.equal(job.scenes.length, 2);
  });

  it('answers 404 "unknown job" for a job that is missing or badly named', async () => {
    for (const p of ['/api/review?job=nope', '/api/review', '/api/review?job=..', '/api/review?job=a/b', '/api/draft?job=nope', '/api/send?job=nope', '/api/anything?job=nope']) {
      const r = await server.get(p);
      assert.equal(r.status, 404, p);
      assert.deepEqual(await r.json(), { error: 'unknown job' });
    }
    const r = await server.post('/api/draft?job=nope', { notes: [] });
    assert.equal(r.status, 404);
  });

  it('answers 404 "not found" for an unknown address', async () => {
    const r = await server.get('/nothing-here');
    assert.equal(r.status, 404);
    assert.deepEqual(await r.json(), { error: 'not found' });
    const known = await server.get('/api/nothing?job=demo');
    assert.equal(known.status, 404);
    assert.deepEqual(await known.json(), { error: 'not found' });
  });

  it('starts a job with an empty draft and no batches', async () => {
    const r = await server.get('/api/review?job=demo');
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { draft: { notes: [], good_scenes: [] }, batches: [] });
  });

  it('saves a draft without the captured frames and gives it back', async () => {
    const note = { time: 1.5, text: 'Make this bigger', box: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, kind: 'change', topic: 'text', must: true, localId: 'a1' };
    const r = await server.post('/api/draft?job=demo', { notes: [{ ...note, frame: 'data:image/jpeg;base64,AAAA' }], good_scenes: ['S02'] });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.deepEqual(root.read('jobs/demo/review/draft.json'), { notes: [note], good_scenes: ['S02'] });
    assert.deepEqual((await (await server.get('/api/review?job=demo')).json()).draft, { notes: [note], good_scenes: ['S02'] });
  });

  it('refuses to send when there is nothing to send', async () => {
    const r = await server.post('/api/send?job=demo', { notes: [{ time: 1, text: '   ' }], good_scenes: ['S99'] });
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { error: 'nothing to send' });
    assert.equal(fs.existsSync(root.path('jobs/demo/review/batch-001.json')), false);
  });

  it('sends notes as a numbered batch, saves the frame, logs the notes and clears the draft', async () => {
    const jpeg = Buffer.from('not really a picture');
    const r = await server.post('/api/send?job=demo', {
      video: 'preview.mp4', reviewer: 'Sam', approved: false, good_scenes: ['S02', 'S99'],
      notes: [
        { time: 1.234, text: '  Make this bigger ', kind: 'change', topic: 'text', must: true, box: { x: 0, y: 0, w: 0.5, h: 0.5 }, frame: `data:image/jpeg;base64,${jpeg.toString('base64')}` },
        { time: 4, text: 'Love this', kind: 'keep' },
        { time: 5, text: '' },
        { time: 5.5, end: 7.126, text: 'Too slow here', kind: 'change' },
        { time: 6, end: 5, text: 'An end before the start is dropped', kind: 'change' },
      ],
    });
    assert.equal(r.status, 200);
    const { ok, batch } = await r.json();
    assert.equal(ok, true);
    assert.deepEqual(Object.keys(batch), ['batch', 'job', 'video', 'reviewer', 'sent_at', 'status', 'approved', 'good_scenes', 'notes']);
    assert.deepEqual({ ...batch, sent_at: null }, {
      batch: 1, job: 'demo', video: 'preview.mp4', reviewer: 'Sam', sent_at: null, status: 'sent', approved: false, good_scenes: ['S02'],
      notes: [
        { id: 'b001-n1', time: 1.23, scene: 'S01', scene_title: 'Opening', kind: 'change', topic: 'text', must: true, text: 'Make this bigger', box: { x: 0, y: 0, w: 0.5, h: 0.5 }, frame: 'review/frames/b001-n1.jpg', resolved: false, reply: null },
        { id: 'b001-n2', time: 4, scene: 'S02', scene_title: 'Closing', kind: 'keep', topic: null, must: false, text: 'Love this', box: null, frame: null, resolved: false, reply: null },
        { id: 'b001-n3', time: 5.5, end: 7.13, scene: 'S02', scene_title: 'Closing', kind: 'change', topic: null, must: false, text: 'Too slow here', box: null, frame: null, resolved: false, reply: null },
        { id: 'b001-n4', time: 6, scene: 'S02', scene_title: 'Closing', kind: 'change', topic: null, must: false, text: 'An end before the start is dropped', box: null, frame: null, resolved: false, reply: null },
      ],
    });
    assert.ok(!Number.isNaN(Date.parse(batch.sent_at)));
    assert.deepEqual(root.read('jobs/demo/review/batch-001.json'), batch);
    assert.deepEqual(fs.readFileSync(root.path('jobs/demo/review/frames/b001-n1.jpg')), jpeg);
    assert.deepEqual(root.read('jobs/demo/review/draft.json'), { notes: [], good_scenes: [] });
    const log = fs.readFileSync(root.path('knowledge/feedback-log/demo.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(log.map((l) => l.text), ['Make this bigger', 'Love this', 'Too slow here', 'An end before the start is dropped']);
    assert.deepEqual(Object.keys(log[0]), ['date', 'job', 'video', 'batch', 'reviewer', 'time', 'scene', 'kind', 'topic', 'must', 'text']);
    assert.deepEqual(Object.keys(log[2]), ['date', 'job', 'video', 'batch', 'reviewer', 'time', 'end', 'scene', 'kind', 'topic', 'must', 'text']);

    const frame = await server.get('/frames/demo/b001-n1.jpg');
    assert.equal(frame.status, 200);
    assert.equal(frame.headers.get('content-type'), 'image/jpeg');
    assert.deepEqual(Buffer.from(await frame.arrayBuffer()), jpeg);

    const review = await (await server.get('/api/review?job=demo')).json();
    assert.deepEqual(review.batches, [batch]);
  });

  it('sends an approval on its own as the next batch', async () => {
    const r = await server.post('/api/send?job=demo', { approved: true, reviewer: 'Sam' });
    assert.equal(r.status, 200);
    const { batch } = await r.json();
    assert.equal(batch.batch, 2);
    assert.equal(batch.approved, true);
    assert.deepEqual(batch.notes, []);
    assert.ok(fs.existsSync(root.path('jobs/demo/review/batch-002.json')));
  });

  it('serves the whole film with its length', async () => {
    const r = await server.get('/media/demo/preview.mp4');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'video/mp4');
    assert.equal(r.headers.get('accept-ranges'), 'bytes');
    assert.equal(r.headers.get('content-length'), '1000');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), videoBytes);
  });

  it('serves a part of the film for a byte range', async () => {
    const r = await server.get('/media/demo/preview.mp4', { headers: { Range: 'bytes=100-199' } });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get('content-range'), 'bytes 100-199/1000');
    assert.equal(r.headers.get('content-length'), '100');
    assert.equal(r.headers.get('content-type'), 'video/mp4');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), videoBytes.subarray(100, 200));

    const tail = await server.get('/media/demo/preview.mp4', { headers: { Range: 'bytes=900-' } });
    assert.equal(tail.status, 206);
    assert.equal(tail.headers.get('content-range'), 'bytes 900-999/1000');

    const long = await server.get('/media/demo/preview.mp4', { headers: { Range: 'bytes=990-5000' } });
    assert.equal(long.headers.get('content-range'), 'bytes 990-999/1000');

    const past = await server.get('/media/demo/preview.mp4', { headers: { Range: 'bytes=1000-' } });
    assert.equal(past.status, 416);
    assert.equal(past.headers.get('content-range'), 'bytes */1000');
  });

  it('answers 404 for a film that is not there or a name that could leave the folder', async () => {
    for (const p of ['/media/demo/missing.mp4', '/media/nope/preview.mp4', '/media/demo/..%2Fjob.json', '/media/..%2F..%2Fdemo/preview.mp4', '/media/demo/', '/frames/demo/missing.jpg']) {
      const r = await server.get(p);
      assert.equal(r.status, 404, p);
    }
    assert.deepEqual(await (await server.get('/media/demo/missing.mp4')).json(), { error: 'no such film' });
  });

  it('lists transcript jobs (none here) and serves the page font', async () => {
    assert.deepEqual(await (await server.get('/api/paper/jobs')).json(), { jobs: [] });
    const paper = await server.get('/api/paper?job=demo');
    assert.equal(paper.status, 404);
    assert.deepEqual(await paper.json(), { error: 'no paper edit for this job yet' });
    const font = await server.get('/font/InstrumentSans-var.woff2');
    assert.equal(font.status, 200);
    assert.equal(font.headers.get('content-type'), 'font/woff2');
    assert.equal((await server.get('/font/nope.woff2')).status, 404);
  });
});
