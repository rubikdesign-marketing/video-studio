// Giant crop: one word so large the frame crops it, rising slowly through the frame as a statement backdrop.
// Sized from the frame's width, so it is cropped the same way in every size.
import { measureText } from '@remotion/layout-utils';
import type { CSSProperties, FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { em, voiceStyle } from '../moves/core';
import { easing, EXIT_SHARE, progress, useMotion } from '../motion';
import { useStage } from '../ui';
import { asLines, type TextMoveProps } from './core';

/** How wide the word is set, as a share of the frame width. Over 1, so both ends are cut; kept low enough to read. */
const SPAN = 1.16;
/** Where it starts, and how far it rises, as a share of the frame height. */
const FROM = 0.32;
const RISE = 0.5;

/**
 * One word (the first of `lines`; extra lines are ignored) set so its width is `span` times the frame's width,
 * whatever the word and the size, so the frame crops its ends alike in 16:9, 9:16, 1:1 and 4:5. It fades in
 * quickly low in the frame and rises slowly (a `hero` length, twice) while it holds; the exit carries it on up and
 * out. `strength` is its opacity: lower it to make a backdrop for other type. `size` and `align` are not used.
 */
export const GiantCrop: FC<Omit<TextMoveProps, 'size' | 'align'> & { span?: number; strength?: number }> = ({ lines, at, out, colours, style, span = SPAN, strength = 1 }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const { width, height } = useVideoConfig();
  const text = asLines(lines)[0].replace(/\*/g, '');
  const voice = brand.fonts.headline;
  const probe = 100;
  const wide = measureText({ text, fontFamily: voice.css, fontSize: probe, fontWeight: String(voice.weight), letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em` }).width;
  const fontSize = (probe * width * span) / Math.max(1, wide);
  const rise = progress(m.t, at, at + m.seconds('hero') * 2, easing.arrive);
  const seen = progress(m.t, at, at + m.seconds('base'));
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('scene') * EXIT_SHARE, easing.leave);
  const place: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };
  return (
    <div style={place}>
      <div
        style={{
          ...voiceStyle(voice, fontSize),
          lineHeight: 1,
          whiteSpace: 'nowrap',
          flex: 'none',
          color: stage[(colours ?? ['ink'])[0]],
          opacity: seen * (1 - exit) * strength,
          translate: `0 ${(FROM * (1 - rise) - RISE * 0.12 * exit - 0.0) * height}px`,
          letterSpacing: em(voice.tracking),
          ...style,
        }}
      >
        {text}
      </div>
    </div>
  );
};
