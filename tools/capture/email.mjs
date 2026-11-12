// Emails the product sends, filmed from a local test inbox (CAPTURE-PLAN.md section 2, "Emails and notifications").
//
//   capture.mjs email <job_dir> <name> [--file x.eml | --folder <dir> | --mailpit [address]] [--pick "words"]
//                     [--size 800x1000] [--seconds 6] [--images]
//
// Takes one e-mail (a .eml or .html file, the newest in a folder of .eml files, or the newest in Mailpit, the free
// local test inbox), shows it in the studio's Chrome at a set size with nothing loaded from the internet, blurs any
// private words (the brand's safe list and never-show list, as in a take), and writes a still, a tall still and a
// short recording that scrolls through it. Never a real inbox: Mailpit must be on this Mac.
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------- reading an e-mail file

const decodeWords = (s) => s.replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=(\s+(?==\?))?/g, (_, cs, enc, text) => {
  const bytes = /b/i.test(enc) ? Buffer.from(text, 'base64') : Buffer.from(text.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
  try { return new TextDecoder(cs).decode(bytes); } catch { return bytes.toString('utf8'); }
});

function headersOf(text) {
  const out = {};
  for (const line of text.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (m) out[m[1].toLowerCase()] = decodeWords(m[2]);
  }
  return out;
}

const param = (value, name) => value?.match(new RegExp(`${name}\\s*=\\s*"?([^";]+)"?`, 'i'))?.[1] ?? null;

function bodyOf(raw, headers) {
  const enc = (headers['content-transfer-encoding'] ?? '').toLowerCase();
  let bytes;
  if (enc === 'base64') bytes = Buffer.from(raw.toString('latin1').replace(/\s+/g, ''), 'base64');
  else if (enc === 'quoted-printable') bytes = Buffer.from(raw.toString('latin1').replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), 'latin1');
  else bytes = raw;
  return bytes;
}

/** A .eml file's subject, sender, receivers, date, HTML or text, and pictures sent inside it (by their Content-ID). */
export function parseEml(buf) {
  const found = { html: null, text: null, inline: {} };
  const walk = (part) => {
    const s = part.toString('latin1');
    const cut = s.search(/\r?\n\r?\n/);
    const head = headersOf(cut < 0 ? s : s.slice(0, cut));
    const raw = cut < 0 ? Buffer.alloc(0) : part.subarray(Buffer.byteLength(s.slice(0, cut), 'latin1') + (s.slice(cut).startsWith('\r\n\r\n') ? 4 : 2));
    const type = (head['content-type'] ?? 'text/plain').toLowerCase();
    if (type.startsWith('multipart/')) {
      const boundary = param(head['content-type'], 'boundary');
      if (!boundary) return head;
      const text = raw.toString('latin1');
      const pieces = text.split(new RegExp(`\\r?\\n?--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?[ \\t]*\\r?\\n?`)).slice(1, -1);
      for (const p of pieces) if (p.trim()) walk(Buffer.from(p, 'latin1'));
      return head;
    }
    const bytes = bodyOf(raw, head);
    const charset = param(head['content-type'], 'charset') ?? 'utf-8';
    const asText = () => { try { return new TextDecoder(charset).decode(bytes); } catch { return bytes.toString('utf8'); } };
    const cid = head['content-id']?.replace(/^<|>$/g, '');
    if (cid && !type.startsWith('text/')) found.inline[cid] = `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`;
    else if (type.startsWith('text/html') && !found.html) found.html = asText();
    else if (type.startsWith('text/plain') && !found.text) found.text = asText();
    return head;
  };
  const top = walk(buf);
  return { subject: top.subject ?? '', from: top.from ?? '', to: top.to ?? '', date: top.date ?? '', ...found };
}

// ---------------------------------------------------------------- finding the e-mail

const where = (f, rel) => (f.startsWith('/') && rel(f).startsWith('..') ? f : f.startsWith('/') ? rel(f) : f);
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|[\w-]+\.localhost|[\w.-]+\.test)(:\d+)?\/?$/i;

async function fromMailpit(address, pick, stop) {
  if (!LOCAL.test(address)) stop(`Mailpit must be on this Mac (an address like http://localhost:8025), never a real inbox. "${address}" is not.`);
  const base = address.replace(/\/$/, '');
  let list;
  try { list = await (await fetch(`${base}/api/v1/messages?limit=50`)).json(); }
  catch {
    stop(`No test inbox answered at ${base}. Start Mailpit (free, open source, it catches the e-mails a local site sends and never delivers them), then run this again:
  with Docker:            docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
  or its single program:  download it from https://github.com/axllent/mailpit/releases, then run ./mailpit
Point the demo site's outgoing mail at localhost port 1025 (for WordPress: a small SMTP plugin, or the recipe does it). Or use a folder of .eml files: --folder <dir>.`);
  }
  const messages = list.messages ?? [];
  const chosen = pick ? messages.find((m) => `${m.Subject} ${m.Snippet}`.toLowerCase().includes(pick.toLowerCase())) : messages[0];
  if (!chosen) stop(messages.length ? `None of the ${messages.length} e-mails in the test inbox mentions "${pick}".` : 'The test inbox is empty: make the product send the e-mail first.');
  const raw = Buffer.from(await (await fetch(`${base}/api/v1/message/${chosen.ID}/raw`)).arrayBuffer());
  return { raw, source: `Mailpit at ${base}, message "${chosen.Subject}"` };
}

function fromFolder(dir, pick, stop) {
  if (!fs.existsSync(dir)) stop(`The e-mail folder ${dir} does not exist.`);
  const files = fs.readdirSync(dir).filter((f) => /\.(eml|html?)$/i.test(f)).map((f) => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  const chosen = pick ? files.find((f) => fs.readFileSync(f, 'latin1').toLowerCase().includes(pick.toLowerCase())) : files[0];
  if (!chosen) stop(files.length ? `None of the ${files.length} e-mails in ${dir} mentions "${pick}".` : `There is no .eml or .html file in ${dir}.`);
  return { raw: fs.readFileSync(chosen), source: chosen, html: /\.html?$/i.test(chosen) };
}

// ---------------------------------------------------------------- the command

export async function emailCommand(jobDir, name, opts, d) {
  const { stop, say, rel } = d;
  if (!name || !/^[a-z0-9][a-z0-9-_]*$/i.test(name)) stop('Name the e-mail capture in letters, digits and dashes, like: capture.mjs email jobs/my-film order-confirmation --folder emails');
  const { brand, product } = d.jobLite(jobDir);
  const cfg = product.raw.email ?? {};
  const [W, H] = String(opts.size ?? cfg.size ?? '800x1000').split('x').map(Number);
  if (!(W >= 200 && W <= 1920 && H >= 200 && H <= 2160)) stop('--size is the width and height in page pixels, like --size 800x1000.');
  const seconds = Number(opts.seconds ?? 6);
  let got;
  if (opts.file) {
    const f = path.resolve(opts.file);
    if (!fs.existsSync(f)) stop(`The e-mail file ${opts.file} does not exist.`);
    got = { raw: fs.readFileSync(f), source: f, html: /\.html?$/i.test(f) };
  } else if (opts.folder || (cfg.folder && !opts.mailpit)) got = fromFolder(path.resolve(opts.folder ?? path.resolve(path.dirname(product.file), cfg.folder)), opts.pick, stop);
  else got = await fromMailpit(typeof opts.mailpit === 'string' ? opts.mailpit : cfg.mailpit ?? 'http://localhost:8025', opts.pick, stop);
  const mail = got.html ? { subject: '', from: '', to: '', date: '', html: got.raw.toString('utf8'), text: null, inline: {} } : parseEml(got.raw);
  let html = mail.html ?? `<pre style="font:15px/1.5 -apple-system,system-ui,sans-serif;white-space:pre-wrap;margin:24px">${(mail.text ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</pre>`;
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\bcid:([^"')\s>]+)/gi, (m, id) => mail.inline[id] ?? m);

  // Who it is from and to: a real-looking address not on the brand's safe list is never written down.
  const warnings = [];
  const safe = [...product.safe, ...product.allowEmail].map((s) => s.toLowerCase());
  const clean = (who) => who.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (addr) => {
    if (safe.some((s) => addr.toLowerCase().includes(s))) return addr;
    warnings.push(`E-mail address not on the brand's safe list in the e-mail's header: "${addr}". It is left out of email.json.`);
    return '[blurred]';
  });

  const out = path.join(jobDir, 'capture', name, 'email');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const chromium = await d.playwright();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: d.SCALE, colorScheme: 'light', javaScriptEnabled: false });
    // Nothing comes from the internet unless --images: pictures in e-mails often report that the mail was opened.
    await ctx.route(/^https?:/, (route) => (opts.images && route.request().resourceType() === 'image' ? route.continue() : route.abort('blockedbyclient')));
    const page = await ctx.newPage();
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#fff}::-webkit-scrollbar{display:none}</style>${html}`, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    const tall = await page.evaluate(() => Math.ceil(Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0)));
    await page.setViewportSize({ width: W, height: Math.max(H, tall) });
    // The same privacy scan and never-show check as a take's marks, on the whole e-mail.
    const hits = await page.evaluate(d.privacyScan, { safe: product.safe, allowEmail: product.allowEmail, firstNames: d.FIRST_NAMES }).catch(() => []);
    const rules = product.rules.map((r) => ({ what: r.what, text: r.text ?? [], pattern: r.pattern ?? null, allow: r.allow ?? [] }));
    const never = rules.some((r) => r.text.length || r.pattern) ? await page.evaluate(d.visibleMatches, rules).catch(() => []) : [];
    const full = path.join(out, 'full.png');
    await page.screenshot({ path: full, type: 'png', scale: 'device', fullPage: true });
    const rects = [...hits.flatMap((h) => h.rects), ...never.flatMap((n) => n.rects)];
    if (rects.length) d.blurStill(full, rects);
    for (const h of hits) warnings.push(`${h.kind[0].toUpperCase()}${h.kind.slice(1)} not on the brand's safe list in the e-mail: "${h.text}". It is blurred in the still and the recording; check it before the footage is used.`);
    for (const n of never) warnings.push(`The e-mail shows "${n.found}", and the brand says never to show "${n.what}". It is blurred; use another e-mail or other demo data.`);
    const pageH = Math.max(H, tall);
    // The first screen as a still, and a recording that rests, scrolls smoothly to the end and rests again.
    d.ffmpeg(['-i', full, '-vf', `crop=${W * d.SCALE}:${H * d.SCALE}:0:0`, '-frames:v', '1', path.join(out, 'still.png')], 'cut the first screen of the e-mail');
    const travel = (pageH - H) * d.SCALE;
    const T = Math.max(2, seconds);
    const y = travel > 0 ? `'${travel}*(0.5-0.5*cos(PI*min(1,max(0,(t-1)/(${T}-2)))))'` : '0';
    d.ffmpeg(['-loop', '1', '-framerate', String(d.FPS), '-i', full, '-vf', `crop=${W * d.SCALE}:${H * d.SCALE}:0:${y},scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709:flags=accurate_rnd+full_chroma_int,format=yuv420p`, '-t', String(T), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-tune', 'stillimage', '-r', String(d.FPS), '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', path.join(out, 'recording.mp4')], 'make the e-mail recording');
    const info = {
      about: 'An e-mail the product sent, from a local test inbox, shown at a set size with nothing loaded from the internet (tools/capture/README.md, "Emails the product sends"). still.png: the first screen; full.png: the whole e-mail; recording.mp4: rests 1 s, scrolls to the end, rests. Private words are blurred in all three. The engine draws the mail frame (CaptureShot staging "mail") with from and subject.',
      brand,
      captured: d.localStamp(),
      source: where(got.source, rel),
      subject: mail.subject,
      from: clean(mail.from),
      to: clean(mail.to),
      date: mail.date,
      page: { width: W, height: H },
      scale: d.SCALE,
      full_height: pageH,
      seconds: T,
      scroll: travel > 0 ? { from: 0, to: pageH - H, start: 1, end: T - 1, easing: 'sine in and out' } : null,
      pictures_from_the_internet: Boolean(opts.images),
      privacy_flags: hits.map((h) => ({ kind: h.kind, text: h.text })),
      never_show: never.map((n) => n.what),
      warnings,
    };
    fs.writeFileSync(path.join(out, 'email.json'), JSON.stringify(info, null, 2) + '\n');
    if (warnings.length) fs.writeFileSync(path.join(out, 'warnings.txt'), warnings.map((w) => `- ${w}`).join('\n') + '\n');
    const pub = d.publishEmail(jobDir, name, out);
    say(`E-mail "${info.subject || name}" from ${where(got.source, rel)}`);
    say(`  still ${rel(path.join(out, 'still.png'))} (${W * d.SCALE} x ${H * d.SCALE}), whole e-mail ${rel(full)} (${pageH} page pixels tall), recording ${rel(path.join(out, 'recording.mp4'))} (${T} s)`);
    say(`  private words blurred: ${rects.length}${warnings.length ? `; ${warnings.length} warning${warnings.length > 1 ? 's' : ''} for a person to read: ${rel(path.join(out, 'warnings.txt'))}` : ''}`);
    say(`  for the engine: ${pub}`);
    return 0;
  } finally {
    await browser.close().catch(() => {});
  }
}
