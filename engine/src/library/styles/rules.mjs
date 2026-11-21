// Rules the preview composition (StylePreview.tsx) and the plan (tools/styles/render-previews.mjs) must agree on.
// A plain module with no imports, so both the Remotion bundler and node can load it.

/** Clip size in pixels for each size name: 480 on the long side. */
export const SIZES = {
  '9:16': { width: 270, height: 480 },
  '16:9': { width: 480, height: 270 },
  '1:1': { width: 480, height: 480 },
  '4:5': { width: 384, height: 480 },
};

/** BlurIn to blur-in. */
export const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** A move plays on a real capture when its family starts with capture-, or its name starts with join-, stage-, product- or relayout-. */
export const isCaptureMove = (name, family) => String(family).startsWith('capture-') || /^(join|stage|product|relayout)-/.test(name);
