'use strict';
// Rendering engine shared by the trailer and the highlights.
//  1. every clip -> frame-exact intermediate (x264 near-lossless, PCM audio with edge fades)
//  2. intermediates concatenated with stream copy
//  3. audio: optional music bed (beat-aligned) ducked under gameplay SFX with a sidechain
//     compressor, mixed, two-pass linear loudnorm, true-peak limiter
//  4. delivery encode: H.264 High yuv420p + AAC, +faststart
const fs = require('fs');
const path = require('path');
const { run, log } = require('../lib/util');
const { reframe, finish } = require('./frame');
const G = require('./graphics');

const A_FMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';

function interArgs(edl) {
  const i = edl.intermediate;
  return ['-c:v', 'libx264', '-preset', i.preset, '-crf', String(i.crf), '-pix_fmt', 'yuv420p', '-r', String(edl.fps), '-g', String(edl.fps), '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', '2'];
}

/** Render one timeline item to an intermediate .mkv. */
async function renderItem(cfg, edl, fmt, item, out, { fadeIn = 0, fadeOut = 0, fadeInColor = 'black', title, label, endcard, tag, audioGain = 1, mute = false, work }) {
  const fps = edl.fps;
  const dur = item.frames / fps;
  const brand = { ...edl.brand, logo: path.join(cfg.paths.root, edl.brand.logo) };
  const L = new G.Layer(work, path.basename(out, '.mkv'));
  const parts = [];
  const rf = reframe('[0:v]', fmt, endcard ? { ...item.framing, mode: item.framing.mode === 'full' ? 'full' : item.framing.mode } : item.framing, 'c');
  parts.push(rf.graph);
  let v = rf.out;
  if (endcard) {
    parts.push(`${v}boxblur=18:3,eq=brightness=-0.2:saturation=0.8[c_bg]`);
    v = '[c_bg]';
  }
  const fx = finish(v, fmt, { durSec: dur, pushIn: endcard ? 0.02 : edl.look.pushIn, vignette: edl.look.vignette, fadeIn, fadeOut, fadeInColor, fps }, 'c');
  parts.push(fx.graph);
  v = fx.out;
  const gfx = [];
  const beat = 60 / (edl.music?.bpm || 120);
  if (title) gfx.push(G.sectionTitle(L, fmt, item.framing, brand, title, { start: (edl.titleDefaults?.showAtBar || 0.15) * beat * 4, hold: Math.min(edl.titleDefaults?.holdSec || 2.6, dur - 0.4), beat }));
  if (label) gfx.push(G.montageLabel(L, fmt, item.framing, brand, label, dur));
  if (endcard) gfx.push(G.endCard(L, fmt, brand, item.lines, { beat, durSec: dur, logoFile: brand.logo }));
  if (tag) gfx.push(G.brandTag(L, fmt, brand, { start: tag.start, durSec: dur, logoFile: brand.logo, url: tag.url }));
  let k = 0;
  const lab = () => `g${k++}`;
  for (const g of gfx) {
    for (const o of g.overlays) { const n = lab(); parts.push(`${v}[${o.input + 1}:v]overlay=x='${o.x}':y='${o.y}':eval=frame:shortest=0:eof_action=pass[${n}]`); v = `[${n}]`; }
    if (g.logo) { const n = lab(); parts.push(`[${g.logo.input + 1}:v]${g.logo.chain}[lg${n}]`, `${v}[lg${n}]overlay=x='${g.logo.x}':y='${g.logo.y}':eval=frame:eof_action=pass[${n}]`); v = `[${n}]`; }
    if (g.filters.length) { const n = lab(); parts.push(`${v}${g.filters.join(',')}[${n}]`); v = `[${n}]`; }
  }
  const e = edl.audio?.edgeFadeSec ?? 0.03;
  const silent = mute || endcard;
  parts.push(`[0:a]${A_FMT},volume=${silent ? 0 : audioGain},afade=t=in:st=0:d=${e},afade=t=out:st=${(dur - e).toFixed(4)}:d=${e},apad,atrim=0:${dur.toFixed(4)}[a]`);
  const inputs = ['-ss', String(item.src.start), '-t', String((dur + 0.3).toFixed(3)), '-i', item.src.file];
  for (const i of L.inputs) inputs.push(...i);
  await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', ...inputs, '-filter_complex', parts.join(';'), '-map', v, '-map', '[a]', '-frames:v', String(item.frames), '-t', dur.toFixed(4), ...interArgs(edl), out]);
}

/** The original studio intro, scaled (never cropped) onto the canvas, with its own soundtrack. */
async function renderIntro(cfg, edl, fmt, out) {
  const file = path.join(cfg.paths.root, edl.intro.file);
  const { out: dj } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const frames = Math.round(Number(dj) * edl.fps);
  const { width: W, height: H } = fmt;
  const vf = `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${edl.fps},tpad=stop_mode=clone:stop_duration=0.5,format=yuv420p`;
  await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-i', file, '-filter_complex', `[0:v]${vf}[v];[0:a]${A_FMT},apad,atrim=0:${(frames / edl.fps).toFixed(4)}[a]`, '-map', '[v]', '-map', '[a]', '-frames:v', String(frames), ...interArgs(edl), out]);
  return frames / edl.fps;
}

async function concat(files, out) {
  const list = `${out}.txt`;
  fs.writeFileSync(list, files.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
}

/** Final audio: [music bed ducked under the programme audio] + programme audio -> two-pass loudnorm -> limiter. */
async function mixAudio(edl, programme, out, { music, totalSec }) {
  const L = edl.audio.loudness;
  const inputs = ['-i', programme];
  let graph;
  if (music) {
    inputs.push('-i', music.file);
    const d = edl.audio.duck;
    const ms = Math.round(music.atSec * 1000);
    graph = [
      `[0:a]${A_FMT},apad,asplit=2[key][dry]`,
      `[1:a]${A_FMT},atrim=start=${music.fromSec.toFixed(4)}:duration=${music.durSec.toFixed(4)},asetpts=PTS-STARTPTS,volume=${music.gain},afade=t=in:st=0:d=${music.fadeIn},afade=t=out:st=${(music.durSec - music.fadeOut).toFixed(4)}:d=${music.fadeOut},adelay=${ms}|${ms},apad[mus]`,
      `[mus][key]sidechaincompress=threshold=${d.threshold}:ratio=${d.ratio}:attack=${d.attack}:release=${d.release}:makeup=${d.makeup}[duck]`,
      `[duck][dry]amix=inputs=2:normalize=0:duration=first,atrim=0:${totalSec.toFixed(4)}[mix]`,
    ].join(';');
  } else {
    graph = `[0:a]${A_FMT},apad,atrim=0:${totalSec.toFixed(4)}[mix]`;
  }
  const premix = out.replace(/\.wav$/, '.premix.wav');
  await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', ...inputs, '-filter_complex', graph, '-map', '[mix]', '-c:a', 'pcm_f32le', premix]);
  const { err } = await run('ffmpeg', ['-hide_banner', '-nostdin', '-i', premix, '-af', `loudnorm=I=${L.I}:TP=${L.TP}:LRA=${L.LRA}:print_format=json`, '-f', 'null', '-']);
  const m = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1));
  const af = `loudnorm=I=${L.I}:TP=${L.TP}:LRA=${L.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000,aresample=192000,alimiter=limit=${Math.pow(10, (L.TP - 0.6) / 20).toFixed(4)}:level=false:attack=2:release=60,aresample=48000`; // 4x oversampled: catches inter-sample peaks
  await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-i', premix, '-af', af, '-ar', '48000', '-c:a', 'pcm_s16le', out]);
  return { measuredIn: { I: Number(m.input_i), TP: Number(m.input_tp), LRA: Number(m.input_lra) } };
}

async function deliver(edl, video, audio, out) {
  const e = edl.encode;
  await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-i', video, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', e.codec, '-preset', e.preset, '-crf', String(e.crf), '-profile:v', e.profile, '-pix_fmt', e.pixFmt, '-r', String(edl.fps), '-g', String(edl.fps * 2),
    '-c:a', 'aac', '-b:a', e.audioBitrate, '-ar', String(e.sampleRate), '-ac', '2', '-movflags', '+faststart', '-shortest', out]);
}

/** Exact video length of an intermediate/programme (frames / fps). */
async function videoSec(file, fps) {
  const { out } = await run('ffprobe', ['-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file]);
  return Number(out.trim()) / fps;
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
}

module.exports = { renderItem, renderIntro, concat, mixAudio, deliver, pool, videoSec, log };
