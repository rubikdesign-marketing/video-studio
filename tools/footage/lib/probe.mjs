// Measuring a clip (FOOTAGE-PLAN.md section 3, "Measure"): length, size, frame rate and whether it varies, rotation,
// colour (normal, HDR or Log), sound channels, sample rate and level. Reads only; never changes the file.
import { FFMPEG, FFPROBE, round, run } from './common.mjs';

/** The frame rates a working copy is made at. A source is snapped to the nearest one. */
export const RATES = [
  { fps: 24000 / 1001, label: '23.976' }, { fps: 24, label: '24' }, { fps: 25, label: '25' },
  { fps: 30000 / 1001, label: '29.97' }, { fps: 30, label: '30' }, { fps: 50, label: '50' },
  { fps: 60000 / 1001, label: '59.94' }, { fps: 60, label: '60' },
  { fps: 100, label: '100' }, { fps: 120000 / 1001, label: '119.88' }, { fps: 120, label: '120' },
];
const ratio = (s) => { const [a, b] = String(s || '0/1').split('/').map(Number); return b ? a / b : a; };

/** The standard rate closest to fps (by ratio, so 59.7 goes to 59.94 and 24.1 to 24). */
export function standardRate(fps) {
  if (!(fps > 0)) return RATES.find((r) => r.label === '30');
  return RATES.reduce((best, r) => (Math.abs(Math.log(r.fps / fps)) < Math.abs(Math.log(best.fps / fps)) ? r : best));
}

/**
 * Whether frames arrive at a steady rate. times: presentation times in seconds, in order.
 * Variable when more than 2% of the gaps differ from the usual gap by more than a quarter of it.
 */
export function steadiness(times) {
  const gaps = [];
  for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1]);
  if (gaps.length < 10) return { variable: false, gaps: gaps.length, odd: 0, usual: null, fps: null };
  const usual = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)];
  const odd = gaps.filter((g) => Math.abs(g - usual) > usual * 0.25).length;
  const span = times[times.length - 1] - times[0];
  return { variable: odd / gaps.length > 0.02, gaps: gaps.length, odd, usual: round(usual, 5), fps: round(gaps.length / span, 3) };
}

/** Rotation in degrees (0, 90, 180, 270) that a player applies, from the display matrix or the old rotate tag. */
export function rotationOf(stream) {
  const dm = (stream.side_data_list || []).find((d) => d.rotation !== undefined);
  let r = dm ? Number(dm.rotation) : Number(stream.tags?.rotate || 0);
  r = ((Math.round(r / 90) * 90) % 360 + 360) % 360;
  return r;
}

/**
 * The picture's colour: "normal" (SDR), "hdr-hlg", "hdr-pq", or "log" (a flat camera profile that needs its own
 * conversion). Log is found only from what the camera writes in the file; a Log clip with no such label is caught
 * later by the picture check as very flat.
 */
export function colourOf(stream, formatTags = {}) {
  const trc = stream.color_transfer || '';
  const tagText = JSON.stringify({ ...formatTags, ...(stream.tags || {}) }).toLowerCase();
  const out = { transfer: trc || 'unknown', primaries: stream.color_primaries || 'unknown', matrix: stream.color_space || 'unknown', range: stream.color_range || 'unknown', bits: bitsOf(stream.pix_fmt) };
  if (trc === 'arib-std-b67') return { kind: 'hdr-hlg', ...out };
  if (trc === 'smpte2084') return { kind: 'hdr-pq', ...out };
  if (/apple ?log|log ?profile|s-?log|v-?log|c-?log|f-?log|n-?log|camera.?log/.test(tagText)) return { kind: 'log', ...out };
  return { kind: 'normal', ...out };
}
const bitsOf = (pix) => { const m = /p(\d+)/.exec(pix || ''); return m ? Number(m[1]) : 8; };

export function probe(file) {
  return JSON.parse(run(FFPROBE, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]));
}

/** Presentation times of the first `seconds` of video packets. */
export function frameTimes(file, seconds = 30) {
  const out = run(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-read_intervals', `%+${seconds}`, '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file]);
  return out.split('\n').filter((l) => l.trim()).map(Number).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
}

/** Each sound channel's level (RMS and peak in dBFS) and the clip's loudness (LUFS) and true peak. */
export function soundLevels(file, channels) {
  const r = run(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'astats=measure_overall=none:measure_perchannel=RMS_level+Peak_level,ebur128=peak=true', '-f', 'null', '-'], { allowFail: true });
  const text = r.err || '';
  const perChannel = [];
  const rx = /Channel: (\d+)[\s\S]*?Peak level dB: (-?[\d.inf]+)[\s\S]*?RMS level dB: (-?[\d.inf]+)/g;
  let m; while ((m = rx.exec(text))) perChannel.push({ channel: Number(m[1]), peak: num(m[2]), rms: num(m[3]) });
  const summary = text.slice(text.lastIndexOf('Summary:'));
  const lufs = num((/I:\s+(-?[\d.]+) LUFS/.exec(summary) || [])[1]);
  const truePeak = num((/Peak:\s+(-?[\d.]+) dBFS/.exec(summary) || [])[1]);
  return { perChannel: perChannel.slice(0, channels), lufs, truePeak };
}
const num = (s) => (s === undefined ? null : /inf/.test(s) ? -Infinity : Number(s));

/** What a channel layout means for this clip, in plain words. Pure. */
export function channelNote(levels) {
  const ch = levels.perChannel;
  if (ch.length < 2) return { kind: 'mono', note: null };
  const loud = Math.max(...ch.map((c) => c.rms));
  const quiet = ch.filter((c) => c.rms === -Infinity || loud - c.rms > 30);
  if (quiet.length && quiet.length < ch.length) return { kind: 'one-side', note: `the sound is on channel ${ch.filter((c) => !quiet.includes(c)).map((c) => c.channel).join(' and ')} only (a microphone on one side); it will be copied to both` };
  return { kind: 'stereo', note: null };
}

/** Everything ingest needs to know about a source file. */
export function measure(file) {
  const p = probe(file);
  const v = p.streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
  const a = p.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(p.format.duration) || Number(v?.duration) || Number(a?.duration) || 0;
  const out = { file, duration: round(duration), container: p.format.format_name, video: null, audio: null };
  if (v) {
    const times = frameTimes(file);
    const steady = steadiness(times);
    const avg = ratio(v.avg_frame_rate) || steady.fps || ratio(v.r_frame_rate);
    const rotation = rotationOf(v);
    const [w, h] = [v.width, v.height];
    const shown = rotation % 180 ? [h, w] : [w, h];
    out.video = {
      codec: v.codec_name, width: shown[0], height: shown[1], stored: [w, h], rotation,
      fps: round(avg, 3), nominal: v.r_frame_rate, variable: steady.variable, steadiness: steady,
      target: standardRate(steady.variable ? (steady.fps || avg) : avg).label,
      colour: colourOf(v, p.format.tags), pixFmt: v.pix_fmt,
    };
  }
  if (a) {
    const levels = soundLevels(file, a.channels);
    out.audio = { codec: a.codec_name, rate: Number(a.sample_rate), channels: a.channels, layout: a.channel_layout || null, ...levels, layoutNote: channelNote(levels) };
  }
  return out;
}
