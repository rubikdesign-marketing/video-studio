// Word morph: one word becomes another in the same place. The old one blurs and shrinks away while the new one
// blurs in, overlapping, and the space between them changes width smoothly so the words around never jump.
import { measureText } from '@remotion/layout-utils';
import type { CSSProperties, FC } from 'react';
import { useBrand, useFontsLoaded } from '../brand';
import { easing, EXIT_SHARE, lerp, progress, useMotion } from '../motion';
import { em, voiceStyle } from '../moves/core';
import { useStage } from '../ui';
import { useFitSize } from './split';
import type { TextMoveProps } from './core';

/**
 * `lines` are the words, in order: the first appears on `at`, and each later one replaces the one before at its
 * time in `swaps` (seconds; default every 1.4 s after `at`). `before` and `after` are fixed text on either side
 * ("Pay in" ... "."); they glide to follow the width of the changing word. A starred word (`*word*`) is in the
 * accent voice. Blur belongs to the swap only: a word at rest is sharp.
 */
export const WordMorph: FC<Omit<TextMoveProps, 'align'> & { before?: string; after?: string; swaps?: number[] }> = ({
  lines,
  at,
  out,
  size = 9,
  colours,
  style,
  before = '',
  after = '',
  swaps,
}) => {
  const m = useMotion();
  const brand = useBrand();
  // measureText remembers what it measured, so a width taken before the brand's fonts arrive would stay wrong:
  // asking again with a different (harmless) style once they have arrived gives a fresh measure.
  const loaded = useFontsLoaded();
  const stage = useStage();
  const words = (typeof lines === 'string' ? [lines] : lines).map((raw) => ({ text: raw.replace(/\*/g, ''), accent: raw.startsWith('*') }));
  const { headline, accent } = brand.fonts;
  const fontSize = useFitSize([`${before} ${words.reduce((a, w) => (w.text.length > a.length ? w.text : a), '')} ${after}`.trim()], size);
  const widthOf = (text: string, accented: boolean) => {
    const voice = accented ? accent : headline;
    return measureText({
      text,
      fontFamily: voice.css,
      fontSize: accented ? fontSize * accent.scale : fontSize,
      fontWeight: String(voice.weight),
      additionalStyles: { fontStyle: voice.style, fontKerning: loaded ? 'normal' : 'auto' },
      letterSpacing: (voice.tracking ?? headline.tracking) === undefined ? undefined : `${voice.tracking ?? headline.tracking}em`,
    }).width;
  };
  const space = Math.max(widthOf('a a', false) - widthOf('aa', false), fontSize * 0.24);
  const length = m.seconds('base');
  const times = words.map((_, i) => (i === 0 ? at : (swaps?.[i - 1] ?? at + i * 1.4)));
  // 0 to 1 for each swap; `index` is the word that has become current.
  const steps = words.map((_, i) => (i === 0 ? progress(m.t, at, at + m.seconds('quick')) : progress(m.t, times[i], times[i] + length, easing.arrive)));
  const exit = out === undefined ? 0 : progress(m.t, out, out + length * EXIT_SHARE, easing.leave);
  // The box is as wide as the old word, then the new one, by the progress of the swap in progress.
  let box = widthOf(words[0].text, words[0].accent);
  for (let i = 1; i < words.length; i++) box = lerp(box, widthOf(words[i].text, words[i].accent), steps[i]);
  const blurMax = fontSize * 0.14;
  const wordStyle = (i: number): CSSProperties => {
    const incoming = steps[i];
    const outgoing = i + 1 < words.length ? steps[i + 1] : 0;
    const seen = (i === 0 ? incoming : progress(incoming, 0.15, 0.8)) * (1 - progress(outgoing, 0, 0.7));
    const blur = (i === 0 ? 0 : (1 - incoming) * blurMax) + outgoing * blurMax;
    const grow = i === 0 ? 1 : lerp(1.1, 1, incoming);
    const shrink = lerp(1, 0.84, outgoing);
    return {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      textAlign: 'center',
      whiteSpace: 'pre',
      opacity: seen * (1 - exit),
      filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
      scale: `${grow * shrink}`,
      translate: `0 ${exit * 0.3}em`,
      ...(words[i].accent ? { fontFamily: accent.css, fontStyle: accent.style, fontWeight: accent.weight, fontSize: em(accent.scale) } : {}),
    };
  };
  const side = (shown: number): CSSProperties => ({ whiteSpace: 'pre', opacity: shown * (1 - exit), translate: `0 ${(1 - shown + exit * 0.4) * 0.2}em` });
  const roles = colours ?? [];
  const lineHeight = headline.lineHeight ?? 1.1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', color: stage[roles[0] ?? 'ink'], height: `${lineHeight}em`, ...voiceStyle(headline, fontSize), ...style }}>
      {before ? <span style={side(steps[0])}>{before}</span> : null}
      <span style={{ position: 'relative', flex: 'none', width: box + (before ? space : 0) + (after ? 0 : 0), height: '100%', marginLeft: before ? 0 : 0 }}>
        {words.map((w, i) => (
          <span key={i} style={{ ...wordStyle(i), left: before ? space : 0 }}>
            {w.text}
          </span>
        ))}
      </span>
      {after ? <span style={side(steps[0])}>{after}</span> : null}
    </div>
  );
};
