/**
 * Pure geometry for the Home widgets' charts, re-implementing what recharts (3.x, as shipped in
 * the live app) computes, so the SVG matches the captured DOM number for number:
 *  - Y axis: recharts getNiceTickValues for the default domain [0, 'auto'] with tickCount 5
 *    (trend max 6 -> 0,2,4,6,8; bar max 3 -> 0,0.75,1.5,2.25,3); the scale domain is [0, last tick].
 *  - X axis tick labels: interval "preserveStartEnd", minTickGap 5, bounds [0, chart width],
 *    sizes from rechartsTickWidth (Inter 10px w600, see textWidth.ts).
 *  - Bars: band scale, barCategoryGap 10%, bar size floor(band - 2 * gap), top radius 3.
 *  - Pie: startAngle 0 counter-clockwise, outerRadius 85% of the offset box, labels at 55% radius.
 * No DOM, no state: everything is a function of the props.
 */
import { rechartsTickWidth } from "./textWidth";

const fix = (n: number) => Math.round(n * 1e10) / 1e10;

// ---------------------------------------------------------------- nice ticks (recharts-scale)

const digitCount = (v: number) => (v === 0 ? 1 : Math.floor(Math.log10(Math.abs(v))) + 1);

const formatStep = (roughStep: number, correction: number): number => {
  if (roughStep <= 0) return 0;
  const dc = digitCount(roughStep);
  const dcv = Math.pow(10, dc);
  const ratio = roughStep / dcv;
  const scale = dc !== 1 ? 0.05 : 0.1;
  const amend = (Math.ceil(fix(ratio / scale)) + correction) * scale;
  return fix(amend * dcv);
};

const calculateStep = (
  min: number,
  max: number,
  tickCount: number,
  correction = 0,
): { step: number; tickMin: number; tickMax: number } => {
  const step = formatStep((max - min) / (tickCount - 1), correction);
  let middle: number;
  if (min <= 0 && max >= 0) middle = 0;
  else {
    middle = (min + max) / 2;
    middle = fix(middle - (middle % step));
  }
  let below = Math.ceil(fix((middle - min) / step));
  let up = Math.ceil(fix((max - middle) / step));
  const scaleCount = below + up + 1;
  if (scaleCount > tickCount) return calculateStep(min, max, tickCount, correction + 1);
  if (scaleCount < tickCount) {
    up = max > 0 ? up + (tickCount - scaleCount) : up;
    below = max > 0 ? below : below + (tickCount - scaleCount);
  }
  return { step, tickMin: fix(middle - below * step), tickMax: fix(middle + up * step) };
};

/** recharts' Y ticks for domain [0, dataMax] (tickCount 5, decimals allowed). */
export const niceTicks = (dataMax: number, tickCount = 5): number[] => {
  const max = Math.max(0, dataMax);
  if (max === 0) {
    // getTickOfSingleValue(0): middle = floor((count-1)/2), step 1 -> 0,1,2,3,4
    return Array.from({ length: tickCount }, (_, i) => i);
  }
  const { step, tickMin, tickMax } = calculateStep(0, max, tickCount);
  const out: number[] = [];
  for (let v = tickMin; v <= tickMax + step * 0.1; v = fix(v + step)) out.push(v);
  return out;
};

/** Y scale maximum (top of the plot) for the given data, as recharts sets it. */
export const niceMax = (dataMax: number): number => {
  const t = niceTicks(dataMax);
  return t[t.length - 1];
};

// ---------------------------------------------------------------- x tick labels

export type XTick = { text: string; coordinate: number; tickCoord: number; show: boolean };

const isVisible = (pos: number, size: number, start: number, end: number) =>
  pos >= start && pos <= end && pos - size / 2 - start >= 0 && pos + size / 2 - end <= 0;

/**
 * recharts getTicksStart(preserveEnd = true) ("preserveStartEnd"): keep the last tick (pulled inside
 * the right edge), then walk from the first tick (pushed inside the left edge), hiding any label that
 * would come closer than minTickGap to the previous shown one.
 */
export const preserveStartEndTicks = (
  labels: { text: string; coordinate: number }[],
  start: number,
  end: number,
  minTickGap = 5,
  sizeOf: (text: string) => number = rechartsTickWidth,
): XTick[] => {
  const len = labels.length;
  const result: XTick[] = labels.map((l) => ({ ...l, tickCoord: l.coordinate, show: false }));
  if (len === 0) return result;
  let s = start;
  let e = end;
  // tail
  const tail = result[len - 1];
  const tailSize = sizeOf(tail.text);
  const tailGap = tail.coordinate + tailSize / 2 - e;
  tail.tickCoord = tailGap > 0 ? tail.coordinate - tailGap : tail.coordinate;
  if (isVisible(tail.tickCoord, tailSize, s, e)) {
    e = tail.tickCoord - (tailSize / 2 + minTickGap);
    tail.show = true;
  }
  for (let i = 0; i < len - 1; i++) {
    const entry = result[i];
    const size = sizeOf(entry.text);
    if (i === 0) {
      const delta = entry.coordinate - size / 2 - s;
      entry.tickCoord = delta < 0 ? entry.coordinate - delta : entry.coordinate;
    }
    if (isVisible(entry.tickCoord, size, s, e)) {
      s = entry.tickCoord + (size / 2 + minTickGap);
      entry.show = true;
    }
  }
  return result;
};

// ---------------------------------------------------------------- bars

export type BarRect = { index: number; x: number; y: number; width: number; height: number; path: string };

/** recharts Rectangle path with radius [r, r, 0, 0] (rounded top corners), radius clamped like recharts. */
export const topRoundedRectPath = (x: number, y: number, w: number, h: number, radius = 3): string => {
  const maxR = Math.min(Math.abs(w) / 2, Math.abs(h));
  const r = Math.min(radius, maxR);
  let p = `M${x},${y + r}`;
  if (r > 0) p += `A ${r},${r},0,0,1,${x + r},${y}`;
  p += `L ${x + w - r},${y}`;
  if (r > 0) p += `A ${r},${r},0,0,1,\n        ${x + w},${y + r}`;
  p += `L ${x + w},${y + h}`;
  p += `L ${x},${y + h}`;
  p += "Z";
  return p;
};

/** Band geometry for n categories over [x0, x0 + width] (barCategoryGap 10%, one bar series). */
export const bandLayout = (n: number, x0: number, width: number) => {
  const band = n > 0 ? width / n : width;
  const offset = band * 0.1;
  let size = band - 2 * offset;
  if (size > 1) size = Math.floor(size);
  return {
    band,
    barWidth: size,
    barX: (i: number) => x0 + i * band + offset,
    center: (i: number) => x0 + i * band + band / 2,
  };
};

// ---------------------------------------------------------------- pie

const RAD = Math.PI / 180;
export const polar = (cx: number, cy: number, r: number, angleDeg: number) => ({
  x: cx + Math.cos(-RAD * angleDeg) * r,
  y: cy + Math.sin(-RAD * angleDeg) * r,
});

export type PieSector = {
  index: number;
  value: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  percent: number;
  path: string | null;
};

/** recharts getSectorPath for innerRadius 0 (whitespace as in the live DOM). */
const sectorPath = (cx: number, cy: number, r: number, startAngle: number, endAngle: number): string | null => {
  const delta = endAngle - startAngle;
  if (Math.abs(delta) <= 0) return null;
  const angle = Math.sign(delta) * Math.min(Math.abs(delta), 359.999);
  const tempEnd = startAngle + angle;
  const s = polar(cx, cy, r, startAngle);
  const e = polar(cx, cy, r, tempEnd);
  return `M ${s.x},${s.y}
    A ${r},${r},0,
    ${+(Math.abs(angle) > 180)},${+(startAngle > tempEnd)},
    ${e.x},${e.y}
  L ${cx},${cy} Z`;
};

/**
 * Sectors from values, starting at 0deg (3 o'clock), counter-clockwise, like recharts' Pie.
 * `sweep` (0..1) is recharts' entry animation: every angle scaled by it.
 */
export const pieSectors = (values: number[], cx: number, cy: number, r: number, sweep = 1): PieSector[] => {
  const total = values.reduce((a, v) => a + Math.max(0, v), 0);
  let acc = 0;
  return values.map((raw, index) => {
    const value = Math.max(0, raw);
    const startAngle = total > 0 ? (acc / total) * 360 * sweep : 0;
    acc += value;
    const endAngle = total > 0 ? (acc / total) * 360 * sweep : 0;
    return {
      index,
      value,
      startAngle,
      endAngle,
      midAngle: (startAngle + endAngle) / 2,
      percent: total > 0 ? value / total : 0,
      path: value > 0 ? sectorPath(cx, cy, r, startAngle, endAngle) : null,
    };
  });
};

/** "18%" as the app formats slice / legend percentages. */
export const formatPercent = (p: number) => `${Math.round(p * 100)}%`;

/** Counts are shown as integers; animated (fractional) values round. */
export const formatCount = (v: number) => String(Math.round(v));

/**
 * True when every value is a whole number. The app only ever labels whole counts: recharts hides
 * LabelList and pie labels while an animation runs and shows the final values afterwards. So any
 * fractional value means "mid-transition", and the chart labels are hidden.
 */
export const isSettled = (values: number[]) => values.every((v) => Math.abs(v - Math.round(v)) < 1e-6);

/**
 * Whole counts and their shares of the whole total, which is what the app's labels show
 * ("1" / "9%" for 1 of 11). Percentages never come from fractional in-between values.
 */
export const integerShares = (values: number[]) => {
  const counts = values.map((v) => Math.max(0, Math.round(v)));
  const total = counts.reduce((a, c) => a + c, 0);
  return counts.map((count) => ({ count, percent: total > 0 ? count / total : 0 }));
};

/** Chart palette slot for category i (the app cycles chart-1 .. chart-7). */
export const chartVar = (i: number) => `hsl(var(--chart-${(i % 7) + 1}))`;
