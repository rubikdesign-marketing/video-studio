/**
 * Settings for the Remotion command line (studio, render, still).
 * They do not apply when rendering through the Node.js APIs; pass the options there instead.
 * All options: https://remotion.dev/docs/config
 */
import { Config } from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
Config.setRspack(true);
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Fresh starting frames where tools/film/render.sh asks for them. It sets KEYFRAMES_AT to frame numbers (like
// "210,516", one per scene start) when it renders a preview, so one scene can later be swapped into the preview
// without touching a single frame of the scenes around it. Without KEYFRAMES_AT nothing changes.
const keyframesAt = (process.env.KEYFRAMES_AT ?? '').split(',').filter(Boolean).map(Number);
if (keyframesAt.length) {
  const expression = 'expr:' + keyframesAt.map((frame) => `eq(n,${frame})`).join('+');
  Config.overrideFfmpegCommand(({ args }) => {
    if (!args.includes('-crf')) return args; // only the step that encodes the picture, not the one that copies it
    return [...args.slice(0, -1), '-force_key_frames', expression, ...args.slice(-1)];
  });
}
