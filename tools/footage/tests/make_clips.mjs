#!/usr/bin/env node
// Makes synthetic test clips with known answers for the footage tool (FOOTAGE-PLAN.md phase 1), until the owner's
// three real clips arrive. Speech comes from the Mac's own voice ("say"), so it needs to run outside Claude's command
// sandbox. Nothing here is a real person.
//
//   node tools/footage/tests/make_clips.mjs <out folder>
//
// Writes into <out folder>/footage/ (a job's footage folder) and <out folder>/truth.json (what each clip really holds).
import fs from 'node:fs';
import path from 'node:path';
import { FFMPEG, run } from '../lib/common.mjs';

const out = path.resolve(process.argv[2] || 'footage-test-job');
const foot = path.join(out, 'footage');
const tmp = path.join(out, '.make');
fs.mkdirSync(foot, { recursive: true }); fs.mkdirSync(tmp, { recursive: true });
const ff = (...a) => run(FFMPEG, ['-hide_banner', '-v', 'error', '-y', ...a]);

/** Speech for each phrase, joined with known gaps. Returns the 48 kHz mono wav and when each phrase's sound starts and ends. */
function speech(name, phrases, gaps, voice = 'Samantha') {
  const parts = []; const truth = []; let t = 0.6;
  ff('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '0.6', path.join(tmp, `${name}-lead.wav`));
  parts.push(path.join(tmp, `${name}-lead.wav`));
  phrases.forEach((text, i) => {
    const raw = path.join(tmp, `${name}-${i}.raw.wav`);
    const p = path.join(tmp, `${name}-${i}.wav`);
    run('say', ['-v', voice, '-o', raw, '--data-format=LEI16@48000', text]);
    // Trim the voice's own silence so the phrase's sound starts exactly at its place in the clip.
    ff('-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0,areverse', '-ac', '1', '-ar', '48000', p);
    const d = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]));
    truth.push({ text, start: +t.toFixed(3), end: +(t + d).toFixed(3) });
    parts.push(p); t += d;
    const g = gaps[i] ?? 0.8;
    const gp = path.join(tmp, `${name}-gap-${i}.wav`);
    ff('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(g), gp);
    parts.push(gp); t += g;
  });
  const list = path.join(tmp, `${name}.txt`);
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const wav = path.join(tmp, `${name}.wav`);
  ff('-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', wav);
  return { wav, phrases: truth, duration: +t.toFixed(3) };
}

const truth = {};

// 1. Talking to camera: fillers, a retake, pauses of different lengths. 1920x1080, 30 fps, normal colour.
{
  const s = speech('talking', [
    'Um, so today I want to show you how boards work.',
    'Every project starts with a board.',
    'Every project starts, uh, with a board.',
    'You add a card, and the team sees it right away.',
    "That's it. Like, it really is that simple.",
  ], [0.9, 0.5, 1.4, 2.2, 1.0]);
  ff('-f', 'lavfi', '-i', `testsrc2=s=1920x1080:r=30:d=${s.duration}`, '-i', s.wav, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', path.join(foot, 'talking.mp4'));
  truth.talking = { phrases: s.phrases, duration: s.duration, fillers: ['um', 'uh', 'like'], retake: [1, 2], fps: 30, size: [1920, 1080] };
}

// 2. Phone clip: HDR (HLG, 10-bit HEVC), recorded sideways (shown upright by a 90° rotation), frames at an uneven
// rate, the voice on the left channel only.
{
  const s = speech('phone', ['Hi, this is a quick update from the office.', 'The new board view is live for everyone.'], [0.8, 0.8], 'Daniel');
  const sdr = path.join(tmp, 'phone-sdr.mov');
  ff('-f', 'lavfi', '-i', `testsrc2=s=1920x1080:r=30:d=${s.duration}`, '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '16', sdr);
  const hdr = path.join(tmp, 'phone-hdr.mov');
  // Every fifth frame arrives 15 ms late: a variable frame rate, as phones write.
  ff('-i', sdr, '-i', s.wav,
    '-vf', "format=yuv444p,zscale=tin=bt709:pin=bt709:min=bt709:rin=tv:t=arib-std-b67:p=bt2020:m=bt2020nc:r=tv:npl=203,format=yuv420p10le,settb=1/15360,setpts='(N/30+if(eq(mod(N,5),4),0.015,0))/TB'",
    '-fps_mode', 'vfr', '-enc_time_base', '1/15360', '-c:v', 'libx265', '-x265-params', 'log-level=error', '-crf', '20', '-tag:v', 'hvc1',
    '-color_primaries', 'bt2020', '-color_trc', 'arib-std-b67', '-colorspace', 'bt2020nc',
    '-af', 'pan=stereo|c0=c0|c1=0*c0', '-c:a', 'aac', '-b:a', '256k', '-shortest', hdr);
  ff('-display_rotation:v:0', '90', '-i', hdr, '-c', 'copy', path.join(foot, 'phone-hdr.mov'));
  truth['phone-hdr'] = { phrases: s.phrases, duration: s.duration, colour: 'hdr-hlg', rotation: 90, shownSize: [1080, 1920], variable: true, oneSide: true };
}

// 3. Noisy room: dark, soft, grainy picture with light flicker; speech with steady noise, 50 Hz hum, music under it,
// a clipped stretch and a few clicks. (ffmpeg's sine source is at one-eighth of full scale, so the hum here sits
// at about -35 dBFS, like a real ground loop.)
{
  const s = speech('noisy', ['Welcome to the booth, we are showing the new release today.', 'Come and try it, it only takes a minute.'], [1.5, 1.0], 'Fred');
  const d = s.duration;
  const music = 'sine=f=220:r=48000,volume=0.05[m1];sine=f=277.18:r=48000,volume=0.04[m2];sine=f=329.63:r=48000,volume=0.04[m3];[m1][m2][m3]amix=inputs=3:normalize=0[music]';
  const hum = 'sine=f=50:r=48000,volume=0.25[h1];sine=f=100:r=48000,volume=0.15[h2];sine=f=150:r=48000,volume=0.08[h3];[h1][h2][h3]amix=inputs=3:normalize=0[hum]';
  const noise = 'anoisesrc=c=pink:r=48000:a=0.02[noise]';
  // Clicks: three single-sample spikes; clipping: 1.2 s of the second phrase driven far past full scale.
  const clipFrom = s.phrases[1].start + 0.3; const clipTo = clipFrom + 1.2;
  const clicks = [1.25, 2.9, d - 0.6];
  const voice = `[0:a]volume='if(between(t,${clipFrom},${clipTo}),12,1)':eval=frame,alimiter=limit=1:level=false:attack=0.1:release=1[vraw];[vraw]aeval='clip(val(0),-0.98,0.98)'[v]`;
  const clickExpr = clicks.map((c) => `between(t,${c},${c + 0.00003})`).join('+');
  ff('-i', s.wav, '-filter_complex',
    `${voice};${music};${hum};${noise};[v][music][hum][noise]amix=inputs=4:normalize=0:duration=first[mix];[mix]aeval='val(0)+if(${clickExpr},0.9,0)'[a]`,
    '-map', '[a]', '-t', String(d), '-ar', '48000', '-c:a', 'pcm_s16le', path.join(tmp, 'noisy-audio.wav'));
  ff('-f', 'lavfi', '-i', `testsrc2=s=1920x1080:r=25:d=${d}`, '-i', path.join(tmp, 'noisy-audio.wav'),
    '-vf', "eq=brightness=-0.32:contrast=0.7,eq=brightness='0.03*sin(2*PI*t*4)':eval=frame,gblur=sigma=3,noise=alls=28:allf=t",
    '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', path.join(foot, 'noisy.mp4'));
  truth.noisy = { phrases: s.phrases, duration: d, hum: 50, clipped: [clipFrom, clipTo], clicks, music: true, dark: true, soft: true, flicker: true, fps: 25 };
}

// 4. Two shots: a steady shot, a hard cut at 4.0 s, then a shaky shot.
{
  ff('-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30:d=4', '-f', 'lavfi', '-i', 'mandelbrot=s=2112x1188:r=30', '-f', 'lavfi', '-i', 'anoisesrc=c=brown:r=48000:a=0.01:d=8',
    '-filter_complex', "[1:v]trim=duration=4,crop=1920:1080:x='96+60*sin(n*1.7)*cos(n*0.9)':y='54+40*sin(n*2.3)',setsar=1,format=yuv420p[b];[0:v]format=yuv420p[a];[a][b]concat=n=2:v=1:a=0[v]",
    '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-crf', '18', '-c:a', 'aac', '-t', '8', path.join(foot, 'twoshots.mp4'));
  truth.twoshots = { cuts: [4.0], shaky: [4.0, 8.0], duration: 8 };
}

fs.writeFileSync(path.join(out, 'truth.json'), `${JSON.stringify(truth, null, 2)}\n`);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Made ${Object.keys(truth).length} test clips in ${foot}`);
