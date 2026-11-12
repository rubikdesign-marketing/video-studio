// Lift: a card rises off the surface. It grows 2 to 3%, and its shadow grows, softens and moves away from the light.
import type { CSSProperties, FC, ReactNode } from 'react';
import { useBrand } from '../brand';
import { EXIT_SHARE, lerp, progress, useMotion } from '../motion';
import { alpha } from '../tokens';
import { useStage, useVh } from '../ui';
import { isDarkPage, lightOf } from './core';

/** How much larger the card is at full height. */
const GROW = 0.025;
/** How far it rises, as a percentage of frame height. */
const RISE = 0.7;
/** The shadow at rest and at full height: drop and blur as percentages of frame height, then strength. */
const SHADOW = { rest: { drop: 1, blur: 3, strength: 0.25 }, up: { drop: 3.4, blur: 6, strength: 0.2 } } as const;
/**
 * On a dark page a shadow hardly shows, so height is read from light: the lifted card catches light along its
 * top edge and all round its rim, and a soft glow of the accent spreads under it. Strengths at full height, and
 * the spread of the glow as a percentage of frame height.
 */
const LIT = { edge: 0.55, rim: 0.22, glow: 0.3, spread: 7 } as const;

/**
 * Wraps a card and lifts it at `at`; with `out` it is set down again, in less time. The card rises first, then
 * grows, and its shadow follows last. `radius` is the corner radius of the card as a percentage of frame height,
 * so the shadow has the card's shape (the brand's window radius if left out). The card's text is never scaled
 * while it is read: the growth is over within a `base` length and the card holds still at its new size.
 */
export const Lift: FC<{ children: ReactNode; at: number; out?: number; radius?: number; style?: CSSProperties }> = ({
  children,
  at,
  out,
  radius,
  style,
}) => {
  const m = useMotion();
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const base = m.seconds('base');
  const down = out === undefined ? 0 : progress(m.t, out, out + base * EXIT_SHARE);
  // What the card carries lands a stagger behind it: the rise, then the growth, then the shadow.
  const risen = m.settle(at) * (1 - down);
  const grown = m.settle(at + m.stagger) * (1 - down);
  const shaded = progress(m.t, at + m.stagger * 2, at + m.stagger * 2 + base) * (1 - down);
  const { rest, up } = SHADOW;
  const dark = isDarkPage(stage);
  const light = lightOf(brand);
  const shadow = [
    `0 ${vh(lerp(rest.drop, up.drop, shaded))}px`,
    `${vh(lerp(rest.blur, up.blur, shaded))}px`,
    alpha(stage.shade, lerp(rest.strength, up.strength, shaded)),
  ].join(' ');
  const glow = `0 ${vh(lerp(rest.drop, up.drop, shaded))}px ${vh(LIT.spread * shaded)}px ${alpha(stage.accent, LIT.glow * shaded)}`;
  const round = vh(radius ?? brand.shape.window);
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: round,
        boxShadow: dark ? `${glow}, ${shadow}` : shadow,
        translate: `0 ${-risen * vh(RISE)}px`,
        scale: `${1 + grown * GROW}`,
        ...style,
      }}
    >
      {children}
      {dark && shaded > 0 ? (
        // The light the card catches sits over it: a bright line along the top edge and a fainter one all round.
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: round,
            pointerEvents: 'none',
            boxShadow: `inset 0 1px 0 ${alpha(light, LIT.edge * shaded)}, inset 0 0 0 1px ${alpha(light, LIT.rim * shaded)}`,
          }}
        />
      ) : null}
    </div>
  );
};
