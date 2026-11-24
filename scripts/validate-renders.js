#!/usr/bin/env node
'use strict';
// Validates every delivered MP4 in renders/trailer and renders/highlights against its .json:
// H.264 High / yuv420p / size / 60 fps, AAC 48 kHz stereo, faststart (moov before mdat),
// duration, integrated loudness and true peak (EBU R128), black stretches. Writes a contact
// sheet per file for visual inspection and renders/validation.json.
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { run, log, args, main } = require('./lib/util');

function atomOrder(file) {
  const fd = fs.openSync(file, 'r');
  const order = [];
  const size = fs.fstatSync(fd).size;
  let pos = 0;
  const b = Buffer.alloc(16);
  while (pos < size && order.length < 20) {
    fs.readSync(fd, b, 0, 16, pos);
    let len = b.readUInt32BE(0);
    const type = b.toString('latin1', 4, 8);
    if (len === 1) len = Number(b.readBigUInt64BE(8));
    else if (len === 0) len = size - pos;
    order.push(type);
    if (len < 8) break;
    pos += len;
  }
  fs.closeSync(fd);
  return order;
}

async function check(cfg, file, spec, targets) {
  const fails = [];
  const { out } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  const dur = Number(j.format.duration);
  const want = (ok, msg) => { if (!ok) fails.push(msg); };
  want(v?.codec_name === 'h264' && v.profile === 'High', `video ${v?.codec_name}/${v?.profile}`);
  want(v?.pix_fmt === 'yuv420p', `pix_fmt ${v?.pix_fmt}`);
  want(v?.width === spec.width && v?.height === spec.height, `size ${v?.width}x${v?.height} (want ${spec.width}x${spec.height})`);
  want(v?.r_frame_rate === `${spec.fps}/1`, `fps ${v?.r_frame_rate}`);
  want(a?.codec_name === 'aac' && Number(a.sample_rate) === 48000 && a.channels === 2, `audio ${a?.codec_name} ${a?.sample_rate} ${a?.channels}ch`);
  want(Number(v?.level) <= 42, `H.264 level ${v?.level / 10} (max 4.2 for broad 1080p60 playback)`);
  want(v?.color_space === 'bt709' && v?.color_primaries === 'bt709' && v?.color_transfer === 'bt709' && v?.color_range === 'tv', `colour tags ${v?.color_space}/${v?.color_primaries}/${v?.color_transfer}/${v?.color_range}`);
  const avDiff = Math.abs(Number(v?.duration) - Number(a?.duration));
  want(avDiff < 0.05, `audio/video length differ by ${avDiff.toFixed(3)}s`);
  want(Number(v?.start_time) === 0 && Number(a?.start_time) === 0, `stream start times v=${v?.start_time} a=${a?.start_time}`);
  // Frame timing: every frame interval must be exactly 1/fps (no dropped or doubled timestamps).
  const { out: pts } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', file]);
  const ts = pts.trim().split('\n').map(Number).sort((x, y) => x - y);
  const step = 1 / spec.fps;
  const irregular = ts.slice(1).filter((t, i) => Math.abs(t - ts[i] - step) > step * 0.25).length;
  want(irregular === 0, `${irregular} irregular frame intervals`);
  const atoms = atomOrder(file);
  const faststart = atoms.indexOf('moov') > -1 && atoms.indexOf('moov') < atoms.indexOf('mdat');
  want(faststart, `atoms ${atoms.join(',')} (moov must precede mdat)`);
  want(Math.abs(dur - spec.expectedSec) < 0.1, `duration ${dur.toFixed(3)}s (want ${spec.expectedSec}s)`);
  const { err } = await run('ffmpeg', ['-hide_banner', '-nostdin', '-i', file, '-filter_complex', '[0:a]ebur128=peak=true[o]', '-map', '[o]', '-map', '0:v', '-vf', 'scale=320:-2,blackdetect=d=0.25:pix_th=0.06', '-f', 'null', '-']);
  const sum = err.slice(err.lastIndexOf('Summary:'));
  const I = Number((/I:\s+(-?[\d.]+) LUFS/.exec(sum) || [])[1]);
  const TP = Number((/Peak:\s+(-?[\d.]+) dBFS/.exec(sum) || [])[1]);
  want(Math.abs(I - targets.I) <= 1, `integrated loudness ${I} LUFS (target ${targets.I})`);
  want(TP <= targets.TP + 0.3, `true peak ${TP} dBFS (limit ${targets.TP})`);
  const blacks = [...err.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  // Black inside the original studio intro (its own black background, letterboxed in tall formats) is intended.
  const introEnd = spec.introSec ? spec.introSec + 0.15 : 0;
  const unintended = blacks.map(([s, e]) => [Math.max(s, introEnd), e]).filter(([s, e]) => e > s);
  const blackSec = +unintended.reduce((t, [s, e]) => t + e - s, 0).toFixed(2);
  want(blackSec < 1.0, `${blackSec}s of black frames outside the intro`);
  // Contact sheet: 12 evenly spaced frames.
  const sheet = file.replace(/\.mp4$/, '.contact.jpg');
  const cols = spec.width > spec.height ? 4 : spec.width === spec.height ? 4 : 6;
  const rows = Math.ceil(12 / cols);
  const tw = spec.width > spec.height ? 480 : spec.width === spec.height ? 360 : 240;
  await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-i', file, '-vf', `fps=${(12 / dur).toFixed(4)},scale=${tw}:-2,tile=${cols}x${rows}:padding=4:color=black`, '-frames:v', '1', '-q:v', '3', sheet]);
  return { file: path.relative(cfg.paths.root, file), ok: fails.length === 0, fails, level: Number(v?.level) / 10, color: v?.color_space, frames: ts.length, avDiffSec: +avDiff.toFixed(3), durationSec: +dur.toFixed(3), loudnessLUFS: I, truePeakDb: TP, blackSec, blacks, faststart, contactSheet: path.relative(cfg.paths.root, sheet), bytes: Number(j.format.size), bitrateKbps: Math.round(Number(j.format.bit_rate) / 1000) };
}

main(async () => {
  const a = args();
  const cfg = config.load();
  const targets = JSON.parse(fs.readFileSync(path.join(cfg.paths.root, 'config', 'trailers', 'inspireverse.json'), 'utf8')).audio.loudness;
  const files = [];
  for (const dir of ['trailer', 'highlights']) {
    const d = path.join(cfg.paths.renders, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.mp4')).sort()) files.push(path.join(d, f));
  }
  if (!files.length) throw new Error('no renders found — run npm run render:all');
  const results = [];
  for (const f of files.filter((x) => !a.only?.length || a.only.some((o) => x.includes(o)))) {
    const specFile = f.replace(/\.mp4$/, '.json');
    if (!fs.existsSync(specFile)) { log.warn(`${path.basename(f)}: no .json spec, skipped`); continue; }
    const r = await check(cfg, f, JSON.parse(fs.readFileSync(specFile, 'utf8')), targets);
    results.push(r);
    (r.ok ? log.ok : log.err)(`${r.file}  ${r.durationSec}s  ${r.loudnessLUFS} LUFS  TP ${r.truePeakDb} dBFS  ${r.bitrateKbps} kb/s${r.fails.length ? `  — ${r.fails.join('; ')}` : ''}`);
  }
  fs.writeFileSync(path.join(cfg.paths.renders, 'validation.json'), JSON.stringify({ checkedAt: new Date().toISOString(), targets, results }, null, 2));
  const bad = results.filter((r) => !r.ok);
  if (bad.length) throw new Error(`${bad.length} render(s) failed validation`);
  log.ok(`${results.length} render(s) valid; contact sheets next to each file`);
});
