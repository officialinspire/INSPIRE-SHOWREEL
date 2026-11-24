#!/usr/bin/env node
'use strict';
// Concatenates footage segments (intro, games in segments.order, end card) into
// renders/<output> with stream copy, then verifies the result and writes a JSON report.
//   --allow-missing   skip games whose segment has not been built
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { probe, decodeCheck } = require('./lib/media');
const { log, args, run, sha256File, main } = require('./lib/util');

main(async () => {
  const a = args();
  const cfg = config.load();
  const f = cfg.paths.footage;
  const parts = [];
  if (cfg.trailer.intro.enabled) parts.push(path.join(f, '00-intro.mp4'));
  cfg.trailer.segments.order.forEach((id, i) => parts.push(path.join(f, `${String(i + 1).padStart(2, '0')}-${id}.mp4`)));
  if (cfg.trailer.endCard.enabled) parts.push(path.join(f, '99-endcard.mp4'));

  const present = [];
  for (const p of parts) {
    if (fs.existsSync(p)) present.push(p);
    else if (a['allow-missing']) log.warn(`skipping missing ${path.relative(cfg.paths.root, p)}`);
    else throw new Error(`missing ${path.relative(cfg.paths.root, p)} — run npm run build (or pass --allow-missing)`);
  }

  // Every segment must share codec parameters for a stream-copy concat.
  const sig = async (p) => { const m = await probe(p); return `${m.video.codec} ${m.video.width}x${m.video.height} ${m.video.fps} ${m.video.pixFmt} | ${m.audio.codec} ${m.audio.sampleRate} ${m.audio.channels}`; };
  const ref = await sig(present[0]);
  for (const p of present.slice(1)) {
    const s = await sig(p);
    if (s !== ref) throw new Error(`${path.basename(p)} has "${s}", expected "${ref}" — rebuild segments`);
  }

  fs.mkdirSync(cfg.paths.renders, { recursive: true });
  const list = path.join(cfg.paths.footage, '.work', 'concat.txt');
  fs.mkdirSync(path.dirname(list), { recursive: true });
  fs.writeFileSync(list, present.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  log.info(`concatenating ${present.length} segments`);
  await run('ffmpeg', ['-y', '-hide_banner', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', cfg.paths.output]);

  const m = await probe(cfg.paths.output);
  const errs = await decodeCheck(cfg.paths.output);
  const expected = (await Promise.all(present.map(async (p) => (await probe(p)).duration))).reduce((x, y) => x + y, 0);
  const report = {
    file: path.relative(cfg.paths.root, cfg.paths.output),
    renderedAt: new Date().toISOString(),
    bytes: fs.statSync(cfg.paths.output).size,
    sha256: sha256File(cfg.paths.output),
    durationSec: +m.duration.toFixed(3),
    expectedDurationSec: +expected.toFixed(3),
    video: m.video,
    audio: m.audio,
    decodeErrors: errs.slice(0, 20),
    segments: present.map((p) => path.relative(cfg.paths.root, p)),
  };
  fs.writeFileSync(cfg.paths.output.replace(/\.mp4$/, '.json'), JSON.stringify(report, null, 2));
  if (errs.length) throw new Error(`render has ${errs.length} decode error(s): ${errs[0]}`);
  if (Math.abs(report.durationSec - expected) > 1) throw new Error(`duration ${report.durationSec}s differs from segment total ${expected.toFixed(2)}s`);
  log.ok(`${report.file}: ${report.durationSec}s, ${m.video.width}x${m.video.height}, ${(report.bytes / 1048576).toFixed(1)} MB`);
});
