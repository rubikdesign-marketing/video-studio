// The smoke test: six seconds that prove a brand's fonts, colours and logo, the presets and the captions work.
// Change `brand`, `preset`, `stage` and `captions` in Remotion Studio's props panel to check each one.
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import { z } from 'zod';
import { BrandProvider, brandNames } from '../kit/brand';
import { Captions, captionsSchema } from '../kit/Captions';
import { MotionProvider, presetNames } from '../kit/motion';
import { stageNames } from '../kit/tokens';
import { Cursor, Headline, Label, Pill, Stage, Wordmark } from '../kit/ui';
import captionsFile from './captions.json';

export const smokeSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  stage: z.enum(stageNames),
  captions: z.boolean(),
});

const captions = captionsSchema.parse(captionsFile);

// Cue times in seconds, and places in the 1920 x 1080 frame.
const HEADLINE_AT = 0.3;
const LABEL_AT = 1.2;
const BUTTON_AT = 1.6;
const CLICK_AT = 3.1;
const CLEAR_AT = 4.0;
const WORDMARK_AT = 4.45;
const BUTTON = { x: 960, y: 664 };

const row = (top: number) => ({ position: 'absolute', top, left: 0, right: 0, display: 'flex', justifyContent: 'center' }) as const;

export const Smoke: FC<z.infer<typeof smokeSchema>> = ({ brand, preset, stage, captions: showCaptions }) => (
  <BrandProvider brand={brand}>
    <MotionProvider preset={preset}>
      <Stage name={stage}>
        <div style={row(286)}>
          <Label at={LABEL_AT} out={CLEAR_AT}>
            Smoke test
          </Label>
        </div>
        <Headline lines={['One engine.', '*Every* video.']} at={HEADLINE_AT} out={CLEAR_AT} size={7.5} style={{ position: 'absolute', top: 346, left: 0, right: 0 }} />
        <div style={row(BUTTON.y - 34)}>
          <Pill at={BUTTON_AT} out={CLEAR_AT}>
            Render
          </Pill>
        </div>
        <Cursor from={{ x: 1500, y: 800 }} moves={[{ to: { x: BUTTON.x + 36, y: BUTTON.y + 6 }, at: CLICK_AT, click: true }]} out={CLEAR_AT} />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Wordmark at={WORDMARK_AT} />
        </AbsoluteFill>
      </Stage>
      <Captions data={captions} enabled={showCaptions} />
    </MotionProvider>
  </BrandProvider>
);
