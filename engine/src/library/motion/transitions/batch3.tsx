// Transitions batch 3: the 3D, noise and brand transitions. Each scene shows its move once, between two small
// product scenes, with the text of each side held long enough to read. Sizes go through `useShort`, so a card
// that fits a wide frame also fits a tall one.
import type { FC } from 'react';
import { useVideoConfig } from 'remotion';
import { CardFlip } from '../../../kit/transitions/CardFlip';
import { CubeTurn } from '../../../kit/transitions/CubeTurn';
import { LogoMaskWipe } from '../../../kit/transitions/LogoMaskWipe';
import { LumaDissolve } from '../../../kit/transitions/LumaDissolve';
import { PageTurn } from '../../../kit/transitions/PageTurn';
import { PixelateThrough } from '../../../kit/transitions/PixelateThrough';
import { TileReveal } from '../../../kit/transitions/TileReveal';
import { TitleTakeover } from '../../../kit/transitions/TitleTakeover';
import { Wordmark } from '../../../kit/ui';
import { Arrive, Card, Centre, Line, row } from '../parts';
import type { SizedDemo } from '../sized';

/** A size given as a percentage of the frame's shorter side, turned into the percentage of frame height the kit takes. */
const useShort = () => {
  const { width, height } = useVideoConfig();
  return (percent: number) => (percent * Math.min(width, height)) / height;
};
/**
 * A label's size: the same share of the short side, but never below 3.8% of frame height, so its capitals are at
 * least the studio's 2.6% minimum in every size (a tall frame would otherwise shrink it to about 2%).
 */
const LABEL_FLOOR = 3.8;
const useLabel = () => {
  const s = useShort();
  return (percent: number) => Math.max(s(percent), LABEL_FLOOR);
};
const usePx = () => {
  const { width, height } = useVideoConfig();
  return (percent: number) => (percent * Math.min(width, height)) / 100;
};

/** One figure on a card: what it counts, the number, and a note that lands after. */
const Figure: FC<{ label: string; value: string; note?: string; noteAt?: number; at?: number; accent?: boolean }> = ({ label, value, note, noteAt, at, accent }) => {
  const s = useShort();
  const lab = useLabel();
  const px = usePx();
  return (
    <Centre>
      <Card at={at} style={{ alignItems: 'flex-start', minWidth: px(62) }}>
        <Line voice="label" size={lab(4)} colour="second">
          {label}
        </Line>
        <Line voice="label" size={s(17)} colour={accent ? 'accent' : 'ink'} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Line>
        {note ? (
          <Line voice="label" size={lab(4)} colour="accent" at={noteAt}>
            {note}
          </Line>
        ) : null}
      </Card>
    </Centre>
  );
};

/** A headline with a small label above it. */
const Title: FC<{ kicker: string; lines: string[]; at?: number; kickerAt?: number }> = ({ kicker, lines, at, kickerAt }) => {
  const s = useShort();
  const lab = useLabel();
  return (
    <Centre gap={s(2.4)}>
      <Line voice="label" size={lab(4)} colour="second" at={kickerAt ?? at}>
        {kicker}
      </Line>
      {lines.map((line, i) => (
        <Line key={line} size={s(10)} colour={i === 0 ? 'ink' : 'second'} at={at}>
          {line}
        </Line>
      ))}
    </Centre>
  );
};

// ---------------------------------------------------------------- cube turn

const CubeTurnScene: FC = () => (
  <CubeTurn at={1.5} next={<Figure label="Invoices sent" value="312" note="Paid within 7 days" noteAt={1.2} />}>
    <Figure label="Orders this month" value="1,840" at={0.2} />
  </CubeTurn>
);

// ---------------------------------------------------------------- card flip

const CardFlipScene: FC = () => (
  <CardFlip at={1.6} next={<Title kicker="The answer" lines={['Under four', 'minutes.']} kickerAt={1.2} />}>
    <Title kicker="Question" lines={['How long does', 'packing take?']} at={0.2} />
  </CardFlip>
);

// ---------------------------------------------------------------- page turn

const PageTurnScene: FC = () => (
  <PageTurn at={1.5} next={<Title kicker="Chapter 2" lines={['Your first order']} kickerAt={1.2} />}>
    <Title kicker="Chapter 1" lines={['Getting set up']} at={0.2} />
  </PageTurn>
);

// ---------------------------------------------------------------- tile reveal

const Month: FC<{ month: string; orders: string; sent: string; at?: number }> = ({ month, orders, sent, at }) => {
  const s = useShort();
  const lab = useLabel();
  const px = usePx();
  return (
    <Centre gap={s(4)}>
      <Line size={s(11)} at={at}>
        {month}
      </Line>
      <Arrive at={at ?? 0} style={row(px(3))}>
        {[
          ['Orders', orders],
          ['Sent', sent],
        ].map(([label, value]) => (
          <Card key={label} width={s(34)}>
            <Line voice="label" size={lab(3.6)} colour="second">
              {label}
            </Line>
            <Line voice="label" size={s(9)} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </Line>
          </Card>
        ))}
      </Arrive>
    </Centre>
  );
};

const TileRevealScene: FC = () => (
  <TileReveal at={1.6} next={<Month month="November" orders="2,115" sent="2,090" />}>
    <Month month="October" orders="1,840" sent="1,812" at={0.2} />
  </TileReveal>
);

// ---------------------------------------------------------------- pixelate through

const PixelateThroughScene: FC = () => (
  <PixelateThrough at={1.5} next={<Figure label="Version 2.0" value="2x faster" note="Live for every team" noteAt={1.1} accent />}>
    <Figure label="Version 1.0" value="1,840 ms" at={0.2} />
  </PixelateThrough>
);

// ---------------------------------------------------------------- luma dissolve

const LumaDissolveScene: FC = () => (
  <LumaDissolve at={1.5} next={<Figure label="5:00 pm" value="All sent" note="12 of 12 orders" noteAt={1.3} accent />}>
    <Figure label="9:00 am" value="12 waiting" at={0.2} />
  </LumaDissolve>
);

// ---------------------------------------------------------------- title takeover

const TitleTakeoverScene: FC = () => (
  <TitleTakeover at={1.4} word="Reports" next={<Figure label="This week" value="96 sent" note="Up 12% on last week" noteAt={1.3} />}>
    <Figure label="Orders today" value="128" at={0.2} />
  </TitleTakeover>
);

// ---------------------------------------------------------------- logo mask wipe

const Closing: FC = () => {
  const s = useShort();
  const lab = useLabel();
  return (
    <Centre gap={s(5)}>
      <Wordmark height={s(9)} />
      <Line voice="label" size={lab(4.4)} colour="second" at={1.4}>
        Every order, in one place
      </Line>
    </Centre>
  );
};

const LogoMaskWipeScene: FC = () => (
  <LogoMaskWipe at={1.5} next={<Closing />}>
    <Title kicker="Start today" lines={['Ship it', 'on time.']} at={0.2} />
  </LogoMaskWipe>
);

export const batch3: SizedDemo[] = [
  { name: 'cube-turn', title: 'Cube turn', seconds: 4, Scene: CubeTurnScene },
  { name: 'card-flip', title: 'Card flip', seconds: 4.2, Scene: CardFlipScene },
  { name: 'page-turn', title: 'Page turn', seconds: 4.2, Scene: PageTurnScene },
  { name: 'tile-reveal', title: 'Tile reveal', seconds: 4.2, Scene: TileRevealScene },
  { name: 'pixelate-through', title: 'Pixelate through', seconds: 4, Scene: PixelateThroughScene },
  { name: 'luma-dissolve', title: 'Luma dissolve', seconds: 4.2, Scene: LumaDissolveScene },
  { name: 'title-takeover', title: 'Title takeover', seconds: 4.5, Scene: TitleTakeoverScene },
  { name: 'logo-mask-wipe', title: 'Logo mask wipe', seconds: 4.5, Scene: LogoMaskWipeScene },
];
