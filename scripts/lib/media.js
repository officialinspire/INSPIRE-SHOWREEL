'use strict';
const { run } = require('./util');

async function probe(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file]);
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const a = j.streams.find((s) => s.codec_type === 'audio');
  return {
    duration: Number(j.format.duration),
    bitRate: Number(j.format.bit_rate),
    formatName: j.format.format_name,
    video: v && { codec: v.codec_name, width: v.width, height: v.height, fps: v.r_frame_rate, pixFmt: v.pix_fmt },
    audio: a && { codec: a.codec_name, sampleRate: Number(a.sample_rate), channels: a.channels },
    raw: j,
  };
}

/** Decode the whole file; resolves with a list of decoder errors (empty = clean). */
async function decodeCheck(file) {
  const { err } = await run('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-f', 'null', '-']);
  return err.split('\n').filter(Boolean);
}

/** Escape text for an ffmpeg drawtext filter value. */
function drawtextEscape(s) {
  return String(s).replace(/\\/g, '\\\\\\\\').replace(/'/g, "'\\\\\\''").replace(/:/g, '\\:').replace(/%/g, '\\%');
}

/** Common H.264/AAC output args from trailer config so every segment concatenates with -c copy. */
function encodeArgs(trailer, { crf } = {}) {
  const v = trailer.video;
  const a = trailer.audio;
  return [
    '-c:v', v.codec, '-preset', v.preset, '-crf', String(crf ?? v.crf), '-profile:v', v.profile,
    '-pix_fmt', v.pixFmt, '-r', String(v.fps), '-g', String(v.fps * 2),
    '-c:a', a.codec, '-b:a', a.bitrate, '-ar', String(a.sampleRate), '-ac', String(a.channels),
    '-movflags', '+faststart',
  ];
}

module.exports = { probe, decodeCheck, drawtextEscape, encodeArgs };
