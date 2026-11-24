# Adding a game

This walks through adding a seventh game, `<id>` (for example `star-runner`). Every step records only facts you observed in a run. See AGENTS.md rule 5.

## 1. Register the game

In `config/games.json`, add an entry to `games` with:

- `id`, `title`, `fullTitle` and `tagline`
- `repo`, `commit` (the full 40-character SHA of the live build) and `url`
- `expectTitle`: the live page's `<title>`, as checked by `verify:urls`
- `stack`, `startup` and `controls`: short notes, filled in after exploring (step 3)
- `segment`: `{ "shot": "…", "layout": "landscape", "fromSec": 0, "durationSec": 12 }`, used by the simple `npm run build` reel
- `assets.titleCard` and `assets.music`: repo paths plus SHA-256

Get the hashes from a clone of the game repo at that commit:

```bash
sha256sum <path>
```

Then add the id to `config/trailer.json` → `segments.order`, and run:

```bash
npm run verify:urls -- --only=<id>
```

```bash
npm run fetch
```

```bash
npm run validate
```

## 2. Read the game's own code and tests

Look for:

- start gate and intro-video element IDs
- skip controls
- `data-*` attributes on game pieces
- test hooks that draw nothing on screen
- analytics opt-outs
- music file names (needed for the SFX-only rule)

Never use QA or debug modes that render overlays.

## 3. Write the adapter

Create `scripts/capture/adapters/<id>.js`; `gridlock.js` and `emoji-elements.js` are good models. Register it in `scripts/capture/adapters/index.js`.

```js
module.exports = {
  layouts: ['landscape', 'portrait'],        // only layouts the game really supports
  layoutNotes: '…',                          // required if portrait is left out
  sfxOnly: { block: /\/music\/[^/]+\.mp3$/i }, // the game's music files; effects must stay
  url: (game) => game.url,                   // optional: analytics opt-out parameter
  async boot(api) { /* gate, skip intro, wait for the main menu (UNRECORDED) */ },
  shots: [
    { id: 'menu', title: '…', maxSec: 30, async run(api) { /* recorded */ } },
    { id: 'gameplay', title: '…', maxSec: 60, async setup(api) { /* unrecorded */ }, async run(api) { /* legal moves via clicks */ } },
  ],
};
```

To see the real controls and screenshots while you write it:

```bash
npm run capture:explore -- <id>
```

```bash
npm run capture:explore -- <id> --layout=portrait
```

```bash
npm run capture:explore -- <id> --steps=/path/to/steps.js
```

Call `api.mark('beat')` at story beats. Trailer clips anchor to these labels and to the automatic click labels.

## 4. Capture and check

```bash
npm run capture:<id>
```

Add `"capture:<id>"` to `package.json` first, or run `node scripts/capture-games.js --only=<id>` instead.

```bash
npm run capture:sfx -- --only=<id>
```

Check that `musicBlocked` is greater than 0 in the manifest.

```bash
npm run capture:report
```

The game counts as captured only when `capture/<id>/manifest.json` shows `summary.<layout>.complete: true`. Look at real frames before relying on a shot.

## 5. Put it in the trailer

In `config/trailers/inspireverse.json`:

- Add a section, or montage clips, with `title`, `tagline`, `accent` and clips (`shot`, `anchor`, `occurrence`, `offset`, `bars`). Keep the total length within 45–60 s; the tests enforce this.
- Add `framing` overrides for 9:16 and 1:1 if needed: `full`, `fit` or a `crop` with a `verified` note.
- Add `highlights.games.<id>` (clip seconds must sum to 15) and `thumbnails.games.<id>` (frame plus `tile` and `band` crops).
- Update the test's expected sequence (`tests/edit.test.js`), and add the game's release names to `scripts/package-release.js` (`order`).

Then run:

```bash
npm test
```

```bash
npm run render:all
```

```bash
npm run package:release -- --tag=<new tag>
```

Review the contact sheets, then update `docs/PRODUCTION_STATUS.md` and `docs/marketing/SOCIAL_COPY.md`.
