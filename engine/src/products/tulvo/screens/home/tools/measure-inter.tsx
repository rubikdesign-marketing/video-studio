/**
 * TOOL (not a screen): measures Inter advance widths in Remotion's own Chrome, the same way
 * recharts measures axis tick labels (an absolutely positioned <span>, font-size in px,
 * getBoundingClientRect().width). Output feeds ../textWidth.ts.
 *
 *   npx remotion still src/products/tulvo/screens/home/tools/measure-inter.tsx MeasureInter out.png
 *   python3 -I src/products/tulvo/screens/home/tools/decode-widths.py out.png
 *
 * (Remotion does not forward the page console, so every width is written as one pixel:
 *  round(width * 1000) as a 24-bit RGB integer, row 0, in the order of ORDER below.)
 *
 * Has its own registerRoot so it never touches Root.tsx or the screen registry.
 */
import React, { useEffect, useState } from "react";
import { Composition, continueRender, delayRender, registerRoot } from "remotion";
import { waitForTulvoFonts } from "../../../fonts";

const SAMPLES = [
  "Prospecting",
  "Pitch Sent",
  "Negotiation",
  "Contract Review",
  "Signed",
  "Live",
  "Closed",
  "Oct 2026",
  "Nov 2026",
  "Dec 2026",
  "Sep 2026",
];

const CHARS = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));

/** Order of the encoded pixels: for weight 400 then 600: printable ASCII 32..126, then SAMPLES, all at 10px. */
export const ORDER = [400, 600].flatMap((w) => [...CHARS.map((c) => `${w}:${c}`), ...SAMPLES.map((s) => `${w}:${s}`)]);

const measure = (text: string, fontSize: number, fontWeight = 400): number => {
  const span = document.createElement("span");
  span.textContent = text;
  Object.assign(span.style, {
    position: "absolute",
    top: "-20000px",
    left: "0",
    whiteSpace: "pre",
    fontFamily: "\"Tulvo Inter\", Inter, sans-serif", // fonts.ts registers the app font as "Tulvo Inter"
    fontSize: `${fontSize}px`,
    fontWeight: String(fontWeight),
    fontOpticalSizing: "auto",
    letterSpacing: "normal",
  });
  document.body.appendChild(span);
  const w = span.getBoundingClientRect().width;
  span.remove();
  return w;
};

const Measure: React.FC = () => {
  const [handle] = useState(() => delayRender("measure inter"));
  const [values, setValues] = useState<number[]>([]);
  useEffect(() => {
    waitForTulvoFonts()
      .then(() => document.fonts.ready)
      .then(() => {
        // Arrays, not objects: integer-like keys ("0".."9") would be reordered by Object.values.
        const out: number[] = [];
        for (const weight of [400, 600]) {
          // Per-character advance at 10px, the tick size (Inter's opsz axis makes advances
          // size-dependent, so they do not scale linearly): "|c|" minus "||" so spaces count too.
          const bars = measure("||", 10, weight);
          for (const ch of CHARS) out.push(measure(`|${ch}|`, 10, weight) - bars);
          for (const s of SAMPLES) out.push(measure(s, 10, weight));
        }
        setValues(out);
        continueRender(handle);
      });
  }, [handle]);
  return (
    <div style={{ position: "absolute", inset: 0, background: "black" }}>
      {values.map((v, i) => {
        const n = Math.round(v * 1000);
        return (
          <div
            key={i}
            style={{ position: "absolute", left: i, top: 0, width: 1, height: 1, background: `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})` }}
          />
        );
      })}
    </div>
  );
};

registerRoot(() => (
  <Composition id="MeasureInter" component={Measure} width={800} height={600} fps={30} durationInFrames={1} />
));
