'use strict';
// Spirit of the Woods — Shells & Feathers (tic-tac-toe) and Acorns & Leaves (checkers).
// Static ES modules. Selectors follow the repo's own tests/helpers/game-page.mjs:
//   hub        a[href="#/shells-feathers"], [data-hub-game="al"], "Play Acorns & Leaves"
//   setup      radios by name (Gentle | Balanced | Wise, Shell | Feather, Classic, Acorns), "Play the Spirit"
//   S&F board  .cell[data-index] with data-symbol, #turn-indicator, result in .modal.active
//   checkers   #al-board button[data-square][data-piece]; tapping a piece marks .is-destination
//              squares and .must-jump pieces; a chain is tapped square by square.
const { passGateAndSkipIntro, forDuration } = require('./common');

const SF_PLAY = 'a[href="#/shells-feathers"]';

// Tic-tac-toe: win, block, centre, corner, any (runs in the page; 'shell' is the player).
const TTT_MOVE = () => {
  const b = [...document.querySelectorAll('.cell')].map((c) => c.dataset.symbol || '');
  const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const finish = (who) => { for (const l of L) { const v = l.map((i) => b[i]); if (v.filter((x) => x === who).length === 2 && v.includes('')) return l[v.indexOf('')]; } return -1; };
  const empty = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (!empty.length) return -1;
  for (const m of [finish('shell'), finish('feather')]) if (m >= 0) return m;
  if (!b[4]) return 4;
  const corners = [0, 2, 6, 8].filter((i) => !b[i]);
  const pool = corners.length ? corners : empty;
  return pool[Math.floor(Math.random() * pool.length)];
};

async function playTicTacToe(api, rounds) {
  for (let r = 0; r < rounds; r++) {
    await api.until(() => document.getElementById('turn-indicator')?.textContent.startsWith('Your Turn') || !!document.querySelector('.modal.active'), null, 15000);
    for (let guard = 0; guard < 6 && !(await api.visible('.modal.active')); guard++) {
      await api.until(() => document.getElementById('turn-indicator')?.textContent.startsWith('Your Turn') || !!document.querySelector('.modal.active'), null, 15000);
      if (await api.visible('.modal.active')) break;
      const i = await api.page.evaluate(TTT_MOVE);
      if (i < 0) break;
      const cell = `.cell[data-index="${i}"]`;
      await api.glide(cell, 16);
      await api.wait(350);
      await api.click(cell, { label: `place shell ${i}` });
      await api.wait(1300); // the Spirit answers on screen
    }
    await api.waitVisible('.modal.active', 15000);
    api.mark(`result: ${await api.page.locator('.modal.active .modal-title').textContent().catch(() => '')}`);
    await api.wait(2600);
    if (r < rounds - 1) {
      await api.click('.modal.active button:has-text("Play Again")', { label: 'Play Again' });
      await api.wait(1200);
    }
  }
}

// Checkers: squares holding our pieces, forced jumpers first.
const MY_PIECES = (side) => {
  const all = [...document.querySelectorAll('#al-board button[data-square]')];
  const mine = all.filter((e) => (e.dataset.piece || '').startsWith(side));
  const forced = mine.filter((e) => e.classList.contains('must-jump'));
  const list = (forced.length ? forced : mine).map((e) => Number(e.dataset.square));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};
const DESTS = () => [...document.querySelectorAll('#al-board .is-destination')].map((e) => Number(e.dataset.square));
const MY_TURN = (side) => {
  const board = document.getElementById('al-board');
  const active = document.querySelector('.al-side.is-active');
  return !!board && board.getAttribute('aria-busy') !== 'true' && !!active && active.id === `al-side-${side}`;
};

async function checkersMove(api, side) {
  if (await api.visible('.modal.active')) return false;
  if (!(await api.page.evaluate(MY_TURN, side))) return false;
  const sq = (n) => `#al-board button[data-square="${n}"]`;
  for (const from of await api.page.evaluate(MY_PIECES, side)) {
    await api.glide(sq(from), 12);
    await api.click(sq(from), { label: `pick ${from}` });
    await api.wait(350);
    let dests = await api.page.evaluate(DESTS);
    if (!dests.length) { await api.click(sq(from), { label: 'put back', optional: true }); await api.wait(150); continue; }
    // Tap each landing square; a capture chain shows the next destinations after each hop.
    for (let hop = 0; hop < 6 && dests.length; hop++) {
      const to = dests[Math.floor(Math.random() * dests.length)];
      await api.glide(sq(to), 12);
      await api.click(sq(to), { label: `move to ${to}` });
      await api.wait(500);
      dests = (await api.page.evaluate(MY_TURN, side)) ? await api.page.evaluate(DESTS) : [];
    }
    await api.wait(900);
    return true;
  }
  return false;
}

async function openCheckers(api) {
  if (await api.visible('.hub-chooser')) await api.click('[data-hub-game="al"]', { label: 'Acorns & Leaves' });
  await api.wait(600);
  await api.click('a[href="#/acorns-leaves"]', { label: 'Play Acorns & Leaves' });
  await api.waitVisible('#al-setup-screen.active, #al-setup-screen:visible', 10000).catch(() => {});
  await api.wait(800);
  for (const name of ['Classic', 'Acorns', 'Balanced']) {
    const r = api.page.locator('.screen.active').getByRole('radio', { name, exact: true });
    if (await r.count()) await r.first().check({ force: true }).catch(() => {});
  }
  await api.wait(500);
  await api.click(api.page.locator('.screen.active').getByRole('button', { name: 'Play the Spirit' }).or(api.page.locator('.screen.active a:has-text("Play the Spirit")')).first(), { label: 'Play the Spirit' });
  await api.waitVisible('#al-board', 10000);
}

module.exports = {
  // SFX-only takes: gameplay.mp3 is the score; piece, select and result sounds stay.
  sfxOnly: { block: /\/gameplay\.mp3$/i },
  layouts: ['landscape', 'portrait'],
  async boot(api) {
    // The start button pulses, so clicks are forced; the intro plays once per browser session.
    await passGateAndSkipIntro(api, { gate: '#start-button', video: '#intro-video', skip: '#intro-skip', after: SF_PLAY });
    await api.waitHidden('#intro-video', 15000).catch(() => {});
    await api.settle();
  },
  shots: [
    {
      id: 'hub-and-tic-tac-toe',
      title: 'The forest hub, then Shells & Feathers against the Spirit',
      maxSec: 70,
      async run(api) {
        api.mark('hub');
        await api.wait(1800);
        await api.glide('[data-hub-game="al"], a[href="#/acorns-leaves"]', 25);
        await api.wait(700);
        await api.glide(SF_PLAY, 25);
        await api.wait(600);
        await api.click(SF_PLAY, { label: 'Play Shells & Feathers' });
        api.mark('setup');
        await api.wait(1500);
        for (const name of ['Balanced', 'Shell']) {
          const r = api.page.locator('.screen.active').getByRole('radio', { name, exact: true });
          if (await r.count()) { await r.first().check({ force: true }).catch(() => {}); await api.wait(500); }
        }
        await api.click(api.page.locator('.screen.active').getByRole('button', { name: 'Play the Spirit' }).or(api.page.locator('.screen.active a:has-text("Play the Spirit")')).first(), { label: 'Play the Spirit' });
        api.mark('match');
        await playTicTacToe(api, 2);
      },
    },
    {
      id: 'acorns-and-leaves',
      title: 'Acorns & Leaves: checkers against the forest Spirit',
      maxSec: 60,
      async setup(api) {
        await openCheckers(api);
      },
      async run(api) {
        api.mark('checkers');
        await api.wait(1200);
        await forDuration(api, 38000, () => checkersMove(api, 'acorn'));
      },
    },
  ],
};
