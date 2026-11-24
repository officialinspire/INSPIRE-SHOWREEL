# INSPIRE Showreel

Production pipeline for the INSPIRE studio games showreel. It drives the six live games in headless Chromium with Playwright, then assembles the footage with FFmpeg. Every reel opens with the original `inspiresoftwareintro.mp4` and uses each game's own music.

| # | Game | Live URL | Source repo |
|---|------|----------|-------------|
| 1 | The Hardigan Boys | https://officialinspire.github.io/THE-HARDIGAN-BOYS-vs-THE-MEXICAN-DRUG-CARTEL/ | [officialinspire/THE-HARDIGAN-BOYS-vs-THE-MEXICAN-DRUG-CARTEL](https://github.com/officialinspire/THE-HARDIGAN-BOYS-vs-THE-MEXICAN-DRUG-CARTEL) |
| 2 | STICKS & BONES | https://officialinspire.github.io/STICKS_-_BONES/ | [officialinspire/STICKS_-_BONES](https://github.com/officialinspire/STICKS_-_BONES) |
| 3 | INSPIRE Card Parlor | https://officialinspire.github.io/Inspire-card-parlor/ | [officialinspire/Inspire-card-parlor](https://github.com/officialinspire/Inspire-card-parlor) |
| 4 | Shells & Feathers | https://officialinspire.github.io/SHELLS-FEATHERS/ | [officialinspire/SHELLS-FEATHERS](https://github.com/officialinspire/SHELLS-FEATHERS) |
| 5 | GRIDLOCK | https://officialinspire.github.io/GRIDLOCK/ | [officialinspire/GRIDLOCK](https://github.com/officialinspire/GRIDLOCK) |
| 6 | Emoji Elements | https://officialinspire.github.io/EMOJI-ELEMENTS-BETA-VERSION-/ | [officialinspire/EMOJI-ELEMENTS-BETA-VERSION-](https://github.com/officialinspire/EMOJI-ELEMENTS-BETA-VERSION-) |

The verification status of each URL, asset and startup flow is in [docs/PRODUCTION_STATUS.md](docs/PRODUCTION_STATUS.md).

## Requirements

- Node.js 20 or later
- FFmpeg and ffprobe, built with `libx264`, `aac` and `drawtext` (libfreetype)
- Chromium for Playwright (`playwright@1.63.0`)
- For capture: Linux with `Xvfb`, `pulseaudio` and `pactl`, and an FFmpeg with the `x11grab` and `pulse` input devices (all installed by `npm run setup` on apt systems)
- A TrueType font for titles (defaults to DejaVu Sans Bold)
- Optional: `gh` to publish releases, `git-lfs` for large source masters

```bash
npm run setup
```

`npm run setup` runs `scripts/install.sh`, which installs npm packages, downloads Chromium only if it doesn't already launch, installs FFmpeg and fonts with apt or brew if missing, and then runs the dependency check. Pass `--no-system` (`bash scripts/install.sh --no-system`) to skip apt and brew.

```bash
npm run check
```

`npm run check` verifies Node, FFmpeg encoders and filters, that Chromium launches, the configuration, the font, the studio assets and that every output path is writable. It exits non-zero if a required dependency is missing.

## Producing the reel

```bash
npm run produce
```

`npm run produce` runs every stage in order. You can also run the stages one at a time:

| Command | Stage | Output |
|---------|-------|--------|
| `npm run check` | Dependency check | console |
| `npm run verify:urls` | HTTP 200 + `<title>` check for each live game; HEAD check for each pinned asset | `capture/url-report.json` |
| `npm run fetch` | Downloads studio branding and per-game title cards and music from the **pinned commits** and checks each SHA-256 | `assets/branding/`, `assets/vendor/<game>/`, `assets/vendor/manifest.json` |
| `npm run validate` | Checks that the intro is bit-identical to the original (hash, size, streams, duration, full decode) and checks the logo and every fetched asset | console |
| `npm run capture:all` | Plays every live game through its adapter and records 1080p60 picture and game audio, shot by shot, in landscape and portrait where the game supports it | `capture/<game>/<layout>/<shot>.mkv`, screenshots, `capture/<game>/manifest.json`, `capture/summary.json` |
| `npm run capture:<game>` | The same for one game: `hardigan-boys`, `sticks-and-bones`, `card-parlor`, `shells-and-feathers`, `gridlock` or `emoji-elements` | |
| `npm run build` | Builds uniform H.264/AAC segments: the intro, one per game (cut from the shot named in `games.json` `segment`, with lower third, watermark and game audio) and the end card | `footage/NN-*.mp4` |
| `npm run render` | Joins the segments with stream copy, then checks duration and decodes the whole file | `renders/inspire-showreel.mp4` and `.json` report |
| `npm run release` | Uploads the render and its report as a GitHub release | GitHub release |
| `npm run clean` | Deletes capture, footage and renders (add `-- --all` to also delete fetched assets) | |
| `npm test` | Configuration and branding-integrity tests | |

To work on a subset, pass options to the capture commands:

- `npm run capture:gridlock -- --layout=portrait --shot=opening-moves --retries=0`
- `npm run capture:all -- --only=gridlock,emoji-elements`

Then run `npm run build -- --only=gridlock --games-only` and `npm run render`. Set `SHOWREEL_VERBOSE=1` to print every FFmpeg command.

## Capture

Playwright's built-in recorder gives about 0.8 Mb/s VP8 with no sound, which isn't good enough for a showreel. The capture engine (`scripts/capture/`) records the screen itself instead:

1. **Display.** A private **Xvfb** screen at exactly 1920×1080 (landscape) or 1080×1920 (portrait).
2. **Browser.** **Headed Chromium** is forced into true fullscreen over CDP, so there are no tabs, URL bar or infobars. The viewport is checked to fill the screen before every shot.
3. **Audio.** A private **PulseAudio** server with a 48 kHz null sink. Chromium plays into it, and FFmpeg records its monitor.
4. **Recording.** **FFmpeg `x11grab` at 60 fps** plus the Pulse monitor are written to Matroska: x264 ultrafast at CRF 8 (near-lossless) with PCM audio. The mouse cursor is not drawn.

Every shot runs in a fresh browser context. The adapter's `boot` (start gate, studio-intro skip, asset readiness, menus) and the shot's `setup` run **before recording starts**, so footage never contains loading screens or duplicate intros. Only the shot's `run` is recorded.

Each recording is then validated from the file itself:

- resolution and delivered fps
- black stretches
- frozen stretches (a single freeze longer than 15 s, or longer than half the shot, fails it)
- audio level

The page's own render rate is also sampled with `requestAnimationFrame`. A failed shot is retried (`capture.retries`, default 2), and every attempt is timed out. Results, event timelines (`api.mark` beats, every click) and screenshots go into `capture/<game>/manifest.json`. A game and layout counts as complete only when every shot passed or warned, with at least 30 s of usable footage.

**Analytics exclusion.** Before any page script runs, `navigator.doNotTrack`, `globalPrivacyControl` and `window.doNotTrack` are set; every game checks at least one of these. Requests to PostHog and other analytics hosts are also blocked, and Hardigan gets its own `?analytics=off`. Blocked request counts are recorded per shot.

**Writing adapters.** See [AGENTS.md](AGENTS.md#adapter-contract). `npm run capture:explore -- <game> [--layout=portrait] [--steps=file.js]` boots a game in the capture environment and prints its visible controls with screenshots.

## Configuration

- **`config/games.json`** holds each game's live URL, its source repository pinned to a full commit SHA, a description of the startup flow and controls, the reel segment (`segment.shot`, `layout`, `fromSec`, `durationSec`), and its title card and music with SHA-256 hashes. It also holds the studio intro and logo, with expected stream properties and every repository that holds an identical copy. How each game is played lives in its adapter, `scripts/capture/adapters/<id>.js`.
- **`config/trailer.json`** holds the output name, `paths`, the video and audio encode settings, loudness target, capture settings (layouts, fps, CRF, retries, timeouts, footage target), the intro mode, segment audio mode, segment order, lower third, watermark and end card.

### Path overrides

Every entry in `trailer.json` `paths` can be overridden with `SHOWREEL_<KEY>_DIR`, for example `SHOWREEL_RENDERS_DIR=/mnt/media/renders`. The config files themselves can be swapped with `SHOWREEL_GAMES_CONFIG` and `SHOWREEL_TRAILER_CONFIG`.

## Quality and audio

- **Studio intro.** `assets/branding/inspiresoftwareintro.mp4` is the original file, byte for byte (SHA-256 `8a6ce01d…cbcb88`). Every one of the five game repos that ships it has an identical copy. The pipeline never writes to it. To place it in the 1920×1080 master, it is scaled 1.5× with Lanczos (`intro.mode: "fit"`) or centred pixel-for-pixel (`"native"`) and encoded at CRF 12. Its own soundtrack is kept, with no loudness change or fades, and only resampled from 44.1 kHz to 48 kHz. The integrated loudness of the original and the rendered intro was measured at −21.0 LUFS for both.
- **Game footage.** Captured at 1920×1080 and 60 fps (near-lossless). Segments and the render are x264 `slow`, CRF 16, High profile, yuv420p, at 60 fps. The 30 fps studio intro is shown with each frame doubled, with no interpolation.
- **Game audio.** Each segment carries the game's own sound recorded with the footage (`segments.audio: "game"`). The alternatives are `"music"` (the original music file from the repo at the pinned commit) or `"mix"`. Audio is loudness-normalised to −14 LUFS with 1.5 dB true-peak headroom, then encoded as AAC 320 kb/s at 48 kHz.

## Large media policy

- Generated media (`capture/`, `footage/`, `renders/`) and fetched assets (`assets/vendor/`) are git-ignored.
- Finished renders are published as **GitHub release assets** with `npm run release`.
- The small originals in `assets/branding/` (279 KB intro, 17 KB logo) are committed as normal blobs, so a fresh clone validates without LFS.
- Any future large source masters go in `assets/masters/`, which `.gitattributes` routes through **Git LFS**.

## Ground rules

This repository only **reads** from the game repositories: raw files at pinned commits, plus the live sites. It never modifies them. See [AGENTS.md](AGENTS.md).
