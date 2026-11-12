// AI answers, recorded once and replayed for retakes (CAPTURE-PLAN.md 5.4; tools/capture/README.md, "AI answers").
//
// The first good take records the product's own answer calls (only the addresses the brand names, never sign-in or
// token addresses) with Playwright's HAR recording, and the moment each piece of a streamed answer arrived (from
// Chrome's network log). Every token, cookie, key and authorization value is removed before anything is saved.
// Retakes replay them: the page gets the same answer, streamed piece by piece at the same moments, and the product's
// server is not asked again. If the product asks for something the saved answers do not cover (it changed how it
// asks, or the script asks something else), the replay is refused and a fresh answer is recorded.
//
// Saved in jobs/<job>/capture/<id>/answers/: answers.har (Playwright's HAR, cleaned) and answers.json (what the
// replay uses: each call, its answer in pieces with their times, and the date the real answer was made).
import fs from 'node:fs';
import path from 'node:path';

// Never recorded, whatever the brand's list says: sign-in, tokens, sessions, accounts, payments.
const NEVER = 'auth|token|login|log-in|logout|signin|sign-in|signout|oauth|openid|session|password|passwd|credential|refresh|account|billing|payment|checkout|cognito|identitytoolkit|securetoken|2fa|mfa|otp|verify';
const SECRET_NAME = /cookie|authori[sz]ation|token|auth|api[-_]?key|apikey|secret|session|csrf|xsrf|signature|\bsig\b|password|passwd|bearer|credential|private|x-amz|jwt/i;
export const REMOVED = '[removed]';

/** The pattern (as text, so the page can use it too) for the product's own answer calls the brand named. */
export function answerPattern(host, answers) {
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^https?://${esc(host)}(?![^?#]*(?:${NEVER}))[^?#]*(?:${answers.map(esc).join('|')})`;
}

/**
 * The key a call is matched by: its method, its address (secret values in the query removed) and what it sent,
 * with the parts that change on every call anyway (ids, times, long random strings, secrets) set aside. Runs in the
 * page too, so it is self-contained.
 */
export function callKey(method, url, body) {
  const SECRET = /cookie|authori[sz]ation|token|auth|api[-_]?key|apikey|secret|session|csrf|xsrf|signature|\bsig\b|password|passwd|bearer|credential|private|jwt/i;
  const VOLATILE = [
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, // ids
    /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?/g, // times
    /\b1[5-9]\d{8}(\d{3})?\b/g, // seconds or milliseconds since 1970
    /\b[0-9a-f]{16,}\b/gi, // long random strings
  ];
  const plain = (s) => VOLATILE.reduce((t, re) => t.replace(re, '*'), String(s));
  const u = new URL(url);
  const q = [...u.searchParams.entries()].map(([k, v]) => `${k}=${SECRET.test(k) ? '*' : plain(v)}`).sort().join('&');
  let b = body ?? '';
  try {
    const walk = (x, k = '') => {
      if (SECRET.test(k)) return '*';
      if (Array.isArray(x)) return x.map((v) => walk(v));
      if (x && typeof x === 'object') return Object.fromEntries(Object.keys(x).sort().map((key) => [key, walk(x[key], key)]));
      if (typeof x === 'string') return plain(x);
      if (typeof x === 'number' && x > 1e9) return '*';
      return x;
    };
    b = JSON.stringify(walk(JSON.parse(b)));
  } catch { b = plain(b); }
  return `${method.toUpperCase()} ${u.pathname}${q ? `?${q}` : ''} ${b}`;
}

/** A copy of a HAR entry with every secret value removed: headers, cookies, query values and sent fields. */
export function scrubEntry(entry) {
  const e = JSON.parse(JSON.stringify(entry));
  const headers = (list) => (list ?? []).filter((h) => !/^(cookie|set-cookie)$/i.test(h.name)).map((h) => (SECRET_NAME.test(h.name) ? { ...h, value: REMOVED } : h));
  const scrubUrl = (url) => { try { const u = new URL(url); for (const k of [...u.searchParams.keys()]) if (SECRET_NAME.test(k)) u.searchParams.set(k, REMOVED); return u.href; } catch { return url; } };
  const scrubJson = (text) => {
    try {
      const walk = (x) => (Array.isArray(x) ? x.map(walk) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, SECRET_NAME.test(k) ? REMOVED : walk(v)])) : x);
      return JSON.stringify(walk(JSON.parse(text)));
    } catch { return text.replace(/(bearer\s+)[\w.~+/=-]+/gi, `$1${REMOVED}`); }
  };
  e.request.url = scrubUrl(e.request.url);
  e.request.headers = headers(e.request.headers);
  e.request.cookies = [];
  e.request.queryString = (e.request.queryString ?? []).map((q) => (SECRET_NAME.test(q.name) ? { ...q, value: REMOVED } : q));
  if (e.request.postData) {
    if (e.request.postData.text) e.request.postData.text = scrubJson(e.request.postData.text);
    if (e.request.postData.params) e.request.postData.params = e.request.postData.params.map((p) => (SECRET_NAME.test(p.name) ? { ...p, value: REMOVED } : p));
  }
  e.response.headers = headers(e.response.headers);
  e.response.cookies = [];
  if (e.response.content?.text && !/^base64$/i.test(e.response.content.encoding ?? '')) e.response.content.text = scrubJson(e.response.content.text).replace(/(bearer\s+)[\w.~+/=-]+/gi, `$1${REMOVED}`);
  return e;
}

/**
 * Runs in the page during a replay: the product's own fetch() calls the brand named are answered from the saved
 * answers, streamed piece by piece at the saved moments. Anything else goes to the network as usual.
 */
export function replayShim({ pattern, entries, keySource }) {
  if (window.__studioAnswers) return;
  const keyOf = new Function(`return (${keySource})`)();
  const re = new RegExp(pattern);
  const left = entries.map((e) => ({ ...e, used: false }));
  const real = window.fetch.bind(window);
  window.__studioAnswers = { served: 0 };
  window.fetch = async function (input, init) {
    const req = new Request(input, init);
    if (!re.test(req.url)) return real(input, init);
    const t0 = performance.now();
    const body = ['GET', 'HEAD'].includes(req.method) ? '' : await req.clone().text();
    const key = keyOf(req.method, req.url, body);
    const entry = left.find((e) => !e.used && e.key === key);
    if (!entry) {
      window.__studioAnswerMiss?.({ key, url: req.url.split('?')[0], method: req.method, nearest: left.find((e) => !e.used)?.key ?? null });
      throw new TypeError('The saved answer does not cover this request.');
    }
    entry.used = true;
    window.__studioAnswers.served++;
    const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms - (performance.now() - t0))));
    await wait(entry.head_ms);
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctrl) {
        for (const [ms, text] of entry.chunks) { await wait(ms); ctrl.enqueue(enc.encode(text)); }
        await wait(entry.total_ms);
        ctrl.close();
      },
    });
    return new Response(stream, { status: entry.status, statusText: entry.statusText, headers: entry.headers });
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

export class Answers {
  /**
   * How a take treats AI answers: "record" (a run with nothing saved yet, or --fresh-answers), "replay" (answers are
   * saved), "live" (a dry run, rehearsal or check with nothing saved: real answers, nothing kept) or "off".
   */
  static plan({ capDir, product, mode, fresh }) {
    if (!product.answers) return new Answers({ mode: 'off' });
    const dir = path.join(capDir, 'answers');
    const saved = fs.existsSync(path.join(dir, 'answers.json'));
    const m = saved && !fresh ? 'replay' : mode === 'take' ? 'record' : 'live';
    return new Answers({ mode: m, dir, pattern: answerPattern(product.host, product.answers), list: product.answers });
  }

  constructor({ mode, dir = null, pattern = null, list = [] }) {
    Object.assign(this, { mode, dir, pattern, list, calls: new Map(), miss: null, served: 0, workHar: null });
    this.re = pattern ? new RegExp(pattern) : null;
    if (mode === 'replay') this.saved = JSON.parse(fs.readFileSync(path.join(dir, 'answers.json'), 'utf8'));
  }

  /** Before the first page opens. `onMiss` is told when the product asks something the saved answers do not cover. */
  async attach(ctx, { workDir, onMiss }) {
    if (this.mode === 'record') {
      // Playwright's HAR recording, limited to the product's own answer calls (sign-in and token addresses never match).
      this.workHar = path.join(workDir, 'answers.raw.har');
      await ctx.routeFromHAR(this.workHar, { update: true, updateContent: 'embed', updateMode: 'full', url: this.re });
      const watch = (page) => this.watch(ctx, page).catch(() => {});
      ctx.pages().forEach(watch);
      ctx.on('page', watch);
    }
    if (this.mode === 'replay') {
      const entries = this.saved.calls.map((c) => ({ key: c.key, status: c.status, statusText: c.status_text ?? '', headers: c.headers, head_ms: c.head_ms, total_ms: c.total_ms, chunks: c.chunks }));
      await ctx.exposeBinding('__studioAnswerMiss', (_, info) => { this.miss ??= info; onMiss(info); });
      await ctx.addInitScript(replayShim, { pattern: this.pattern, entries, keySource: callKey.toString() });
      // Calls made another way than fetch() (XMLHttpRequest): answered whole, after the same wait.
      const left = this.saved.calls.map((c) => ({ ...c, used: false }));
      await ctx.route(this.re, async (route) => {
        const r = route.request();
        const key = callKey(r.method(), r.url(), r.postData() ?? '');
        const entry = left.find((e) => !e.used && e.key === key);
        if (!entry) { const info = { key, url: r.url().split('?')[0], method: r.method(), nearest: left.find((e) => !e.used)?.key ?? null }; this.miss ??= info; onMiss(info); return route.abort('failed'); }
        entry.used = true;
        this.served++;
        await sleep(entry.total_ms);
        return route.fulfill({ status: entry.status, headers: Object.fromEntries(Object.entries(entry.headers)), body: entry.chunks.map((c) => c[1]).join('') });
      });
    }
  }

  /** Recording: when each piece of each answer arrived, from Chrome's own network log. */
  async watch(ctx, page) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', (e) => { if (this.re.test(e.request.url)) this.calls.set(e.requestId, { url: e.request.url, method: e.request.method, body: e.request.postData ?? '', start: e.timestamp, pieces: [], head: null, end: null }); });
    cdp.on('Network.responseReceived', (e) => { const c = this.calls.get(e.requestId); if (c) c.head = e.timestamp; });
    cdp.on('Network.dataReceived', (e) => { const c = this.calls.get(e.requestId); if (c) c.pieces.push([e.timestamp, e.dataLength]); });
    cdp.on('Network.loadingFinished', (e) => { const c = this.calls.get(e.requestId); if (c) c.end = e.timestamp; });
  }

  /** In the page right now: how many answers the replay served there. */
  async servedIn(page) {
    const n = await page.evaluate(() => window.__studioAnswers?.served ?? 0).catch(() => 0);
    return n + this.served;
  }

  /**
   * After a good recorded take (its window closed, so the HAR is written): the answers, cleaned, saved for retakes.
   * Returns what capture.json says about them.
   */
  save({ made, take }) {
    if (this.mode !== 'record') return null;
    if (!fs.existsSync(this.workHar)) return { mode: 'recorded', calls: 0, note: 'The product made none of the answer calls the brand names, so nothing was saved to replay.' };
    const har = JSON.parse(fs.readFileSync(this.workHar, 'utf8'));
    const nevers = new RegExp(NEVER, 'i');
    const entries = har.log.entries.filter((e) => this.re.test(e.request.url) && !nevers.test(new URL(e.request.url).pathname));
    const timings = [...this.calls.values()].filter((c) => c.end !== null);
    const used = new Set();
    const calls = entries.map((raw) => {
      const e = scrubEntry(raw);
      const body = raw.request.postData?.text ?? '';
      const key = callKey(raw.request.method, raw.request.url, body);
      // The network log's pieces for this call: the same address and what was sent, in order.
      const t = timings.find((c) => !used.has(c) && c.method === raw.request.method && c.url === raw.request.url && (c.body === body || !c.body));
      if (t) used.add(t);
      const content = e.response.content ?? {};
      const bytes = content.encoding === 'base64' ? Buffer.from(content.text ?? '', 'base64') : Buffer.from(content.text ?? '', 'utf8');
      const text = bytes.toString('utf8');
      const ms = (ts) => Math.round((ts - t.start) * 1000);
      let chunks;
      if (t?.pieces.length) {
        // Splits the whole answer into the pieces as they arrived, by their sizes.
        const dec = new TextDecoder('utf-8');
        let at = 0;
        chunks = t.pieces.map(([ts, len], i) => {
          const end = i === t.pieces.length - 1 ? bytes.length : Math.min(bytes.length, at + len);
          const piece = dec.decode(bytes.subarray(at, end), { stream: i < t.pieces.length - 1 });
          at = end;
          return [ms(ts), piece];
        }).filter(([, s]) => s.length);
        if (at < bytes.length) chunks.push([ms(t.end), dec.decode(bytes.subarray(at))]);
      } else chunks = [[Math.round(raw.time ?? 0), text]];
      const headers = Object.fromEntries(e.response.headers.filter((h) => !/^(content-length|content-encoding|transfer-encoding|connection|keep-alive)$/i.test(h.name) && !h.name.startsWith(':')).map((h) => [h.name.toLowerCase(), h.value]));
      return {
        method: raw.request.method,
        address: e.request.url,
        key,
        status: raw.response.status,
        status_text: raw.response.statusText,
        headers,
        head_ms: t?.head ? ms(t.head) : chunks[0]?.[0] ?? 0,
        total_ms: t?.end ? ms(t.end) : Math.round(raw.time ?? 0),
        chunks,
        answer: chunks.map((c) => c[1]).join(''),
      };
    });
    if (!calls.length) { fs.rmSync(this.workHar, { force: true }); return { mode: 'recorded', calls: 0, note: 'The product made none of the answer calls the brand names, so nothing was saved to replay.' }; }
    fs.mkdirSync(this.dir, { recursive: true });
    har.log.entries = entries.map(scrubEntry);
    fs.writeFileSync(path.join(this.dir, 'answers.har'), JSON.stringify(har, null, 2) + '\n');
    const saved = {
      about: 'AI answers the capture tool recorded once and replays for retakes (tools/capture/README.md, "AI answers"). made: when the real answers were made. Each call: what the product asked (key: its method, address and what it sent, with ids, times and secrets set aside), the answer, and when each piece of it arrived (chunks: [milliseconds after the call started, text]). Every token, cookie, key and authorization value was removed before saving. A person reads every answer before the footage is used.',
      made,
      made_in_take: take,
      addresses: this.list,
      calls,
    };
    fs.writeFileSync(path.join(this.dir, 'answers.json'), JSON.stringify(saved, null, 2) + '\n');
    fs.rmSync(this.workHar, { force: true });
    return { mode: 'recorded', made, calls: calls.length, answers: path.join(this.dir, 'answers.json') };
  }

  /** What capture.json says about a replayed take. */
  replayed(served) {
    if (this.mode !== 'replay') return null;
    return { mode: 'replayed', made: this.saved.made, made_in_take: this.saved.made_in_take, calls: this.saved.calls.length, served, note: `The AI's answers in this take are the real answers made ${this.saved.made} (take ${this.saved.made_in_take}), replayed with their own timing. Label the footage with that date.` };
  }

  /** Moves the saved answers aside (kept, never deleted), so the next take records fresh ones. */
  retire(why) {
    if (!this.dir || !fs.existsSync(this.dir)) return null;
    const aside = `${this.dir}.before-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
    fs.renameSync(this.dir, aside);
    fs.writeFileSync(path.join(aside, 'why.txt'), why + '\n');
    return aside;
  }
}
