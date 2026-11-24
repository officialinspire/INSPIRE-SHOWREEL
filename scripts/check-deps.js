#!/usr/bin/env node
'use strict';
// Verifies every external dependency the pipeline needs. Exit 1 if a required one is missing.
const fs = require('fs');
const { log, run, which, main } = require('./lib/util');
const config = require('./lib/config');

main(async () => {
  const problems = [];
  const warn = [];
  const need = (ok, msg, fix) => (ok ? log.ok(msg) : (log.err(`${msg}${fix ? ` — ${fix}` : ''}`), problems.push(msg)));

  log.step('Runtime');
  const major = Number(process.versions.node.split('.')[0]);
  need(major >= 20, `Node.js ${process.versions.node} (need >= 20)`, 'install Node 20+');

  log.step('FFmpeg');
  for (const bin of ['ffmpeg', 'ffprobe']) {
    const p = which(bin);
    if (!p) { need(false, `${bin} on PATH`, 'run scripts/install.sh or install ffmpeg'); continue; }
    const { out } = await run(bin, ['-version']);
    log.ok(`${bin}: ${out.split('\n')[0]}`);
  }
  if (which('ffmpeg')) {
    const { out: enc } = await run('ffmpeg', ['-hide_banner', '-encoders']);
    need(/\blibx264\b/.test(enc), 'ffmpeg encoder libx264', 'install an ffmpeg build with --enable-libx264');
    need(/\baac\b/.test(enc), 'ffmpeg encoder aac');
    const { out: filt } = await run('ffmpeg', ['-hide_banner', '-filters']);
    for (const f of ['drawtext', 'overlay', 'loudnorm', 'scale', 'pad', 'afade']) need(new RegExp(`\\b${f}\\b`).test(filt), `ffmpeg filter ${f}`, f === 'drawtext' ? 'needs ffmpeg built with libfreetype' : '');
  }

  log.step('Capture environment (Xvfb + PulseAudio + FFmpeg devices)');
  for (const [bin, fix] of [['Xvfb', 'apt-get install xvfb'], ['pulseaudio', 'apt-get install pulseaudio'], ['pactl', 'apt-get install pulseaudio-utils']]) {
    need(!!which(bin), `${bin} on PATH`, fix);
  }
  if (which('ffmpeg')) {
    const { out: dev } = await run('ffmpeg', ['-hide_banner', '-devices']);
    need(/\bx11grab\b/.test(dev), 'ffmpeg input device x11grab', 'needs ffmpeg built with libxcb');
    need(/\bpulse\b/.test(dev), 'ffmpeg input device pulse', 'needs ffmpeg built with libpulse');
  }

  log.step('Playwright / Chromium');
  let playwright;
  try {
    playwright = require('playwright');
    log.ok(`playwright ${require('playwright/package.json').version} (${require.resolve('playwright')})`);
  } catch {
    need(false, 'playwright module', 'run npm install');
  }
  if (playwright) {
    try {
      const b = await playwright.chromium.launch();
      log.ok(`chromium ${b.version()} launches`);
      await b.close();
    } catch (e) {
      need(false, 'chromium launches', `run "npx playwright install chromium" (${e.message.split('\n')[0]})`);
    }
  }

  log.step('Configuration');
  let cfg;
  try {
    cfg = config.load();
    log.ok(`config valid: ${cfg.games.games.length} games, order = ${cfg.trailer.segments.order.join(', ')}`);
  } catch (e) {
    need(false, 'configuration', e.message);
  }
  if (cfg) {
    const lt = cfg.trailer.segments.lowerThird;
    if (lt.enabled) need(fs.existsSync(lt.fontFile), `lower-third font ${lt.fontFile}`, 'set segments.lowerThird.fontFile in config/trailer.json (e.g. apt-get install fonts-dejavu-core)');
    try {
      const edl = JSON.parse(fs.readFileSync(require('path').join(cfg.paths.root, 'config', 'trailers', 'inspireverse.json'), 'utf8'));
      for (const f of [edl.brand.font, edl.brand.fontSub]) need(fs.existsSync(f), `trailer font ${f}`, 'apt-get install fonts-inter');
    } catch (e) { need(false, 'trailer EDL readable', e.message); }
    need(fs.existsSync(cfg.paths.intro), `studio intro ${cfg.games.studio.intro.file}`, 'run npm run fetch');
    need(fs.existsSync(cfg.paths.logo), `studio logo ${cfg.games.studio.logo.file}`, 'run npm run fetch');
    for (const [k, p] of Object.entries(cfg.paths)) {
      if (['root', 'intro', 'logo', 'output'].includes(k)) continue;
      try {
        fs.mkdirSync(p, { recursive: true });
        fs.accessSync(p, fs.constants.W_OK);
        log.ok(`paths.${k} writable: ${p}`);
      } catch (e) {
        need(false, `paths.${k} writable (${p})`, e.message);
      }
    }
  }

  log.step('Optional');
  for (const [bin, why] of [['git', 'version control'], ['git-lfs', 'large source masters (see README)'], ['gh', 'npm run release (GitHub release artifacts)']]) {
    if (which(bin)) log.ok(`${bin} found`);
    else { log.warn(`${bin} not found — needed only for ${why}`); warn.push(bin); }
  }

  console.log('');
  if (problems.length) throw new Error(`${problems.length} required dependency check(s) failed`);
  log.ok(`All required dependencies present${warn.length ? ` (${warn.length} optional missing)` : ''}.`);
});
