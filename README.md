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
| `npm run capture` | Plays each live game through its startup flow in Chromium and records it | `capture/<game>/capture.webm`, `marks.json`, `steps/*.png` |
| `npm run build` | Builds uniform H.264/AAC segments: the intro, one per game (trimmed capture, lower third, watermark, game music) and the end card | `footage/NN-*.mp4` |
| `npm run render` | Joins the segments with stream copy, then checks duration and decodes the whole file | `renders/inspire-showreel.mp4` and `.json` report |
| `npm run release` | Uploads the render and its report as a GitHub release | GitHub release |
| `npm run clean` | Deletes capture, footage and renders (add `-- --all` to also delete fetched assets) | |
| `npm test` | Configuration and branding-integrity tests | |

To work on a subset of games, pass `--only`. Example: `npm run capture -- --only=gridlock,emoji-elements`, then `npm run build -- --only=gridlock --games-only` and `npm run render`. Use `npm run capture -- --headed` to watch the browser. Set `SHOWREEL_VERBOSE=1` to print every FFmpeg command.

## Configuration

- **`config/games.json`** holds each game's live URL, its source repository pinned to a full commit SHA, a description of the startup flow and controls, the capture `steps`, the segment trim (`segment.from` mark and `durationSec`), and its title card and music with SHA-256 hashes. It also holds the studio intro and logo, with expected stream properties and every repository that holds an identical copy.
- **`config/trailer.json`** holds the output name, `paths`, the video and audio encode settings, loudness target, capture viewport, the intro mode, segment order, lower third, watermark and end card.

### Capture steps

| Step | Fields | Notes |
|------|--------|-------|
| `wait` | `ms` | |
| `press` | `key` | Playwright key name, e.g. `Enter` |
| `click` | `selector` or `text`, `force`, `optional`, `timeout` | Use `force: true` for pulsing or animated start buttons |
| `hover` | `selector` or `text` | |
| `mouse` | `x`, `y`, `steps` | Moves the cursor smoothly |
| `waitFor` | `selector` or `text`, `state` (`visible` or `hidden`), `timeout` | Use `state: "hidden"` on an intro video to wait for it to finish |
| `mark` | `name` | Records seconds from the start of the video into `marks.json`; `segment.from` refers to a mark |

### Path overrides

Every entry in `trailer.json` `paths` can be overridden with `SHOWREEL_<KEY>_DIR`, for example `SHOWREEL_RENDERS_DIR=/mnt/media/renders`. The config files themselves can be swapped with `SHOWREEL_GAMES_CONFIG` and `SHOWREEL_TRAILER_CONFIG`.

## Quality and audio

- **Studio intro.** `assets/branding/inspiresoftwareintro.mp4` is the original file, byte for byte (SHA-256 `8a6ce01d…cbcb88`). Every one of the five game repos that ships it has an identical copy. The pipeline never writes to it. To place it in the 1920×1080 master, it is scaled 1.5× with Lanczos (`intro.mode: "fit"`) or centred pixel-for-pixel (`"native"`) and encoded at CRF 12. Its own soundtrack is kept, with no loudness change or fades, and only resampled from 44.1 kHz to 48 kHz. The integrated loudness of the original and the rendered intro was measured at −21.0 LUFS for both.
- **Game footage.** Captured at 1920×1080 and encoded with x264 `slow`, CRF 16, High profile, yuv420p, 30 fps.
- **Game audio.** Playwright's recorder captures picture only. Each segment's soundtrack is therefore that game's original music file from its repository at the pinned commit, loudness-normalised to −14 LUFS with 1.5 dB true-peak headroom, then encoded as AAC 320 kb/s at 48 kHz.

## Large media policy

- Generated media (`capture/`, `footage/`, `renders/`) and fetched assets (`assets/vendor/`) are git-ignored.
- Finished renders are published as **GitHub release assets** with `npm run release`.
- The small originals in `assets/branding/` (279 KB intro, 17 KB logo) are committed as normal blobs, so a fresh clone validates without LFS.
- Any future large source masters go in `assets/masters/`, which `.gitattributes` routes through **Git LFS**.

## Ground rules

This repository only **reads** from the game repositories: raw files at pinned commits, plus the live sites. It never modifies them. See [AGENTS.md](AGENTS.md).
