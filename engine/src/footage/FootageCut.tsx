// "FootageCut": an edit of raw footage (FOOTAGE-PLAN.md phase 2), from tools/footage/footage.mjs rough. It reads
// public/jobs/<cut>/edit/cut.json: each piece's picture as a stretch of film frames (from, frames, trim: the frame of
// the working copy it starts on; freeze: hold that frame), one dialogue track already joined sample by sample with
// 15 ms crossfades, and the captions on the film's clock. Leave "cut" empty for the newest one.
//
// Phase 2 shows the footage whole (fitted in the frame) with plain cuts. Framing, punch-ins and titles over cuts
// arrive in phase 4.
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { AbsoluteFill, Audio, cancelRender, continueRender, delayRender, Freeze, OffthreadVideo, Sequence, staticFile, type CalculateMetadataFunction } from 'remotion';
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
  captions: z.boolean(),
});
type Props = z.infer<typeof footageCutSchema>;

export type FootagePicture = { src: string; from: number; frames: number; trim: number; freeze: boolean };
export type FootageCutData = {
  job: string; fps: number; width: number; height: number; durationInFrames: number;
  audio: string; pictures: FootagePicture[]; captions: CaptionsData;
};

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
  return { durationInFrames: data.durationInFrames, fps: data.fps, width: data.width, height: data.height, props: { ...props, cut: data.job } };
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

const Picture: FC<{ p: FootagePicture }> = ({ p }) => {
  const video = <OffthreadVideo src={staticFile(p.src)} muted trimBefore={p.trim} style={fit} />;
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
              {data.pictures.map((p, i) => (
                <Sequence key={i} from={p.from} durationInFrames={p.frames} layout="none">
                  <Picture p={p} />
                </Sequence>
              ))}
              <Audio src={staticFile(data.audio)} />
              <Captions data={data.captions} enabled={props.captions} />
            </>
          ) : null}
        </AbsoluteFill>
      </MotionProvider>
    </BrandProvider>
  );
};

export const footageCutDefaults: Props = { brand: defaultBrand, preset: 'confident', cut: '', captions: true };
