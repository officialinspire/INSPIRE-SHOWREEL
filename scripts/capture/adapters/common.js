'use strict';
// Helpers shared by adapters.

/** Click a start gate, then skip the studio intro as soon as its skip control accepts input.
 *  The intro is never recorded in game shots (the reel opens with the original file). */
async function passGateAndSkipIntro(api, { gate, gateKey, video, skip, skipKeys = ['Escape'], after, timeout = 20000 }) {
  if (gate) {
    await api.waitVisible(gate, timeout);
    await api.wait(600);
    await api.click(gate, { label: 'start gate' });
  } else if (gateKey) {
    await api.wait(1200);
    await api.press(gateKey);
  }
  const t0 = Date.now();
  // Wait for the intro to appear (some games skip it once per session).
  let seen = false;
  while (Date.now() - t0 < 6000) {
    if (await api.visible(video)) { seen = true; break; }
    if (after && (await api.visible(after))) break;
    await api.wait(150);
  }
  if (seen) {
    await api.wait(700); // skip controls arm a few hundred ms after the start input is released
    while (Date.now() - t0 < timeout && (await api.visible(video))) {
      if (!(skip && (await api.clickIfVisible(skip, { label: 'skip intro' })))) for (const k of skipKeys) await api.page.keyboard.press(k);
      await api.wait(400);
    }
  }
  if (after) await api.waitVisible(after, timeout);
  await api.settle();
}

/** Repeatedly perform fn until the page has spent ms milliseconds, keeping footage alive. */
async function forDuration(api, ms, fn, { gapMs = 0 } = {}) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const did = await fn(end - Date.now());
    if (gapMs) await api.wait(Math.min(gapMs, Math.max(0, end - Date.now())));
    if (did === false) await api.wait(Math.min(250, Math.max(0, end - Date.now())));
  }
}

/** Hold for ms while slowly drifting the pointer across targets (hover effects, no clicks). */
async function hoverTour(api, selectors, totalMs) {
  const per = Math.max(600, Math.floor(totalMs / Math.max(1, selectors.length)));
  for (const s of selectors) {
    if (await api.visible(s)) { await api.glide(s, 30); api.mark(`hover ${s}`); }
    await api.wait(per);
  }
}

function withParams(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

module.exports = { passGateAndSkipIntro, forDuration, hoverTour, withParams };
