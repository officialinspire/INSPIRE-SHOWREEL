'use strict';
// EMOJI ELEMENTS — static PWA. Selectors and the turn loop follow the repo's own tests/smoke.mjs
// ("match-natural-play"): play a land, tap lands, cast playable cards, attack with every eligible
// creature, end turn. Only UI clicks are used; game state (global `gameState`, `isProcessingAction`)
// is read to decide what is legal, never written. ?qa is NOT used (it enables QA/debug features).
const { forDuration } = require('./common');

const MENU = (label) => `#mainMenu button:has-text("${label}")`;

const PLAYER_READY = () => typeof gameState !== 'undefined' && (gameState.matchFinalized || (gameState.turn === 'player' && gameState.phase === 'main' && !isProcessingAction));

async function closeDetail(api) {
  await api.page.evaluate(() => { if (typeof hideCardDetail === 'function') hideCardDetail(); }).catch(() => {});
}

async function startBattle(api, element = 'fire') {
  await api.click(MENU('NEW GAME'), { label: 'NEW GAME' });
  await api.wait(900);
  await api.click('.deck-mode-btn[data-deck-mode="single"]', { label: 'single element deck' });
  await api.wait(500);
  await api.glide(`.element-btn[data-element="${element}"]`, 20);
  await api.click(`.element-btn[data-element="${element}"]`, { label: `element ${element}` });
  await api.wait(900);
  await api.click('#startBtn', { label: 'START BATTLE' });
  await api.until(() => document.getElementById('gameContainer')?.style.display === 'flex', null, 15000);
  await api.until(PLAYER_READY, null, 30000);
}

/** One full player turn through the UI. pace = ms between visible actions. */
async function playTurn(api, { pace = 450, attack = true } = {}) {
  const p = api.page;
  if (await p.evaluate(() => gameState.matchFinalized)) return false;
  if ((await p.evaluate(() => gameState.landsPlayedThisTurn === 0)) && (await p.locator('#playerHand .card.land').count())) {
    await api.click('#playerHand .card.land', { label: 'play land' });
    await api.wait(pace);
  }
  for (let guard = 0; guard < 30; guard++) {
    const stack = p.locator('#playerBoard .land-stack-card:not(.all-tapped):visible').first();
    if (!(await stack.count())) break;
    if (!(await api.click(stack, { label: 'tap land', optional: true, timeout: 2000 }))) break;
    if (await p.locator('#manaChoiceModal.show .mana-choice-btn').count()) await api.click('#manaChoiceModal .mana-choice-btn', { label: 'choose mana' });
    await api.wait(Math.round(pace / 3));
  }
  for (let guard = 0; guard < 8; guard++) {
    await api.wait(pace);
    const playable = p.locator('#playerHand .card.playable:not(.land)').first();
    if (!(await playable.count())) break;
    await api.glide(playable, 12);
    await api.click(playable, { label: 'cast card' });
    await closeDetail(api);
  }
  await api.until(() => !isProcessingAction, null, 15000);
  if (attack) {
    const attackers = await p.evaluate(() => gameState.playerBoard.filter((c) => c.type === 'creature' && !c.tapped && !c.summoningSick && !c.abilities?.includes('defender')).map((c) => c.id));
    if (attackers.length && !(await p.evaluate(() => gameState.matchFinalized))) {
      await api.click('#attackBtn', { label: 'ATTACK' });
      for (const id of attackers) { await api.wait(Math.round(pace / 2)); await api.click(`[id="card-player-${id}"]`, { label: 'choose attacker' }); }
      await api.wait(pace);
      await api.click('#attackBtn', { label: 'CONFIRM attack' });
      await api.until(() => !isProcessingAction, null, 20000);
    }
  }
  if (await p.evaluate(() => gameState.matchFinalized)) return false;
  await api.wait(pace);
  await api.click('#endTurnBtn', { label: 'END TURN' });
  await api.until(PLAYER_READY, null, 40000); // the AI's turn plays out on screen
  return true;
}

module.exports = {
  // SFX-only takes: every soundtrack is .mp3; effects come from audio/sfx/sfx-bank.wav (Kenney CC0).
  sfxOnly: { block: /\.mp3$/i },
  layouts: ['landscape', 'portrait'],
  async boot(api) {
    await api.waitVisible('#clickToStart', 20000);
    await api.wait(800);
    await api.click('#clickToStart', { label: 'click to start' });
    await api.until(() => document.getElementById('introContainer')?.style.display === 'flex' || !!document.querySelector('#mainMenu button'), null, 10000);
    await api.wait(900);
    // Skip the studio intro the way a player does: tap the intro (corner avoids the credit link).
    for (let i = 0; i < 20 && (await api.page.evaluate(() => document.getElementById('introContainer')?.style.display === 'flex')); i++) {
      await api.click('#introContainer', { position: { x: 15, y: 15 }, label: 'skip intro', optional: true });
      await api.wait(400);
    }
    await api.waitVisible(MENU('NEW GAME'), 15000);
    await api.clickIfVisible('#pwaUpdateDismiss, .pwa-update [aria-label="Dismiss"]', { label: 'dismiss update toast' });
    await api.settle();
  },
  shots: [
    {
      id: 'pack-opening',
      title: 'Main menu, Pack Shop and a booster pack reveal',
      maxSec: 30,
      async run(api) {
        api.mark('main menu');
        await api.wait(1000);
        for (const l of ['NEW GAME', 'COLLECTION', 'PACK SHOP']) { await api.glide(MENU(l), 25); await api.wait(600); }
        await api.click(MENU('PACK SHOP'), { label: 'PACK SHOP' });
        api.mark('pack shop');
        await api.wait(1600);
        await api.glide('.shop-pack-btn[data-theme="fantasy"]', 25);
        await api.wait(500);
        await api.click('.shop-pack-btn[data-theme="fantasy"]', { label: 'buy Fantasy Pack' });
        await api.waitVisible('#packOpenBtn', 8000);
        await api.wait(1200);
        await api.click('#packOpenBtn', { label: 'OPEN PACK' });
        api.mark('pack reveal');
        await api.wait(2200);
        for (let i = 0; i < 4; i++) { await api.click('#packNextBtn', { label: 'next card' }); await api.wait(1700); }
        await api.click('#packSummaryBtn', { label: 'all 5 cards', optional: true });
        await api.wait(3000);
      },
    },
    {
      id: 'battle-opening',
      title: 'Battle setup, then the opening turns: lands, mana and first creatures',
      maxSec: 45,
      async run(api) {
        api.mark('battle setup');
        await startBattle(api, 'fire');
        api.mark('battle start');
        await api.wait(1500);
        await forDuration(api, 26000, () => playTurn(api, { pace: 550 }));
      },
    },
    {
      id: 'battle-combat',
      title: 'Mid-battle: attacks, blocks and the AI turn',
      maxSec: 50,
      setupTimeoutSec: 240,
      async setup(api) {
        await startBattle(api, 'fire');
        // Play quickly (unrecorded) until there are creatures on both sides to fight with.
        for (let t = 0; t < 12; t++) {
          const s = await api.page.evaluate(() => ({ mine: gameState.playerBoard.filter((c) => c.type === 'creature').length, theirs: gameState.enemyBoard.filter((c) => c.type === 'creature').length, done: gameState.matchFinalized }));
          if (s.done) throw new Error('match ended during setup');
          if (s.mine >= 2 && s.theirs >= 1 && t >= 4) break;
          await playTurn(api, { pace: 120 });
        }
      },
      async run(api) {
        api.mark('combat');
        await api.wait(800);
        await forDuration(api, 30000, () => playTurn(api, { pace: 550 }));
      },
    },
  ],
};
