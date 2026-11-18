// Block reveal: a solid block in the accent colour wipes across each line and, as it leaves, uncovers the text.
// The classic title reveal.
import type { CSSProperties, FC } from 'react';
import { easing } from '../motion';
import { useStage } from '../ui';
import { asLines, useTextClock, type TextMoveProps } from './core';
import { SplitText } from './split';

/** Room around the line so descenders sit under the block, pulled back with an equal margin. */
const ROOM: CSSProperties = { padding: '0.06em 0.14em 0.14em', margin: '-0.06em -0.14em -0.14em' };

/**
 * A block in the accent colour grows across each line from the left, then runs off the right side, and the text
 * shows behind it as its trailing edge passes. Lines follow a short gap apart. The exit runs the same block across
 * again, hiding the text as it goes. The block is only as large as the line, never the frame.
 */
export const BlockReveal: FC<TextMoveProps> = ({ lines, at, out, size = 8, align = 'center', colours, style }) => {
  const clock = useTextClock(at, out, 'line');
  const stage = useStage();
  const rows = asLines(lines);
  // The block's front and back edges, per cent along the line, entering and leaving.
  const edges = (index: number) => {
    const leaving = clock.exit > 0;
    const u = leaving ? clock.exit : clock.enter(index, 'scene', easing.travel);
    return { leaving, front: Math.min(1, u * 2) * 100, back: Math.max(0, u * 2 - 1) * 100 };
  };
  return (
    <div style={{ position: 'relative' }}>
      <SplitText
        lines={rows}
        size={size}
        align={align}
        colours={colours}
        by="line"
        style={style}
        piece={(p) => {
          const { leaving, front, back } = edges(p.index);
          // Entering, the text shows behind the block's trailing edge; leaving, ahead of its front edge.
          return { ...ROOM, clipPath: leaving ? `inset(0 0 0 ${front}%)` : `inset(0 ${100 - back}% 0 0)` };
        }}
      />
      <SplitText
        lines={rows}
        size={size}
        align={align}
        colours={colours}
        by="line"
        style={{ ...style, position: 'absolute', top: 0, left: 0, right: 0 }}
        piece={(p) => {
          const { leaving, front, back } = edges(p.index);
          return { ...ROOM, color: 'transparent', background: stage.accent, clipPath: `inset(0 ${100 - front}% 0 ${leaving ? back : back}%)` };
        }}
      />
    </div>
  );
};
