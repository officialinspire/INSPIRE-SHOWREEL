# Regenerating the showreel

These are exact commands, run from the repository root on Linux. Ubuntu 24.04 with 4 vCPU and 16 GB RAM is the reference. Each step is safe to re-run.

## Everything, from scratch (~2 h)

```bash
npm run setup
```

```bash
npm run produce:all -- --tag=showreel-2026-v1.1.0
```

```bash
npm run release:github -- showreel-2026-v1.1.0
```

```bash
npm run verify:release -- showreel-2026-v1.1.0
```

`produce:all` runs these stages in order:

1. `check` and `test`
2. `verify:urls`, `fetch`, `validate`
3. `capture:all`, then `capture:sfx`
4. `render:all` (trailers, highlights, thumbnails, `validate:renders`)
5. `package:release`

It stops at the first failure.

To run the same on GitHub instead, go to **Actions → Production → Run workflow**. Choose `mode: full`, set `release_tag`, and tick `publish_release` to publish. The release step re-downloads and verifies every asset.

## Re-render only

Use this when the captures already exist locally and you changed the edit (EDL, graphics or audio):

```bash
npm test
```

```bash
npm run render:all
```

```bash
npm run package:release -- --tag=showreel-2026-v1.1.0
```

`npm test` resolves every clip anchor in every format against the existing takes.

To render a single trailer format:

```bash
npm run render:trailer:9x16
```

```bash
npm run validate:renders -- --only=9x16
```

To render one game's 15-second trailers:

```bash
npm run render:highlight:gridlock
```

```bash
npm run validate:renders -- --only=gridlock
```

`package:release` needs every deliverable validated. Run `npm run validate:renders` with no filter before packaging.

## When a game changes

1. Bump the game's `commit` in `config/games.json`. Re-hash any changed title card or music (`sha256sum`) and update `assets.*.sha256`.
2. Run:

   ```bash
   npm run verify:urls -- --only=<game>
   ```

   ```bash
   npm run fetch
   ```

   ```bash
   npm run validate
   ```

3. Explore any new or changed screens:

   ```bash
   npm run capture:explore -- <game> --layout=landscape
   ```

   Adjust `scripts/capture/adapters/<game>.js` if selectors changed.
4. Re-capture the full and SFX-only takes:

   ```bash
   npm run capture:<game>
   ```

   ```bash
   npm run capture:sfx -- --only=<game>
   ```

5. Run `npm test`. If an anchor is now missing, edit `config/trailers/inspireverse.json`: the error lists the labels the take does have.
6. Re-render, validate and package:

   ```bash
   npm run render:all
   ```

   ```bash
   npm run package:release -- --tag=<new tag>
   ```

   Then review the `.contact.jpg` sheets in `renders/`.
7. Update the tables in `docs/PRODUCTION_STATUS.md` (`npm run capture:report` prints them).

## Changing the edit

| Change | Where |
|---|---|
| Clip choice or timing | `sections[].clips[]`: `shot`, `anchor`, `occurrence`, `offset`, `bars`. Pick anchors present in every take: `npm test` checks both layouts and both audio variants. |
| Section titles and taglines | `sections[].title`, `tagline`, `accent` |
| Framing per format | `framing.<format>.<game>` or `<game>/<shot>`: `full`, `fit` or `crop` (with a `verified` note checked against real frames) |
| Safe areas | `formats.<format>.safe` |
| Music bed | `music`: `file` + `sha256` (or `game`), `bpm`, `firstDownbeatSec`, `startBar`, fades. A new track needs a new beat grid, measured with onset analysis, plus sections re-timed to its phrases. |
| Loudness and ducking | `audio.loudness`, `audio.duck` |
| End card text | `endCard.lines` |
| Highlights and thumbnails | `highlights.games`, `thumbnails.games` |

## Outputs

```
renders/trailer/      enter-the-inspireverse-2026-{16x9,9x16,1x1}.mp4 (+ .json, .contact.jpg)
renders/highlights/   <game>-{16x9,9x16}.mp4
renders/thumbnails/   inspire-showreel-2026-{landscape,portrait}.jpg, <game>-{landscape,portrait}.jpg
renders/validation.json
release/              final names + MANIFEST.json + SHA256SUMS.txt + RELEASE_NOTES.md + SOCIAL_COPY.md
```

All of these are git-ignored.
