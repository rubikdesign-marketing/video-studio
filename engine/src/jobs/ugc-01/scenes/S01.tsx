/*
 * S01: Hook (hand-built; see ../ugc.tsx and jobs/2026-11-19-ugc-01/events.json for the cues).
 * The lead pipeline already in frame, pushed in slowly. The hook is a comment-reply card (kit/ugc CommentReply) that
 * drops in at frame 0 with a phone buzz, gets a heart tap, and leaves before the cut; the one caption line (5 words)
 * is the answer and lands at 0.4 s. Nothing else: show first, say little.
 */
import type { FC } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneData } from '../../_film';
import { CommentReply } from '../../../kit/ugc';
import { camAt, events as e, UgcCaptions, useFilmTime, Window } from '../ugc';

// [time, centre x, centre y, zoom]: a slow push in on the tabs and the first card, speeding a little into the cut.
const KEYS: [number, number, number, number][] = [[0, 640, 500, 2.4], [2.5, 610, 500, 2.9]];

export const S01: FC<{ scene: SceneData }> = ({ scene }) => {
  const t = useFilmTime(scene);
  const cam = camAt(KEYS, t);
  return (
    <AbsoluteFill>
      <Window src="jobs/ugc-01/graded/demo-1.png" cam={cam} />
      <CommentReply comment="Wait, how do you keep every lead in one place?" handle="@maya.runs" likes="2.4K" at={e.commentIn} preroll={0.1} likeAt={e.commentLike} out={e.commentOut} y={0.55} />
      <UgcCaptions t={t} />
    </AbsoluteFill>
  );
};
