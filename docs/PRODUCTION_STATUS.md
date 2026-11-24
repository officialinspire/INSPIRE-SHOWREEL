# Production status

_Last verified: 2026-11-24 (Playwright 1.63.0 / Chromium 158, FFmpeg 6.1.1, Node 22)._

## Summary

| Stage | Status |
|-------|--------|
| Dependency check (`npm run check`) | ✅ passes |
| Live URLs (`npm run verify:urls`) | ✅ 6/6 return HTTP 200 with the expected `<title>` |
| Asset fetch + SHA-256 (`npm run fetch`) | ✅ intro, logo, 6 title cards, 6 music tracks |
| Asset validation (`npm run validate`) | ✅ the intro is bit-identical to the original and decodes cleanly |
| Capture (`npm run capture`) | ✅ 6/6 games reach the menu and enter gameplay or setup |
| Segments + render (`npm run build && npm run render`) | ✅ `renders/inspire-showreel.mp4`: 81.9 s, 1920×1080, 30 fps, H.264 High + AAC 48 kHz stereo, 30.9 MB, 0 decode errors |
| Tests (`npm test`) | ✅ 7/7 |

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

1. **The INSPIRE-SHOWREEL GitHub repository could not be created from the build session.** That session's GitHub credential was scoped to existing repositories, and the creation request was refused. The project was built, tested and committed locally on `main`. Its remote state is in *Next steps*.
2. **Gameplay audio is not captured.** Playwright's `recordVideo` records picture only. The reel uses each game's original music file from its repository instead. Capturing live in-game SFX would need OS-level capture, such as PulseAudio plus `ffmpeg -f pulse`, on a machine with a display server.
3. **Capture quality ceiling.** Playwright records VP8 at about 0.8 Mb/s at 1080p, which softens fine text and fast motion. The final encode is high quality, but it cannot add back detail the capture lost. Options: CDP `Page.startScreencast` at JPEG quality 100, or Xvfb plus `ffmpeg -f x11grab` at lossless or high bitrate.
4. **The intro master is 1080×720 (3:2), not HD.** In the 1080p master it is upscaled 1.5× and pillarboxed. A higher-resolution master from the studio would remove the upscale. Set `intro.mode: "native"` for pixel-exact placement instead.
5. **Corrupt track in Inspire-card-parlor (not fixed: read-only).** `public/assets/music/downtown-fxbg-saturday-walk.m4a` fails with "moov atom not found" and cannot be decoded.
6. **Mislabelled container in Inspire-card-parlor.** `inspire-card-parlor-menu-track.m4a` contains MP3 audio. FFmpeg and Chromium play it, but strict MP4 parsers may not.
7. **`https://officialinspire.github.io/` returns 404**, because there is no organisation Pages site. The end card uses `www.inspireclothing.art` instead, which is the studio site the games link to (HTTP 200).
8. **The Shells & Feathers deployment is titled "Spirit of the Woods".** It is a hub containing Shells & Feathers (tic-tac-toe) and Acorns & Leaves (checkers). The reel enters Shells & Feathers directly.

## Next steps

- [ ] Create `officialinspire/INSPIRE-SHOWREEL` and push `main` (see blocker 1).
- [ ] Choose the final segment lengths and order, and decide whether to use title cards as interstitials.
- [ ] Extend the capture steps into longer gameplay moments, such as playing a domino or attacking in Emoji Elements.
- [ ] Higher-fidelity capture path (blocker 3).
- [ ] `npm run release` the first approved cut.
