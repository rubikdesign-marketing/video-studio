// Fill the frame: each word of the line is set so large it touches the frame's edges, and the words replace one
// another on a beat, then the whole line settles. A kinetic-type opener with no footage.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, lerp, progress, useMotion } from '../motion';
import { em, voiceStyle } from '../moves/core';
import { useStage } from '../ui';
import { Centred, HookText, Opener, useHookLayout, wordWidth, type HookPart, type OpenerProps } from './core';

const parse = (line: string) =>
  line
    .split(' ')
    .filter(Boolean)
    .map((raw) => {
      const found = /^\*(.+?)\*(.*)$/.exec(raw);
      const parts: HookPart[] = found ? [{ text: found[1], accent: true }, ...(found[2] ? [{ text: found[2], accent: false }] : [])] : [{ text: raw, accent: false }];
      return parts;
    });

/**
 * One word at a time, each cut in hard and sized to fill the frame's width (and no taller than 55% of its height),
 * with the starred word on an accent fill (the one colour change; every other word is ink on the page); after the last word the full line holds. Every cut is a
 * planned instant change; only the starred word swaps the page for the accent colour, once, so it cannot strobe.
 * Sound: a tick or impact on every word, a riser underneath.
 * Props: `line`, `beat` (seconds a word stays, default a base length), `at`, `out`, `next`, `size`.
 */
export const FillFrame: FC<OpenerProps & { line: string; beat?: number }> = ({ line, beat, at = 0, out, next, size, style }) => {
  const m = useMotion();
  const stage = useStage();
  const { headline, accent } = useBrand().fonts;
  const { width, height } = useVideoConfig();
  const t = m.t - at;
  const words = parse(line);
  const hold = beat ?? m.seconds('base') * 1.05;
  const layout = useHookLayout(line, { size: size ?? 14.5 });
  const all = words.length * hold;
  const index = Math.min(words.length - 1, Math.floor(Math.max(0, t) / hold));
  const full = t >= all;
  const word = words[index];
  const px = Math.min((width * 0.92 * 100) / wordWidth(word, headline, accent, 100), height * 0.55);
  const into = (t - index * hold) / hold;
  const onAccent = word.some((p) => p.accent);
  const settle = progress(t, all, all + m.seconds('base'), easing.arrive);
  return (
    <Opener out={out} next={next} style={style}>
      {full || !onAccent ? null : <div style={{ position: 'absolute', inset: 0, background: stage.accent }} />}
      <Centred>
        {full ? (
          <div style={{ scale: String(lerp(1.06, 1, settle)) }}>
            <HookText layout={layout} />
          </div>
        ) : (
          <div style={{ ...voiceStyle(headline, px), color: onAccent ? stage.onAccent : stage.ink, textAlign: 'center', whiteSpace: 'pre', scale: String(1 + 0.05 * into) }}>
            {word.map((p, i) => (
              <span key={i} style={p.accent ? { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale), lineHeight: 0 } : undefined}>
                {p.text}
              </span>
            ))}
          </div>
        )}
      </Centred>
    </Opener>
  );
};
