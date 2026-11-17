// "FootageCut": an edit of raw footage (FOOTAGE-PLAN.md phase 2), from tools/footage/footage.mjs rough. It reads
// public/jobs/<cut>/edit/cut.json: each piece's picture as a stretch of film frames (from, frames, trim: the frame of
// the working copy it starts on; freeze: hold that frame), one dialogue track already joined sample by sample with
// 15 ms crossfades, and the captions on the film's clock. Leave "cut" empty for the newest one.
//
// Phase 4: each picture carries the footage camera's crop keyframes (tools/footage/lib/framing.mjs: headroom, lead
// room, chin to hairline, punch-ins on jump cuts, a push on the opening line, the speaker followed in tall sizes), one
// set per film size, with caption lines split to fit that size; "size" picks the size (empty: the job's own). A
// picture without a crop is fitted whole.
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { AbsoluteFill, Audio, cancelRender, continueRender, delayRender, Freeze, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig, type CalculateMetadataFunction } from 'remotion';
import { z } from 'zod';
import { getJson } from '../capture/load';
import { BrandProvider, brandNames, defaultBrand } from '../kit/brand';
import { Captions, type CaptionsData } from '../kit/Captions';
import { MotionProvider, presetNames } from '../kit/motion';

export const footageCutSchema = z.object({
  brand: z.enum(brandNames),
  preset: z.enum(presetNames),
  /** The job's engine name (its folder name, lower case); empty means the newest cut. */
  cut: z.string(),
  /** "16:9", "9:16", "1:1" or "4:5"; empty means the job's own size. */
  size: z.string(),
  captions: z.boolean(),
});
type Props = z.infer<typeof footageCutSchema>;

/** Crop keyframes in source pixels: [frame from the picture's start, x, y, w, h]. */
export type FootageCrop = { src: [number, number]; keys: [number, number, number, number, number][] };
export type FootagePicture = { src: string; from: number; frames: number; trim: number; freeze: boolean; crop?: FootageCrop };
type SizeData = { width: number; height: number; pictures: FootagePicture[]; captions?: CaptionsData };
export type FootageCutData = {
  job: string; fps: number; width: number; height: number; size?: string; durationInFrames: number;
  audio: string; pictures: FootagePicture[]; sizes?: Record<string, SizeData>; captions: CaptionsData;
};

/** The picture list and frame size for the size asked for (or the job's own). */
const sized = (data: FootageCutData, size: string): SizeData =>
  (size && data.sizes?.[size]) || data.sizes?.[data.size || ''] || { width: data.width, height: data.height, pictures: data.pictures };

async function loadCut(cut: string): Promise<FootageCutData | null> {
  let name = cut;
  if (!name) {
    const list = await getJson<{ cut: string }[]>('footage-cuts.json').catch(() => null);
    name = list?.[0]?.cut ?? '';
  }
  if (!name) return null;
  return getJson<FootageCutData>(`jobs/${name}/edit/cut.json`).catch(() => null);
}

export const calculateFootageCut: CalculateMetadataFunction<Props> = async ({ props }) => {
  const data = await loadCut(props.cut);
  if (!data) return { durationInFrames: 90, fps: 30, width: 1920, height: 1080, props };
  const s = sized(data, props.size);
  return { durationInFrames: data.durationInFrames, fps: data.fps, width: s.width, height: s.height, props: { ...props, cut: data.job } };
};

const useCut = (cut: string) => {
  const [state, setState] = useState<FootageCutData | null | undefined>(undefined);
  const [handle] = useState(() => delayRender('Loading the footage cut'));
  useEffect(() => {
    loadCut(cut)
      .then((d) => { setState(d); continueRender(handle); })
      .catch((e: unknown) => cancelRender(e));
  }, [cut, handle]);
  return state;
};

const fit = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' } as const;

/** The crop at a frame of the picture: between the two keyframes around it, in a straight line. */
const cropAt = (c: FootageCrop, f: number) => {
  const k = c.keys;
  if (f <= k[0][0]) return k[0];
  for (let i = 1; i < k.length; i++) {
    if (f <= k[i][0]) {
      const a = k[i - 1]; const b = k[i]; const u = (f - a[0]) / Math.max(1, b[0] - a[0]);
      return a.map((v, j) => v + (b[j] - v) * u) as typeof a;
    }
  }
  return k[k.length - 1];
};

/** The source video placed so the crop fills the frame exactly. */
const Cropped: FC<{ p: FootagePicture; W: number }> = ({ p, W }) => {
  const frame = useCurrentFrame();
  const c = p.crop as FootageCrop;
  const [, x, y, w] = cropAt(c, p.freeze ? 0 : frame);
  const s = W / w;
  const style = { position: 'absolute', left: -x * s, top: -y * s, width: c.src[0] * s, height: c.src[1] * s } as const;
  return <OffthreadVideo src={staticFile(p.src)} muted trimBefore={p.trim} style={style} />;
};

const Picture: FC<{ p: FootagePicture }> = ({ p }) => {
  const { width } = useVideoConfig();
  const video = p.crop ? <Cropped p={p} W={width} /> : <OffthreadVideo src={staticFile(p.src)} muted trimBefore={p.trim} style={fit} />;
  return p.freeze ? <Freeze frame={0}>{video}</Freeze> : video;
};

export const FootageCut: FC<Props> = (props) => {
  const data = useCut(props.cut);
  return (
    <BrandProvider brand={props.brand}>
      <MotionProvider preset={props.preset}>
        <AbsoluteFill style={{ background: '#000' }}>
          {data ? (
            <>
              {sized(data, props.size).pictures.map((p, i) => (
                <Sequence key={i} from={p.from} durationInFrames={p.frames} layout="none">
                  <Picture p={p} />
                </Sequence>
              ))}
              <Audio src={staticFile(data.audio)} />
              <Captions data={sized(data, props.size).captions || data.captions} enabled={props.captions} />
            </>
          ) : null}
        </AbsoluteFill>
      </MotionProvider>
    </BrandProvider>
  );
};

export const footageCutDefaults: Props = { brand: defaultBrand, preset: 'confident', cut: '', size: '', captions: true };
