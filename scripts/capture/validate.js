'use strict';
// Validates a raw recording from the file itself: container/streams, delivered frame rate,
// black stretches, frozen stretches and audio level. Produces { status, problems, metrics }.
const { run } = require('../lib/util');

function parseIntervals(text, startKey, endKey) {
  const out = [];
  let open = null;
  for (const line of text.split('\n')) {
    const s = new RegExp(`${startKey}:\\s*([\\d.]+)`).exec(line);
    const e = new RegExp(`${endKey}:\\s*([\\d.]+)`).exec(line);
    if (s) open = Number(s[1]);
    if (e && open !== null) { out.push([+open.toFixed(2), +Number(e[1]).toFixed(2)]); open = null; }
  }
  return { out, open };
}

async function validateRecording(file, { width, height, fps, minSec = 3, requireAudio = true } = {}) {
  const problems = [];
  const warnings = [];
  const { out } = await run('ffprobe', ['-v', 'error', '-count_packets', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === 'video');
  const a = j.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(j.format.duration);
  const frames = Number(v?.nb_read_packets || 0);
  const captureFps = duration > 0 ? +(frames / duration).toFixed(2) : 0;
  const metrics = { durationSec: +duration.toFixed(3), width: v?.width, height: v?.height, frames, captureFps, audio: a ? { codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels } : null, bytes: Number(j.format.size) };

  if (!v) problems.push('no video stream');
  if (v && (v.width !== width || v.height !== height)) problems.push(`resolution ${v.width}x${v.height}, expected ${width}x${height}`);
  if (duration < minSec) problems.push(`only ${duration.toFixed(1)} s recorded`);
  if (captureFps < fps * 0.9) warnings.push(`capture delivered ${captureFps} fps of ${fps} requested`);
  if (requireAudio && !a) problems.push('no audio stream');

  // One decode pass at reduced size for picture analysis; audio analysed in the same run.
  const vf = 'scale=480:-2,blackdetect=d=0.5:pix_th=0.08:pic_th=0.98,freezedetect=n=0.002:d=2';
  const args = ['-hide_banner', '-nostdin', '-i', file, '-map', '0:v:0', '-vf', vf, '-f', 'null', '-'];
  if (a) args.splice(args.indexOf('-f'), 0, '-map', '0:a:0', '-af', 'volumedetect');
  const { err } = await run('ffmpeg', args);
  const black = parseIntervals(err, 'black_start', 'black_end');
  if (black.open !== null) black.out.push([+black.open.toFixed(2), +duration.toFixed(2)]);
  const frz = parseIntervals(err.replace(/lavfi\.freezedetect\./g, ''), 'freeze_start', 'freeze_end');
  if (frz.open !== null) frz.out.push([+frz.open.toFixed(2), +duration.toFixed(2)]);
  const sum = (iv) => +iv.reduce((s, [x, y]) => s + (y - x), 0).toFixed(2);
  metrics.blackSec = sum(black.out);
  metrics.blackIntervals = black.out;
  metrics.frozenSec = sum(frz.out);
  metrics.frozenIntervals = frz.out;
  const mean = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(err);
  const max = /max_volume:\s*(-?[\d.]+|-inf) dB/.exec(err);
  if (a) metrics.audioMeanDb = mean ? Number(mean[1]) : null;
  if (a) metrics.audioMaxDb = max ? Number(max[1]) : null;

  if (metrics.blackSec > duration * 0.5) problems.push(`${metrics.blackSec}s of ${duration.toFixed(1)}s is black`);
  else if (metrics.blackSec > 1) warnings.push(`${metrics.blackSec}s black`);
  // A hung game is one long freeze; dialogue and card reveals are many short holds between changes.
  metrics.longestFrozenSec = +Math.max(0, ...frz.out.map(([x, y]) => y - x)).toFixed(2);
  if (metrics.longestFrozenSec > Math.min(15, duration * 0.5)) problems.push(`picture frozen for ${metrics.longestFrozenSec}s in one stretch`);
  else if (metrics.frozenSec > duration * 0.4) warnings.push(`picture static for ${metrics.frozenSec}s in total (longest hold ${metrics.longestFrozenSec}s)`);
  if (a && (metrics.audioMaxDb === null || metrics.audioMaxDb < -60)) warnings.push('audio track is silent');

  metrics.usableSec = +Math.max(0, duration - metrics.blackSec).toFixed(2);
  return { status: problems.length ? 'fail' : warnings.length ? 'warn' : 'pass', problems, warnings, metrics };
}

module.exports = { validateRecording };
