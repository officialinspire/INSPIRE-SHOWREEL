#!/usr/bin/env node
'use strict';
// ENTER THE INSPIREVERSE trailer: one independent composition per aspect ratio.
//   npm run render:trailer                 all formats in config/trailers/inspireverse.json
//   npm run render:trailer -- --format=9x16
//   --edl=<name>       another config/trailers/<name>.json
//   --variant=full     use full-audio takes (game music included) instead of SFX-only takes
// Output: renders/trailer/<output>-<format>.mp4 + .json (timeline, sources, loudness)
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { loadEdl, trailerTimeline } = require('./edit/edl');
const R = require('./edit/render');
const { log, args, main } = require('./lib/util');

main(async () => {
  const a = args();
  const cfg = config.load();
  const edl = loadEdl(typeof a.edl === 'string' ? a.edl : 'inspireverse');
  const formats = typeof a.format === 'string' && a.format !== 'all' ? a.format.split(',') : Object.keys(edl.formats);
  const variant = a.variant === 'full' ? 'full' : 'sfx';
  const outDir = path.join(cfg.paths.renders, 'trailer');
  fs.mkdirSync(outDir, { recursive: true });

  for (const format of formats) {
    const fmt = edl.formats[format];
    if (!fmt) throw new Error(`unknown format ${format}; have ${Object.keys(edl.formats).join(', ')}`);
    const t0 = Date.now();
    log.step(`${edl.title} — ${format} (${fmt.width}x${fmt.height})`);
    const tl = trailerTimeline(cfg, edl, format, { variant });
    for (const c of tl.clips) for (const w of c.src.warnings) log.warn(w);
    const work = path.join(cfg.paths.footage, '.trailer', `${edl.id}-${format}`);
    fs.rmSync(work, { recursive: true, force: true });
    fs.mkdirSync(work, { recursive: true });

    const introFile = path.join(work, '000-intro.mkv');
    const introSec = await R.renderIntro(cfg, edl, fmt, introFile);
    log.ok(`intro ${introSec.toFixed(3)}s (original file, own audio)`);
    const files = [introFile];
    const jobs = tl.clips.map((c, i) => {
      const next = tl.clips[i + 1];
      const prev = tl.clips[i - 1];
      const dip = edl.look.sectionDip;
      const sectionStart = c.kind === 'clip' && c.firstInSection;
      const sectionEnd = c.kind === 'clip' && c.lastInSection && !c.montage;
      const opts = {
        work,
        audioGain: edl.audio.sfxGain,
        title: c.title,
        label: c.label,
        endcard: c.kind === 'endcard',
        fadeIn: c.kind === 'endcard' ? 0.3 : sectionStart ? (c.montage ? 0.12 : i === 0 ? 0.25 : dip) : 0,
        fadeInColor: c.montage && sectionStart && prev ? 'white' : 'black',
        fadeOut: c.kind === 'endcard' ? 0.45 : sectionEnd && next && !next.montage ? dip : 0,
      };
      const file = path.join(work, `${String(i + 1).padStart(3, '0')}-${c.kind === 'endcard' ? 'endcard' : `${c.game}-${c.shot}`}.mkv`);
      files.push(file);
      return { c, file, opts };
    });
    await R.pool(jobs, 2, async ({ c, file, opts }) => {
      await R.renderItem(cfg, edl, fmt, c, file, opts);
      log.ok(`${path.basename(file)}  ${c.durSec.toFixed(3)}s  ← ${c.src.take} @ ${c.src.start}s${c.framing ? ` [${c.framing.source}/${c.framing.mode}]` : ''}`);
    });

    const programme = path.join(work, 'programme.mkv');
    await R.concat(files, programme);
    const totalSec = await R.videoSec(programme, edl.fps); // measured, so audio always matches picture
    const musicFile = config.vendorPath(cfg, cfg.games.games.find((g) => g.id === edl.music.game), 'music');
    if (!fs.existsSync(musicFile)) throw new Error(`music bed missing (${musicFile}) — run npm run fetch`);
    const m = edl.music;
    const music = { file: musicFile, fromSec: m.firstDownbeatSec + m.startBar * tl.bar, durSec: tl.musicSec, atSec: introSec, gain: m.gain, fadeIn: m.fadeInSec, fadeOut: m.fadeOutSec };
    const audio = path.join(work, 'mix.wav');
    const loud = await R.mixAudio(edl, programme, audio, { music, totalSec });
    const out = path.join(outDir, `${edl.output}-${format}.mp4`);
    await R.deliver(edl, programme, audio, out);
    const report = {
      title: edl.title, subtitle: edl.subtitle, format, ...fmt, fps: edl.fps, file: path.relative(cfg.paths.root, out), renderedAt: new Date().toISOString(),
      expectedSec: +(introSec + tl.musicSec).toFixed(3), programmeSec: +totalSec.toFixed(3), introSec: +introSec.toFixed(3), variant,
      music: { source: path.relative(cfg.paths.root, musicFile), fromSec: +music.fromSec.toFixed(3), bpm: m.bpm, bars: tl.totalBars },
      premixLoudness: loud.measuredIn,
      timeline: tl.clips.map((c) => ({ kind: c.kind, game: c.game, shot: c.shot, take: c.src.take, sourceStart: c.src.start, sec: +c.durSec.toFixed(3), bars: c.bars, framing: c.framing, title: c.title?.text, label: c.label?.text })),
    };
    fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify(report, null, 2));
    log.ok(`${report.file}  ${totalSec.toFixed(2)}s  (${Math.round((Date.now() - t0) / 1000)}s to render)`);
  }
});
