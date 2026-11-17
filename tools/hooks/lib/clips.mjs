// The gate on Viral Hooks clips (LIBRARY-PLAN.md decision 1). viralhooks.org offers short viral clips free to
// download, but names no owner, source or licence for any of them and says nothing about ads. So a clip may open a
// film only for an organic post, on the owner's own decision for that clip, and that decision is written down beside
// the file. Never for a paid ad, never kept in the studio's repository (jobs/ is not synced). Pure, apart from
// checkJob reading a folder.
import fs from 'node:fs';
import path from 'node:path';

// Words that mean a paid placement, matched on whole words after splitting on anything that is not a letter or a
// figure ("reels_ad", "paid-social" and "Meta ads" all count; "add" and "upload" do not).
const PAID_WORDS = /^(ad|ads|adset|adsets|advert|adverts|advertising|advertisement|advertisements|paid|sponsored|boost|boosted|ppc|cpc|cpm)$/i;
// The fields of a job that say where a film goes or what it is for, at any depth.
const PLACEMENT_KEY = /type|kind|channel|placement|purpose|platform|objective|campaign|distribution|post|usage|format/i;
const paidWord = (value) => String(value).split(/[^\p{L}\p{N}]+/u).find((w) => PAID_WORDS.test(w));

/** The first field of a job that says it is paid: { key, value }, or null. */
export function paidField(job, trail = '') {
  if (!job || typeof job !== 'object') return null;
  for (const [k, v] of Object.entries(job)) {
    const key = trail ? `${trail}.${k}` : k;
    if (v && typeof v === 'object') { const inner = paidField(v, PLACEMENT_KEY.test(k) ? `${key}(placement)` : key); if (inner) return inner; continue; }
    if ((PLACEMENT_KEY.test(k) || /\(placement\)/.test(trail)) && (typeof v === 'string' || typeof v === 'number') && paidWord(v)) return { key: key.replace(/\(placement\)/g, ''), value: String(v) };
  }
  return null;
}

/** The clip's short name from its page or file address on viralhooks.org, or null when it is not one. */
export function slugOf(url) {
  const m = String(url).match(/^https:\/\/viralhooks\.org\/(?:hook\/([a-z0-9-]+)\/?|hooks\/([a-z0-9-]+)\.mp4)$/);
  return m ? m[1] || m[2] : null;
}
export const pageOf = (slug) => `https://viralhooks.org/hook/${slug}/`;
export const fileOf = (slug) => `https://viralhooks.org/hooks/${slug}.mp4`;

/** Whether this job may use a clip at all. job: its job.json (or {}); post: what the film is for. */
export function mayUse(job, { post, approvedBy, words } = {}) {
  if (post !== 'organic') return { ok: false, why: 'A Viral Hooks clip is only for an organic post (--post organic): its rights are not stated, so never a paid ad.' };
  const paid = paidField(job);
  if (paid) return { ok: false, why: `This job's ${paid.key} is "${paid.value}": a Viral Hooks clip may not be used in a paid ad.` };
  if (!String(approvedBy || '').trim()) return { ok: false, why: 'Say who decided (--approved-by "<name>"): the owner decides for each clip.' };
  if (!String(words || '').trim()) return { ok: false, why: 'Give the owner\'s own words for this clip (--words "<what they said>").' };
  return { ok: true, why: '' };
}

export function rightsRecord({ slug, approvedBy, words, post, date }) {
  return {
    clip: slug, page: pageOf(slug), file: fileOf(slug), source: 'viralhooks.org',
    licence: 'none stated: the site names no owner, source or licence for its clips, and its terms do not cover ads',
    post, approved_by: approvedBy, owner_words: words, decided: date,
    checks_for_a_person: ['no child and no recognisable private person in the clip', 'no other creator\'s captions or logo burned in', 'not presented as something the brand filmed'],
  };
}

export const creditLine = (r) => `- Opening clip "${r.clip}" from viralhooks.org (${r.page}). No licence is stated for it; used for an organic post on ${r.approved_by}'s decision of ${r.decided}.`;

/** Every clip in jobs/<job>/media/viralhooks/ must have its decision beside it. Returns the problems. */
export function checkJob(dir) {
  const folder = path.join(dir, 'media', 'viralhooks');
  if (!fs.existsSync(folder)) return [];
  const problems = [];
  const jobFile = path.join(dir, 'job.json');
  let job = {};
  if (fs.existsSync(jobFile)) { try { job = JSON.parse(fs.readFileSync(jobFile, 'utf8')); } catch { problems.push('job.json cannot be read, so the job cannot be checked for paid use'); } }
  const paid = paidField(job);
  for (const f of fs.readdirSync(folder).filter((n) => /\.(mp4|mov|m4v|webm)$/i.test(n))) {
    if (paid) problems.push(`${f}: this job's ${paid.key} is "${paid.value}", and a Viral Hooks clip may not be in a paid ad`);
    const rec = path.join(folder, f.replace(/\.[^.]+$/, '.rights.json'));
    if (!fs.existsSync(rec)) { problems.push(`${f}: no decision recorded beside it (use tools/hooks/clips.mjs use, which asks for the owner's words)`); continue; }
    let r; try { r = JSON.parse(fs.readFileSync(rec, 'utf8')); } catch { problems.push(`${f}: its decision file cannot be read`); continue; }
    if (r.clip !== f.replace(/\.[^.]+$/, '')) problems.push(`${f}: the decision beside it is for another clip ("${r.clip}")`);
    if (r.post !== 'organic') problems.push(`${f}: recorded for "${r.post}", but a clip is only for an organic post`);
    if (!r.approved_by || !r.owner_words) problems.push(`${f}: the decision does not say who decided, in their words`);
  }
  return problems;
}
