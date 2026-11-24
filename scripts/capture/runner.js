'use strict';
// Runs adapter shots: for each layout, a fresh virtual display + headed Chromium; for each shot,
// an isolated browser context that boots the game unrecorded (gate, intro skip, menus), then
// records only the shot itself, validates the file and writes it to the game's manifest.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { startDisplay } = require('./env');
const { launch, openPage, assertFullscreen } = require('./browser');
const { Recorder } = require('./recorder');
const { validateRecording } = require('./validate');
const { createApi } = require('./shot-api');
const { log } = require('../lib/util');

const withTimeout = (p, ms, what) => {
  let timer;
  return Promise.race([p.finally(() => clearTimeout(timer)), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`${what} timed out after ${Math.round(ms / 1000)} s`)), ms); })]);
};

function ffmpegVersion() {
  try { return execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0]; } catch { return null; }
}

function loadManifest(file, game) {
  if (fs.existsSync(file)) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
  }
  return { game: game.id, title: game.title, repo: game.repo, commit: game.commit, url: game.url, shots: [] };
}

async function runShot({ browser, cfg, game, adapter, shot, layout, size, audio, display, outDir, attempt, variant }) {
  const capCfg = cfg.trailer.capture;
  const shotDir = path.join(outDir, shot.id);
  fs.rmSync(shotDir, { recursive: true, force: true });
  fs.mkdirSync(shotDir, { recursive: true });
  const file = path.join(outDir, `${shot.id}.mkv`);
  const stats = {};
  const sfx = variant === 'sfx' ? adapter.sfxOnly : null;
  const { ctx, page } = await openPage(browser, { ...size, touch: layout === 'portrait', stats, blockMedia: sfx?.block || null, storage: sfx?.storage || null });
  const api = createApi({ page, ctx, layout, size, game, shotDir, log: log.info });
  const recorder = new Recorder({ display, ...size, fps: capCfg.fps, audio, out: file, crf: capCfg.crf });
  const result = { id: shot.id, title: shot.title, layout, variant, attempt, file: null, startedAt: new Date().toISOString() };
  try {
    const url = adapter.url ? adapter.url(game, layout) : game.url;
    result.pageUrl = url;
    await withTimeout(page.goto(url, { waitUntil: 'load', timeout: capCfg.navigationTimeoutMs }), capCfg.navigationTimeoutMs + 5000, 'navigation');
    result.viewport = await assertFullscreen(page, size.width, size.height);
    await withTimeout(adapter.boot(api), (adapter.bootTimeoutSec || 90) * 1000, 'boot');
    if (shot.setup) await withTimeout(shot.setup(api), (shot.setupTimeoutSec || 90) * 1000, 'setup');
    await api.settle(5000);
    await api.screenshot('00-before');
    await recorder.start();
    api._attachRecorder(recorder);
    await api.fpsReset();
    api.mark('record-start');
    await withTimeout(shot.run(api), (shot.maxSec || capCfg.shotTimeoutSec) * 1000 + 15000, `shot ${shot.id}`);
    api.mark('record-end');
    result.pageFps = await api.fpsRead();
    await api.screenshot('99-end');
  } catch (e) {
    result.error = e.message.split('\n').slice(0, 3).join(' | ');
    await api.screenshot('error').catch(() => {});
  } finally {
    await recorder.stop().catch((e) => (result.error = result.error || `recorder: ${e.message}`));
    await ctx.close().catch(() => {});
  }
  result.events = api.events;
  result.analyticsBlocked = stats.analyticsBlocked || 0;
  result.analyticsHosts = stats.analyticsHosts || [];
  if (variant === 'sfx') result.musicBlocked = stats.musicBlocked || 0;
  result.pageErrors = stats.pageErrors || [];
  if (fs.existsSync(file)) {
    result.file = path.relative(cfg.paths.root, file);
    result.validation = await validateRecording(file, { ...size, fps: capCfg.fps, minSec: shot.minSec || 5 }).catch((e) => ({ status: 'fail', problems: [e.message], warnings: [], metrics: {} }));
  } else {
    result.validation = { status: 'fail', problems: ['no recording file'], warnings: [], metrics: {} };
  }
  if (result.error) result.validation.status = 'fail';
  result.status = result.validation.status;
  result.screenshots = fs.readdirSync(shotDir).filter((f) => f.endsWith('.png')).map((f) => path.relative(cfg.paths.root, path.join(shotDir, f)));
  return result;
}

/** Capture one game. opts: { layouts?, shots?, retries } */
async function captureGame({ cfg, game, adapter, audio, opts }) {
  const capCfg = cfg.trailer.capture;
  const gameDir = path.join(cfg.paths.capture, game.id);
  fs.mkdirSync(gameDir, { recursive: true });
  const manifestFile = path.join(gameDir, 'manifest.json');
  const manifest = loadManifest(manifestFile, game);
  Object.assign(manifest, { repo: game.repo, commit: game.commit, url: game.url, supportedLayouts: adapter.layouts, layoutNotes: adapter.layoutNotes || null });
  const layouts = adapter.layouts.filter((l) => !opts.layouts?.length || opts.layouts.includes(l));

  for (const layout of layouts) {
    const size = capCfg.layouts[layout];
    const shots = adapter.shots.filter((s) => (!s.layouts || s.layouts.includes(layout)) && (!opts.shots?.length || opts.shots.includes(s.id)));
    if (!shots.length) continue;
    const variant = opts.variant || 'full';
    if (variant === 'sfx' && !adapter.sfxOnly) throw new Error(`${game.id}: adapter has no sfxOnly rule`);
    const outDir = path.join(gameDir, layout, variant === 'sfx' ? 'sfx' : '');
    fs.mkdirSync(outDir, { recursive: true });
    const screen = await startDisplay(size);
    let browser;
    try {
      browser = await launch({ display: screen.display, audio, ...size, extraArgs: capCfg.chromiumArgs });
      manifest.environment = { chromium: browser.version(), ffmpeg: ffmpegVersion(), fps: capCfg.fps, crf: capCfg.crf, method: 'Xvfb + headed Chromium (CDP fullscreen) + FFmpeg x11grab + PulseAudio null-sink monitor' };
      for (const shot of shots) {
        let result;
        for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
          if (!browser.isConnected()) browser = await launch({ display: screen.display, audio, ...size, extraArgs: capCfg.chromiumArgs });
          log.info(`${game.id} ${layout}${variant === 'sfx' ? ' [sfx]' : ''} ${shot.id}: attempt ${attempt}`);
          result = await runShot({ browser, cfg, game, adapter, shot, layout, size, audio, display: screen.display, outDir, attempt, variant });
          const m = result.validation.metrics || {};
          const line = `${game.id} ${layout} ${shot.id}: ${result.status} ${m.durationSec ?? '?'}s @ ${m.captureFps ?? '?'} fps (page ${result.pageFps ?? '?'} fps), audio max ${m.audioMaxDb ?? '—'} dB`;
          if (result.status === 'fail') log.err(`${line} — ${result.error || result.validation.problems.join('; ')}`);
          else log[result.status === 'pass' ? 'ok' : 'warn'](`${line}${result.validation.warnings.length ? ` — ${result.validation.warnings.join('; ')}` : ''}`);
          if (result.status !== 'fail') break;
        }
        manifest.shots = manifest.shots.filter((s) => !(s.id === shot.id && s.layout === layout && (s.variant || 'full') === variant)).concat(result);
        manifest.updatedAt = new Date().toISOString();
        fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
      }
    } finally {
      await browser?.close().catch(() => {});
      await screen.stop();
    }
  }
  return summarize(manifest, adapter, cfg);
}

function summarize(manifest, adapter, cfg) {
  const order = adapter.shots.map((s) => s.id);
  // Drop entries (and files) for shots or layouts the adapter no longer defines.
  const stale = manifest.shots.filter((s) => !order.includes(s.id) || !adapter.layouts.includes(s.layout));
  for (const s of stale) {
    if (s.file) fs.rmSync(path.join(cfg.paths.root, s.file), { force: true });
    fs.rmSync(path.join(cfg.paths.capture, manifest.game, s.layout, s.variant === 'sfx' ? 'sfx' : '', s.id), { recursive: true, force: true });
  }
  manifest.shots = manifest.shots.filter((s) => !stale.includes(s));
  manifest.shots.sort((a, b) => (a.variant || 'full').localeCompare(b.variant || 'full') || a.layout.localeCompare(b.layout) || order.indexOf(a.id) - order.indexOf(b.id));
  // The summary (and "complete") counts the full-audio takes; SFX-only takes are editing stems.
  const full = manifest.shots.filter((s) => (s.variant || 'full') === 'full');
  const usable = (l) => +full.filter((s) => s.layout === l && s.status !== 'fail').reduce((t, s) => t + (s.validation.metrics.usableSec || 0), 0).toFixed(1);
  const goal = cfg.trailer.capture.targetSecPerGame;
  manifest.summary = {};
  manifest.sfxTakes = manifest.shots.filter((s) => s.variant === 'sfx').map((s) => ({ id: s.id, layout: s.layout, status: s.status, file: s.file, musicBlocked: s.musicBlocked }));
  for (const l of adapter.layouts) {
    const shots = full.filter((s) => s.layout === l);
    const ok = shots.filter((s) => s.status !== 'fail');
    manifest.summary[l] = {
      shots: shots.length, passed: ok.length, failed: shots.length - ok.length,
      usableSec: usable(l), target: goal,
      complete: shots.length === adapter.shots.filter((s) => !s.layouts || s.layouts.includes(l)).length && ok.length === shots.length && usable(l) >= goal.min,
      minCaptureFps: ok.length ? Math.min(...ok.map((s) => s.validation.metrics.captureFps)) : null,
    };
  }
  fs.writeFileSync(path.join(cfg.paths.capture, manifest.game, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

module.exports = { captureGame };
