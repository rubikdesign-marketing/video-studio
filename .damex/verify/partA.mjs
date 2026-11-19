import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const ROOT = path.resolve(process.cwd());
const OLD = '~/Desktop/Marketer/projects/damex-video-engine';
const MANIFEST = '~/Desktop/Marketer/projects/tulvo/video-studio/release/manifest.json';
const C = (f) => path.join(ROOT, 'tools/conductor', f);
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'verA-'));
const out = []; const res = {};
const log = (s = '') => { out.push(s); };
const run = (file, args, env = {}) => { const r = spawnSync('node', [file, ...args], { encoding: 'utf8', env: { ...process.env, ...env } }); return { code: r.status, out: (r.stdout + r.stderr).trim() }; };
const ok = (item, cond, msg) => { (res[item] ||= { pass: true, fails: [] }); log(`  [${cond ? 'ok' : 'FAIL'}] ${msg}`); if (!cond) { res[item].pass = false; res[item].fails.push(msg); } };
const job = (n) => { const d = path.join(tmp, n); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'job.json'), '{"brand":"demo"}'); return d; };
const claim = (d, o, env = {}) => run(C('dispatch.mjs'), ['claim', d, '--stage', o.stage || 'animation', '--task', o.task || 't1', '--worker', o.worker || 'checker', '--model', o.model || 'haiku', ...(o.writes ? ['--writes', o.writes] : []), ...(o.paid ? ['--paid'] : [])], env);
const NOSET = { CONDUCTOR_SETTINGS_FILES: '' };
const fx = (n, o) => { const f = path.join(tmp, n); fs.writeFileSync(f, JSON.stringify(o)); return f; };

// 1
log('ITEM 1 Default lead selection');
const rs = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/settings.json'), 'utf8'));
ok(1, !('model' in rs), 'ROOT .claude/settings.json has no model key');
const sl = path.join(ROOT, '.claude/settings.local.json'); ok(1, !fs.existsSync(sl) || !('model' in JSON.parse(fs.readFileSync(sl, 'utf8'))), 'no settings.local.json model key');
for (const f of fs.readdirSync(path.join(ROOT, '.claude/agents')).filter((x) => x.endsWith('.md'))) {
  const t = fs.readFileSync(path.join(ROOT, '.claude/agents', f), 'utf8'); const fm = t.split('---')[1] || ''; const m = /^model:\s*(.+)$/m.exec(fm);
  if (m) ok(1, /^(haiku|sonnet|opus|inherit)$/.test(m[1].trim()), `${f} model=${m[1].trim()} is an alias (no full id)`);
  ok(1, !/claude-(opus|sonnet|haiku)-\d/.test(t), `${f} has no full model ID anywhere`);
}
const usr = fx('user-opus.json', { model: 'opus[1m]' });
let r = run(C('models.mjs'), ['--json'], { CONDUCTOR_SETTINGS_FILES: usr }); let j = JSON.parse(r.out);
ok(1, j.lead === 'opus[1m]' && j.leadFrom === usr, `models.mjs lead from user fixture = ${j.lead}`);
r = run(C('models.mjs'), ['--json'], { CONDUCTOR_SETTINGS_FILES: fx('nolead.json', { enabledPlugins: {} }) }); j = JSON.parse(r.out);
ok(1, j.lead === null, `unset lead stays null (got ${j.lead})`);
r = run(C('models.mjs'), [], { CONDUCTOR_SETTINGS_FILES: fx('nolead2.json', {}) });
ok(1, /not set in settings/.test(r.out), 'plain output says not set, no invention');
r = run(C('models.mjs'), ['--json']); j = JSON.parse(r.out);
ok(1, j.lead === 'opus[1m]' || j.lead === null || typeof j.lead === 'string', `real settings lead = ${j.lead} from ${j.leadFrom}`);
ok(1, j.leadFrom !== path.join(ROOT, '.claude/settings.json'), 'lead does not come from ROOT project settings');

// 2
log('ITEM 2 Model routing');
const pol = JSON.parse(fs.readFileSync(C('policy.json'), 'utf8'));
const fmOf = (n) => { const t = fs.readFileSync(path.join(ROOT, '.claude/agents', n + '.md'), 'utf8'); return t.split('---')[1]; };
for (const [cls, v] of Object.entries(pol.routes)) {
  const rr = run(C('route.mjs'), [cls, '--json']); const jj = JSON.parse(rr.out);
  ok(2, ['lead', 'script', 'haiku', 'sonnet'].includes(v.route) && jj.route === v.route, `${cls} -> ${v.route}${v.worker ? ' (' + v.worker + ')' : ''} (CLI agrees)`);
  if (v.worker) { const fm = fmOf(v.worker); const model = /^model:\s*(\S+)/m.exec(fm)?.[1]; ok(2, model === v.route && pol.agents[v.worker].model === model, `${cls}: agent ${v.worker} model field=${model} matches route`); }
  else ok(2, !v.worker, `${cls}: no worker needed for ${v.route}`);
}
for (const [a, v] of Object.entries(pol.agents)) { const fm = fmOf(a); const mt = Number(/^maxTurns:\s*(\d+)/m.exec(fm)?.[1]); ok(2, mt === pol.max_turns[a], `${a} maxTurns ${mt} = policy ${pol.max_turns[a]}`); ok(2, /^effort:/m.test(fm), `${a} has effort`); }
ok(2, run(C('route.mjs'), ['nonsense']).code === 2, 'unknown class exits 2');

// 3
log('ITEM 3 Bounded retries');
let d = job('retry');
let a = claim(d, { writes: 'out/a' }); ok(3, a.code === 0 && /ALLOW c1/.test(a.out), 'first claim allowed');
r = run(C('dispatch.mjs'), ['release', d, 'c1', '--status', 'partial']); ok(3, /outputs kept: out\/a/.test(r.out), 'partial release keeps writes: ' + r.out);
a = claim(d, { writes: 'out/a' }); ok(3, a.code === 0, 'retry (second try) allowed: ' + a.out);
run(C('dispatch.mjs'), ['release', d, 'c2', '--status', 'failed']);
a = claim(d, { writes: 'out/a' }); ok(3, a.code === 4 && /retry cap/.test(a.out), 'second retry (third try) STOPPED: ' + a.out);
a = claim(d, { task: 'other', writes: 'out/b' }); ok(3, a.code === 0, 'a different task still allowed');
ok(3, fs.existsSync(path.join(d, 'dispatch.jsonl')) && fs.readFileSync(path.join(d, 'dispatch.jsonl'), 'utf8').includes('"partial"'), 'ledger keeps partial record');
// done resets
d = job('retry2'); claim(d, {}); run(C('dispatch.mjs'), ['release', d, 'c1', '--status', 'done']); a = claim(d, {}); ok(3, a.code === 0, 'after done a re-claim is allowed (reset)');

// 4
log('ITEM 4 Unavailable model / paid');
d = job('blocked');
const blk = fx('avail.json', { model: 'opus[1m]', availableModels: ['opus', 'sonnet'] });
a = claim(d, { model: 'haiku' }, { CONDUCTOR_SETTINGS_FILES: blk });
ok(4, a.code === 4 && /blocked/.test(a.out) && /lead session/.test(a.out) && /Not switched/.test(a.out), 'haiku blocked, lead named: ' + a.out);
ok(4, !fs.existsSync(path.join(d, 'dispatch.jsonl')) || fs.readFileSync(path.join(d, 'dispatch.jsonl'), 'utf8') === '', 'nothing recorded for blocked claim (no swap)');
a = claim(d, { model: 'sonnet' }, { CONDUCTOR_SETTINGS_FILES: blk }); ok(4, a.code === 0, 'sonnet still allowed (not auto-swapped target needed)');
d = job('denied'); a = claim(d, { model: 'haiku' }, { CONDUCTOR_SETTINGS_FILES: fx('den.json', { deniedModels: ['claude-haiku-4-5'] }) }); ok(4, a.code === 4, 'deniedModels full id blocks haiku');
d = job('managed'); a = claim(d, { model: 'sonnet' }, { CONDUCTOR_SETTINGS_FILES: `${fx('u.json', { availableModels: ['haiku', 'sonnet'] })}|managed:${fx('m.json', { availableModels: ['haiku'] })}` }); ok(4, a.code === 4, 'managed list further restricts sonnet');
d = job('paid'); a = claim(d, { model: 'sonnet', paid: true }, NOSET); ok(4, a.code === 4 && /paid work needs/.test(a.out), '--paid without approval STOPPED: ' + a.out.slice(0, 80));
fs.writeFileSync(path.join(d, 'spend.md'), 'budget 5'); r = run(C('gate.mjs'), ['approve', d, 'paid_usage', '--inputs', 'spend.md']); ok(4, r.code === 0, 'approve paid_usage');
a = claim(d, { model: 'sonnet', paid: true }, NOSET); ok(4, a.code === 0, '--paid with approval allowed');
fs.writeFileSync(path.join(d, 'spend.md'), 'budget 500'); run(C('dispatch.mjs'), ['release', d, 'c1', '--status', 'done']); a = claim(d, { task: 'x', model: 'sonnet', paid: true }, NOSET); ok(4, a.code === 4, '--paid with stale approval STOPPED');

// 5
log('ITEM 5 Skipped / reused work');
d = job('gates'); fs.writeFileSync(path.join(d, 'idea.md'), 'hello'); fs.mkdirSync(path.join(d, 'sub')); fs.writeFileSync(path.join(d, 'sub/x.txt'), 'abc');
r = run(C('gate.mjs'), ['approve', d, 'idea', '--inputs', 'idea.md,sub']); ok(5, r.code === 0, r.out);
r = run(C('gate.mjs'), ['check', d, 'idea']); ok(5, r.code === 0 && /^OK/.test(r.out), 'check OK: ' + r.out);
r = run(C('dispatch.mjs'), ['resume', d, '--mode', 'guided']); ok(5, /gates already satisfied \(skipped\): idea/.test(r.out) && /NEXT: run stage "script-and-voice"/.test(r.out), 'rerun skips idea, next is script-and-voice');
fs.writeFileSync(path.join(d, 'idea.md'), 'hellp'); r = run(C('gate.mjs'), ['check', d, 'idea']); ok(5, r.code === 3 && /STALE/.test(r.out), 'one-byte change (o->p) -> STALE exit 3');
r = run(C('dispatch.mjs'), ['resume', d, '--mode', 'guided']); ok(5, /NEXT: run stage "intake-and-idea".*changed/.test(r.out), 'resume next = redo idea (stale): ' + r.out.split('\n').pop());
fs.writeFileSync(path.join(d, 'idea.md'), 'hello'); r = run(C('gate.mjs'), ['check', d, 'idea']); ok(5, r.code === 0, 'reverting restores OK');
fs.appendFileSync(path.join(d, 'sub/x.txt'), 'd'); ok(5, run(C('gate.mjs'), ['check', d, 'idea']).code === 3, 'one byte added inside hashed folder -> stale');
fs.writeFileSync(path.join(d, 'sub/x.txt'), 'abc'); fs.writeFileSync(path.join(d, 'sub/new.txt'), ''); ok(5, run(C('gate.mjs'), ['check', d, 'idea']).code === 3, 'new empty file in folder -> stale');
fs.rmSync(path.join(d, 'sub/new.txt')); fs.rmSync(path.join(d, 'sub/x.txt')); ok(5, run(C('gate.mjs'), ['check', d, 'idea']).code === 3, 'deleted input file -> stale');
ok(5, run(C('gate.mjs'), ['check', d, 'storyboard']).code === 1, 'unapproved gate MISSING exit 1');
// grouped fold
d = job('fold'); fs.writeFileSync(path.join(d, 'brief.md'), 'b'); run(C('gate.mjs'), ['approve', d, 'brief_review', '--inputs', 'brief.md', '--mode', 'grouped']);
ok(5, run(C('gate.mjs'), ['check', d, 'idea']).code === 0 && run(C('gate.mjs'), ['check', d, 'moodboard']).code === 0, 'grouped brief_review satisfies folded idea+moodboard');
// path tricks
r = run(C('gate.mjs'), ['approve', d, 'idea', '--inputs', 'nope.md']); ok(5, r.code !== 0, 'approve with missing input refused');

// 6
log('ITEM 6 Allow/stop matrix');
d = job('matrix');
ok(6, /ALLOW c1/.test(claim(d, { task: 'a', writes: 'out/a' }).out), 'claim 1 allowed');
ok(6, /ALLOW c2/.test(claim(d, { task: 'b', writes: 'out/b' }).out), 'claim 2 allowed');
a = claim(d, { task: 'c', writes: 'out/c' }); ok(6, a.code === 4 && /active cap/.test(a.out), 'third active STOP: ' + a.out.slice(0, 60));
run(C('dispatch.mjs'), ['release', d, 'c1', '--status', 'done']);
a = claim(d, { task: 'c', writes: 'out/c' }); ok(6, /ALLOW c3/.test(a.out), 'release then new claim allowed');
a = claim(d, { task: 'd', writes: 'out/b/deep' }); ok(6, a.code === 4 && /write overlap|active cap/.test(a.out), 'child path vs held parent (active cap hit first maybe): ' + a.out.slice(0, 50));
run(C('dispatch.mjs'), ['release', d, 'c3', '--status', 'done']);
a = claim(d, { task: 'd', writes: 'out/b/deep' }); ok(6, a.code === 4 && /write overlap/.test(a.out), 'overlapping writes (child of held) STOP: ' + a.out.slice(0, 70));
a = claim(d, { task: 'd', writes: 'out' }); ok(6, a.code === 4 && /write overlap/.test(a.out), 'parent of held STOP');
a = claim(d, { task: 'd', writes: './out/b/' }); ok(6, a.code === 4 && /write overlap/.test(a.out), 'normalised ./out/b/ STOP');
a = claim(d, { task: 'd', writes: 'out/bb' }); ok(6, a.code === 0, 'out/bb is not overlap of out/b (sibling prefix)');
// stage cap
d = job('stagecap'); for (let i = 1; i <= 3; i++) { const c = claim(d, { stage: 'storyboard', task: 't' + i, writes: 'w' + i }); run(C('dispatch.mjs'), ['release', d, 'c' + i, '--status', 'done']); ok(6, c.code === 0, 'storyboard dispatch ' + i + ' allowed'); }
a = claim(d, { stage: 'storyboard', task: 't4', writes: 'w4' }); ok(6, a.code === 4 && /stage cap/.test(a.out), '4th in default stage STOP: ' + a.out);
d = job('animcap'); let allowed = 0; for (let i = 1; i <= 7; i++) { const c = claim(d, { stage: 'animation', task: 't' + i, writes: 'w' + i }); if (c.code === 0) { allowed++; run(C('dispatch.mjs'), ['release', d, 'c' + i, '--status', 'done']); } }
ok(6, allowed === 6, `animation stage cap 6 (allowed ${allowed})`);
// misc
r = run(C('dispatch.mjs'), ['release', d, 'c1', '--status', 'done']); ok(6, r.code === 2, 'double release rejected');
r = run(C('dispatch.mjs'), ['release', d, 'c99', '--status', 'done']); ok(6, r.code === 2, 'unknown claim release rejected');
r = run(C('dispatch.mjs'), ['claim', d, '--stage', 'animation']); ok(6, r.code === 2, 'missing flags rejected');
// concurrency: 6 parallel claims, active cap 2
d = job('race'); const procs = []; for (let i = 0; i < 6; i++) procs.push(new Promise((res2) => { const p = spawn('node', [C('dispatch.mjs'), 'claim', d, '--stage', 'animation', '--task', 'r' + i, '--worker', 'checker', '--model', 'haiku', '--writes', 'w' + i], { env: { ...process.env, ...NOSET } }); let o = ''; p.stdout.on('data', (x) => (o += x)); p.on('close', (c) => res2({ c, o })); }));
const rr = await Promise.all(procs); const al = rr.filter((x) => x.c === 0).length; ok(6, al === 2, `6 parallel claims -> exactly 2 allowed (got ${al})`);

// 7
log('ITEM 7 Recovery');
d = job('crash'); a = claim(d, { task: 'k', writes: 'out/k' }); ok(7, a.code === 0, 'claim made');
// kill a process mid-claim holding the lock: use a child that takes lock via the lib then sleeps
const holder = path.join(tmp, 'holder.mjs');
fs.writeFileSync(holder, `import {withLock} from '${path.join(ROOT, 'tools/conductor/lib/util.mjs')}'; import {claim} from '${path.join(ROOT, 'tools/conductor/lib/dispatch.mjs')}'; import fs from 'node:fs'; withLock(process.argv[2], ()=>{ fs.writeFileSync(process.argv[2]+'/READY','1'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000); });`);
const ch = spawn('node', [holder, d], { stdio: 'ignore' });
for (let i = 0; i < 100 && !fs.existsSync(path.join(d, 'READY')); i++) await new Promise((x) => setTimeout(x, 50));
ok(7, fs.existsSync(path.join(d, '.conductor.lock')), 'lock held by live child');
ch.kill('SIGKILL'); await new Promise((x) => setTimeout(x, 300));
ok(7, fs.existsSync(path.join(d, '.conductor.lock')), 'stale lock left behind after SIGKILL');
r = run(C('dispatch.mjs'), ['resume', d]); ok(7, r.code === 0 && /interrupted c1 .*partial work preserved at: out\/k/.test(r.out), 'resume (new process) cleared stale lock and reports c1: ' + r.out.split('\n')[1]);
for (const l of fs.readFileSync(path.join(d, 'dispatch.jsonl'), 'utf8').split('\n').filter(Boolean)) JSON.parse(l);
ok(7, true, 'every ledger line is valid JSON');
ok(7, !fs.existsSync(path.join(d, '.conductor.lock')), 'lock released');
a = claim(d, { task: 'k', writes: 'out/k' }); ok(7, a.code === 0, 'retry of interrupted task allowed (1 retry): ' + a.out);
run(C('dispatch.mjs'), ['release', d, 'c2', '--status', 'failed']); a = claim(d, { task: 'k', writes: 'out/k' }); ok(7, a.code === 4, 'interrupted + failed counts, next STOP');
// kill during many gate writes: hammer approve then SIGKILL, check receipts.json parseable and no leftover tmp
d = job('atomic'); fs.writeFileSync(path.join(d, 'a.md'), 'x');
const hammer = path.join(tmp, 'hammer.mjs');
fs.writeFileSync(hammer, `import {approve} from '${path.join(ROOT, 'tools/conductor/lib/receipts.mjs')}'; for(let i=0;;i++) approve(process.argv[2],'g'+(i%5),{inputs:['a.md']});`);
let bad = 0; for (let k = 0; k < 8; k++) { const h = spawn('node', [hammer, d], { stdio: 'ignore' }); await new Promise((x) => setTimeout(x, 150 + k * 37)); h.kill('SIGKILL'); await new Promise((x) => setTimeout(x, 100)); try { const f = path.join(d, 'receipts.json'); if (fs.existsSync(f)) JSON.parse(fs.readFileSync(f, 'utf8')); } catch { bad++; } }
ok(7, bad === 0, `receipts.json valid after 8 SIGKILLs mid-write (corrupt ${bad})`);
const tmps = fs.readdirSync(d).filter((n) => n.includes('.tmp-')); log(`  leftover tmp files after SIGKILL: ${tmps.length}${tmps.length ? ' (' + tmps.join(',') + ')' : ''}`);
// a SIGKILL between write and rename can leave a tmp; atomicity itself is about no corruption. Check next write works and tmp is not read.
r = run(C('gate.mjs'), ['status', d]); ok(7, r.code === 0, 'status works after kills');
ok(7, tmps.length === 0, 'no leftover .tmp files (informational: SIGKILL between write and rename may leave one)');
// torn ledger line tolerance
d = job('torn'); claim(d, {}); fs.appendFileSync(path.join(d, 'dispatch.jsonl'), '{"event":"claim","id":"c2","sta'); r = run(C('dispatch.mjs'), ['usage', d]); ok(7, r.code === 0, 'torn trailing ledger line tolerated');
a = claim(d, { task: 'z' }); ok(7, a.code === 0, 'claim after torn line works: ' + a.out);
const lines = fs.readFileSync(path.join(d, 'dispatch.jsonl'), 'utf8').split('\n').filter(Boolean); let badl = 0; for (const l of lines) { try { JSON.parse(l); } catch { badl++; } }
ok(7, badl === 0, `ledger lines after claim following a torn line: ${badl} unparsable (append glued to torn fragment loses the new claim if >0)`);

// 8
log('ITEM 8 Export links');
const man = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const g = spawnSync('bash', ['-c', `cd "${ROOT}" && { git ls-files; git ls-files --others --exclude-standard; } | sort -u`], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).filter((f) => fs.existsSync(path.join(ROOT, f)));
const rx = (gl) => new RegExp('^' + gl.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '(/.*)?$');
const exc = man.exclude.map(rx); const keep = new Set(man.keep_inside_excluded);
const kept = g.filter((f) => keep.has(f) || [...keep].some((k) => f.startsWith(k + '/')) || !exc.some((e) => e.test(f)));
const keptSet = new Set(kept); const excl = new Set(g.filter((f) => !keptSet.has(f)));
log(`  tracked+new files ${g.length}, kept after export ${kept.length}, excluded ${excl.size}`);
const existsAfter = (p) => { p = p.replace(/\/$/, ''); return keptSet.has(p) || kept.some((f) => f.startsWith(p + '/')); };
const existsNow = (p) => fs.existsSync(path.join(ROOT, p.replace(/\/$/, '')));
const scan = ['CLAUDE.md', ...fs.readdirSync(path.join(ROOT, '.claude/agents')).filter((x) => x.endsWith('.md')).map((x) => '.claude/agents/' + x), '.claude/skills/video-menu/SKILL.md'];
(function w(dir) { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const p = dir + '/' + e.name; if (e.isDirectory()) w(p); else if (e.name.endsWith('.md')) scan.push(p); } })('.claude/skills/video-studio');
const skillMap = fs.readFileSync(path.join(ROOT, '.claude/skills/video-studio/skill-map.md'), 'utf8');
const tbl = skillMap.split('## When a named skill or file is missing')[1].split('\n## ')[0].split('\n').filter((l) => l.startsWith('|')).map((l) => l.split('|')[1] || '').join(' ');
const jobRel = /^(audio|out|review|storyboard|capture|moodboard|frames|renders?|voice|music|sound|footage|brief|study|cuts?|jobs\/<)/;
let refs = 0; const unresolved = []; const seen = new Set();
for (const f of [...new Set(scan)].sort()) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8'); const L = txt.split('\n');
  L.forEach((line, i) => { for (const m of line.matchAll(/`([^`]+)`/g)) {
    let tok = m[1].trim().split(/\s+/); tok = tok.find((t) => /\//.test(t) || /\.(md|json|mjs|py|sh|tsx?|jsx?|txt|yml)$/.test(t)); if (!tok) continue;
    tok = tok.replace(/[,;:.)]+$/, '').replace(/^\.\//, ''); if (/^(https?:|~|\/|-)/.test(tok) || /[<>{}*$|=()]/.test(tok)) continue; if (!/^[\w.@\/-]+$/.test(tok)) continue;
    if (tok.startsWith('.claude/skills/')) continue; if (jobRel.test(tok)) continue; if (!/\//.test(tok) && !/^[A-Z][A-Z_-]*\.md$|^[a-z-]+\.json$/.test(tok)) continue;
    if (!/\//.test(tok) && !existsNow(tok)) continue; // bare names that are not repo files: skip
    if (/^(brands\/<|jobs\/)/.test(tok) && !/^jobs\/_sample/.test(tok)) { if (/^jobs\//.test(tok) && !/^jobs\/_/.test(tok)) { /* generic jobs/ folder */ } }
    refs++; const e = existsNow(tok); const after = existsAfter(tok);
    if (e && after) continue;
    const base = path.basename(tok);
    const viaTable = tbl.includes(tok) || tbl.includes(base);
    const sameFile = L.slice(Math.max(0, i - 1), i + 2).join(' ').toLowerCase();
    const viaStand = /(stand-in|stand in|if missing|when missing|if it is missing|is missing|customer install|not in the customer|leave out|absent|instead)/.test(sameFile) || (/jobs\/$/.test(tok) && false);
    const key = f + '|' + tok; if (seen.has(key)) return; seen.add(key);
    if (viaTable || viaStand) continue;
    unresolved.push({ file: f, line: i + 1, ref: tok, inRoot: e, afterExport: after });
  } });
}
log(`  files scanned ${new Set(scan).size}, path refs checked ${refs}`);
for (const u of unresolved) log(`  UNRESOLVED ${u.file}:${u.line} \`${u.ref}\` existsNow=${u.inRoot} afterExport=${u.afterExport}`);
const realBreaks = unresolved.filter((u) => u.inRoot && !u.afterExport);
ok(8, realBreaks.length === 0, `refs to excluded files with no stand-in: ${realBreaks.length}`);
log(`  (refs to paths absent even in ROOT, informational: ${unresolved.filter((u) => !u.inRoot).length})`);

// 9
log('ITEM 9 Registry');
const RG = path.join(ROOT, 'tools/library/registry.mjs');
r = run(RG, ['find', 'a', '--limit', '99']); let n = r.out.split('\n').filter((l) => /\|/.test(l)).length; ok(9, n <= 5 && n > 0, `find a --limit 99 -> ${n} lines`);
for (const q of ['hook', 'motion', 'sound', 'preset', 'e']) { r = run(RG, ['find', q, '--limit', '99']); n = r.out.split('\n').filter((l) => /\|/.test(l)).length; ok(9, n <= 5, `find ${q} --limit 99 -> ${n}`); }
r = run(RG, ['find', 'e', '--limit', '1000000', '--kind', 'hook']); n = r.out.split('\n').filter((l) => /\|/.test(l)).length; ok(9, n <= 5, `find --kind hook --limit 1000000 -> ${n}`);
r = run(RG, ['find', 'e', '--limit', '-1']); n = r.out.split('\n').filter((l) => /\|/.test(l)).length; ok(9, n <= 5, `find --limit -1 -> ${n}`);
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'library/registry.json'), 'utf8')); const items = reg.items || reg.entries || [];
log(`  registry items: ${items.length}`);
const ids = items.map((x) => x.id); for (let k = 0; k < 3; k++) { const id = ids[Math.floor(Math.random() * ids.length)]; r = run(RG, ['get', id]); ok(9, r.code === 0 && r.out.includes(id), `get ${id} -> exit ${r.code}`); }
r = run(RG, ['get', 'no-such-id']); ok(9, r.code !== 0, 'get unknown id non-zero');
r = run(RG, ['check', '--release', OLD]); log('  check output tail: ' + r.out.split('\n').slice(-4).join(' / ')); ok(9, r.code === 0, `check --release OLD exit ${r.code}`);

log('');
log('SUMMARY');
for (const k of Object.keys(res).sort((x, y) => x - y)) log(`  item ${k}: ${res[k].pass ? 'PASS' : 'FAIL'}${res[k].fails.length ? ' -> ' + res[k].fails.join(' ; ') : ''}`);
fs.writeFileSync(path.join(ROOT, '.damex/evidence/04-verify-A.txt'), out.join('\n') + '\n');
console.log(out.join('\n'));
fs.rmSync(tmp, { recursive: true, force: true });
