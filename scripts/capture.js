#!/usr/bin/env node
'use strict';
// Records each live game with Playwright + Chromium, driving the startup flow described by
// games.json capture.steps. Writes capture/<id>/capture.webm and capture/<id>/marks.json
// (seconds from video start for every "mark" step), plus a screenshot per step.
//   --only=gridlock,emoji-elements   capture a subset
//   --headed                         show the browser
// Playwright's recorder captures picture only, no audio; the soundtrack comes from each game's
// original music file at render time.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const config = require('./lib/config');
const { log, args, main } = require('./lib/util');

function locator(page, step) {
  if (step.selector) return page.locator(step.selector).first();
  if (step.text) return page.getByText(step.text, { exact: false }).first();
  throw new Error(`step needs "selector" or "text": ${JSON.stringify(step)}`);
}

async function runStep(page, step) {
  switch (step.do) {
    case 'wait':
      return page.waitForTimeout(step.ms);
    case 'press':
      return page.keyboard.press(step.key);
    case 'click':
      return locator(page, step).click({ force: !!step.force, timeout: step.timeout ?? 10000 });
    case 'hover':
      return locator(page, step).hover({ force: true, timeout: step.timeout ?? 10000 });
    case 'mouse':
      return page.mouse.move(step.x, step.y, { steps: step.steps ?? 20 });
    case 'waitFor':
      return locator(page, step).waitFor({ state: step.state ?? 'visible', timeout: step.timeout ?? 15000 });
    case 'mark':
      return undefined;
    default:
      throw new Error(`unknown step ${step.do}`);
  }
}

async function captureGame(browser, cfg, game) {
  const cap = cfg.trailer.capture;
  const dir = path.join(cfg.paths.capture, game.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'steps'), { recursive: true });

  const ctx = await browser.newContext({
    viewport: cap.viewport,
    deviceScaleFactor: cap.deviceScaleFactor,
    recordVideo: { dir, size: cap.viewport },
    reducedMotion: 'no-preference',
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const since = () => +((Date.now() - t0) / 1000).toFixed(3);
  const result = { id: game.id, url: game.url, startedAt: new Date(t0).toISOString(), marks: {}, steps: [], pageErrors: [] };
  page.on('pageerror', (e) => result.pageErrors.push(e.message.slice(0, 300)));

  let failed = null;
  try {
    await page.goto(game.url, { waitUntil: 'load', timeout: cap.navigationTimeoutMs });
    result.steps.push({ do: 'goto', at: since() });
    for (const [i, step] of game.capture.steps.entries()) {
      const at = since();
      try {
        await runStep(page, step);
        if (step.do === 'mark') result.marks[step.name] = at;
        result.steps.push({ ...step, at, ok: true });
      } catch (e) {
        result.steps.push({ ...step, at, ok: false, error: e.message.split('\n')[0] });
        if (!step.optional) throw new Error(`step ${i} (${step.do} ${step.selector || step.text || ''}): ${e.message.split('\n')[0]}`);
      }
      if (cap.stepScreenshots && step.do !== 'wait' && step.do !== 'mark') {
        await page.screenshot({ path: path.join(dir, 'steps', `${String(i).padStart(2, '0')}-${step.do}.png`) }).catch(() => {});
      }
    }
  } catch (e) {
    failed = e;
  }
  result.durationSec = since();
  const video = page.video();
  await ctx.close();
  const webm = path.join(dir, 'capture.webm');
  if (video) fs.renameSync(await video.path(), webm);
  result.video = path.relative(cfg.paths.root, webm);
  result.ok = !failed;
  if (failed) result.error = failed.message;
  fs.writeFileSync(path.join(dir, 'marks.json'), JSON.stringify(result, null, 2));
  if (failed) throw failed;
  return result;
}

main(async () => {
  const a = args();
  const cfg = config.load();
  const games = config.selectGames(cfg, a.only);
  const browser = await chromium.launch({ headless: a.headed ? false : cfg.trailer.capture.headless, args: cfg.trailer.capture.chromiumArgs });
  const failures = [];
  try {
    for (const g of games) {
      log.info(`capturing ${g.id} ← ${g.url}`);
      try {
        const r = await captureGame(browser, cfg, g);
        log.ok(`${g.id}: ${r.durationSec}s, marks ${JSON.stringify(r.marks)}${r.pageErrors.length ? `, ${r.pageErrors.length} page error(s)` : ''}`);
      } catch (e) {
        log.err(`${g.id}: ${e.message}`);
        failures.push(g.id);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) throw new Error(`capture failed for: ${failures.join(', ')} (see capture/<id>/marks.json and steps/*.png)`);
});
