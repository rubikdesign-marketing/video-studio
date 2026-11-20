/*
 * S01: one product beat, about 4 s, 9:16. The studio's own take-5 recording (graded once, see jobs/2026-11-19-product-motion-02/build.mjs) in the
 * "phone-crop" staging: the campaign board is open and the pointer travels to New; the existing product-ring move (CaptureClip emphasis "ring") draws round the board title.
 * The new ugc move is RecBadge (kit/ugc, move ugc-screen-rec-tell): a REC dot and a running timer, placed inside the light window because on the dark stage its text is unreadable (verifier-4 finding).
 */
import type { FC } from 'react';
import { AbsoluteFill, useVideoConfig } from 'remotion';
import cursor from '../../../../public/jobs/product-motion-02/capture/take-5/cursor.json';
import tracks from '../../../../public/jobs/product-motion-02/capture/take-5/tracks.json';
import events from '../../../../public/jobs/product-motion-02/events.json';
import { CaptureShot } from '../../../kit/capture/staging';
import { RecBadge } from '../../../kit/ugc';
import type { SceneData } from '../../_film';

// Recording seconds 8.7 to 12.8: the board has settled (8.64 s) and the pointer travels to New (marked at 11.87 s). The camera frames the title first, as the library's own product moves do (library/motion/product.tsx `framing`).
const FROM = 8.7;
const TO = 12.8;
// The board title, in page pixels (1920 x 1080), measured from the mark's still: the same rectangle ugc-01 outlines.
const things = { title: { rect: [365, 16, 152, 20] as [number, number, number, number], from: 8.64 } };
const BOX = { x: 365, y: 16, width: 152, height: 20 };

export const S01: FC<{ scene: SceneData }> = () => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <CaptureShot
        src="jobs/product-motion-02/capture/take-5/recording.mp4"
        cursor={cursor as never}
        tracks={tracks as never}
        from={FROM}
        to={TO}
        trimLoads={false}
        camera={{ auto: false }}
        moves={[{ move: 'key', to: BOX, at: 0.2, over: 'scene', zoom: 1.8 }]}
        things={things}
        staging="phone-crop"
        emphasis={[{ kind: 'ring', target: 'title', at: events.ring, out: events.end - 0.3 }]}
      />
      <RecBadge at={0} timerFrom={0} width={width} height={height} x={0.62} y={0.2} size={3.2} />
    </AbsoluteFill>
  );
};
