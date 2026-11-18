// Stream answer: an assistant's answer arriving in chunks of one to three words, each chunk fading in softly, with
// a small block cursor at the end. For showing a product that answers in words. Idea after Leonxlnx/cinetic,
// "AI text stream" (MIT).
import type { CSSProperties, FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { easing, progress, rng } from '../motion';
import { em, voiceStyle } from '../moves/core';
import { useStage, useVh } from '../ui';
import { caretOpacity } from './HumanType';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { splitText } from './split';

/**
 * Streams the lines in as one answer: each entry of `lines` is a paragraph, and the words wrap inside `width`
 * (a share of the frame width, at most a column about as wide as the frame is tall). Chunks of one to three words
 * (seeded) arrive a little apart and fade in over a quick length; the whole answer holds its place from the first
 * frame, so lines never re-wrap. A block cursor in the accent colour follows the last word, solid while chunks
 * land and blinking softly (never fully off) while it waits. Paragraphs wrap balanced, so no line is left with a single word. Set in the product voice; `size` is smaller than headline type (default 3.8, lifted by a third in square-ish frames).
 */
export const StreamAnswer: FC<TextMoveProps & { width?: number; seed?: number }> = ({ lines, at, out, size = 3.8, align = 'left', colours, style, width = 0.82, seed = 11 }) => {
  const clock = useTextClock(at, out, 'word');
  const { m } = clock;
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const { width: frameWidth, height } = useVideoConfig();
  const split = splitText(asLines(lines));
  const { accent } = brand.fonts;

  // Chunk number of every word, and when each chunk lands.
  const random = rng(seed);
  const chunkOf: number[] = [];
  const landsAt: number[] = [];
  let clockT = at;
  for (let w = 0, c = 0; w < split.words; c += 1) {
    const take = Math.min(split.words - w, 1 + Math.floor(random() * 3));
    for (let k = 0; k < take; k += 1) chunkOf[w + k] = c;
    landsAt[c] = clockT;
    clockT += m.seconds('tick') * (1.2 + 1.0 * random()) + take * m.seconds('tick') * 0.6;
    w += take;
  }
  const shownChunks = landsAt.filter((when) => when <= m.t).length;
  const lastLanded = shownChunks === 0 ? at - m.seconds('quick') : landsAt[shownChunks - 1];
  const cursor = (0.4 + 0.6 * caretOpacity(m.t - lastLanded, m.seconds('tick') * 2, m.seconds('hero') * 0.6)) * progress(m.t, at - m.seconds('quick'), at);
  const lastWord = chunkOf.lastIndexOf(shownChunks - 1);

  const column = Math.min(frameWidth * width, height * 1.1);
  // Square-ish frames are as high as they are wide, so the same share of height reads small: lift it there.
  const lift = frameWidth / height > 1.5 ? 1 : frameWidth / height > 0.7 ? 1.3 : 1;
  const box: CSSProperties = { ...voiceStyle(brand.fonts.product, vh(size * lift)), width: column, textAlign: align, opacity: 1 - clock.exit, ...style };
  const roles = colours ?? ['ink'];
  return (
    <div style={box}>
      {split.lines.map((line, li) => (
        <p key={li} style={{ margin: 0, textWrap: 'balance', marginTop: li === 0 ? 0 : '0.7em', color: stage[roles[Math.min(li, roles.length - 1)]] }}>
          {line.words.map((w, wi) => {
            const joined = wi > 0 && w.word === line.words[wi - 1].word;
            const u = progress(m.t, landsAt[chunkOf[w.word]], landsAt[chunkOf[w.word]] + m.seconds('base'), easing.arrive);
            const accentStyle: CSSProperties = w.accent ? { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale) } : {};
            const lastPart = wi === line.words.length - 1 || line.words[wi + 1].word !== w.word;
            const here = shownChunks === 0 ? li === 0 && wi === 0 : w.word === lastWord && lastPart;
            const block = (
              <span style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: shownChunks === 0 ? 0 : '0.2em', top: '0.12em', width: '0.45em', height: '0.85em', background: stage.accent, opacity: cursor }} />
              </span>
            );
            return (
              <span key={wi}>
                {wi > 0 && !joined ? ' ' : null}
                <span style={{ whiteSpace: 'nowrap' }}>
                  {shownChunks === 0 && here ? block : null}
                  <span style={{ display: 'inline', opacity: u, ...accentStyle }}>{w.text}</span>
                  {shownChunks > 0 && here ? block : null}
                </span>
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
};
