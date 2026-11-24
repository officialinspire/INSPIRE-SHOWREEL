#!/usr/bin/env node
'use strict';
// Captures raw footage for every game (npm run capture:all) or a subset.
//   --only=gridlock,emoji-elements   games (also: npm run capture:<id>)
//   --layout=landscape|portrait      one layout
//   --shot=menu,board                specific shots
//   --retries=N                      extra attempts per failing shot (default from trailer.json)
//   --no-audio                       record picture only
//   --variant=sfx                    SFX-only takes: the game's music is blocked (adapter.sfxOnly)
//                                    so trailers can lay their own music bed under real gameplay SFX
// Output: capture/<id>/<layout>/<shot>.mkv (+ screenshots), capture/<id>/manifest.json,
//         capture/summary.json
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { startAudio } = require('./capture/env');
const { captureGame } = require('./capture/runner');
const { loadAdapter } = require('./capture/adapters');
const { log, args, which, main } = require('./lib/util');

main(async () => {
  const a = args();
  const cfg = config.load();
  for (const bin of ['Xvfb', 'ffmpeg', ...(a['no-audio'] ? [] : ['pulseaudio', 'pactl'])]) {
    if (!which(bin)) throw new Error(`${bin} not found — run npm run setup`);
  }
  const games = config.selectGames(cfg, a.only);
  const opts = {
    layouts: typeof a.layout === 'string' ? a.layout.split(',') : [],
    shots: typeof a.shot === 'string' ? a.shot.split(',') : [],
    retries: a.retries !== undefined ? Number(a.retries) : cfg.trailer.capture.retries,
    variant: a.variant === 'sfx' ? 'sfx' : 'full',
  };
  const audio = a['no-audio'] ? null : await startAudio();
  const summaryFile = path.join(cfg.paths.capture, 'summary.json');
  let summary = {};
  try { summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8')); } catch {}
  const incomplete = [];
  try {
    for (const game of games) {
      const adapter = loadAdapter(game.id);
      log.step(`${game.title} (${adapter.layouts.join(' + ')})`);
      const m = await captureGame({ cfg, game, adapter, audio, opts });
      summary[game.id] = { updatedAt: m.updatedAt, ...m.summary };
      if (opts.variant === 'sfx') {
        for (const t of m.sfxTakes.filter((x) => !opts.layouts.length || opts.layouts.includes(x.layout))) {
          if (t.status === 'fail') incomplete.push(`${game.id}/${t.layout}/sfx/${t.id}`);
        }
        continue;
      }
      for (const [layout, s] of Object.entries(m.summary)) {
        const msg = `${game.id} ${layout}: ${s.passed}/${s.shots} shots ok, ${s.usableSec}s usable (target ${s.target.min}–${s.target.max}s)`;
        if (s.complete) log.ok(msg); else { log.warn(`${msg} — INCOMPLETE`); incomplete.push(`${game.id}/${layout}`); }
      }
      fs.mkdirSync(cfg.paths.capture, { recursive: true });
      fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    }
  } finally {
    await audio?.stop();
  }
  if (incomplete.length) throw new Error(`incomplete: ${incomplete.join(', ')} (see capture/<id>/manifest.json)`);
  log.ok('All requested captures complete.');
});
