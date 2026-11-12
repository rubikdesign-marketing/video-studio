// The brand sheet: one still frame for approving a brand before any video is made with it.
// It shows the palette on the light and the dark page with role names, the logo on both pages, a type specimen,
// a button and a pill, and the caption bar on both pages. Everything on it is drawn by the kit from brand.json,
// so what is approved here is what films get.
//
//   npx remotion still BrandSheet out/brand-sheet-<brand>.png --props='{"brand":"<brand>"}'
import type { CSSProperties, FC, ReactNode } from 'react';
import { z } from 'zod';
import { BrandProvider, brandNames, useBrand } from '../kit/brand';
import { CaptionBar, CaptionHighlight } from '../kit/Captions';
import { MotionProvider } from '../kit/motion';
import { stageNames, type StageName, type StagePalette, type Voice } from '../kit/tokens';
import { Button, Headline, Label, Panel, Pill, useStage, useVh, Wordmark } from '../kit/ui';

export const brandSheetSchema = z.object({ brand: z.enum(brandNames) });

// A still has no time to move in, so every kit piece is cued long before frame 0 and has settled.
const SETTLED = -10;

const ROLES = [
  ['page', 'Page'],
  ['ink', 'Ink'],
  ['second', 'Second'],
  ['accent', 'Accent'],
  ['warm', 'Warm'],
  ['soft', 'Soft'],
  ['line', 'Line'],
] as const satisfies readonly (readonly [keyof StagePalette, string])[];

const PAGE_TITLE: Record<StageName, string> = { light: 'light page', dark: 'dark page' };

// Sizes, as percentages of frame height.
const MARGIN = 5;
const GAP = 2.8;
const PANEL_PADDING = 2.2;

const column: CSSProperties = { display: 'flex', flexDirection: 'column' };
const row: CSSProperties = { display: 'flex', flexDirection: 'row', alignItems: 'center' };

const voiceStyle = (voice: Voice): CSSProperties => ({
  fontFamily: voice.css,
  fontStyle: voice.style,
  fontWeight: voice.weight,
  letterSpacing: voice.tracking === undefined ? undefined : `${voice.tracking}em`,
});

/** A voice in words: its family and weight, and "italic" when it is. */
const describe = (voice: Voice) => `${voice.family} ${voice.weight}${voice.style === 'italic' ? ' italic' : ''}`;

/** The heading of one part of the sheet, in the label voice and sentence case. */
const Title: FC<{ children: ReactNode }> = ({ children }) => {
  const { label } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  return <div style={{ ...voiceStyle(label), fontSize: vh(2), color: stage.ink, marginBottom: vh(1.2) }}>{children}</div>;
};

/** A small note under a specimen. */
const Note: FC<{ children: ReactNode; style?: CSSProperties }> = ({ children, style }) => {
  const { label } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  return <div style={{ ...voiceStyle(label), fontSize: vh(1.7), lineHeight: 1.35, color: stage.second, fontVariantNumeric: 'tabular-nums', ...style }}>{children}</div>;
};

/** A bordered box painted in one of the brand's pages. */
const Card: FC<{ name: StageName; style?: CSSProperties; children: ReactNode }> = ({ name, style, children }) => {
  const brand = useBrand();
  const vh = useVh();
  return (
    <Panel
      name={name}
      style={{ borderRadius: vh(brand.shape.window), boxShadow: `inset 0 0 0 1px ${brand.stages[name].line}`, padding: vh(PANEL_PADDING), boxSizing: 'border-box', ...style }}
    >
      {children}
    </Panel>
  );
};

/** The seven colour roles of the page this sits on, each with its role name and its value. */
const Swatches: FC = () => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  return (
    <div style={{ ...row, alignItems: 'flex-start', gap: vh(1.5) }}>
      {ROLES.map(([role, title]) => (
        <div key={role} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: vh(5.2), borderRadius: vh(brand.shape.control), background: stage[role], boxShadow: `inset 0 0 0 1px ${stage.line}` }} />
          <div style={{ ...voiceStyle(brand.fonts.label), fontSize: vh(1.9), color: stage.ink, marginTop: vh(1) }}>{title}</div>
          <Note>{String(stage[role]).toUpperCase()}</Note>
        </div>
      ))}
    </div>
  );
};

const Palette: FC<{ name: StageName }> = ({ name }) => (
  <div>
    <Title>Colours on the {PAGE_TITLE[name]}</Title>
    <Card name={name}>
      <Swatches />
    </Card>
  </div>
);

/** The headline with its starred word, a label, and numbers in fixed-width figures. */
const TypeSpecimen: FC = () => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const { headline, accent, label, product } = brand.fonts;
  return (
    <div>
      <Title>Type</Title>
      <Headline lines={['A headline in two parts,', 'with *one* accent word.']} at={SETTLED} size={5.2} align="left" />
      <Note style={{ marginTop: vh(1.2) }}>
        Headline voice: {describe(headline)}. The starred word: {describe(accent)}
        {brand.hasAccentFont ? '' : ' (this brand has no accent typeface)'}
      </Note>
      <div style={{ ...row, alignItems: 'baseline', gap: vh(4), marginTop: vh(2.2) }}>
        <Label at={SETTLED} size={3}>
          A label in sentence case
        </Label>
        <div style={{ ...voiceStyle(label), fontSize: vh(4), color: stage.ink, fontVariantNumeric: 'tabular-nums' }}>0123456789</div>
      </div>
      <Note style={{ marginTop: vh(0.8) }}>Label voice: {describe(label)}, with fixed-width figures</Note>
      {brand.productUi ? (
        <div style={{ ...row, alignItems: 'baseline', gap: vh(1.6), marginTop: vh(1.8) }}>
          <div style={{ ...voiceStyle(product), fontSize: vh(2.4), color: stage.ink }}>Text inside the product</div>
          <Note>Product voice: {describe(product)}</Note>
        </div>
      ) : null}
    </div>
  );
};

/** The wordmark and the mark on both pages. */
const Logos: FC = () => {
  const vh = useVh();
  return (
    <div>
      <Title>Logo</Title>
      <div style={{ ...row, gap: vh(1.6) }}>
        {stageNames.map((name) => (
          <Card key={name} name={name} style={{ ...row, flex: 1, height: vh(15), justifyContent: 'center', gap: vh(2.6) }}>
            <Wordmark at={SETTLED} height={4} />
            <Wordmark mark at={SETTLED} height={4.6} />
          </Card>
        ))}
      </div>
    </div>
  );
};

const Controls: FC = () => {
  const vh = useVh();
  return (
    <div>
      <Title>Button and pill</Title>
      <div style={{ ...row, gap: vh(2) }}>
        <Button at={SETTLED}>Button</Button>
        <Button at={SETTLED} emphasis>
          Emphasis
        </Button>
        <Pill at={SETTLED}>Pill</Pill>
        <Pill at={SETTLED} emphasis>
          New
        </Pill>
      </div>
    </div>
  );
};

/** The caption bar over both pages, with its one highlighted phrase. */
const CaptionSamples: FC = () => {
  const vh = useVh();
  return (
    <div>
      <Title>Captions</Title>
      <div style={{ ...column, gap: vh(1.6) }}>
        {stageNames.map((name) => (
          <Card key={name} name={name} style={{ ...row, height: vh(13), justifyContent: 'center' }}>
            <CaptionBar>
              Captions look <CaptionHighlight>like this</CaptionHighlight>
            </CaptionBar>
          </Card>
        ))}
      </div>
    </div>
  );
};

const Sheet: FC = () => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  return (
    <div style={{ ...column, position: 'absolute', inset: 0, padding: vh(MARGIN), boxSizing: 'border-box' }}>
      <div style={{ ...row, justifyContent: 'space-between', paddingBottom: vh(2.2), borderBottom: `1px solid ${stage.line}`, marginBottom: vh(GAP) }}>
        <div style={{ ...row, gap: vh(1.8) }}>
          <Wordmark mark at={SETTLED} height={5} />
          <div style={{ ...voiceStyle(brand.fonts.headline), fontSize: vh(4.6), lineHeight: 1.1, color: stage.ink }}>{brand.name}</div>
        </div>
        <Note style={{ fontSize: vh(2) }}>Brand sheet for approval</Note>
      </div>
      <div style={{ ...row, alignItems: 'flex-start', gap: vh(5), flex: 1, minHeight: 0 }}>
        <div style={{ ...column, flex: 1.25, minWidth: 0, gap: vh(GAP) }}>
          <Palette name="light" />
          <Palette name="dark" />
          <TypeSpecimen />
        </div>
        <div style={{ ...column, flex: 1, minWidth: 0, gap: vh(GAP) }}>
          <Logos />
          <Controls />
          <CaptionSamples />
        </div>
      </div>
    </div>
  );
};

export const BrandSheet: FC<z.infer<typeof brandSheetSchema>> = ({ brand }) => (
  <BrandProvider brand={brand}>
    <MotionProvider preset="confident">
      {/* The brand's own light page, flat: no lights and no grain, so the colours are judged as they are. */}
      <Panel name="light" style={{ position: 'absolute', inset: 0 }}>
        <Sheet />
      </Panel>
    </MotionProvider>
  </BrandProvider>
);
