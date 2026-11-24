'use strict';
// STICKS & BONES — No Rest for Cousin. Vite/TypeScript build; the window.__sb* hooks exist only in
// dev builds (import.meta.env.DEV), so everything here is plain DOM driven by data-act attributes
// from src/ui/table.ts, src/ui/menu.ts and src/ui/story-ui.ts:
//   menu        [data-act="story"], "Quick Play" destination, "Deal the tiles"
//   story       "New Case", [data-act="story-next"] (Continue), [data-act="story-skip"]
//   table       .hand-tile.is-legal[data-act="select"] -> .end-slot.is-legal[data-act="place"],
//               [data-act="draw"] / [data-act="pass"] when blocked, [data-act="next-hand"]
// Story footage stops inside the prologue ("An Open Door"), before any chapter plays out.
const { passGateAndSkipIntro, forDuration } = require('./common');

async function storyLines(api, { maxLines, maxMs }) {
  const t0 = Date.now();
  for (let i = 0; i < maxLines && Date.now() - t0 < maxMs; i++) {
    const next = api.page.locator('[data-act="story-next"]:visible').first();
    if (!(await next.count())) { await api.wait(600); if (!(await next.count())) return; }
    const text = await api.page.evaluate(() => (document.querySelector('.dialogue-body')?.innerText || '').trim()).catch(() => '');
    await api.wait(Math.min(4800, Math.max(2200, text.length * 32)));
    await api.click(next, { label: `continue: ${text.slice(0, 40)}` });
    await api.wait(400);
  }
}

/** One step at the domino table. Returns false when there is nothing to do yet. */
async function tableStep(api, { show = true } = {}) {
  if (await api.clickIfVisible('[data-act="next-hand"]', { label: 'next hand' })) { await api.wait(1500); return true; }
  const tile = api.page.locator('.hand-tile.is-legal:visible').first();
  if (await tile.count()) {
    if (show) { await api.glide(tile, 18); await api.wait(450); }
    await api.click(tile, { label: 'select tile' });
    await api.wait(show ? 600 : 150);
    const slot = api.page.locator('.end-slot.is-legal:visible');
    const n = await slot.count();
    if (n) {
      const pick = slot.nth(Math.floor(Math.random() * n));
      if (show) { await api.glide(pick, 18); await api.wait(350); }
      await api.click(pick, { label: 'place tile' });
    }
    await api.wait(show ? 900 : 200);
    return true;
  }
  for (const act of ['draw', 'pass']) {
    const b = api.page.locator(`[data-act="${act}"]:visible:not([disabled])`).first();
    if (await b.count()) { await api.click(b, { label: act }); await api.wait(show ? 800 : 200); return true; }
  }
  return false; // Cousin's turn: the AI plays on screen
}

async function quickPlay(api) {
  await api.click('button:has-text("Quick Play")', { label: 'Quick Play' });
  await api.waitVisible('button:has-text("Deal the tiles")', 10000);
  await api.wait(1200);
  await api.glide('button:has-text("Deal the tiles")', 20);
  await api.wait(400);
  await api.click('button:has-text("Deal the tiles")', { label: 'Deal the tiles' });
  await api.waitVisible('.hand-tile', 15000);
}

module.exports = {
  // SFX-only takes: music, ambience beds and result stingers are .mp3; tile/table effects are .wav.
  sfxOnly: { block: /\.mp3$/i },
  layouts: ['landscape', 'portrait'],
  async boot(api) {
    await passGateAndSkipIntro(api, { gate: '[data-act="start"]', video: 'video', skip: '[data-act="intro-skip"]', after: '[data-act="story"]' });
  },
  shots: [
    {
      id: 'story-prologue',
      title: 'Story mode: the case file and the prologue "An Open Door"',
      maxSec: 55,
      async run(api) {
        api.mark('main menu');
        await api.wait(1500);
        await api.glide('[data-act="story"]', 25);
        await api.wait(600);
        await api.click('[data-act="story"]', { label: 'STORY' });
        await api.wait(1800);
        await api.glide('button:has-text("New Case")', 20);
        await api.wait(500);
        await api.click('button:has-text("New Case")', { label: 'New Case' });
        api.mark('prologue');
        await api.wait(2500);
        await storyLines(api, { maxLines: 8, maxMs: 40000 });
      },
    },
    {
      id: 'quick-play-hand',
      title: 'Quick Play: dealing and playing a hand of dominoes against Cousin',
      maxSec: 55,
      async run(api) {
        api.mark('quick play');
        await api.wait(800);
        await quickPlay(api);
        api.mark('deal');
        await api.wait(1500);
        await forDuration(api, 38000, () => tableStep(api));
      },
    },
  ],
};
