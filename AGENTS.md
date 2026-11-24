# AGENTS.md

Instructions for AI agents and contributors working in this repository.

## Hard rules

1. **Never modify the game repositories.** Treat the officialinspire game repos and their live GitHub Pages sites as read-only sources. Do not open PRs, push or file changes against them from this project. If a game needs a fix, write it up in `docs/PRODUCTION_STATUS.md` under *Blockers / findings* instead.
2. **Never alter the studio originals.** `assets/branding/inspiresoftwareintro.mp4` and `assets/branding/inspire-logo.png` must stay byte-identical to the SHA-256 recorded in `config/games.json`. `npm test` and `npm run validate` enforce this. Make derived versions in `footage/` only.
3. **Never commit generated media.** `capture/`, `footage/`, `renders/`, `release/` and `assets/vendor/` are git-ignored. Publish finished renders with `npm run package:release` and then `npm run release:github` (or the Production workflow). Never attach unvalidated files. Large source masters go in `assets/masters/` (Git LFS).
4. **Pin sources.** Every asset reference uses a full 40-character commit SHA plus a SHA-256. When a game updates, bump `commit`, re-hash its assets, re-run `npm run verify:urls && npm run fetch && npm run validate`, re-run that game's capture, and update the tables in `docs/PRODUCTION_STATUS.md`.
5. **Record only verified facts.** A URL, control, selector or startup step goes in the docs only after you have observed it in a run, such as a capture manifest, its screenshots, or `scripts/capture/explore.js` output.
6. **Never fabricate or misreport footage.** A game or layout counts as captured only when `capture/<id>/manifest.json` shows `summary.<layout>.complete: true`. A failed or warned shot is reported as such, with its reason.
7. **Play legally, show no debug UI.** Adapters drive the games only through the input a player uses: clicks, taps and keys. They may read game state to choose a legal move, but must never write it. Never use QA or debug modes that draw on screen, such as Emoji Elements' `?qa` or Hardigan's `show-hotspots`. Stay early in the story modes, because the reel must not spoil plots.

## Layout

```
config/games.json        games, URLs, pinned commits, startup notes, segment shot picks, asset hashes
config/trailer.json      paths, capture settings (layouts, fps, retries), encode, intro, overlays
scripts/lib/             config loader + validation, process helpers, ffprobe/encode helpers
scripts/capture/         capture engine
  env.js                 Xvfb display + private PulseAudio null sink
  browser.js             headed Chromium, CDP fullscreen, analytics exclusion, render-fps meter
  recorder.js            FFmpeg x11grab + pulse -> Matroska (x264 near-lossless + PCM)
  validate.js            recording checks (size, fps, black, frozen, audio)
  shot-api.js            helpers given to adapters (click, glide, mark, until, screenshot...)
  runner.js              per-layout/per-shot loop, retries, timeouts, manifest + summary
  explore.js             dev tool: boot a game and dump its visible controls + screenshots
  adapters/<game>.js     one adapter per game (see "Adapter contract")
scripts/capture-games.js CLI for npm run capture:all / capture:<id> / capture:sfx
config/trailers/<name>.json  edit decision lists (trailer + highlights)
scripts/edit/            editing engine
  edl.js                 resolves clips to captures via manifest event anchors; bar-locked timeline
  frame.js               per-aspect reframing (full / fit over blurred fill / verified crop), push-in
  graphics.js            animated titles, montage labels, end card, highlight brand tag
  render.js              clip intermediates, concat, ducked music mix, loudnorm, delivery encode
scripts/render-trailer.js, render-highlights.js, render-thumbnails.js, validate-renders.js
scripts/package-release.js   final release names + MANIFEST/SHA256SUMS/RELEASE_NOTES (validated files only)
scripts/github-release.js, verify-release.js   GitHub release create/update (REST) + download verification
.github/workflows/production.yml   manual CI: check | full production, artifact, optional release
scripts/*.js             other stages (check-deps, verify-urls, fetch-assets, validate-assets,
                         build-segments, render, clean); install.sh
assets/branding/         committed studio originals (intro MP4, logo)
docs/PRODUCTION_STATUS.md  verification record, per-game capture results, QA, blockers
docs/REGENERATING.md     exact regeneration commands;  docs/ADDING_A_GAME.md  adding a game
docs/marketing/SOCIAL_COPY.md  draft captions/promo copy (never auto-posted)
tests/                   node:test suite (npm test)
```

## Adapter contract

`scripts/capture/adapters/<id>.js` exports:

- `layouts`: the layouts the game genuinely supports, verified with `explore.js --layout=portrait`. If a layout is left out, `layoutNotes` must say why.
- `url(game, layout)`: optional. Use it to add the game's own analytics opt-out parameter, or a test hook that draws nothing on screen.
- `boot(api)`: runs **unrecorded**. It passes the start gate, skips the studio intro, waits for assets and reaches the main menu. Every shot boots in a fresh browser context.
- `shots[]`: each shot is `{ id, title, layouts?, maxSec, setup?(api), run(api) }`. `setup` is unrecorded. Only `run` is recorded. Call `api.mark(label)` at each story beat.

Selectors come from the game's own code and tests. Each adapter's header comment names those sources. Prefer `data-*` attributes and IDs over text. Use `force: true` clicks for pulsing or animated buttons.

## Editing rules

- Trailers and highlights use **only genuine captures and the studio's own media**: the original intro, the INSPIRE logo, and the games' own soundtracks fetched at pinned commits. Never add stock footage, generated imagery or unlicensed music. The OFFICIAL INSPIRE soundtracks carry no licence file in their repos, so record music approval in `docs/PRODUCTION_STATUS.md`.
- Trailer clips come from **SFX-only takes** (`npm run capture:sfx`) so that the music bed never clashes with in-game music. Highlights use the full-audio takes.
- Clips reference **manifest events** (`anchor`, `occurrence`, `offset`), never raw seconds. After a re-capture, run `npm test`: it resolves every anchor.
- **Never blind-crop.** A `crop` framing needs a `verified` note describing what the rectangle keeps, checked against real frames. Otherwise use `fit`, or the game's own portrait capture.
- After any edit change, run `npm run validate:renders` and look at the `.contact.jpg` sheets before reporting a render as done.
- Keep text and graphics inside each format's **safe area** (`formats.<fmt>.safe`). In 9:16, never place them in the bottom ~22% or the right ~16%, where platform UI sits.
- Never post to social accounts from this repository or from CI. `SOCIAL_COPY.md` is a draft for people to post.

## Workflow

- Before you start: `npm run check`.
- Writing or fixing an adapter:
  1. `npm run capture:explore -- <id> [--layout=portrait] [--steps=file.js]` to see the real controls.
  2. `npm run capture:<id> -- --shot=<shot> --retries=0` to record it.
  3. Read `capture/<id>/manifest.json`: its `events`, `validation` and screenshots.
  4. Look at real frames, for example with `ffmpeg -ss 10 -i <shot>.mkv -frames:v 1 f.png`, before calling it done.
- After changing config or scripts: `npm test`. If you touched capture or render, also run `npm run build -- --only=<id> --games-only` and `npm run render -- --allow-missing`.
- Every segment must share identical codec parameters, because `render.js` concatenates with stream copy and refuses a mismatch. Change encode settings only in `trailer.json`, and route all encoding through `encodeArgs()` in `scripts/lib/media.js`.
- No GPU: keep the Chromium flags in `browser.js` (`--use-angle=swiftshader-webgl --disable-gpu-rasterization`). With GPU rasterization through SwiftShader, animations drop to 6–16 fps.
- Keep scripts dependency-free apart from Playwright. Use Node built-ins such as `fetch` and `node:test`.
