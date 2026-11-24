# Production status

_Last verified: 2026-11-24. Toolchain: Playwright 1.63.0, Chromium 158 (headed, on Xvfb), FFmpeg 6.1.1, PulseAudio 16, Node 22, on a 4-core machine with no GPU._

## Summary

| Stage | Status |
|-------|--------|
| Live URLs (`npm run verify:urls`) | ✅ 6/6 return HTTP 200 with the expected `<title>` |
| Studio assets (`npm run fetch && npm run validate`) | ✅ intro bit-identical to the original (SHA-256 `8a6ce01d…`), plus the logo and all per-game assets |
| Gameplay capture (`npm run capture:all`, clean run) | ✅ **6/6 games complete** in every layout they support: 11 game/layout pairs, 29 shots, 74–114 s usable per pair, delivered at 59.5–59.9 fps |
| SFX-only takes (`npm run capture:sfx`) | ✅ 26/26 takes of the trailer shots recorded with the game music blocked |
| Trailer *ENTER THE INSPIREVERSE — Official Gameplay Showcase 2026* | ✅ rendered in **16:9, 9:16 and 1:1**: 57.05 s each, −13.9 LUFS, −2.0 dBFS true peak |
| 15-second highlights | ✅ 12 rendered (6 games × 16:9 and 9:16), −13.8 to −14.8 LUFS |
| Render validation (`npm run validate:renders`) | ✅ 15/15: H.264 High, yuv420p, 60 fps, AAC 48 kHz stereo, faststart, duration, loudness, true peak, no black outside the intro. Contact sheets were also checked by eye. |
| Tests (`npm test`) | ✅ 16/16 |
| Push to GitHub | ❌ **blocked**: `officialinspire/INSPIRE-SHOWREEL` does not exist, and this session can neither create it nor push to it. See Blockers. |

## Trailer: ENTER THE INSPIREVERSE (2026)

Files: `renders/trailer/enter-the-inspireverse-2026-{16x9,9x16,1x1}.mp4`. These are git-ignored; publish them with `npm run release`. Each has a `.json` report (full timeline, source takes, loudness) and a `.contact.jpg` sheet.

**Structure.** 57.05 s: the original 5.87 s studio intro, then 29 bars of the music bed at 136 BPM (1.7647 s per bar). Every cut lands on a bar line.

| # | Section | Bars | Source takes (SFX-only, landscape; 9:16 and 1:1 per the framing table) | On screen |
|---|---------|------|--------------------------------|-----------|
| 1 | Original `inspiresoftwareintro.mp4` | — | committed original, own soundtrack | INSPIRE Software |
| 2 | The Hardigan Boys | 5 | `opening-scene` @ "scene: Another Normal Night", `living-room-investigation` @ "hotspot television", `the-raid` @ "scene: The Raid" | title "THE HARDIGAN BOYS" + kicker "OFFICIAL GAMEPLAY SHOWCASE 2026"; Hank, Jonah and Mom on the couch; the raid outside |
| 3 | STICKS & BONES | 5 | `story-prologue` (prologue "An Open Door"), `quick-play-hand` (deal, then tiles selected and placed) | title; cinematic story card; dominoes against Cousin |
| 4 | INSPIRE Card Parlor | 5 | `parlor-hub` (night scenery), `story-chapter-one` (Cheryl's "Price Check" scene), `klondike` (tableau moves) | title; Cheryl's character card; Klondike |
| 5 | Shells & Feathers | 4 | `hub-and-tic-tac-toe` (hub, then shells placed against the Spirit), `acorns-and-leaves` (checkers) | title; the last bar falls on the music's breakdown |
| 6 | GRIDLOCK + Emoji Elements montage | 6 | GRIDLOCK `capture-and-build` / `opening-moves`; Emoji Elements `battle-combat` / `pack-opening` | 1-bar cuts on the music's drop, opening with a white flash; game labels |
| 7 | End card | 4 | blurred Emoji Elements battle behind | INSPIRE logo scales in; ENTER THE INSPIREVERSE / PLAY FREE / WWW.INSPIRECLOTHING.ART arrive on the beat |

**Framing per format.** These are independent compositions, with no blind crops:

- **16:9:** every clip uses its landscape capture.
- **9:16:** each game's own portrait layout. The Hardigan Boys has no portrait layout, so its full 16:9 stage is fitted over a blurred fill, with the title in the fill.
- **1:1:** verified crops for the GRIDLOCK board (landscape), the Klondike tableau (portrait), the Shells & Feathers boards (portrait) and the STICKS & BONES prologue art (landscape). Everything else is fitted whole.

**Audio.**

- The intro keeps its original soundtrack.
- The music bed is *Emoji Elements — Celestial Battle Theme* from bar 8. It fades in over 0.35 s after the intro and out over the last 3.2 s.
- Gameplay SFX come from takes recorded with each game's music blocked, so the bed never clashes with in-game music.
- The bed is ducked under the SFX with a sidechain compressor (5:1, threshold 0.025).
- Clip edges get 30 ms fades.
- The mix is two-pass linear-normalised to −14 LUFS, then limited 4× oversampled. Measured: −13.9 LUFS, −2.0 dBFS true peak.

**Highlights.** `renders/highlights/<game>-{16x9,9x16}.mp4`, 15.0 s each. Each opens with the game's title and closes with the INSPIRE logo and PLAY FREE · WWW.INSPIRECLOTHING.ART. These use the game's own full sound (its music and effects), loudness-normalised the same way.

### Render validation (`renders/validation.json`)

| File | Length | Size | Loudness | True peak | Bitrate | Black outside intro | Faststart | Result |
|---|---|---|---|---|---|---|---|---|
| `renders/trailer/enter-the-inspireverse-2026-16x9.mp4` | 57.05 s | 1920×1080 @ 60 | -13.9 LUFS | -2 dBFS | 5848 kb/s | 0 s | yes | ✅ |
| `renders/trailer/enter-the-inspireverse-2026-1x1.mp4` | 57.05 s | 1080×1080 @ 60 | -13.9 LUFS | -2 dBFS | 3187 kb/s | 0 s | yes | ✅ |
| `renders/trailer/enter-the-inspireverse-2026-9x16.mp4` | 57.05 s | 1080×1920 @ 60 | -13.9 LUFS | -2 dBFS | 4905 kb/s | 0 s | yes | ✅ |
| `renders/highlights/card-parlor-16x9.mp4` | 14.998 s | 1920×1080 @ 60 | -14.3 LUFS | -2 dBFS | 6355 kb/s | 0 s | yes | ✅ |
| `renders/highlights/card-parlor-9x16.mp4` | 15 s | 1080×1920 @ 60 | -14.3 LUFS | -2 dBFS | 5607 kb/s | 0 s | yes | ✅ |
| `renders/highlights/emoji-elements-16x9.mp4` | 14.999 s | 1920×1080 @ 60 | -14.5 LUFS | -2 dBFS | 4624 kb/s | 0 s | yes | ✅ |
| `renders/highlights/emoji-elements-9x16.mp4` | 15 s | 1080×1920 @ 60 | -14.6 LUFS | -2 dBFS | 4666 kb/s | 0 s | yes | ✅ |
| `renders/highlights/gridlock-16x9.mp4` | 15 s | 1920×1080 @ 60 | -14 LUFS | -2 dBFS | 5685 kb/s | 0 s | yes | ✅ |
| `renders/highlights/gridlock-9x16.mp4` | 15 s | 1080×1920 @ 60 | -13.8 LUFS | -2 dBFS | 5333 kb/s | 0 s | yes | ✅ |
| `renders/highlights/hardigan-boys-16x9.mp4` | 15 s | 1920×1080 @ 60 | -14.6 LUFS | -2.1 dBFS | 5948 kb/s | 0 s | yes | ✅ |
| `renders/highlights/hardigan-boys-9x16.mp4` | 15 s | 1080×1920 @ 60 | -14.6 LUFS | -2.1 dBFS | 3602 kb/s | 0 s | yes | ✅ |
| `renders/highlights/shells-and-feathers-16x9.mp4` | 15 s | 1920×1080 @ 60 | -14.1 LUFS | -2.1 dBFS | 5692 kb/s | 0 s | yes | ✅ |
| `renders/highlights/shells-and-feathers-9x16.mp4` | 14.999 s | 1080×1920 @ 60 | -14 LUFS | -2.1 dBFS | 5132 kb/s | 0 s | yes | ✅ |
| `renders/highlights/sticks-and-bones-16x9.mp4` | 15 s | 1920×1080 @ 60 | -14.8 LUFS | -1.9 dBFS | 5807 kb/s | 0 s | yes | ✅ |
| `renders/highlights/sticks-and-bones-9x16.mp4` | 15 s | 1080×1920 @ 60 | -14.7 LUFS | -2 dBFS | 4991 kb/s | 0 s | yes | ✅ |

## Gameplay capture

Method: each game runs in a private **Xvfb** display, in **headed Chromium forced fullscreen over CDP** (no browser chrome; the viewport is verified at 1920×1080 or 1080×1920). **FFmpeg `x11grab` records at 60 fps**, along with the monitor of a private **PulseAudio** null sink, as near-lossless x264 plus PCM. Each shot boots its game unrecorded (gate, intro skip, menus), so footage contains no loading screens or duplicate intros. Analytics are excluded: Do Not Track and GPC are set before page scripts run, PostHog and other analytics hosts are blocked, and Hardigan gets `?analytics=off`. **0 analytics requests** were made across all captures.

"Page fps" is the game's own `requestAnimationFrame` rate during the shot. With no GPU, Chromium rasterizes on the CPU. Most shots render at 47–60 fps, but heavy blurred backdrops drop lower: GRIDLOCK's build panel to 15–30 fps and the Card Parlor hub to 26–39 fps. Those moments are recorded at 60 fps but animate less smoothly than on a real device.

### Per game and layout (clean `capture:all` run, full-audio takes)

| Game | Layout | Shots ok | Usable footage | Capture fps (min) | Complete |
|------|--------|----------|----------------|-------------------|----------|
| The Hardigan Boys | landscape | 3/3 | 100.3 s | 59.8 | ✅ |
| STICKS & BONES | landscape | 2/2 | 81.2 s | 59.78 | ✅ |
| STICKS & BONES | portrait | 2/2 | 81.7 s | 59.92 | ✅ |
| INSPIRE Card Parlor | landscape | 3/3 | 114.3 s | 59.8 | ✅ |
| INSPIRE Card Parlor | portrait | 3/3 | 111.1 s | 59.75 | ✅ |
| Shells & Feathers | landscape | 2/2 | 75 s | 59.89 | ✅ |
| Shells & Feathers | portrait | 2/2 | 74.1 s | 59.87 | ✅ |
| GRIDLOCK | landscape | 3/3 | 81 s | 59.53 | ✅ |
| GRIDLOCK | portrait | 3/3 | 79.6 s | 59.49 | ✅ |
| Emoji Elements | landscape | 3/3 | 87.9 s | 59.7 | ✅ |
| Emoji Elements | portrait | 3/3 | 91.3 s | 59.86 | ✅ |

### Shots


_The Hardigan Boys: Portrait is not captured: the scenes are fixed 1920x1080 art with native-coordinate hotspots; on a tall screen the game letterboxes the 16:9 stage (verified 2026-11-24 with scripts/capture/explore.js --layout=portrait: a ~720 px band in a 1920 px screen)._

#### The Hardigan Boys

| Layout | Take | Shot | Status | Length | Capture fps | Page fps | Audio peak | Static / longest hold | Notes |
|---|---|---|---|---|---|---|---|---|---|
| landscape | full audio | `opening-scene` — Main menu into "Another Normal Night": Hank and Jonah on the couch | warn (attempt 1) | 48.5 s | 59.92 | 59.2 | -5.2 dB | 33.42 s / 5.3 s | 1.95s black; picture static for 33.42s in total (longest hold 5.3s) |
| landscape | full audio | `living-room-investigation` — Exploring the living room until Jonah spots the lights outside | warn (attempt 1) | 39.938 s | 59.92 | 59.6 | -4.5 dB | 18.71 s / 9.43 s | 3.55s black; picture static for 18.71s in total (longest hold 9.43s) |
| landscape | full audio | `the-raid` — "The Raid": the neighbours, the agents and the boys at the window | pass (attempt 1) | 17.325 s | 59.8 | 58.8 | -9.3 dB | 6.28 s / 3.45 s | — |
| landscape | SFX-only (3 music requests blocked) | `opening-scene` — Main menu into "Another Normal Night": Hank and Jonah on the couch | warn (attempt 1) | 47.97 s | 59.93 | 59.2 | -12.6 dB | 34.93 s / 6.17 s | 1.69s black; picture static for 34.93s in total (longest hold 6.17s) |
| landscape | SFX-only (4 music requests blocked) | `living-room-investigation` — Exploring the living room until Jonah spots the lights outside | warn (attempt 1) | 40.117 s | 59.85 | 59.4 | -11 dB | 16.52 s / 9.45 s | 3.65s black; picture static for 16.52s in total (longest hold 9.45s) |
| landscape | SFX-only (4 music requests blocked) | `the-raid` — "The Raid": the neighbours, the agents and the boys at the window | pass (attempt 1) | 17.549 s | 59.15 | 59 | -18.4 dB | 5.24 s / 2.97 s | — |

Analytics requests blocked during capture: 0. Environment: Xvfb + headed Chromium (CDP fullscreen) + FFmpeg x11grab + PulseAudio null-sink monitor; Chromium 158.0.8127.36.

#### STICKS & BONES

| Layout | Take | Shot | Status | Length | Capture fps | Page fps | Audio peak | Static / longest hold | Notes |
|---|---|---|---|---|---|---|---|---|---|
| landscape | full audio | `story-prologue` — Story mode: the case file and the prologue "An Open Door" | warn (attempt 1) | 37.385 s | 59.78 | 58.5 | -8.3 dB | 32.53 s / 4.87 s | picture static for 32.53s in total (longest hold 4.87s) |
| landscape | full audio | `quick-play-hand` — Quick Play: dealing and playing a hand of dominoes against Cousin | pass (attempt 1) | 43.791 s | 59.9 | 59.8 | -6.7 dB | 2.2 s / 2.2 s | — |
| portrait | full audio | `story-prologue` — Story mode: the case file and the prologue "An Open Door" | warn (attempt 1) | 37.252 s | 59.92 | 59.1 | -8.3 dB | 31.95 s / 5.03 s | picture static for 31.95s in total (longest hold 5.03s) |
| portrait | full audio | `quick-play-hand` — Quick Play: dealing and playing a hand of dominoes against Cousin | pass (attempt 1) | 44.409 s | 59.92 | 59.3 | -6.1 dB | 9.89 s / 3.48 s | — |
| landscape | SFX-only (11 music requests blocked) | `story-prologue` — Story mode: the case file and the prologue "An Open Door" | warn (attempt 1) | 37.342 s | 59.88 | 58.8 | -8.3 dB | 31.88 s / 4.88 s | picture static for 31.88s in total (longest hold 4.88s) |
| landscape | SFX-only (25 music requests blocked) | `quick-play-hand` — Quick Play: dealing and playing a hand of dominoes against Cousin | pass (attempt 1) | 43.664 s | 59.91 | 59.8 | -7.3 dB | 6.69 s / 2.47 s | — |
| portrait | SFX-only (11 music requests blocked) | `story-prologue` — Story mode: the case file and the prologue "An Open Door" | warn (attempt 1) | 37.304 s | 59.91 | 59.1 | -8.3 dB | 31.98 s / 5.01 s | picture static for 31.98s in total (longest hold 5.01s) |
| portrait | SFX-only (25 music requests blocked) | `quick-play-hand` — Quick Play: dealing and playing a hand of dominoes against Cousin | pass (attempt 1) | 44.262 s | 59.85 | 59.3 | -7.1 dB | 4.33 s / 2.21 s | — |

Analytics requests blocked during capture: 0. Environment: Xvfb + headed Chromium (CDP fullscreen) + FFmpeg x11grab + PulseAudio null-sink monitor; Chromium 158.0.8127.36.

#### INSPIRE Card Parlor

| Layout | Take | Shot | Status | Length | Capture fps | Page fps | Audio peak | Static / longest hold | Notes |
|---|---|---|---|---|---|---|---|---|---|
| landscape | full audio | `parlor-hub` — The parlor hub: day/night scenery, menus and the card games | pass (attempt 1) | 22.022 s | 59.8 | 26.1 | -12.9 dB | 7.1 s / 4.47 s | — |
| landscape | full audio | `story-chapter-one` — Story Mode: Chapter 1 "The Card Without a Suit", Cheryl's challenge and a hand of War | warn (attempt 1) | 48.992 s | 59.93 | 51.8 | -9.5 dB | 26.6 s / 3.72 s | picture static for 26.6s in total (longest hold 3.72s) |
| landscape | full audio | `klondike` — Quick Play Klondike: the deal and a run of legal moves | pass (attempt 1) | 43.279 s | 59.91 | 50.8 | -10 dB | 0 s / 0 s | — |
| portrait | full audio | `parlor-hub` — The parlor hub: day/night scenery, menus and the card games | warn (attempt 1) | 18.244 s | 59.75 | 39.3 | -12.8 dB | 13.5 s / 4.54 s | picture static for 13.5s in total (longest hold 4.54s) |
| portrait | full audio | `story-chapter-one` — Story Mode: Chapter 1 "The Card Without a Suit", Cheryl's challenge and a hand of War | warn (attempt 1) | 48.856 s | 59.91 | 52.5 | -10 dB | 26.32 s / 3.77 s | picture static for 26.32s in total (longest hold 3.77s) |
| portrait | full audio | `klondike` — Quick Play Klondike: the deal and a run of legal moves | pass (attempt 1) | 43.979 s | 59.89 | 54.5 | -11.1 dB | 2.43 s / 2.43 s | — |
| landscape | SFX-only (10 music requests blocked) | `parlor-hub` — The parlor hub: day/night scenery, menus and the card games | warn (attempt 1) | 21.739 s | 59.75 | 27.1 | -14.8 dB | 9.21 s / 4.59 s | picture static for 9.21s in total (longest hold 4.59s) |
| landscape | SFX-only (10 music requests blocked) | `story-chapter-one` — Story Mode: Chapter 1 "The Card Without a Suit", Cheryl's challenge and a hand of War | warn (attempt 1) | 49.037 s | 59.93 | 51.8 | -10.1 dB | 28.72 s / 3.67 s | picture static for 28.72s in total (longest hold 3.67s) |
| landscape | SFX-only (10 music requests blocked) | `klondike` — Quick Play Klondike: the deal and a run of legal moves | pass (attempt 1) | 44.109 s | 59.51 | 47.7 | -10.8 dB | 2 s / 2 s | — |
| portrait | SFX-only (10 music requests blocked) | `parlor-hub` — The parlor hub: day/night scenery, menus and the card games | warn (attempt 1) | 19.184 s | 59.84 | 34.7 | -15.6 dB | 15.07 s / 4.43 s | picture static for 15.07s in total (longest hold 4.43s) |
| portrait | SFX-only (10 music requests blocked) | `story-chapter-one` — Story Mode: Chapter 1 "The Card Without a Suit", Cheryl's challenge and a hand of War | warn (attempt 1) | 49.269 s | 59.9 | 51.2 | -10.2 dB | 23.76 s / 3.62 s | picture static for 23.76s in total (longest hold 3.62s) |
| portrait | SFX-only (10 music requests blocked) | `klondike` — Quick Play Klondike: the deal and a run of legal moves | pass (attempt 1) | 43.695 s | 59.94 | 53 | -11.2 dB | 2.72 s / 2.72 s | — |

Analytics requests blocked during capture: 0. Environment: Xvfb + headed Chromium (CDP fullscreen) + FFmpeg x11grab + PulseAudio null-sink monitor; Chromium 158.0.8127.36.

#### Shells & Feathers

| Layout | Take | Shot | Status | Length | Capture fps | Page fps | Audio peak | Static / longest hold | Notes |
|---|---|---|---|---|---|---|---|---|---|
| landscape | full audio | `hub-and-tic-tac-toe` — The forest hub, then Shells & Feathers against the Spirit | pass (attempt 1) | 33.034 s | 59.91 | 59.7 | -13.5 dB | 8.98 s / 3.08 s | — |
| landscape | full audio | `acorns-and-leaves` — Acorns & Leaves: checkers against the forest Spirit | pass (attempt 1) | 41.947 s | 59.89 | 60 | -12.5 dB | 2.68 s / 2.68 s | — |
| portrait | full audio | `hub-and-tic-tac-toe` — The forest hub, then Shells & Feathers against the Spirit | pass (attempt 1) | 33.005 s | 59.87 | 59.6 | -14.2 dB | 11.44 s / 3.01 s | — |
| portrait | full audio | `acorns-and-leaves` — Acorns & Leaves: checkers against the forest Spirit | pass (attempt 1) | 41.109 s | 59.91 | 60 | -11.9 dB | 7.29 s / 5.1 s | — |
| landscape | SFX-only (1 music requests blocked) | `hub-and-tic-tac-toe` — The forest hub, then Shells & Feathers against the Spirit | pass (attempt 1) | 33.269 s | 59.85 | 59.3 | -14.9 dB | 8.73 s / 3.14 s | — |
| landscape | SFX-only (1 music requests blocked) | `acorns-and-leaves` — Acorns & Leaves: checkers against the forest Spirit | pass (attempt 1) | 40.85 s | 59.93 | 60 | -12 dB | 5 s / 2.8 s | — |
| portrait | SFX-only (1 music requests blocked) | `hub-and-tic-tac-toe` — The forest hub, then Shells & Feathers against the Spirit | warn (attempt 1) | 25.525 s | 59.71 | 57.4 | -15.5 dB | 11.81 s / 3.32 s | picture static for 11.81s in total (longest hold 3.32s) |
| portrait | SFX-only (1 music requests blocked) | `acorns-and-leaves` — Acorns & Leaves: checkers against the forest Spirit | pass (attempt 1) | 41.084 s | 59.93 | 59.9 | -13.9 dB | 8.92 s / 3.73 s | — |

Analytics requests blocked during capture: 0. Environment: Xvfb + headed Chromium (CDP fullscreen) + FFmpeg x11grab + PulseAudio null-sink monitor; Chromium 158.0.8127.36.

#### GRIDLOCK

| Layout | Take | Shot | Status | Length | Capture fps | Page fps | Audio peak | Static / longest hold | Notes |
|---|---|---|---|---|---|---|---|---|---|
| landscape | full audio | `menus` — Title screen, menu and How To Play cards | warn (attempt 1) | 22.794 s | 59.53 | 59.5 | -14.5 dB | 10.48 s / 5.57 s | picture static for 10.48s in total (longest hold 5.57s) |
| landscape | full audio | `opening-moves` — First rounds: paving roads against three Mayor Bots | pass (attempt 1) | 26.574 s | 59.91 | 48.3 | -6.8 dB | 0 s / 0 s | — |
| landscape | full audio | `capture-and-build` — Mid-game: enclosing blocks, building and the bonus road | pass (attempt 1) | 31.62 s | 59.93 | 20.7 | -6 dB | 4.4 s / 2.2 s | — |
| portrait | full audio | `menus` — Title screen, menu and How To Play cards | warn (attempt 1) | 22.794 s | 59.49 | 58.9 | -7.1 dB | 15.25 s / 7.82 s | picture static for 15.25s in total (longest hold 7.82s) |
| portrait | full audio | `opening-moves` — First rounds: paving roads against three Mayor Bots | pass (attempt 1) | 26.705 s | 59.8 | 48.2 | -9.6 dB | 0 s / 0 s | — |
| portrait | full audio | `capture-and-build` — Mid-game: enclosing blocks, building and the bonus road | pass (attempt 1) | 30.101 s | 59.8 | 29.9 | -6.1 dB | 4.49 s / 2.28 s | — |
| landscape | SFX-only (4 music requests blocked) | `opening-moves` — First rounds: paving roads against three Mayor Bots | pass (attempt 1) | 26.629 s | 59.86 | 47.5 | -9.5 dB | 2.08 s / 2.08 s | — |
| landscape | SFX-only (4 music requests blocked) | `capture-and-build` — Mid-game: enclosing blocks, building and the bonus road | pass (attempt 1) | 31.105 s | 59.86 | 18.9 | -8.6 dB | 4.9 s / 2.6 s | — |
| portrait | SFX-only (4 music requests blocked) | `opening-moves` — First rounds: paving roads against three Mayor Bots | pass (attempt 1) | 26.936 s | 59.88 | 44.9 | -8.2 dB | 2.17 s / 2.17 s | — |
| portrait | SFX-only (4 music requests blocked) | `capture-and-build` — Mid-game: enclosing blocks, building and the bonus road | pass (attempt 1) | 31.804 s | 59.84 | 14.9 | -5.6 dB | 5.39 s / 2.9 s | — |

Analytics requests blocked during capture: 0. Environment: Xvfb + headed Chromium (CDP fullscreen) + FFmpeg x11grab + PulseAudio null-sink monitor; Chromium 158.0.8127.36.

#### Emoji Elements

| Layout | Take | Shot | Status | Length | Capture fps | Page fps | Audio peak | Static / longest hold | Notes |
|---|---|---|---|---|---|---|---|---|---|
| landscape | full audio | `pack-opening` — Main menu, Pack Shop and a booster pack reveal | warn (attempt 1) | 21.284 s | 59.86 | 54.8 | -10.1 dB | 10.3 s / 4.2 s | picture static for 10.3s in total (longest hold 4.2s) |
| landscape | full audio | `battle-opening` — Battle setup, then the opening turns: lands, mana and first creatures | pass (attempt 1) | 34.44 s | 59.7 | 52.3 | -5.7 dB | 12.34 s / 4.47 s | — |
| landscape | full audio | `battle-combat` — Mid-battle: attacks, blocks and the AI turn | warn (attempt 2) | 32.175 s | 59.89 | 56.7 | -3.4 dB | 21.33 s / 14.49 s | picture static for 21.33s in total (longest hold 14.49s) |
| portrait | full audio | `pack-opening` — Main menu, Pack Shop and a booster pack reveal | warn (attempt 1) | 21.317 s | 59.86 | 54 | -9.3 dB | 10.37 s / 4.3 s | picture static for 10.37s in total (longest hold 4.3s) |
| portrait | full audio | `battle-opening` — Battle setup, then the opening turns: lands, mana and first creatures | pass (attempt 1) | 37.987 s | 59.94 | 55 | -5.3 dB | 7.35 s / 2.95 s | — |
| portrait | full audio | `battle-combat` — Mid-battle: attacks, blocks and the AI turn | warn (attempt 1) | 32.043 s | 59.89 | 56.3 | -3.7 dB | 13.5 s / 3.92 s | picture static for 13.5s in total (longest hold 3.92s) |
| landscape | SFX-only (2 music requests blocked) | `pack-opening` — Main menu, Pack Shop and a booster pack reveal | warn (attempt 1) | 21.434 s | 59.86 | 54.4 | -10.4 dB | 10.44 s / 4.31 s | picture static for 10.44s in total (longest hold 4.31s) |
| landscape | SFX-only (3 music requests blocked) | `battle-combat` — Mid-battle: attacks, blocks and the AI turn | pass (attempt 1) | 40.402 s | 59.92 | 52.2 | -5.4 dB | 11.92 s / 2.93 s | — |
| portrait | SFX-only (2 music requests blocked) | `pack-opening` — Main menu, Pack Shop and a booster pack reveal | warn (attempt 1) | 21.417 s | 59.81 | 53.9 | -10.3 dB | 10.38 s / 4.3 s | picture static for 10.38s in total (longest hold 4.3s) |
| portrait | SFX-only (3 music requests blocked) | `battle-combat` — Mid-battle: attacks, blocks and the AI turn | warn (attempt 1) | 32.369 s | 59.9 | 55.2 | -2.6 dB | 16.96 s / 12.02 s | picture static for 16.96s in total (longest hold 12.02s) |

Analytics requests blocked during capture: 0. Environment: Xvfb + headed Chromium (CDP fullscreen) + FFmpeg x11grab + PulseAudio null-sink monitor; Chromium 158.0.8127.36.


## Verified deployments and startup flows

Commit = HEAD of the default branch at verification time (pinned in `config/games.json`).

| Game | URL (HTTP 200) | `<title>` | Commit | Deploy |
|------|----------------|-----------|--------|--------|
| The Hardigan Boys | https://officialinspire.github.io/THE-HARDIGAN-BOYS-vs-THE-MEXICAN-DRUG-CARTEL/ | THE HARDIGAN BOYS vs THE MEXICAN DRUG CARTEL | `dc5f1d7` | static, GitHub Pages |
| STICKS & BONES | https://officialinspire.github.io/STICKS_-_BONES/ | STICKS & BONES — No Rest for Cousin | `77ca671` | Vite, `deploy-pages.yml` |
| INSPIRE Card Parlor | https://officialinspire.github.io/Inspire-card-parlor/ | INSPIRE CARD PARLOR — Classic Card Games by OFFICIAL INSPIRE | `0959323` | Vite, `deploy.yml` |
| Shells & Feathers | https://officialinspire.github.io/SHELLS-FEATHERS/ | Spirit of the Woods | `2244a59` | static, GitHub Pages |
| GRIDLOCK | https://officialinspire.github.io/GRIDLOCK/ | GRIDLOCK — Grid Lock City by INSPIRE | `e8b087d` | static, GitHub Pages |
| Emoji Elements | https://officialinspire.github.io/EMOJI-ELEMENTS-BETA-VERSION-/ | EMOJI ELEMENTS | `8fc3cc8` | static PWA, GitHub Pages |

Startup flows, as observed in headless Chromium at 1920×1080. Every game gates on a user gesture before the studio intro plays with sound:

| Game | Gate | Intro | Menu → gameplay used in the reel |
|------|------|-------|-----------------------------------|
| The Hardigan Boys | `#touch-start-btn` "TOUCH TO START" | `#intro-video`, skip `#intro-skip-btn` | `#btn-new-game` → first room with the tutorial prompt |
| STICKS & BONES | full-screen "Tap, click or press Enter to start" (Enter) | hashed `inspiresoftwareintro-*.mp4`; Skip and Mute arm 400 ms after release | "Quick Play" → "Deal the tiles" |
| INSPIRE Card Parlor | animated title ("Skip intro"), then "TOUCH TO START / ENTER PARLOR" | studio video, "Skip video" | "QUICK PLAY Klondike" → "Deal" |
| Shells & Feathers | `#start-button`, which pulses and needs a forced click | `#intro-video` once per session, skip `#intro-skip` | Spirit of the Woods hub → `a[href="#/shells-feathers"]` → "Play the Spirit" |
| GRIDLOCK | `#start-button` "Click or press Enter to start" | `#intro-video`, skip `#intro-skip` | "Play Solo" → board, with the CPU mayors set up |
| Emoji Elements | `#clickToStart` overlay | `#introVideo` in `#introContainer` | "NEW GAME" → battle setup → "START BATTLE" |

Each game's controls, taken from its README and confirmed in play, are recorded in `config/games.json` under `controls`.

## Source assets

### Studio branding (committed in `assets/branding/`)

| File | SHA-256 | Properties | Identical copies at the pinned commits |
|------|---------|------------|----------------------------------------|
| `inspiresoftwareintro.mp4` | `8a6ce01dde56350a8e13aa09b194a4205ca13e1e826d34e71381896a20cbcb88` | 278,774 B; H.264 1080×720 30 fps; AAC 44.1 kHz stereo; 5.869 s; ~380 kb/s; −21.0 LUFS | GRIDLOCK `assets/media/`, STICKS_-_BONES `assets/video/`, HARDIGAN `/`, SHELLS-FEATHERS `/`, EMOJI-ELEMENTS `/` |
| `inspire-logo.png` | `f182ae2bfc59fa97c06a0a0785c2e391e8883cf8f62cf7639d6c8d1ede8c9eb9` | 600×181 grey+alpha, white wordmark with a black outline | GRIDLOCK `assets/media/inspire.png`, SHELLS-FEATHERS `inspire-logo.png`, HARDIGAN `logo.png` |

INSPIRE Card Parlor's live site serves a byte-identical copy at `https://officialinspire.github.io/Inspire-card-parlor/assets/video/inspiresoftwareintro.mp4` (same SHA-256). That file is **not** tracked in the `Inspire-card-parlor` git tree at `0959323`, so the deployment gets it from outside version control. The pipeline uses the committed copy above.

### Per-game assets (fetched into `assets/vendor/`)

| Game | Title card | Music |
|------|-----------|-------|
| The Hardigan Boys | `promo/hardigan-boys-vs-drug-cartel-promo-title-card.jpg` (1536×1024) | `audio/main-menu-theme.mp3` (196.9 s, 44.1 kHz) |
| STICKS & BONES | `public/social/sticks-and-bones-og-v1.jpg` (1200×630) | `assets/audio/music/Domino Table (Subtle Vibe).mp3` (179.8 s, 48 kHz) |
| INSPIRE Card Parlor | `public/assets/branding/social-card.jpg` (1200×630) | `public/assets/music/inspire-card-parlor-menu-track.m4a` (181.3 s; MP3 data, see findings) |
| Shells & Feathers | `assets/spirit-of-the-woods-social.jpg` (1732×908) | `gameplay.mp3` (600.1 s, 44.1 kHz) |
| GRIDLOCK | `GRIDLOCK paper-cut cityscape.png` (1672×941) | `assets/media/cardboard-city.mp3` (154.8 s, 48 kHz) |
| Emoji Elements | `EMOJI-ELEMENTS-TITLE-CARD.jpg` (2528×1686) | `Emoji Elements - Celestial Battle Theme.mp3` (174.0 s, 48 kHz) |

SHA-256 values for all of these are in `config/games.json`. The title cards are fetched and validated but not yet used in the cut.

## Blockers / findings

1. **The GitHub repository does not exist, so nothing has been pushed.** `officialinspire/INSPIRE-SHOWREEL` was never created: this session's GitHub access covers only existing repositories, and both creation and push are refused (HTTP 403). All work is committed locally on `main`. To unblock, create an empty `officialinspire/INSPIRE-SHOWREEL`, then run `git push -u origin main`.
2. **Music approval.** The trailer bed (*Emoji Elements — Celestial Battle Theme*) and the highlight audio are OFFICIAL INSPIRE soundtracks shipped in the studio's own game repos. Card Parlor's music README states its tracks were "uploaded by OFFICIAL INSPIRE". No repo carries an explicit music licence file, so **the owner should confirm music rights before public release.** Emoji Elements' effects are Kenney CC0 (licence notices are in that repo). Fonts are Inter (SIL OFL).
3. **No GPU in the capture machine.** See "Page fps" above. Capturing on a machine with a GPU would make the heavy moments smoother. The Chromium flags were tuned for CPU rendering (`--use-angle=swiftshader-webgl --disable-gpu-rasterization`), which took GRIDLOCK's turn animations from 6–16 to 53–61 fps.
4. **Portrait not captured for The Hardigan Boys.** Its scenes are fixed 16:9 art with native-coordinate hotspots, and the game letterboxes them on tall screens. 9:16 deliverables fit the 16:9 stage instead.
5. **Gameplay is live, so takes differ.** CPU opponents and deals are random, so event counts vary between takes. Trailer anchors use only events present in every take, and `npm test` resolves them all. One Emoji Elements setup can end the match early; the runner's retry handled it.
6. **Corrupt track in Inspire-card-parlor (not fixed: read-only).** `public/assets/music/downtown-fxbg-saturday-walk.m4a` has no moov atom.
7. **Mislabelled container in Inspire-card-parlor.** `inspire-card-parlor-menu-track.m4a` contains MP3 data.
8. **`https://officialinspire.github.io/` returns 404**, because there is no organisation Pages site. The end card uses WWW.INSPIRECLOTHING.ART, the site the games link to.
9. **The studio intro master is 1080×720.** It is scaled (never cropped) into each format.

## Next steps

- [ ] Create the GitHub repo and push `main` (blocker 1). Then `npm run release` the approved cut as release assets.
- [ ] Owner sign-off on music rights (blocker 2) and on the cut itself.
- [ ] Optional: re-capture on a GPU machine for smoother heavy scenes. The pipeline is unchanged: `npm run capture:all && npm run capture:sfx && npm run render:all`.
