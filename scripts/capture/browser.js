'use strict';
// Headed Chromium on the virtual display, forced into true fullscreen (no tabs, URL bar or
// infobars), with audio routed to the private PulseAudio sink and analytics excluded.
const { chromium } = require('playwright');

const ANALYTICS_HOSTS = /(^|\.)(posthog\.com|google-analytics\.com|googletagmanager\.com|plausible\.io|clarity\.ms|umami\.is|goatcounter\.com|segment\.io)$/i;

// Runs before any page script: every officialinspire game checks one of these before sending analytics.
const INIT_SCRIPT = `(() => {
  const def = (o, k, v) => { try { Object.defineProperty(o, k, { get: () => v, configurable: true }); } catch {} };
  def(Navigator.prototype, 'doNotTrack', '1');
  def(Navigator.prototype, 'globalPrivacyControl', true);
  def(window, 'doNotTrack', '1');
  // Render-rate meter: counts requestAnimationFrame callbacks so recordings can report real page FPS.
  const m = { frames: 0, since: performance.now() };
  window.__showreelFps = m;
  const tick = () => { m.frames++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
})();`;

async function launch({ display, audio, width, height, extraArgs = [] }) {
  const browser = await chromium.launch({
    headless: false,
    env: { ...process.env, DISPLAY: display, ...(audio ? { PULSE_SERVER: audio.server } : {}) },
    ignoreDefaultArgs: ['--enable-automation', '--mute-audio', '--hide-scrollbars'],
    args: [
      `--window-size=${width},${height}`, '--window-position=0,0', '--start-fullscreen',
      '--autoplay-policy=no-user-gesture-required', '--disable-infobars', '--hide-scrollbars',
      '--disable-features=Translate,MediaRouter,GlobalMediaControls,DownloadBubble',
      '--disable-session-crashed-bubble', '--noerrdialogs', '--no-first-run', '--no-default-browser-check',
      '--force-device-scale-factor=1',
      // No GPU in the capture machine. GPU rasterization through SwiftShader dropped GRIDLOCK's
      // turn animations to 6-16 fps; CPU raster + SwiftShader for WebGL only holds 53-61 fps.
      '--use-gl=angle', '--use-angle=swiftshader-webgl', '--disable-gpu-rasterization',
      ...extraArgs,
    ],
  });
  return browser;
}

/** New isolated context + page, fullscreen, analytics blocked. */
async function openPage(browser, { width, height, touch = false, stats, blockMedia = null, storage = null }) {
  const ctx = await browser.newContext({ viewport: null, hasTouch: touch, locale: 'en-US', timezoneId: 'America/New_York', serviceWorkers: 'block' });
  await ctx.addInitScript(INIT_SCRIPT);
  // SFX-only takes: seed the game's own audio settings and refuse its music files.
  if (storage) await ctx.addInitScript((entries) => { for (const [k, v] of Object.entries(entries)) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch {} } }, storage);
  if (blockMedia) {
    await ctx.route((url) => blockMedia.test(url.pathname), (route) => {
      stats.musicBlocked = (stats.musicBlocked || 0) + 1;
      return route.abort('blockedbyclient');
    });
  }
  await ctx.route((url) => ANALYTICS_HOSTS.test(url.hostname), (route) => {
    stats.analyticsBlocked = (stats.analyticsBlocked || 0) + 1;
    stats.analyticsHosts = [...new Set([...(stats.analyticsHosts || []), new URL(route.request().url()).hostname])];
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal', left: 0, top: 0, width, height } }).catch(() => {});
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'fullscreen' } });
  page.on('pageerror', (e) => (stats.pageErrors = [...(stats.pageErrors || []), e.message.slice(0, 200)].slice(-20)));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  return { ctx, page, cdp };
}

/** Viewport check: the page must fill the whole screen (no browser chrome). */
async function assertFullscreen(page, width, height) {
  for (let i = 0; i < 20; i++) {
    const [w, h] = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
    if (Math.abs(w - width) <= 1 && Math.abs(h - height) <= 1) return [w, h];
    await page.waitForTimeout(150);
  }
  const [w, h] = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
  throw new Error(`page is ${w}x${h}, expected ${width}x${height}: browser chrome would be visible`);
}

module.exports = { launch, openPage, assertFullscreen, ANALYTICS_HOSTS };
