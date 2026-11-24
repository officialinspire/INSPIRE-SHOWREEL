'use strict';
// GRIDLOCK — Grid Lock City. Static ES modules; selectors from index.html, js/ui/boardView.js and
// the repo's own tests/smoke.mjs. Moves are chosen from the live game state exposed by ?debug
// (window.__GRIDLOCK__.getGame(), js/main.js), which draws nothing on screen. Every move is a
// normal UI click, so only legal moves are made.
const { passGateAndSkipIntro, forDuration, withParams } = require('./common');

const PLAY_SOLO = 'button[data-setup-preset="solo"]';

// Runs in the page: pick a road id for the human (seat 1).
//  'capture' = a road that encloses an unowned block (4th side); else 'safe'.
//  'safe'    = a road that does not hand an opponent a 3-sided block; else any open road.
const CHOOSE_ROAD = (mode) => {
  const g = window.__GRIDLOCK__?.getGame?.();
  if (!g) return null;
  const { rows, cols, roads } = g.board;
  const has = (id) => Object.hasOwn(roads, id);
  const sides = (r, c) => [`h-${r}-${c}`, `h-${r + 1}-${c}`, `v-${r}-${c}`, `v-${r}-${c + 1}`];
  const blockAt = (r, c) => g.board.blocks.find((b) => b.row === r && b.col === c);
  const blocksOf = (id) => {
    const [, d, a, b] = /^([hv])-(\d+)-(\d+)$/.exec(id).map((x, i) => (i > 1 ? Number(x) : x));
    return (d === 'h' ? [[a - 1, b], [a, b]] : [[a, b - 1], [a, b]]).filter(([r, c]) => r >= 0 && c >= 0 && r < rows && c < cols);
  };
  const open = [...document.querySelectorAll('button[data-road]:not([disabled])')].map((e) => e.dataset.road).filter((id) => !has(id));
  if (!open.length) return null;
  const builtAfter = (id, r, c) => sides(r, c).filter((s) => has(s) || s === id).length;
  const capturing = open.filter((id) => blocksOf(id).some(([r, c]) => !blockAt(r, c)?.ownerSeat && builtAfter(id, r, c) === 4));
  if (mode === 'capture' && capturing.length) return capturing[Math.floor(Math.random() * capturing.length)];
  const safe = open.filter((id) => blocksOf(id).every(([r, c]) => builtAfter(id, r, c) < 3));
  const pool = safe.length ? safe : capturing.length ? capturing : open;
  return pool[Math.floor(Math.random() * pool.length)];
};

const STATE = () => {
  const g = window.__GRIDLOCK__?.getGame?.();
  if (!g) return null;
  const p = g.players[g.turnIndex];
  const capturable = g.board.blocks.filter((b) => !b.ownerSeat && [`h-${b.row}-${b.col}`, `h-${b.row + 1}-${b.col}`, `v-${b.row}-${b.col}`, `v-${b.row}-${b.col + 1}`].filter((s) => Object.hasOwn(g.board.roads, s)).length === 3).length;
  return { phase: g.phase, turnPhase: g.turnPhase, human: p?.seat === 1, round: g.round, era: g.era, owned: g.board.blocks.filter((b) => b.ownerSeat === 1).length, capturable, roads: Object.keys(g.board.roads).length };
};

/** Clear whichever dialog or tip is blocking play. Returns true if it acted. */
async function clearInterruptions(api, { develop }) {
  const pairs = [
    ['.tutorial-tip button:has-text("Skip tutorial"), button:has-text("Skip tutorial")', 'skip tutorial'],
    ['#city-intro-dialog[open] #city-intro-go', 'city era intro'],
    ['#event-dialog[open] #event-continue', 'city event'],
    ['#handoff-dialog[open] #handoff-ready', 'handoff'],
  ];
  for (const [sel, label] of pairs) if (await api.clickIfVisible(sel, { label })) return true;
  if (await api.visible('#capture-choice-dialog[open]')) {
    await api.wait(develop ? 900 : 150);
    return api.click(`#capture-choice-dialog [data-capture-choice="${develop ? 'develop' : 'vacant'}"]`, { label: develop ? 'develop captured block' : 'leave vacant' });
  }
  if (await api.visible('#build-dialog[open]')) {
    const opts = api.page.locator('#build-dialog [data-build]:not([disabled]):not([aria-disabled="true"])');
    const n = await opts.count();
    if (n) {
      const pick = opts.nth(Math.floor(Math.random() * n));
      await api.glide(pick, 15); await api.wait(500);
      await api.click(pick, { label: 'build' });
      const confirm = api.page.locator('#build-dialog button.btn--gold:not([disabled])').last();
      await api.wait(400);
      if (await confirm.isVisible().catch(() => false)) await api.click(confirm, { label: 'confirm build', optional: true });
    } else {
      await api.click('#build-dialog [data-action="close"], #build-dialog button:has-text("Close")', { optional: true, label: 'close build' });
    }
    return true;
  }
  if (await api.visible('#finance-dialog[open]')) return api.click('#finance-dialog [data-action="close"]', { optional: true, label: 'close finance' });
  return false;
}

/** One step of play for the human seat; CPU turns just run. */
async function step(api, { mode = 'safe', develop = true, show = false } = {}) {
  if (await clearInterruptions(api, { develop })) return true;
  const s = await api.page.evaluate(STATE);
  if (!s || s.phase !== 'playing' || !s.human) return false;
  if (await api.visible('#action-end-turn:not([hidden])')) return api.click('#action-end-turn', { label: 'end turn' });
  if (await api.visible('#action-pave:not([disabled])')) {
    if (show) await api.wait(500);
    return api.click('#action-pave', { label: 'pave road' });
  }
  const road = await api.page.evaluate(CHOOSE_ROAD, mode);
  if (!road) return false;
  const btn = `button[data-road="${road}"]`;
  if (show) { await api.glide(btn, 20); await api.wait(450); }
  await api.click(btn, { label: `road ${road}` });
  if (api.portrait && !(await api.page.evaluate((id) => Object.hasOwn(window.__GRIDLOCK__.getGame().board.roads, id), road).catch(() => true))) {
    await api.click(btn, { label: `confirm road ${road}`, optional: true }); // tap-twice-to-pave on touch
  }
  if (show) await api.wait(600);
  return true;
}

async function smoothScroll(api, dy, ms) {
  const steps = Math.max(1, Math.round(ms / 40));
  await api.page.mouse.move(api.size.width / 2, api.size.height / 2);
  for (let i = 0; i < steps; i++) { await api.page.mouse.wheel(0, dy / steps); await api.wait(40); }
}

async function startSoloGame(api) {
  await api.click(PLAY_SOLO, { label: 'Play Solo' });
  await api.waitVisible('#setup-start');
  await api.wait(500);
  await api.click('#setup-start', { label: 'Start Game' });
  await api.until(() => window.__GRIDLOCK__?.getGame?.()?.phase === 'playing', null, 20000);
  await api.wait(800);
  await clearInterruptions(api, { develop: true });
  await api.settle();
}

module.exports = {
  layouts: ['landscape', 'portrait'],
  url: (game) => withParams(game.url, { debug: '1' }),
  async boot(api) {
    await passGateAndSkipIntro(api, { gate: '#start-button', video: '#intro-video', skip: '#intro-skip', after: PLAY_SOLO });
  },
  shots: [
    {
      id: 'menus',
      title: 'Title screen, menu and How To Play cards',
      maxSec: 22,
      async run(api) {
        api.mark('title');
        await api.wait(1200);
        for (const sel of [PLAY_SOLO, 'button[data-setup-preset="friends"]', 'button[data-setup-preset="mixed"]']) {
          await api.glide(sel, 30);
          await api.wait(900);
        }
        await api.click('button[data-nav="howto"]', { label: 'How To Play' });
        api.mark('how-to-play');
        await api.wait(1500);
        await smoothScroll(api, api.portrait ? 2600 : 1400, 7000);
        await api.wait(1000);
        await smoothScroll(api, api.portrait ? -2600 : -1400, 2500);
        await api.click('[data-screen="howto"] [data-nav="back"]', { label: 'back to title' });
        await api.wait(1800);
      },
    },
    {
      id: 'opening-moves',
      title: 'First rounds: paving roads against three Mayor Bots',
      maxSec: 30,
      setup: startSoloGame,
      async run(api) {
        api.mark('board');
        await api.wait(1200);
        await forDuration(api, 24000, () => step(api, { mode: 'safe', show: true }), { gapMs: 150 });
      },
    },
    {
      id: 'capture-and-build',
      title: 'Mid-game: enclosing blocks, building and the bonus road',
      maxSec: 34,
      setupTimeoutSec: 240,
      async setup(api) {
        await startSoloGame(api);
        // Play on (unrecorded) until the human is to move with a block ready to enclose.
        const t0 = Date.now();
        while (Date.now() - t0 < 200000) {
          const s = await api.page.evaluate(STATE);
          if (s?.human && s.capturable >= 2 && s.turnPhase === 'manage-city' && !(await api.visible('dialog[open]'))) break;
          if (s?.phase !== 'playing') throw new Error('game ended before a capture position arose');
          await step(api, { mode: 'safe', develop: false });
          await api.wait(100);
        }
      },
      async run(api) {
        api.mark('mid-game');
        await api.wait(800);
        await forDuration(api, 28000, () => step(api, { mode: 'capture', develop: true, show: true }), { gapMs: 200 });
      },
    },
  ],
};
