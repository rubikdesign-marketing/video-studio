// The working copy (FOOTAGE-PLAN.md section 3, "Edit copy"): a steady frame rate, upright, normal colour, a keyframe
// at least every ten frames so the engine can jump to any frame exactly, at most 3840 on the long side. The sound is
// also saved on its own (sound.wav, 48 kHz) for the sound measurements. The original file is never changed.
import fs from 'node:fs';
import path from 'node:path';
import { FFMPEG, run } from './common.mjs';
import { RATES } from './probe.mjs';

/** The rate as ffmpeg wants it: "30000/1001" for 29.97. */
export const rateArg = (label) => {
  const r = RATES.find((x) => x.label === label);
  if (!r) return '30';
  return Number.isInteger(r.fps) ? String(r.fps) : `${Math.round(r.fps * 1001)}/1001`;
};

/** The picture filters for a measured clip, as one ffmpeg filter chain, and what each does in plain words. Pure. */
export function pictureChain(video, { logLut } = {}) {
  const steps = [];
  const said = [];
  const c = video.colour;
  if (c.kind === 'hdr-hlg' || c.kind === 'hdr-pq') {
    const tin = c.kind === 'hdr-hlg' ? 'arib-std-b67' : 'smpte2084';
    // HDR to normal colour: to linear light with HDR reference white (203 nits, BT.2408) as 1.0, to BT.709 colours,
    // then highlights above white rolled off (mobius 0.5), back to the normal curve. Measured 12 Nov on exact HLG grey
    // patches: 18% grey (HLG 38%) lands at 42%, reference white (HLG 75%) at 88%, peak at 98%, nothing clipped. The
    // usual Hable recipe (npl 100) left reference white at 75%, which looks dark and flat.
    steps.push(`zscale=tin=${tin}:pin=bt2020:min=bt2020nc:rin=tv:t=linear:npl=203`,
      'format=gbrpf32le', 'zscale=p=bt709', 'tonemap=tonemap=mobius:param=0.5:desat=0', 'zscale=t=bt709:m=bt709:r=tv');
    said.push(c.kind === 'hdr-hlg' ? 'HDR (HLG, as phones record) converted to normal colour' : 'HDR (PQ) converted to normal colour');
  } else if (c.kind === 'log') {
    if (logLut) { steps.push(`lut3d=file='${logLut.replace(/'/g, "\\'")}'`); said.push(`Log footage converted with ${path.basename(logLut)}`); }
    else said.push('Log footage: left flat, because no conversion LUT was given (put the camera maker\'s LUT beside the clip as <clip>.cube)');
  }
  if (video.rotation) said.push(`turned upright (it was recorded at ${video.rotation}°)`);
  steps.push("scale='if(gte(iw,ih),min(iw,3840),-2)':'if(gte(iw,ih),-2,min(ih,3840))':flags=lanczos");
  if (video.width > 3840 || video.height > 3840) said.push('made smaller to 3840 on the long side');
  steps.push('format=yuv420p');
  if (video.variable) said.push(`frame rate made steady at ${video.target} (it varied, as phones do)`);
  else if (Math.abs(video.fps - Number(video.target)) > 0.01 && video.target !== '23.976' && video.target !== '29.97' && video.target !== '59.94') said.push(`frame rate set to ${video.target}`);
  return { chain: steps.join(','), said };
}

/** The sound filter: a microphone on one side copied to both; otherwise unchanged. Pure. */
export function soundChain(audio) {
  if (!audio) return { chain: null, said: [] };
  const n = audio.layoutNote;
  if (n?.kind === 'one-side') {
    const live = audio.perChannel.reduce((a, b) => (b.rms > a.rms ? b : a)).channel - 1;
    return { chain: `pan=stereo|c0=c${live}|c1=c${live}`, said: ['sound copied from the one live channel to both sides'] };
  }
  return { chain: null, said: [] };
}

/** Make edit.mp4 (when the clip has a picture) and sound.wav in dir. Returns what was done, in plain words. */
export function makeWorkingCopy(src, m, dir, { logLut } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const said = [];
  if (m.video) {
    const pic = pictureChain(m.video, { logLut });
    said.push(...pic.said);
    const args = ['-hide_banner', '-v', 'error', '-y', '-i', src, '-map', '0:v:0', '-vf', pic.chain,
      '-fps_mode', 'cfr', '-r', rateArg(m.video.target),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-g', '10', '-bf', '0', '-profile:v', 'high',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];
    if (m.audio) {
      const snd = soundChain(m.audio);
      args.push('-map', '0:a:0', ...(snd.chain ? ['-af', snd.chain] : []), '-c:a', 'aac', '-b:a', '320k', '-ar', '48000');
    }
    args.push('-movflags', '+faststart', path.join(dir, 'edit.mp4'));
    run(FFMPEG, args);
  }
  if (m.audio) {
    const snd = soundChain(m.audio);
    said.push(...snd.said);
    run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', '-i', src, '-map', '0:a:0', ...(snd.chain ? ['-af', snd.chain] : []), '-ar', '48000', '-c:a', 'pcm_s24le', path.join(dir, 'sound.wav')]);
  }
  return said;
}
