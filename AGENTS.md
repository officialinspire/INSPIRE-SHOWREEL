# AGENTS.md

Instructions for AI agents and contributors working in this repository.

## Hard rules

1. **Never modify the game repositories.** Treat the officialinspire game repos and their live GitHub Pages sites as read-only sources. Do not open PRs, push or file changes against them from this project. If a game needs a fix, write it up in `docs/PRODUCTION_STATUS.md` under *Blockers / findings* instead.
2. **Never alter the studio originals.** `assets/branding/inspiresoftwareintro.mp4` and `assets/branding/inspire-logo.png` must stay byte-identical to the SHA-256 recorded in `config/games.json`. `npm test` and `npm run validate` enforce this. Make derived versions in `footage/` only.
3. **Never commit generated media.** `capture/`, `footage/`, `renders/` and `assets/vendor/` are git-ignored. Publish finished renders with `npm run release`. Large source masters go in `assets/masters/` (Git LFS).
4. **Pin sources.** Every asset reference uses a full 40-character commit SHA plus a SHA-256. When a game updates, bump `commit`, re-hash its assets, re-run `npm run verify:urls && npm run fetch && npm run validate`, and update the *Verified* table in `docs/PRODUCTION_STATUS.md`.
5. **Record only verified facts.** A URL, control or startup step goes in the docs only after you have observed it in a run, such as `capture/<id>/steps/*.png` or `marks.json`.

## Layout

```
config/games.json      games, URLs, pinned commits, startup flows, capture steps, asset hashes
config/trailer.json    paths, encode settings, intro mode, segment order, overlays
scripts/lib/           config loader + validation, process helpers, ffprobe/encode helpers
scripts/*.js           one stage per file (check-deps, verify-urls, fetch-assets, validate-assets,
                       capture, build-segments, render, clean); install.sh, publish-release.sh
assets/branding/       committed studio originals (intro MP4, logo)
assets/vendor/         fetched per-game title cards + music (ignored)
capture/ footage/ renders/   generated (ignored)
docs/PRODUCTION_STATUS.md    verification record, blockers, next steps
tests/                 node:test suite (npm test)
```

## Workflow

- Before you start: `npm run check`.
- After changing config or scripts: `npm test`. If you touched capture or render, also run `npm run capture -- --only=<id>`, `npm run build -- --only=<id> --games-only` and `npm run render -- --allow-missing`. Look at `capture/<id>/steps/*.png` and a few frames of the render before you call it done.
- Every segment must share identical codec parameters, because `render.js` concatenates with stream copy and refuses a mismatch. Change encode settings only in `trailer.json`, and route all encoding through `encodeArgs()` in `scripts/lib/media.js`.
- Start gates differ per game. Several use pulsing or animated buttons, which need `"force": true` on `click`. Some leave the menu "visible" underneath the intro overlay. In that case wait for the intro `<video>` with `"state": "hidden"` before marking `menu`.
- Keep scripts dependency-free apart from Playwright. Use Node built-ins such as `fetch` and `node:test`.
