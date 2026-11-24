#!/usr/bin/env node
'use strict';
// Development tool for writing adapters: boots a game in the real capture environment
// (Xvfb, fullscreen headed Chromium) and runs a JS snippet against the page, dumping visible
// interactive elements and a screenshot after each step. Nothing is recorded.
//   node scripts/capture/explore.js <game-id> [--layout=portrait] [--no-boot] [--steps=file.js]
// A steps file exports async (api, dump) => { ... } and can call dump('label') at any point.
const fs = require('fs');
const path = require('path');
const config = require('../lib/config');
const { startDisplay } = require('./env');
const { launch, openPage } = require('./browser');
const { createApi } = require('./shot-api');
const { args, main, log } = require('../lib/util');

const DUMP = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const desc = (el) => {
    const r = el.getBoundingClientRect();
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
    const data = [...el.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'aria-label' || a.name === 'href').map((a) => `${a.name}=${a.value.slice(0, 30)}`).join(' ');
    return `${el.tagName.toLowerCase()}${id}${cls} [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}] "${(el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40)}" ${data}`;
  };
  const els = [...document.querySelectorAll('button,a,[role=button],[onclick],input,select,canvas,video,[tabindex]:not([tabindex="-1"]),[data-action],[class*=card],[class*=tile],[class*=cell]')].filter(vis);
  return { url: location.href, title: document.title, n: els.length, els: els.slice(0, 80).map(desc) };
};

main(async () => {
  const watchdog = setTimeout(() => { console.error('explore watchdog: 180 s, aborting'); process.exit(2); }, 180000);
  watchdog.unref();
  const a = args();
  const id = a._[0];
  const cfg = config.load();
  const game = config.selectGames(cfg, [id])[0];
  const adapter = require(`./adapters/${id}`); // unchecked: adapters may be work in progress
  const layout = a.layout || 'landscape';
  const size = cfg.trailer.capture.layouts[layout];
  const out = path.join(cfg.paths.capture, '_explore', id, layout);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const screen = await startDisplay(size); process.env.DISP = screen.display;
  const browser = await launch({ display: screen.display, ...size, extraArgs: (process.env.EXTRA_ARGS || '').split(' ').filter(Boolean) });
  const stats = {};
  let n = 0;
  try {
    const { ctx, page } = await openPage(browser, { ...size, touch: layout === 'portrait', stats });
    const api = createApi({ page, ctx, layout, size, game, shotDir: out, log: log.info });
    const dump = async (label) => {
      const d = await page.evaluate(DUMP);
      const file = path.join(out, `${String(n++).padStart(2, '0')}-${label}.png`);
      await page.screenshot({ path: file });
      console.log(`\n=== ${label}  (${d.title}) ${d.url}\n${d.els.join('\n')}${d.n > 80 ? `\n… ${d.n - 80} more` : ''}\n→ ${path.relative(cfg.paths.root, file)}`);
    };
    await page.goto(adapter.url ? adapter.url(game, layout) : game.url, { waitUntil: 'load' });
    if (!a['no-boot']) { await adapter.boot(api); await dump('after-boot'); } else { await page.waitForTimeout(2500); await dump('loaded'); }
    if (typeof a.steps === 'string') await require(path.resolve(a.steps))(api, dump);
    console.log(`\nanalytics blocked: ${stats.analyticsBlocked || 0} ${JSON.stringify(stats.analyticsHosts || [])}; page errors: ${JSON.stringify(stats.pageErrors || [])}`);
  } finally {
    await browser.close();
    await screen.stop();
  }
});
