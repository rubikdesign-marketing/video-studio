import type { PaperBlock, PaperCheck, PaperClip, PaperData, PaperWord } from '../../api';

export const keyOf = (clip: string, index: number) => `${clip}:${index}`;
/** A time in a clip as the old page shows it: 1:04.5 */
export const clock = (s: number) => { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; };
export const clipOf = (clips: PaperClip[], name: string) => clips.find((c) => c.name === name);
export const isFiller = (w: PaperWord) => w.filler === 'yes' || !!w.repeat;

/** Which takes the tool set aside, by "clip#sentence": "Take 2 of 3, the one proposed". */
export function takeLabels(data: PaperData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of data.paper.proposals.retakes ?? []) {
    r.takes.forEach((t, n) => { out[`${r.clip}#${t}`] = t === r.keep ? `Take ${n + 1} of ${r.takes.length}, the one proposed` : `Take ${n + 1} of ${r.takes.length}`; });
  }
  return out;
}

/** The start of a sentence in a few words, for labels: “This is the first…” */
export function excerpt(clips: PaperClip[], block: PaperBlock, words = 4): string {
  const clip = clipOf(clips, block.clip); const sentence = clip?.sentences[block.sentence] ?? [];
  const all = sentence.map((i) => clip?.words[i]?.text ?? '');
  const text = all.slice(0, words).join(' ').replace(/[,.;:!?]+$/, '');
  return `“${text}${all.length > words ? '…' : ''}”`;
}

/** Joins that are flagged and not yet approved. */
export const openJoins = (check: PaperCheck) => check.joins.filter((j) => j.flagged && !j.approved).length;

/** The length line: "About 12.4 s of 30 s · 2 joins to check". */
export function lengthLine(check: PaperCheck, target: number | null | undefined): { text: string; over: boolean } {
  const open = openJoins(check);
  const text = `About ${check.seconds.toFixed(1)} s${target ? ` of ${target} s` : ''}${open ? ` · ${open} join${open > 1 ? 's' : ''} to check` : ''}`;
  return { text, over: !!target && check.seconds > target };
}
