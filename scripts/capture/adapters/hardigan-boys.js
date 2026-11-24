'use strict';
// THE HARDIGAN BOYS vs THE MEXICAN DRUG CARTEL — point-and-click story. Structure from
// HARDIGAN-BOYS-CODEBASE-WALKTHROUGH.md and index.js: hotspots are .hotspot[data-hotspot-id],
// dialogue is #dialogue-box with #dialogue-continue and .dialogue-choice buttons. Shots stay in
// the first two scenes (S1 "Another Normal Night", S2 "The Raid") so nothing past the opening is
// spoiled. In S1 the window only moves the story on after remote, TV, lamp and notebook have
// been explored (index.js S1_LIVING_ROOM_INTRO). ?analytics=off is the game's own opt-out.
const { passGateAndSkipIntro, withParams } = require('./common');

async function dialogueVisible(api) {
  return api.page.evaluate(() => {
    const b = document.getElementById('dialogue-box');
    return !!b && !b.classList.contains('hidden') && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height > 0;
  });
}

/** Advance dialogue the way a reader would: hold each line for its reading time, then Continue. */
async function readDialogue(api, { maxLines = 20, choice = 0, fast = false, until } = {}) {
  for (let i = 0; i < maxLines; i++) {
    if (until && (await until())) return;
    if (!(await dialogueVisible(api))) {
      await api.wait(fast ? 200 : 600);
      if (!(await dialogueVisible(api))) return;
    }
    const text = await settledText(api, fast ? 1500 : 6000);
    // The line has already been on screen while it typed; a short hold lets it land.
    const hold = fast ? 150 : Math.min(1900, Math.max(900, text.length * 12));
    await api.wait(hold);
    const choices = api.page.locator('#dialogue-choices .dialogue-choice:visible');
    if (await choices.count()) {
      const pick = choices.nth(Math.min(choice, (await choices.count()) - 1));
      if (!fast) { await api.glide(pick, 20); await api.wait(700); }
      await api.click(pick, { label: `choice: ${(await pick.innerText().catch(() => '')).slice(0, 40)}` });
    } else if (await api.visible('#dialogue-continue')) {
      await api.click('#dialogue-continue', { label: `continue: ${text.slice(0, 40)}` });
    } else {
      await api.wait(fast ? 300 : 900); // auto-advancing line
    }
    await api.wait(fast ? 150 : 350);
  }
}

/** The dialogue types itself out (sceneRenderer.isTyping); wait for it to finish, then read it. */
async function settledText(api, timeout) {
  await api.until(() => typeof sceneRenderer === 'undefined' || !sceneRenderer.isTyping, null, timeout).catch(() => {});
  return api.page.textContent('#dialogue-text').then((t) => (t || '').trim()).catch(() => '');
}

async function currentScene(api) {
  return api.page.evaluate(() => (typeof gameState !== 'undefined' ? gameState.currentSceneId : null)).catch(() => null);
}

async function waitScene(api, id, timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await currentScene(api)) === id && !(await api.page.evaluate(() => !!(sceneRenderer?.isTransitioning || gameState.sceneTransitioning)).catch(() => false))) return;
    await api.wait(200);
  }
  throw new Error(`scene ${id} did not load (at ${await currentScene(api)})`);
}

async function newGame(api) {
  // The click handler ignores input while the post-intro menu transition is still running.
  await api.until(() => typeof sceneRenderer !== 'undefined' && !sceneRenderer.isTransitioning, null, 15000);
  for (let i = 0; i < 4; i++) {
    await api.click('#btn-new-game', { label: 'NEW GAME' });
    try { await waitScene(api, 'S1_LIVING_ROOM_INTRO', 6000); return; } catch { await api.wait(500); }
  }
  await waitScene(api, 'S1_LIVING_ROOM_INTRO', 3000);
}

// Hotspot id -> the flag its onClick records in gameState.objectsClicked (index.js S1 scene).
const FLAG = { tv_remote: 'remote', television: 'television', lamp: 'lamp', notebook: 'notebook', window: 'window' };

async function exploreHotspot(api, id, { fast = false } = {}) {
  const sel = `#hotspot-layer .hotspot[data-hotspot-id="${id}"]`;
  for (let attempt = 0; attempt < 4; attempt++) {
    // Hotspots ignore clicks while a line of dialogue is open or a scene transition runs.
    await api.until(() => {
      const b = document.getElementById('dialogue-box');
      const open = b && !b.classList.contains('hidden') && b.getBoundingClientRect().height > 0;
      return !open && !sceneRenderer.isTransitioning;
    }, null, 8000).catch(() => {});
    await api.waitVisible(sel, 8000).catch(() => {});
    if (!fast && attempt === 0) { await api.glide(sel, 25); await api.wait(500); }
    await api.click(sel, { label: `hotspot ${id}` });
    await api.wait(fast ? 300 : 700);
    const ok = await api.page.evaluate((f) => gameState.objectsClicked.has(f), FLAG[id]);
    await readDialogue(api, { fast, until: async () => (await currentScene(api)) !== 'S1_LIVING_ROOM_INTRO' });
    if (ok) return;
  }
  throw new Error(`hotspot ${id} never registered`);
}

/** Explore the rest of the living room, then the window (which needs the other four first). */
async function finishLivingRoom(api, { fast }) {
  for (const id of ['tv_remote', 'television', 'lamp', 'notebook']) {
    if (!(await api.page.evaluate((f) => gameState.objectsClicked.has(f), FLAG[id]))) await exploreHotspot(api, id, { fast });
  }
  await exploreHotspot(api, 'window', { fast });
  await waitScene(api, 'S2_ICE_RAID_WINDOW', 20000);
}

module.exports = {
  layouts: ['landscape'],
  layoutNotes: 'Portrait is not captured: the scenes are fixed 1920x1080 art with native-coordinate hotspots; on a tall screen the game letterboxes the 16:9 stage (verified 2026-11-24 with scripts/capture/explore.js --layout=portrait: a ~720 px band in a 1920 px screen).',
  url: (game) => withParams(game.url, { analytics: 'off' }),
  async boot(api) {
    await passGateAndSkipIntro(api, { gate: '#touch-start-btn', video: '#intro-video', skip: '#intro-skip-btn', after: '#btn-new-game' });
    // The yellow pulse on unexplored hotspots is player-facing (.hotspot--unexplored); the dev
    // overlay is body.show-hotspots (filled boxes + labels) and must never be recorded.
    if (await api.page.evaluate(() => document.body.classList.contains('show-hotspots'))) throw new Error('debug hotspot overlay is on');
  },
  shots: [
    {
      id: 'opening-scene',
      title: 'Main menu into "Another Normal Night": Hank and Jonah on the couch',
      maxSec: 50,
      async run(api) {
        api.mark('main menu');
        await api.wait(1500);
        for (const s of ['#btn-new-game', '#btn-options', '#btn-new-game']) { await api.glide(s, 25); await api.wait(700); }
        await newGame(api);
        api.mark('scene: Another Normal Night');
        await api.wait(1500);
        await readDialogue(api, { maxLines: 4 });
        await exploreHotspot(api, 'tv_remote');
        await api.wait(1000);
      },
    },
    {
      id: 'living-room-investigation',
      title: 'Exploring the living room until Jonah spots the lights outside',
      maxSec: 75,
      async setup(api) {
        await newGame(api);
        await api.wait(800);
        await readDialogue(api, { maxLines: 4, fast: true });
        await exploreHotspot(api, 'tv_remote', { fast: true });
      },
      async run(api) {
        api.mark('living room');
        await api.wait(800);
        await finishLivingRoom(api, { fast: false });
        api.mark('scene: The Raid');
        await api.wait(2500);
      },
    },
    {
      id: 'the-raid',
      title: '"The Raid": the neighbours, the agents and the boys at the window',
      maxSec: 60,
      setupTimeoutSec: 120,
      async setup(api) {
        await newGame(api);
        await readDialogue(api, { maxLines: 4, fast: true });
        await finishLivingRoom(api, { fast: true });
      },
      async run(api) {
        api.mark('scene: The Raid');
        await api.wait(1200);
        // Stop at the first story choice: what follows depends on it (no spoilers past it).
        await readDialogue(api, {
          maxLines: 14,
          until: async () => (await api.page.locator('#dialogue-choices .dialogue-choice:visible').count()) > 0,
        });
        await api.wait(2500);
      },
    },
  ],
};
