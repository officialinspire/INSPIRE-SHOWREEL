#!/usr/bin/env node
'use strict';
// Validates the studio intro (hash, streams, full decode) and logo, plus every fetched per-game asset.
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { probe, decodeCheck } = require('./lib/media');
const { log, args, sha256File, main } = require('./lib/util');

main(async () => {
  const a = args();
  const cfg = config.load();
  const fails = [];
  const check = (ok, msg) => (ok ? log.ok(msg) : (log.err(msg), fails.push(msg)));

  log.step('Studio intro (must be bit-identical to the original)');
  const intro = cfg.games.studio.intro;
  if (!fs.existsSync(cfg.paths.intro)) throw new Error(`${intro.file} missing — run npm run fetch`);
  check(sha256File(cfg.paths.intro) === intro.sha256, `sha256 ${intro.sha256.slice(0, 16)}…`);
  check(fs.statSync(cfg.paths.intro).size === intro.bytes, `size ${intro.bytes} bytes`);
  const p = await probe(cfg.paths.intro);
  const e = intro.expect;
  check(p.video?.codec === e.videoCodec && p.video.width === e.width && p.video.height === e.height, `video ${p.video?.codec} ${p.video?.width}x${p.video?.height}`);
  check(p.video?.fps === e.fps, `frame rate ${p.video?.fps}`);
  check(p.audio?.codec === e.audioCodec && p.audio.sampleRate === e.sampleRate && p.audio.channels === e.channels, `audio ${p.audio?.codec} ${p.audio?.sampleRate} Hz ${p.audio?.channels} ch`);
  check(Math.abs(p.duration - e.durationSec) < 0.05, `duration ${p.duration.toFixed(3)} s`);
  const derr = await decodeCheck(cfg.paths.intro);
  check(derr.length === 0, `full decode clean${derr.length ? `: ${derr[0]}` : ''}`);

  log.step('Studio logo');
  const logo = cfg.games.studio.logo;
  check(fs.existsSync(cfg.paths.logo) && sha256File(cfg.paths.logo) === logo.sha256, `sha256 ${logo.sha256.slice(0, 16)}…`);
  const lp = await probe(cfg.paths.logo);
  check(lp.video?.width === logo.expect.width && lp.video?.height === logo.expect.height, `logo ${lp.video?.width}x${lp.video?.height}`);

  log.step('Per-game assets');
  for (const g of config.selectGames(cfg, a.only)) {
    for (const kind of ['titleCard', 'music']) {
      const f = config.vendorPath(cfg, g, kind);
      if (!fs.existsSync(f)) { check(false, `${g.id} ${kind} missing (${path.relative(cfg.paths.root, f)}) — run npm run fetch`); continue; }
      check(sha256File(f) === g.assets[kind].sha256, `${g.id} ${kind} sha256`);
      const m = await probe(f);
      if (kind === 'music') check(!!m.audio && m.duration > 10, `${g.id} music ${m.audio?.codec} ${m.audio?.sampleRate} Hz ${m.duration.toFixed(1)} s`);
      else check(!!m.video && m.video.width >= 1000, `${g.id} title card ${m.video?.width}x${m.video?.height}`);
    }
  }

  if (fails.length) throw new Error(`${fails.length} asset check(s) failed`);
  log.ok('All assets valid.');
});
