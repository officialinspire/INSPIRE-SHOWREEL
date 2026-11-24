#!/usr/bin/env node
'use strict';
// 15-second highlight per game, with the game's own recorded sound (full takes).
//   npm run render:highlights                       every game, formats from the EDL
//   npm run render:highlights -- --only=gridlock --format=9x16
// Output: renders/highlights/<game>-<format>.mp4 + .json
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { loadEdl, highlightTimeline } = require('./edit/edl');
const R = require('./edit/render');
const { log, args, main } = require('./lib/util');

main(async () => {
  const a = args();
  const cfg = config.load();
  const edl = loadEdl(typeof a.edl === 'string' ? a.edl : 'inspireverse');
  const formats = typeof a.format === 'string' ? a.format.split(',') : edl.highlights.formats;
  const games = config.selectGames(cfg, a.only).filter((g) => edl.highlights.games[g.id]);
  const outDir = path.join(cfg.paths.renders, 'highlights');
  fs.mkdirSync(outDir, { recursive: true });
  const meta = (id) => {
    const s = edl.sections.find((x) => x.game === id);
    const mc = edl.sections.flatMap((x) => x.clips).find((c) => c.game === id && c.accent);
    const g = cfg.games.games.find((x) => x.id === id);
    return { text: s?.title || g.title.toUpperCase(), tagline: s?.tagline || g.tagline, accent: s?.accent || mc?.accent || edl.brand.accent };
  };
  const url = edl.endCard.lines[2];

  for (const g of games) {
    for (const format of formats) {
      const fmt = edl.formats[format];
      const tl = highlightTimeline(cfg, edl, format, g.id);
      for (const c of tl.clips) for (const w of c.src.warnings) log.warn(w);
      const work = path.join(cfg.paths.footage, '.highlights', `${g.id}-${format}`);
      fs.rmSync(work, { recursive: true, force: true });
      fs.mkdirSync(work, { recursive: true });
      const files = [];
      for (const c of tl.clips) {
        const last = c.index === tl.clips.length - 1;
        const file = path.join(work, `${String(c.index).padStart(2, '0')}-${c.shot}.mkv`);
        await R.renderItem(cfg, edl, fmt, c, file, {
          work, audioGain: 1,
          title: c.index === 0 ? meta(g.id) : null,
          tag: last ? { start: Math.max(0.2, c.durSec - 2.6), url } : null,
          fadeIn: c.index === 0 ? 0.2 : 0.1, fadeOut: last ? 0.4 : 0.1,
        });
        files.push(file);
      }
      const programme = path.join(work, 'programme.mkv');
      await R.concat(files, programme);
      const audio = path.join(work, 'mix.wav');
      const loud = await R.mixAudio(edl, programme, audio, { music: null, totalSec: tl.totalSec });
      const out = path.join(outDir, `${g.id}-${format}.mp4`);
      await R.deliver(edl, programme, audio, out);
      fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({
        game: g.id, format, ...fmt, fps: edl.fps, file: path.relative(cfg.paths.root, out), expectedSec: tl.totalSec, audio: 'game (full takes)', premixLoudness: loud.measuredIn,
        timeline: tl.clips.map((c) => ({ shot: c.shot, take: c.src.take, sourceStart: c.src.start, sec: +c.durSec.toFixed(3), framing: c.framing })),
      }, null, 2));
      log.ok(`renders/highlights/${g.id}-${format}.mp4  ${tl.totalSec}s`);
    }
  }
});
