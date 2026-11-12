// Gallery scenes for the type moves. Each shows its move once, in a small realistic setup, with cues in seconds.
import type { FC } from 'react';
import { useBrand } from '../../../kit/brand';
import { BlurIn, DrawnMark, NumberRoll, RotatingWord, SwapWord, TrackingSettle, TypeOn } from '../../../kit/moves';
import { Button, useStage, useVh } from '../../../kit/ui';
import { Centre, Line } from '../parts';

export const BlurInScene: FC = () => (
  <Centre>
    <BlurIn lines={['Every order,', 'in *one* place']} at={0.4} out={3.3} size={8} />
  </Centre>
);

export const TrackingSettleScene: FC = () => (
  <Centre>
    <TrackingSettle text="Ready when you are" at={0.4} out={3.3} />
  </Centre>
);

export const RotatingWordScene: FC = () => (
  <Centre>
    <RotatingWord lead="Built for" words={['designers', 'founders', 'support teams']} at={0.4} every={1.1} out={4.2} size={8} />
  </Centre>
);

export const NumberRollScene: FC = () => (
  <Centre gap={2}>
    <Line voice="label" size={3} colour="second" at={0.3}>
      Orders this week
    </Line>
    <NumberRoll value={1280} at={0.6} size={18} />
  </Centre>
);

/** A search field with a prompt typed into it. */
export const TypeOnScene: FC = () => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  return (
    <Centre gap={3}>
      <Line voice="label" size={3} colour="second" at={0.2}>
        Ask about your shop
      </Line>
      <div
        style={{
          boxSizing: 'border-box',
          width: vh(104),
          padding: `${vh(3)}px ${vh(4)}px`,
          borderRadius: vh(brand.shape.control),
          background: stage.soft,
          boxShadow: `0 0 0 1px ${stage.line}`,
        }}
      >
        <TypeOn text="Show unpaid invoices from March" at={0.7} over={2.2} size={4.4} />
      </div>
    </Centre>
  );
};

export const SwapWordScene: FC = () => (
  <Centre>
    <SwapWord lead="Reports in" from="hours" to="minutes" at={0.4} swapAt={1.7} out={3.4} size={8} />
  </Centre>
);

/** An underline under the offer, then a ring around the control that takes it up: one mark per beat. */
export const DrawnMarkScene: FC = () => (
  <Centre gap={7}>
    <Line at={0.3} size={8}>
      Free for{' '}
      <DrawnMark at={1.1} out={3.9}>
        30 days
      </DrawnMark>
    </Line>
    <DrawnMark kind="ring" at={2.3} out={3.9}>
      <Button at={0.6}>Start a trial</Button>
    </DrawnMark>
  </Centre>
);
