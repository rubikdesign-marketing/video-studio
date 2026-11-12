// Sound from the event log (CAPTURE-PLAN 7.8 and the 7.9 "Sounds tied to events"): where each of the brand's named
// sounds goes in a capture clip, on the film's clock, through the same time map the picture uses, so a click sounds
// on the frame the button goes down even after a speed ramp, a jump or a pin. Pure: no React, no Remotion.
//
// The sounds themselves are the brand's sound kit, one file per slot in brands/<brand>/sounds/<slot>.mp3, made once
// with the studio's sound tool after the owner says yes to the paid call. A slot with no file is left out and listed
// as missing; nothing is fetched or generated here. Levels follow knowledge/craft/07-sound.md: every effect between
// a third and two thirds of the voice, and no two sounds of the same kind within 0.3 s.
import type { CapturePlan } from './plan';
import type { CaptureCursor, CaptureTracks } from './data';
import { targetRect, type Emphasis } from './glue';

export const soundSlots = {
  'soft-click': { layer: 'interface', gain: 0.36, about: 'A soft, dry click for a calm or confident film.' },
  'crisp-click': { layer: 'interface', gain: 0.36, about: 'A short, crisp click for a hype film.' },
  'soft-keyboard': { layer: 'interface', gain: 0.34, about: 'One soft key tap.' },
  'crisp-keyboard': { layer: 'interface', gain: 0.34, about: 'One crisp key tap, for a hype film.' },
  'small-whoosh': { layer: 'movement', gain: 0.42, about: 'A small airy whoosh for a cut or jump inside a shot.' },
  'large-whoosh': { layer: 'movement', gain: 0.5, about: 'A larger whoosh for a scene change in a hype film.' },
  'success-chime': { layer: 'interface', gain: 0.46, about: 'A short, warm confirm when a result lands.' },
  'toast-pop': { layer: 'interface', gain: 0.4, about: 'A light pop as the product shows a message.' },
  'drag-lift': { layer: 'interface', gain: 0.36, about: 'A soft lift as a drag starts.' },
  'drag-drop': { layer: 'interface', gain: 0.38, about: 'A soft drop as a drag lets go.' },
} as const;
export type SoundSlot = keyof typeof soundSlots;

/** One placed sound: which slot, when (film seconds) and how loud (share of the voice), and what on screen causes it. */
export type SoundCue = { slot: SoundSlot; at: number; gain: number; cause: string };

export type SoundOptions = {
  /** Film seconds where the clip starts in the film (the plan's own clock starts at 0). */
  offset?: number;
  energy?: 'calm' | 'confident' | 'hype';
  /** The clip's product animations: a toast pop and a success moment have their own sounds. */
  emphasis?: Emphasis[];
  /** Film seconds (on the clip's clock) of scene changes, for a whoosh that peaks on the change. */
  sceneChanges?: number[];
  /** Recording seconds when a result lands (the moment to confirm), for a success chime. */
  results?: number[];
  tracks?: CaptureTracks;
};

/** No two sounds of the same kind closer than this (craft file 07). */
export const SAME_KIND_GAP = 0.3;
/** A whoosh starts this early, so it peaks on the change (craft file 07: 150 to 200 ms). */
export const WHOOSH_LEAD = 0.17;
export const GAIN_RANGE = [1 / 3, 2 / 3] as const;

/** Every sound a capture clip's events call for, in film order, thinned so no slot repeats within 0.3 s. */
export const planSounds = (cursor: CaptureCursor, plan: CapturePlan, options: SoundOptions = {}): SoundCue[] => {
  const { map, from, to, pointer } = plan;
  const offset = options.offset ?? 0;
  const hype = options.energy === 'hype';
  const raw: SoundCue[] = [];
  const inClip = (r: number) => r >= from - 1e-6 && r <= to + 1e-6;
  const put = (slot: SoundSlot, filmTime: number, cause: string) => {
    if (filmTime < -1e-6 || filmTime > map.duration + 1e-6) return;
    raw.push({ slot, at: +(offset + Math.max(0, filmTime)).toFixed(3), gain: soundSlots[slot].gain, cause });
  };
  const everywhere = (slot: SoundSlot, r: number, cause: string) => {
    if (!inClip(r)) return;
    for (const ft of map.filmTimesOf(r)) put(slot, ft, cause);
  };

  pointer.clicks.forEach((c, i) => everywhere(hype ? 'crisp-click' : 'soft-click', c.t, `click ${i + 1}`));
  for (const e of cursor.events) {
    if (e.type === 'type' || e.type === 'paste') {
      const keys = e.type === 'type' && Array.isArray(e.keys) ? (e.keys as number[]) : [e.t];
      for (const k of keys) everywhere(hype ? 'crisp-keyboard' : 'soft-keyboard', k, `typing "${(e.text ?? '').slice(0, 24)}"`);
    }
    if (e.type === 'press') everywhere(hype ? 'crisp-keyboard' : 'soft-keyboard', e.t, `key ${e.key ?? ''}`);
    if (e.type === 'drag') {
      everywhere('drag-lift', e.t, 'drag starts');
      if (e.end !== undefined) everywhere('drag-drop', e.end, 'drag lets go');
    }
  }
  // Jumps inside the shot: a small whoosh peaking on the cut.
  for (const cut of map.cuts) put('small-whoosh', cut - WHOOSH_LEAD, 'jump in time');
  for (const change of options.sceneChanges ?? []) put(hype ? 'large-whoosh' : 'small-whoosh', change - WHOOSH_LEAD, 'scene change');
  for (const r of options.results ?? []) everywhere('success-chime', r, 'a result lands');
  for (const e of options.emphasis ?? []) {
    if (e.kind === 'success') put('success-chime', e.at, 'success moment');
    if (e.kind === 'toast') {
      let at = e.at;
      if (at < 0) {
        const fps = options.tracks?.fps ?? 60;
        at = -1;
        for (let r = from; r <= to; r += 1 / fps)
          if (targetRect(options.tracks, e.target, r)) {
            at = map.filmAt(r);
            break;
          }
      }
      if (at >= 0) put('toast-pop', at, 'the product shows a message');
    }
  }

  raw.sort((a, b) => a.at - b.at);
  const last = new Map<SoundSlot, number>();
  return raw.filter((cue) => {
    const before = last.get(cue.slot);
    if (before !== undefined && cue.at - before < SAME_KIND_GAP) return false;
    last.set(cue.slot, cue.at);
    return true;
  });
};
