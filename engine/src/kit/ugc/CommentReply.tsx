// Comment reply: the question card a UGC film answers. A comment drops in at the top of the frame (a phone's
// "replying to a comment" bubble), holds while the film gives its answer, optionally shrinks to the top as the answer
// lands, and leaves. Everything is drawn here in plain 2D (HTML and SVG): no image, no emoji glyph, no WebGL.
// Time is the scene clock in seconds, so any frame renders alone and the same frame always renders the same.
import type { CSSProperties, FC } from 'react';
import { useVideoConfig } from 'remotion';
import { useBrand } from '../brand';
import { clamp01, easing, EXIT_SHARE, lerp, progress, useMotion } from '../motion';
import { voiceStyle } from '../moves/core';
import { alpha } from '../tokens';
import { useStage } from '../ui';

export type CommentReplyProps = {
  /** The question or comment, as written. Up to about 90 characters reads in three lines at the default size. */
  comment: string;
  /** The commenter's handle, with or without the @. */
  handle?: string;
  /** The small line above the card. Default "Replying to @handle". An empty string leaves it out. */
  label?: string;
  /** The number beside the heart. Leave out to show no heart. */
  likes?: string | number;
  /** Seconds on the scene clock when the card starts to arrive. */
  at?: number;
  /** Seconds of the arrival already elapsed at `at`, for a card that is part-way in on the film's first frame. */
  preroll?: number;
  /** Seconds when the card leaves. Leave out to hold to the end of the scene. */
  out?: number;
  /** Seconds when the card shrinks and moves to `dockY` (the answer lands). Leave out for a card that does not move. */
  dockAt?: number;
  /** Where the docked card's middle sits, as a share of the frame height. */
  dockY?: number;
  /** Seconds when the heart is tapped (it pops and fills). Leave out for no like. */
  likeAt?: number;
  /** The middle of the card as shares of the frame (0..1). */
  x?: number;
  y?: number;
  /** The comment's size as a per cent of the frame's SHORT side (default 5.6 in a tall or square frame, 4.6 in a wide one). */
  size?: number;
  /** Colours: the brand's stage by default (an inverse card), any six-digit colour to override. */
  fill?: string;
  ink?: string;
  accent?: string;
  style?: CSSProperties;
};

/** Up to two letters for the avatar, from the handle. */
const initialOf = (handle: string) => handle.replace(/^@/, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '?';

/** A heart drawn as one path, in a 24 unit box. */
const HEART = 'M12 21.2S3.4 15.9 2 9.9C1.2 6.4 3.4 3.6 6.5 3.6c2 0 3.7 1 5.5 3.2 1.8-2.2 3.5-3.2 5.5-3.2 3.1 0 5.3 2.8 4.5 6.3-1.4 6-10 11.3-10 11.3z';
/** A bent arrow (the reply mark), drawn as one stroked path in a 24 unit box. */
const REPLY = 'M9.5 5 4 10.5 9.5 16M4.5 10.5H14c3.6 0 6 2 6 5.5v2.5';

export const CommentReply: FC<CommentReplyProps> = ({ comment, handle = '@maya.runs', label, likes, at = 0, preroll = 0, out, dockAt, dockY = 0.12, likeAt, x = 0.5, y = 0.2, size, fill, ink, accent, style }) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const { width, height } = useVideoConfig();
  const short = Math.min(width, height);
  const cardFill = fill ?? stage.ink;
  const text = ink ?? stage.page;
  const hot = accent ?? stage.accent;
  const name = handle.startsWith('@') ? handle : `@${handle}`;
  const caption = label ?? `Replying to ${name}`;

  const wide = width > height;
  const cardW = Math.min(width * 0.88, short * (wide ? 0.8 : 0.95));
  const pad = cardW * 0.05;
  const avatar = cardW * 0.1;
  const radius = short * 0.04;

  const t = m.t + preroll;
  const enterOpacity = progress(t, at, at + m.seconds('quick'));
  const arrive = m.settle(at - preroll, 'scene');
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('quick') * EXIT_SHARE, easing.leave);
  const dock = dockAt === undefined ? 0 : progress(m.t, dockAt, dockAt + m.seconds('scene'), easing.travel);
  const scale = (0.88 + 0.12 * arrive) * lerp(1, 0.62, dock) * (1 - 0.04 * exit);
  const lift = (1 - arrive) * -short * 0.12 - exit * short * 0.05;
  const shiftY = lerp(0, (dockY - y) * height, dock);

  const k = likeAt === undefined ? 0 : clamp01((m.t - likeAt) / 0.3);
  const liked = likeAt === undefined ? 0 : progress(m.t, likeAt, likeAt + 0.1, easing.travel);
  const heartScale = 1 + 0.45 * Math.sin(Math.PI * k);

  return (
    <div style={{ position: 'absolute', left: width * x - cardW / 2, top: height * y, width: cardW, opacity: enterOpacity * (1 - exit), translate: `0 ${lift + shiftY}px`, scale: `${scale}`, transformOrigin: '50% 0%', ...style }}>
      <div style={{ boxSizing: 'border-box', padding: pad, borderRadius: radius, background: cardFill, boxShadow: `0 ${short * 0.012}px ${short * 0.05}px ${alpha(stage.shade, 0.4)}, 0 0 0 1px ${alpha(text, 0.08)}` }}>
        {caption ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: short * 0.012, marginBottom: pad * 0.5, ...voiceStyle(brand.fonts.label, short * 0.027), color: alpha(text, 0.62), whiteSpace: 'pre' }}>
            <svg width={short * 0.03} height={short * 0.03} viewBox="0 0 24 24" fill="none" stroke={alpha(text, 0.62)} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d={REPLY} />
            </svg>
            {caption}
          </div>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: avatar * 0.3, marginBottom: pad * 0.55 }}>
          <div style={{ width: avatar, height: avatar, borderRadius: '50%', background: hot, color: stage.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', ...voiceStyle(brand.fonts.headline, avatar * 0.5) }}>{initialOf(handle)}</div>
          <div style={{ flex: 1, ...voiceStyle(brand.fonts.label, avatar * 0.4), color: alpha(text, 0.62), whiteSpace: 'pre' }}>{name}</div>
          {likes !== undefined ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: avatar * 0.14, ...voiceStyle(brand.fonts.label, avatar * 0.36), color: alpha(text, 0.62), fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ position: 'relative', width: avatar * 0.5, height: avatar * 0.5, scale: `${heartScale}` }}>
                <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ position: 'absolute', inset: 0 }}>
                  <path d={HEART} fill="none" stroke={alpha(text, 0.5)} strokeWidth={2} strokeLinejoin="round" />
                </svg>
                <svg width="100%" height="100%" viewBox="0 0 24 24" style={{ position: 'absolute', inset: 0, opacity: liked }}>
                  <path d={HEART} fill={hot} stroke={hot} strokeWidth={2} strokeLinejoin="round" />
                </svg>
              </span>
              {likes}
            </div>
          ) : null}
        </div>
        <div style={{ ...voiceStyle(brand.fonts.product, (short * (size ?? (wide ? 4.6 : 5.6))) / 100), color: text, lineHeight: 1.18 }}>{comment}</div>
      </div>
    </div>
  );
};
