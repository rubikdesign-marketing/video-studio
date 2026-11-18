// What every shader background shares: the brand's colours for the page it is drawn for, a clock taken from the
// film's frame, the fades, and the mount that draws a Paper shader (paper-design/shaders, Apache-2.0) once per frame
// and holds the frame until it is drawn.
//
// Paper's components normally run their own animation loop. Here their speed is 0 and their time is set from the
// film's real clock on every frame, so a render is the same every time and any frame can be drawn alone.
// Rendering needs WebGL2: render with `--gl=angle`.
import { useLayoutEffect, useRef, useState, type CSSProperties, type FC, type ReactElement, type Ref } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender } from 'remotion';
import type { PaperShaderElement } from '@paper-design/shaders';
import { useBrand } from '../brand';
import { easing, EXIT_SHARE, progress, useMotion, useRealTime } from '../motion';
import { mix, quietCentre } from '../backgrounds/shared';
import type { StageName, StagePalette } from '../tokens';
import { useGrainShare, useStage } from '../ui';

/** How lively a shader is: calm (the default) drifts so slowly it reads as a held picture; bold is the most it may move under type. */
export const intensityNames = ['calm', 'alive', 'bold'] as const;
export type ShaderIntensity = (typeof intensityNames)[number];

/** How fast the shader's clock runs and how strong its colours are, at each intensity. */
const levels: Record<ShaderIntensity, { rate: number; strength: number }> = {
  calm: { rate: 1, strength: 1 },
  alive: { rate: 1.8, strength: 1.15 },
  bold: { rate: 2.8, strength: 1.3 },
};

export type ShaderProps = {
  /** The brand page the shader is coloured for. Leave it out to follow the stage it sits on. */
  page?: StageName;
  /** calm (default), alive or bold. Set it once per film, or change it on a cut: the clock runs at a different rate. */
  intensity?: ShaderIntensity;
  /** Lowers the contrast further, for a shader that sits under a line of type for the whole shot. */
  quiet?: boolean;
  /** Seconds on the scene clock: fades the shader up from the page. Leave it out and it is simply there. */
  at?: number;
  /** Seconds on the scene clock: fades it back to the page. */
  out?: number;
  /** Changes where its clock starts, so two films with the same shader do not match. */
  seed?: number;
};

/**
 * The colours, the clock and the fade for one shader. `rate` is the shader's own pace at calm, in its seconds per
 * film second. `contrast` is 0 to 1: how far the shader's colours may go from the page (lowered by `quiet`).
 */
export const useShaderLook = ({ page, intensity = 'calm', quiet = false, at, out, seed = 1 }: ShaderProps, rate: number) => {
  const brand = useBrand();
  const onStage = useStage();
  const stage: StagePalette = page ? brand.stages[page] : onStage;
  const now = useRealTime();
  const m = useMotion();
  const level = levels[intensity];
  // The page is the darker of page and ink on a dark stage, and that is what the stage calls its shade.
  const dark = stage.shade === stage.page;
  const enter = at === undefined ? 1 : progress(m.t, at, at + m.seconds('hero'), easing.arrive);
  const exit = out === undefined ? 0 : progress(m.t, out, out + m.seconds('hero') * EXIT_SHARE, easing.leave);
  // How far from the page the colours may go, before the fade.
  const reach = Math.min(1, (quiet ? 0.6 : 1) * level.strength);
  // A tone `share` of the way from the page to a colour, held back by quiet and intensity.
  const tone = (colour: string, share: number) => mix(stage.page, colour, Math.min(1, share * reach));
  // Seconds on the shader's own clock, as Paper counts them (its frame is in milliseconds).
  const seconds = (now + seed * 47.3) * rate * level.rate;
  return { stage, dark, tone, frame: seconds * 1000, opacity: enter * (1 - exit), quiet };
};
export type ShaderLook = ReturnType<typeof useShaderLook>;

/** What each Paper component is given so that it draws one frame of the film and nothing else. */
export type MountProps = {
  ref: Ref<PaperShaderElement>;
  speed: 0;
  frame: number;
  minPixelRatio: number;
  maxPixelCount: number;
  webGlContextAttributes: WebGLContextAttributes;
  style: CSSProperties;
};

/** How long to wait for WebGL before giving up with a clear message. */
const START_LIMIT_MS = 15000;

/**
 * Draws one Paper shader full frame, under a fade to the page colour. `children` is the Paper component, given the
 * mount props. The first frame is held until the shader has compiled and its canvas has its size; after that each
 * frame sets the shader's time and draws it at once, before the frame is taken.
 */
export const ShaderLayer: FC<{
  look: ShaderLook;
  /** The share of the stage's grain this shader can take (useGrainShare): less over a strong fill or a shader with grain of its own. */
  grain?: number;
  /** For a busy shader: how much of it is left in the middle of the frame, where the type sits (0 to 1). `quiet` halves it. */
  centre?: number;
  children: (mount: MountProps) => ReactElement;
}> = ({ look, grain = 1, centre, children }) => {
  useGrainShare(grain);
  const ref = useRef<PaperShaderElement>(null);
  const frame = useRef(look.frame);
  frame.current = look.frame;
  const [handle] = useState(() => delayRender('Starting a Paper shader (needs WebGL2: render with --gl=angle)'));

  // Wait once for the shader to compile and for its canvas to take the frame's size, then draw and let go.
  useLayoutEffect(() => {
    let live = true;
    const started = performance.now();
    const check = () => {
      if (!live) return;
      const mount = ref.current?.paperShaderMount;
      // The canvas is sized by a ResizeObserver; until it has run, the mount does not know the frame's size.
      const sized = mount ? (mount as unknown as { parentWidth: number }).parentWidth > 0 : false;
      if (mount && sized) {
        mount.setFrame(frame.current);
        release();
        return;
      }
      if (performance.now() - started > START_LIMIT_MS) {
        cancelRender(new Error('The Paper shader did not start. It needs WebGL2: render with --gl=angle.'));
        return;
      }
      setTimeout(check, 10);
    };
    let released = false;
    const release = () => {
      if (!released) continueRender(handle);
      released = true;
    };
    check();
    return () => {
      live = false;
      // Leaving before the shader started (scrubbing past it in Studio) must not hold the render forever.
      release();
    };
  }, [handle]);

  // Every later frame: set the time and draw now (Paper draws at once when its own loop is stopped).
  useLayoutEffect(() => {
    ref.current?.paperShaderMount?.setFrame(look.frame);
  }, [look.frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: look.stage.page, overflow: 'hidden', pointerEvents: 'none' }}>
      <AbsoluteFill style={{ opacity: look.opacity, ...(centre === undefined ? {} : quietCentre(look.stage.page, look.quiet ? centre / 2 : centre)) }}>
        {children({
          ref,
          speed: 0,
          frame: look.frame,
          // One shader pixel per frame pixel: the default of two is four times the work for no visible gain.
          minPixelRatio: 1,
          maxPixelCount: 4096 * 4096,
          webGlContextAttributes: { preserveDrawingBuffer: true },
          style: { position: 'absolute', inset: 0 },
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
