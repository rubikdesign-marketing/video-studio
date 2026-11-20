// UGC moves: the comment a film answers, the marks of a screen recording, a sticker reaction. Each demo sits on a small
// product tile so the move is the only thing that moves, and lays itself out for the frame it is shown in.
import type { FC } from 'react';
import { CommentReply, ScreenRecTell, StickerPop } from '../../../kit/ugc';
import { Centre, Tile } from '../parts';
import type { FormatName, SizedDemo } from '../sized';

const tall = (format: FormatName) => format === '9:16' || format === '4:5';

const CommentReplyScene: FC<{ format: FormatName }> = ({ format }) => (
  <>
    <Centre>
      <Tile label="Lead pipeline" value="24 leads" at={0.05} />
    </Centre>
    <CommentReply comment="Wait, how do you keep every lead in one place?" handle="@maya.runs" likes="2.4K" at={0.15} preroll={0.1} likeAt={1.5} dockAt={2.1} dockY={tall(format) ? 0.1 : 0.04} out={3.5} y={tall(format) ? 0.2 : 0.07} />
  </>
);

const ScreenRecScene: FC<{ format: FormatName }> = () => (
  <ScreenRecTell at={0.2} timerFrom={4} taps={[{ at: 1.1, x: 0.5, y: 0.52 }, { at: 2.4, x: 0.7, y: 0.3 }]} frame>
    <Centre style={{ transform: 'scale(0.62)' }}>
      <Tile label="Campaign board" value="12 briefs" at={0.05} />
    </Centre>
  </ScreenRecTell>
);

const StickerScene: FC<{ format: FormatName }> = ({ format }) => (
  <>
    <Centre>
      <Tile label="Approvals" value="All clear" at={0.05} />
    </Centre>
    <StickerPop shape="tick" at={0.7} out={2.2} x={tall(format) ? 0.78 : 0.62} y={tall(format) ? 0.4 : 0.34} size={tall(format) ? 20 : 14} rotate={-10} seed={3} />
    <StickerPop shape="heart" at={2.5} out={3.7} x={tall(format) ? 0.24 : 0.4} y={tall(format) ? 0.6 : 0.62} size={tall(format) ? 17 : 12} rotate={12} colour="warm" seed={11} />
  </>
);

export const batch1: SizedDemo[] = [
  { name: 'ugc-comment-reply', title: 'Comment reply', seconds: 4.2, Scene: CommentReplyScene },
  { name: 'ugc-screen-rec-tell', title: 'Screen recording tell', seconds: 4.2, Scene: ScreenRecScene },
  { name: 'ugc-sticker-pop', title: 'Sticker pop', seconds: 4.2, Scene: StickerScene },
];
