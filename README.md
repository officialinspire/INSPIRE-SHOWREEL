# INSPIRE Showreel

Production pipeline for **ENTER THE INSPIREVERSE — Official Gameplay Showcase 2026**. It plays the six live INSPIRE browser games with Playwright in real Chromium, records 1080p60 gameplay with sound, cuts trailers to the beat with FFmpeg, validates every file and publishes the results as a GitHub release. Everything in the trailers is genuine captured gameplay or the studio's own media: the original `inspiresoftwareintro.mp4`, the INSPIRE logo and the games' own soundtracks.

| # | Game | Live build | Source (read-only) |
|---|------|-----------|--------------------|
| 1 | The Hardigan Boys | https://officialinspire.github.io/THE-HARDIGAN-BOYS-vs-THE-MEXICAN-DRUG-CARTEL/ | [repo](https://github.com/officialinspire/THE-HARDIGAN-BOYS-vs-THE-MEXICAN-DRUG-CARTEL) |
| 2 | STICKS & BONES | https://officialinspire.github.io/STICKS_-_BONES/ | [repo](https://github.com/officialinspire/STICKS_-_BONES) |
| 3 | INSPIRE Card Parlor | https://officialinspire.github.io/Inspire-card-parlor/ | [repo](https://github.com/officialinspire/Inspire-card-parlor) |
| 4 | Shells & Feathers | https://officialinspire.github.io/SHELLS-FEATHERS/ | [repo](https://github.com/officialinspire/SHELLS-FEATHERS) |
| 5 | GRIDLOCK | https://officialinspire.github.io/GRIDLOCK/ | [repo](https://github.com/officialinspire/GRIDLOCK) |
| 6 | Emoji Elements | https://officialinspire.github.io/EMOJI-ELEMENTS-BETA-VERSION-/ | [repo](https://github.com/officialinspire/EMOJI-ELEMENTS-BETA-VERSION-) |

## Deliverables

These are published on the [Releases page](https://github.com/officialinspire/inspire-showreel/releases), never committed to Git.

| File | Format |
|------|--------|
| `INSPIRE_SHOWREEL_2026_LANDSCAPE.mp4` | 1920×1080, 57 s |
| `INSPIRE_SHOWREEL_2026_VERTICAL.mp4` | 1080×1920, 57 s (its own composition, not a crop) |
| `INSPIRE_SHOWREEL_2026_SQUARE.mp4` | 1080×1080, 57 s |
| `INSPIRE_SHOWREEL_2026_<GAME>_15S_{LANDSCAPE,VERTICAL}.mp4` | 15 s trailer per game, with the game's own sound |
| `INSPIRE_SHOWREEL_2026_THUMB_{LANDSCAPE,PORTRAIT}.jpg` and `…_<GAME>_THUMB_*.jpg` | thumbnails built from real gameplay frames |
| `SOCIAL_COPY.md` | draft captions and promotional copy ([source](docs/marketing/SOCIAL_COPY.md)); nothing is posted automatically |
| `MANIFEST.json`, `SHA256SUMS.txt` | sizes, durations, loudness, codecs and checksums |

Every MP4 has:
- **Video:** H.264 High (level ≤ 4.2), yuv420p, BT.709, 60 fps.
- **Audio:** AAC-LC 320 kb/s at 48 kHz stereo.
- **Container:** `+faststart`.
- **Loudness:** −14 LUFS, true peak ≤ −1.5 dBFS.

## Quick start

```bash
npm run setup
```

```bash
npm run produce:all
```

```bash
npm run release:github
```

```bash
npm run verify:release
```

- **`npm run setup`** installs npm packages, Chromium, FFmpeg, Xvfb, PulseAudio and fonts, then checks everything.
- **`npm run produce:all`** captures, renders, validates and packages everything into `release/`. It takes about 2 h on 4 cores with no GPU.
- **`npm run release:github`** creates or updates the GitHub release from `release/`.
- **`npm run verify:release`** downloads the release and checks every asset.

The same production runs on GitHub: **Actions → Production → Run workflow**. Choose `mode: full`, optionally with `publish_release`. See [CI](#ci-github-actions).

Exact commands for regenerating the trailer, or one game or format, are in **[docs/REGENERATING.md](docs/REGENERATING.md)**. To add a seventh game, see **[docs/ADDING_A_GAME.md](docs/ADDING_A_GAME.md)**. Results, the QA record and blockers are in **[docs/PRODUCTION_STATUS.md](docs/PRODUCTION_STATUS.md)**.

## Requirements

- **System:** Linux, Ubuntu 24.04 as on the reference machine and in CI, with 4 vCPU, 16 GB RAM and about 6 GB free disk. No GPU is needed.
- **Packages:** Node 22.23.5 (pinned in `.nvmrc`), `playwright@1.63.0` (lockfile; its Chromium revision follows), `ffmpeg` 6.1 (needs `libx264`, `drawtext`, the `x11grab` and `pulse` devices), `xvfb`, `pulseaudio` and `pulseaudio-utils`, `fonts-inter`, `fonts-dejavu-core`.
- **Optional:** `gh` for releases, `git-lfs` for large source masters.
- **Network:** the six live game sites, `raw.githubusercontent.com` (asset fetches at pinned commits), npm, Chromium download.

`npm run check` verifies all of this and exits non-zero if anything required is missing.

## Commands

| Stage | Command | Output |
|-------|---------|--------|
| Verify | `npm run check` · `npm test` · `npm run verify:urls` | console · 16 tests · `capture/url-report.json` |
| Assets | `npm run fetch` · `npm run validate` | studio intro and logo checked against SHA-256; per-game title cards and music in `assets/vendor/` |
| Capture | `npm run capture:all` · `npm run capture:<game>` | `capture/<game>/<layout>/<shot>.mkv`, screenshots, `capture/<game>/manifest.json` |
| | `npm run capture:sfx` | SFX-only takes, with the game music blocked, for the trailer: `capture/<game>/<layout>/sfx/` |
| | `npm run capture:explore -- <game> [--layout=portrait]` | dev tool: prints visible controls and takes screenshots |
| | `npm run capture:report` | Markdown tables of every take |
| Trailer | `npm run render:trailer` · `render:trailer:16x9` · `:9x16` · `:1x1` | `renders/trailer/enter-the-inspireverse-2026-<fmt>.mp4` + `.json` |
| Highlights | `npm run render:highlights` · `render:highlight:<game>` | `renders/highlights/<game>-{16x9,9x16}.mp4` |
| Thumbnails | `npm run render:thumbnails` | `renders/thumbnails/*.jpg` |
| QA | `npm run validate:renders` | `renders/validation.json` + `.contact.jpg` per file |
| All renders | `npm run render:all` | trailers, highlights, thumbnails, validation |
| Package | `npm run package:release -- [--tag=…]` | `release/`: final names, `MANIFEST.json`, `SHA256SUMS.txt`, `RELEASE_NOTES.md` |
| Publish | `npm run release:github -- [tag]` · `npm run verify:release -- [tag]` | GitHub release, verified by download |
| Everything | `npm run produce:all -- [--tag=…]` | from check to package |

Games: `hardigan-boys`, `sticks-and-bones`, `card-parlor`, `shells-and-feathers`, `gridlock`, `emoji-elements`.

Capture options: `--only=a,b`, `--layout=portrait`, `--shot=x,y`, `--retries=N`, `--variant=sfx`. Set `SHOWREEL_VERBOSE=1` to print FFmpeg commands. `npm run build` and `npm run render` still produce the first-generation simple reel, `renders/inspire-showreel.mp4`, with one segment per game.

## How it works

### Capture (`scripts/capture/`)

Playwright's built-in recorder gives about 0.8 Mb/s VP8 with no sound, so the engine records the screen itself:

1. **Display.** A private **Xvfb** screen at 1920×1080 or 1080×1920.
2. **Browser.** **Headed Chromium** in true fullscreen over CDP, with no browser chrome. The viewport is verified before every shot.
3. **Audio.** The game's audio goes into a private **PulseAudio** null sink.
4. **Recording.** **FFmpeg `x11grab` at 60 fps** plus the sink monitor are written to Matroska: near-lossless x264 with PCM audio.

**Adapters.** Each game's adapter (`scripts/capture/adapters/<game>.js`) is built from that game's own code and tests. It passes the start gate and skips the studio intro **before** recording, then plays real, legal moves. Moves are chosen from the live game state but always made through normal clicks.

**Validation.** Every take is checked for resolution, delivered fps, black and frozen stretches, and audio level. Failed shots are retried, and results go into a manifest with event timelines and screenshots.

**Analytics exclusion.** Do Not Track and GPC are set, analytics hosts are blocked, and Hardigan gets `?analytics=off`. Capture runs have made 0 analytics requests.

### Edit (`scripts/edit/`, `config/trailers/inspireverse.json`)

- **Clips are anchored to capture events, not timestamps.** An anchor is an event such as `"scene: The Raid"` or `"place tile"`, so re-captures keep the edit valid, and `npm test` resolves every anchor in every format.
- **Cuts are locked to the music.** The bed is the OFFICIAL INSPIRE *Emoji Elements — Celestial Battle Theme* at 136 BPM. Bar boundaries are computed frame-accurately, so there is no drift. The montage hits on the track's drop.
- **Each aspect ratio is its own composition.** Each format sets per-game framing:
  - `full`: the capture matches the canvas.
  - `fit`: the whole capture over a blurred fill, so nothing is cut.
  - `crop`: a rectangle checked by eye, recorded with a `verified` note.
  - 9:16 uses each game's own portrait layout. The Hardigan Boys has no portrait layout and is fitted.
- **Graphics.** Inter Display titles with eased motion, accent bars, montage labels and an animated end card. They stay inside per-format **platform-safe areas**: in 9:16, clear of the bottom ~22% and right ~16% where Reels, TikTok and Shorts put their UI.
- **Audio.** The trailer uses SFX-only takes under one music bed, with sidechain ducking and 30 ms edge fades. The intro keeps its own soundtrack. The mix is two-pass loudness-normalised to −14 LUFS and run through a 4× oversampled limiter. Highlights use the game's own full sound.
- **Colour and compatibility.** Captures are converted from BT.601 to BT.709 and every file is tagged. Output is level 4.2, faststart.

### QA (`npm run validate:renders`)

Each delivered file is checked for:
- codec, profile and level
- pixel format and colour tags
- size and frame rate
- AAC format
- faststart
- exact duration
- frame-interval regularity
- A/V length match and start times
- loudness and true peak (EBU R128)
- black frames outside the intro

A contact sheet is written for each file for a visual review. `npm run package:release` refuses any file that has not passed validation, or that changed after it.

## Configuration

- `config/games.json` holds:
  - each game's URL and source repo, pinned to a 40-character commit
  - startup and controls notes, and the default reel segment
  - title card and music, with SHA-256
  - the studio intro and logo hashes
- `config/trailers/inspireverse.json` holds:
  - formats and safe areas, brand fonts and colours
  - music bed and beat grid, ducking and loudness
  - sections and clips (anchors), framing per format, end card
  - highlights and thumbnails
- `config/trailer.json` holds paths, capture settings (layouts, fps, CRF, retries, timeouts) and the encode settings of the simple reel. You can override paths with `SHOWREEL_<KEY>_DIR`, and the config files with `SHOWREEL_GAMES_CONFIG` and `SHOWREEL_TRAILER_CONFIG`.

## CI (GitHub Actions)

`.github/workflows/production.yml` is triggered manually (`workflow_dispatch`).

**Pinned dependencies:**
- every action by commit SHA
- Node from `.nvmrc`
- npm from the lockfile, with Playwright and its Chromium build fixed by the lockfile
- Ubuntu 24.04 archive packages, recorded in `system-packages.txt`

**Modes:**
- `check` takes about 5 minutes: environment, tests, live URLs, asset hashes.
- `full` takes about 2 hours: `npm run produce:all`.

**Outputs:**
- **Workflow artifact:** the release package, retained for 14 days. Add raw captures with `upload_raw_captures`.
- **GitHub release:** with `publish_release`, the workflow publishes and verifies the release.

Resource requirements are documented at the top of the workflow.

## Media policy

- Generated media (`capture/`, `footage/`, `renders/`, `release/`) and fetched assets (`assets/vendor/`) are git-ignored. Deliverables go out as **GitHub release assets** or workflow artifacts.
- Only the small studio originals are committed: the intro (279 KB) and the logo (17 KB).
- Large source masters belong in `assets/masters/`, which goes through **Git LFS**.
- The game repositories and live sites are **read-only** sources: this project never modifies them. See [AGENTS.md](AGENTS.md).
