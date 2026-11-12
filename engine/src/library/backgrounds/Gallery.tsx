// The gallery of backgrounds. "Backgrounds" is a reel: every background made for the light page for three seconds
// each, then every one made for the dark page. Each also has its own four-second composition, "bg-<name>", for
// single previews.
// A sample headline and a product-style card sit in the middle of every shot, so it is plain whether the
// background stays quieter than the content.
import type { FC } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { BrandProvider, brandNames, useBrand } from '../../kit/brand';
import { energyNames } from '../../kit/backgrounds';
import { MotionProvider } from '../../kit/motion';
import { alpha, stageNames } from '../../kit/tokens';
import { Label, Stage, useStage, useVh } from '../../kit/ui';
import { catalogue, type Entry } from './catalogue';

export const reelSchema = z.object({ brand: z.enum(brandNames), energy: z.enum(energyNames) });
/** `seconds` makes a single preview longer than its usual four seconds, to watch a background for a loop or a pulse. */
export const shotSchema = z.object({ brand: z.enum(brandNames), page: z.enum(stageNames), energy: z.enum(energyNames), seconds: z.number().min(1).max(120).optional() });
type ShotProps = z.infer<typeof shotSchema>;

export const FPS = 60;
/** Seconds each background is shown for in the reel, and the length of a single preview. */
const REEL_SHOT = 3;
export const PREVIEW = 4;
/** The reel's shots in order: for each page, the backgrounds made for it. */
const reel = stageNames.map((page) => ({ page, entries: catalogue.filter((entry) => entry.pages.includes(page)) }));
export const REEL_FRAMES = reel.reduce((shots, part) => shots + part.entries.length, 0) * REEL_SHOT * FPS;
export const PREVIEW_FRAMES = PREVIEW * FPS;

// ---------------------------------------------------------------- sample content

/** Bar widths of the rows of the sample card, in % of frame height: a name, a detail and a status. */
const ROWS = [
  [20, 12, 8],
  [26, 9, 10],
  [17, 14, 7],
  [23, 10, 9],
];

/** A stand-in for a product window: a title, a button and a few rows, drawn in the brand's light page colours. */
const SampleCard: FC = () => {
  const brand = useBrand();
  const stage = useStage();
  const vh = useVh();
  const ui = brand.stages.light;
  const { product } = brand.fonts;
  const bar = (width: number, colour: string) => <div style={{ width: vh(width), height: vh(1.2), borderRadius: vh(0.6), background: colour }} />;
  // The same border, shadow and glow as the kit's Screen.
  const shadow = [`0 0 0 1px ${stage.line}`, `0 ${vh(4)}px ${vh(9)}px ${alpha(stage.shade, 0.3)}`, `0 0 ${vh(13)}px ${alpha(stage.accent, stage.screenGlow)}`];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: vh(78),
        height: vh(40),
        overflow: 'hidden',
        borderRadius: vh(brand.shape.window),
        background: brand.screen,
        boxShadow: shadow.join(', '),
        fontFamily: product.css,
        fontStyle: product.style,
        fontWeight: product.weight,
        color: ui.ink,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${vh(2.2)}px ${vh(3)}px`, borderBottom: `1px solid ${ui.line}` }}>
        <div style={{ fontSize: vh(2.5) }}>Overview</div>
        <div style={{ padding: `${vh(0.9)}px ${vh(2)}px`, borderRadius: vh(brand.shape.control), background: ui.accent, color: ui.onAccent, fontSize: vh(1.9) }}>New item</div>
      </div>
      {ROWS.map(([name, detail, status], i) => (
        <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: vh(2.4), padding: `0 ${vh(3)}px`, borderTop: i > 0 ? `1px solid ${ui.line}` : undefined }}>
          <div style={{ width: vh(3.4), height: vh(3.4), borderRadius: vh(0.9), background: ui.soft }} />
          {bar(name, alpha(ui.ink, 0.82))}
          {bar(detail, ui.line)}
          <div style={{ marginLeft: 'auto' }}>{bar(status, ui.soft)}</div>
        </div>
      ))}
    </div>
  );
};

/** The sample headline and card in the middle, and the background's name at the bottom left. */
const Sample: FC<{ entry: Entry }> = ({ entry }) => {
  const { headline } = useBrand().fonts;
  const stage = useStage();
  const vh = useVh();
  // On a frame filled with the accent colour, type takes the colour made for it.
  const first = entry.onAccent ? stage.onAccent : stage.ink;
  const second = entry.onAccent ? alpha(stage.onAccent, 0.72) : stage.second;
  return (
    <>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: vh(5) }}>
        <div
          style={{
            fontFamily: headline.css,
            fontStyle: headline.style,
            fontWeight: headline.weight,
            fontSize: vh(6.2),
            lineHeight: headline.lineHeight,
            letterSpacing: headline.tracking === undefined ? undefined : `${headline.tracking}em`,
            textAlign: 'center',
          }}
        >
          <div style={{ color: first }}>A quiet stage.</div>
          <div style={{ color: second }}>The product leads.</div>
        </div>
        <SampleCard />
      </AbsoluteFill>
      <Label size={2.6} style={{ position: 'absolute', left: vh(6), bottom: vh(5.5), color: second }}>
        {entry.label}
      </Label>
    </>
  );
};

// ---------------------------------------------------------------- compositions

/** The reel: every background made for the light page, then every background made for the dark page. */
export const BackgroundsReel: FC<z.infer<typeof reelSchema>> = ({ brand, energy }) => {
  const { fps } = useVideoConfig();
  const shot = REEL_SHOT * fps;
  let from = 0;
  const parts = reel.map((part) => {
    const placed = { ...part, from, run: shot * part.entries.length };
    from += placed.run;
    return placed;
  });
  return (
    <BrandProvider brand={brand}>
      <MotionProvider preset="calm">
        {parts.map(({ page, entries, from, run }) => (
          <Sequence key={page} name={`On the ${page} page`} from={from} durationInFrames={run}>
            <Stage name={page}>
              {entries.map((entry, i) => (
                <Sequence key={entry.name} name={entry.label} from={i * shot} durationInFrames={shot}>
                  <entry.Component energy={energy} />
                  <Sample entry={entry} />
                </Sequence>
              ))}
            </Stage>
          </Sequence>
        ))}
      </MotionProvider>
    </BrandProvider>
  );
};

/** One background on one page, with the sample content. */
const Shot: FC<ShotProps & { entry: Entry }> = ({ entry, brand, page, energy }) => (
  <BrandProvider brand={brand}>
    <MotionProvider preset="calm">
      <Stage name={page}>
        <entry.Component energy={energy} />
        <Sample entry={entry} />
      </Stage>
    </MotionProvider>
  </BrandProvider>
);

/** A component per background for its "bg-<name>" composition. Made once, so each keeps its identity. */
export const shots: { entry: Entry; Component: FC<ShotProps> }[] = catalogue.map((entry) => ({
  entry,
  Component: (props) => <Shot entry={entry} {...props} />,
}));
