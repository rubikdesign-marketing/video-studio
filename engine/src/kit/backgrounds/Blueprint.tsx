// Blueprint: thin solid construction lines in the line colour, and one active path in the accent that draws itself
// around the edge of the frame. The construction lines are the path's own sides carried out to the frame edges, and
// two compass arcs struck from its corners. Every line is solid.
import type { FC } from 'react';
import type { Point } from '../motion';
import { alpha } from '../tokens';
import { Fill, pool, quietCentre, useBackdrop, type BackgroundProps } from './shared';

/** The corners of the path, as shares of the frame. It keeps to the edges and never crosses the middle. */
const CORNERS: [number, number][] = [
  [0.07, 0.2],
  [0.3, 0.2],
  [0.3, 0.1],
  [0.82, 0.1],
  [0.82, 0.26],
  [0.93, 0.26],
  [0.93, 0.8],
  [0.66, 0.8],
  [0.66, 0.9],
  [0.18, 0.9],
  [0.18, 0.74],
  [0.07, 0.74],
];

/** Compass arcs: struck from one corner of the path through the next, and chosen to stay clear of the middle of the frame. Indexes into CORNERS. */
const ARCS = [
  { from: 2, through: 1 },
  { from: 5, through: 4 },
];

/** How fast the head of the active path travels, in laps of the path per second at "alive". */
const LAP_RATE = 0.011;

/** A closed path through `points` with every corner rounded by `radius`. */
const roundedLoop = (points: Point[], radius: number) => {
  const toward = (from: Point, to: Point) => {
    const share = radius / Math.hypot(to.x - from.x, to.y - from.y);
    return `${from.x + (to.x - from.x) * share} ${from.y + (to.y - from.y) * share}`;
  };
  const count = points.length;
  const corners = points.map((p, i) => {
    const before = toward(p, points[(i + count - 1) % count]);
    const after = toward(p, points[(i + 1) % count]);
    return `${i === 0 ? 'M' : 'L'}${before} Q${p.x} ${p.y} ${after}`;
  });
  return `${corners.join(' ')} Z`;
};

const unique = (values: number[]) => [...new Set(values)];

export const Blueprint: FC<BackgroundProps> = ({ energy = 'rest', seed = 1 }) => {
  const b = useBackdrop(energy, seed);
  const { stage, dark, width, height, vh, thin } = b;
  // The light is flat: one faint lift of the soft fill, so the page is not dead.
  const lift = pool(stage.soft, dark ? 0.45 : 0.4, width * 0.5 + b.drift(2, 14), height * 0.3 + b.drift(3, 8), width * 0.6, height * 0.8);
  const points = CORNERS.map(([x, y]) => ({ x: width * x, y: height * y }));
  const loop = roundedLoop(points, vh(1.6));

  // The head runs on at a steady pace. The drawn length swells and shrinks more slowly than the head moves, so the
  // tail always follows and never backs up: the path draws itself, is taken up from behind, and draws again.
  const head = b.phase(0) / (Math.PI * 2) + b.t * LAP_RATE;
  const drawn = 0.27 + 0.15 * Math.sin(b.t * LAP_RATE * 5 + b.phase(1));
  const tail = (((head - drawn) % 1) + 1) % 1;

  const frame = { position: 'absolute', inset: 0 } as const;
  const size = { width, height, viewBox: `0 0 ${width} ${height}`, fill: 'none' };
  return (
    <Fill colour={stage.page} layers={[lift]}>
      {/* Construction lines, quieter in the middle where the content sits. */}
      <svg {...size} style={{ ...frame, ...quietCentre(stage.page, 0.3) }} stroke={b.rule} strokeWidth={thin}>
        {unique(points.map((p) => p.x)).map((x) => (
          <line key={`x${x}`} x1={x} y1={0} x2={x} y2={height} />
        ))}
        {unique(points.map((p) => p.y)).map((y) => (
          <line key={`y${y}`} x1={0} y1={y} x2={width} y2={y} />
        ))}
        {ARCS.map(({ from, through }) => {
          const centre = points[from];
          const edge = points[through];
          return <circle key={from} cx={centre.x} cy={centre.y} r={Math.hypot(edge.x - centre.x, edge.y - centre.y)} />;
        })}
      </svg>
      <svg {...size} style={frame}>
        <path d={loop} stroke={b.rule} strokeWidth={thin * 1.5} />
        <path
          d={loop}
          pathLength={1}
          stroke={alpha(stage.accent, dark ? 0.75 : 0.6)}
          strokeWidth={vh(0.24)}
          strokeDasharray={`${drawn} ${1 - drawn}`}
          strokeDashoffset={-tail}
        />
      </svg>
    </Fill>
  );
};
