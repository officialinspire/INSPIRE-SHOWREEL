'use strict';
// INSPIRE CARD PARLOR — Vite/TypeScript. Selectors follow the repo's own tests/e2e (helpers.ts,
// story.spec.ts, solitaire.spec.ts): the live screen is `.screen:not([aria-hidden])`, dialogs use
// [data-dialog-action], story chapters [data-chapter] / [data-level], War [data-action="play-round"],
// solitaire .sol-card[data-code][data-pile] and .sol-slot[data-pile]. window.__ICP__.store is read
// for the current screen only. Klondike moves are chosen by a small legal-move finder over the
// visible cards and made with the same click-select-then-click-target input a player uses.
// Story footage covers Chapter 1's opening narration and first challenge only.
const { forDuration } = require('./common');

const C = '.screen:not([aria-hidden])';
const DIALOG = (v) => `.dialog-backdrop:not([aria-hidden]) [data-dialog-action="${v}"]`;
const screen = (api) => api.page.evaluate(() => window.__ICP__?.store?.state?.screen).catch(() => null);

async function untilScreen(api, name, timeout = 15000) {
  await api.until((n) => window.__ICP__?.store?.state?.screen === n, name, timeout);
}

/** Pages a pager grid until the selector is visible (tests/e2e/helpers.ts revealInPager). */
async function revealInPager(api, selector) {
  const target = api.page.locator(`${C} ${selector}`).first();
  for (let i = 0; i < 8 && !(await target.isVisible().catch(() => false)); i++) {
    if (!(await api.clickIfVisible(`${C} [data-pager="next"]`, { label: 'next page' }))) break;
    await api.wait(700);
  }
  return target;
}

// Runs in the page: one legal Klondike move as { from: data-key, to: data-key | pile id } or a stock action.
const KLONDIKE_MOVE = (C) => {
  const RANK = { A: 1, J: 11, Q: 12, K: 13 };
  const parse = (code) => code && { rank: RANK[code.slice(0, -1)] || Number(code.slice(0, -1)), suit: code.slice(-1), red: /[HD]$/.test(code) };
  const cards = [...document.querySelectorAll(`${C} .sol-card`)].map((e) => ({ el: e, key: e.dataset.key, pile: e.dataset.pile, up: e.classList.contains('card-face'), c: parse(e.dataset.code) }));
  const pile = (id) => cards.filter((x) => x.pile === id);
  // The playable top card carries .pickable (the waste pile lists its top card first in the DOM).
  const top = (id) => { const p = pile(id); return p.find((x) => x.el.classList.contains('pickable') && x === p.filter((y) => y.el.classList.contains('pickable')).slice(-1)[0]) || p.slice(-1)[0]; };
  const tabs = [0, 1, 2, 3, 4, 5, 6].map((i) => `tableau:${i}`);
  const founds = [0, 1, 2, 3].map((i) => `foundation:${i}`);
  const toFoundation = (card) => {
    for (const f of founds) {
      const t = top(f);
      if ((!t && card.c.rank === 1) || (t && t.c && t.c.suit === card.c.suit && t.c.rank === card.c.rank - 1)) return f;
    }
    return null;
  };
  const sources = [top('waste'), ...tabs.map(top)].filter((x) => x && x.up && x.c);
  for (const s of sources) { const f = toFoundation(s); if (f) return { from: s.key, to: f, kind: 'foundation' }; }
  // Tableau runs that uncover a face-down card (or free a column for a king).
  for (const from of tabs) {
    const p = pile(from);
    const i = p.findIndex((x) => x.up);
    if (i < 0) continue;
    const head = p[i];
    for (const to of tabs) {
      if (to === from) continue;
      const t = top(to);
      if (!t && head.c.rank === 13 && i > 0) return { from: head.key, to, kind: 'king' };
      if (t && t.up && t.c && t.c.red !== head.c.red && t.c.rank === head.c.rank + 1 && i > 0) return { from: head.key, to: t.key, kind: 'tableau' };
    }
  }
  const w = top('waste');
  if (w && w.c) {
    for (const to of tabs) {
      const t = top(to);
      if ((!t && w.c.rank === 13) || (t && t.up && t.c && t.c.red !== w.c.red && t.c.rank === w.c.rank + 1)) return { from: w.key, to: t ? t.key : to, kind: 'waste' };
    }
  }
  if (pile('stock').length) return { stock: 'draw' };
  if (pile('waste').length) return { stock: 'recycle' };
  return null;
};

async function klondikeStep(api, state) {
  const m = await api.page.evaluate(KLONDIKE_MOVE, C);
  if (!m) return false;
  if (m.stock) {
    if (m.stock === 'recycle' && ++state.recycles > 2) return false; // stuck deal: stop rather than loop
    const target = m.stock === 'draw' ? `${C} .sol-card[data-pile="stock"] >> nth=-1` : `${C} .sol-slot[data-pile="stock"]`;
    await api.click(target, { label: m.stock === 'draw' ? 'draw from stock' : 'recycle waste' });
    await api.wait(650);
    return true;
  }
  const src = `${C} .sol-card[data-key="${m.from}"]`;
  const dst = /^(tableau|foundation):/.test(m.to) ? `${C} .sol-slot[data-pile="${m.to}"]` : `${C} .sol-card[data-key="${m.to}"]`;
  await api.glide(src, 14);
  await api.click(src, { label: `pick ${m.kind}` });
  await api.wait(350);
  await api.glide(dst, 14);
  await api.click(dst, { label: `place ${m.kind}` });
  await api.wait(700);
  return true;
}

module.exports = {
  layouts: ['landscape', 'portrait'],
  async boot(api) {
    const enter = 'button:has-text("Enter Parlor")';
    // Title animation: any tap skips it (Initialization.ts); the start itself needs its own tap.
    for (let i = 0; i < 60 && !(await api.visible(enter)); i++) {
      await api.clickIfVisible('[data-action="skip-intro"]', { label: 'skip title animation' });
      await api.wait(300);
    }
    await api.wait(700);
    await api.click(enter, { label: 'ENTER PARLOR' });
    // The studio video follows the start tap; skip it the way a player does.
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const playing = await api.page.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.getBoundingClientRect().width > 0 && !v.ended));
      if (!playing && (await screen(api)) === 'MAIN_MENU') break;
      await api.clickIfVisible('button:has-text("Skip video")', { label: 'skip studio video' });
      await api.wait(400);
    }
    await untilScreen(api, 'MAIN_MENU', 20000);
    await api.settle();
    await api.wait(1200);
  },
  shots: [
    {
      id: 'parlor-hub',
      title: 'The parlor hub: day/night scenery, menus and the card games',
      maxSec: 30,
      async run(api) {
        api.mark('hub');
        await api.wait(1500);
        if (await api.clickIfVisible(`${C} button:has-text("NIGHT")`, { label: 'night' })) { api.mark('night'); await api.wait(3500); }
        for (const t of ['Story Mode', 'Card Games', 'Collection', 'Gameboards']) {
          const b = `${C} button:has-text("${t}")`;
          if (await api.visible(b)) { await api.glide(b, 20); await api.wait(650); }
        }
        await api.click(`${C} button:has-text("Card Games")`, { label: 'Card Games' });
        api.mark('card games');
        await api.wait(2200);
        for (let i = 0; i < 2; i++) { if (await api.clickIfVisible(`${C} [data-pager="next"]`, { label: 'next page' })) await api.wait(1800); }
        await api.wait(1000);
      },
    },
    {
      id: 'story-chapter-one',
      title: 'Story Mode: Chapter 1 "The Card Without a Suit", Cheryl\'s challenge and a hand of War',
      maxSec: 75,
      async run(api) {
        api.mark('story map');
        await api.click(`${C} button:has-text("Story Mode")`, { label: 'Story Mode' });
        await untilScreen(api, 'STORY_MODE');
        await api.wait(2200);
        await api.glide(`${C} [data-chapter="th-1"]`, 25);
        await api.wait(800);
        await api.click(`${C} [data-chapter="th-1"]`, { label: "Cheryl's Antique Shop" });
        api.mark('chapter intro');
        // Chapter intro narration: read each line, then "Let's go".
        for (let i = 0; i < 10 && (await api.visible(DIALOG('ok'))); i++) {
          await api.wait(2600);
          const next = '.dialog-backdrop:not([aria-hidden]) button:has-text("Next"):not([disabled]):not([aria-disabled="true"])';
          if (!(await api.clickIfVisible(next, { label: 'next line' }))) {
            await api.click(DIALOG('ok'), { label: "Let's go" });
            break;
          }
        }
        await api.wait(1500);
        const level = await revealInPager(api, 'button:has-text("Price Check")');
        await api.glide(level, 20);
        await api.wait(600);
        await api.click(level, { label: 'Price Check' });
        api.mark('challenge scene');
        await api.waitVisible('.dialog-scene [data-objective]', 10000);
        await api.wait(4200);
        await api.click(DIALOG('play'), { label: 'Ready' });
        api.mark('versus card');
        await api.waitVisible('[data-versus="th-1-1"]', 10000);
        await api.wait(3000);
        await api.click(DIALOG('play'), { label: 'Play' });
        await untilScreen(api, 'GAMEPLAY');
        await api.clickIfVisible(DIALOG('deal'), { label: 'deal' });
        api.mark('war');
        await api.wait(1500);
        await forDuration(api, 14000, async () => {
          if (!(await api.clickIfVisible(`${C} [data-action="play-round"]`, { label: 'play round' }))) return false;
          await api.wait(1300);
          return true;
        });
      },
    },
    {
      id: 'klondike',
      title: 'Quick Play Klondike: the deal and a run of legal moves',
      maxSec: 55,
      async run(api) {
        api.mark('hub');
        await api.wait(800);
        await api.glide(`${C} [data-action="quick-play"]`, 20);
        await api.click(`${C} [data-action="quick-play"]`, { label: 'Quick Play: Klondike' });
        await api.waitVisible(DIALOG('deal'), 10000);
        await api.wait(1200);
        await api.click(DIALOG('deal'), { label: 'Deal' });
        api.mark('deal');
        await api.waitVisible(`${C} .sol-board .sol-card`, 10000);
        await api.wait(2500);
        const state = { recycles: 0 };
        await forDuration(api, 36000, () => klondikeStep(api, state));
      },
    },
  ],
};
