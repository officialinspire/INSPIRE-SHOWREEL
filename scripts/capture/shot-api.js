'use strict';
// The object adapters receive. It wraps Playwright with logged, time-stamped helpers so every
// shot leaves a trail of events (seconds from the first recorded frame) in the manifest.
const path = require('path');

function createApi({ page, ctx, layout, size, game, shotDir, log }) {
  const events = [];
  let recorder = null;
  const t = () => (recorder ? recorder.elapsed() : null);
  const note = (kind, label, extra = {}) => events.push({ t: t(), kind, label, ...extra });

  const loc = (target) => (typeof target === 'string' ? page.locator(target).first() : target);

  const api = {
    page, ctx, layout, size, game, events,
    portrait: layout === 'portrait',
    log: (...a) => log(`[${game.id}/${layout}]`, ...a),
    _attachRecorder: (r) => (recorder = r),
    /** Label a moment in the footage (used for shot manifests and later editing). */
    mark: (label, extra) => note('mark', label, extra),
    wait: (ms) => page.waitForTimeout(ms),
    /** Click a selector or locator; throws on failure unless optional. */
    async click(target, { optional = false, timeout = 8000, force = true, label, position } = {}) {
      try {
        await loc(target).click({ force, timeout, position });
        note('click', label || String(typeof target === 'string' ? target : 'locator'));
        return true;
      } catch (e) {
        if (optional) return false;
        throw new Error(`click ${label || target}: ${e.message.split('\n')[0]}`);
      }
    },
    /** Click only if visible right now (no waiting). */
    async clickIfVisible(target, opts = {}) {
      const l = loc(target);
      if (await l.isVisible().catch(() => false)) return api.click(l, { ...opts, optional: true });
      return false;
    },
    async press(key, { label } = {}) {
      await page.keyboard.press(key);
      note('key', label || key);
    },
    async waitVisible(target, timeout = 15000) {
      await loc(target).waitFor({ state: 'visible', timeout });
    },
    async waitHidden(target, timeout = 15000) {
      await loc(target).waitFor({ state: 'hidden', timeout });
    },
    async visible(target) {
      return loc(target).isVisible().catch(() => false);
    },
    /** Wait until fn() (evaluated in the page) is truthy. */
    async until(fn, arg, timeout = 15000) {
      await page.waitForFunction(fn, arg, { timeout, polling: 100 });
    },
    /** Smooth cursor glide (the cursor itself is not recorded; hover states are). */
    async glide(target, steps = 25) {
      const box = await loc(target).boundingBox();
      if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps });
    },
    /** Wait for fonts, images and media of the current screen to be ready. */
    async settle(timeout = 10000) {
      await page.waitForLoadState('load', { timeout }).catch(() => {});
      await page.evaluate(async (ms) => {
        const deadline = Date.now() + ms;
        try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, ms))]); } catch {}
        const imgs = [...document.images].filter((i) => i.getBoundingClientRect().width > 0 && !i.complete);
        await Promise.race([Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())))]);
      }, timeout).catch(() => {});
    },
    async screenshot(name) {
      const file = path.join(shotDir, `${name}.png`);
      await page.screenshot({ path: file }).catch(() => {});
      note('screenshot', name, { file: path.basename(file) });
      return file;
    },
    /** Page render rate measured with requestAnimationFrame since the last reset. */
    async fpsReset() {
      await page.evaluate(() => { const m = window.__showreelFps; if (m) { m.frames = 0; m.since = performance.now(); } }).catch(() => {});
    },
    async fpsRead() {
      return page.evaluate(() => { const m = window.__showreelFps; return m ? +(m.frames / ((performance.now() - m.since) / 1000)).toFixed(1) : null; }).catch(() => null);
    },
  };
  return api;
}

module.exports = { createApi };
