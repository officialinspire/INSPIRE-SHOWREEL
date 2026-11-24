#!/usr/bin/env node
'use strict';
// Packages validated renders for a GitHub release under their final names:
//   INSPIRE_SHOWREEL_2026_{LANDSCAPE,VERTICAL,SQUARE}.mp4
//   INSPIRE_SHOWREEL_2026_<GAME>_15S_{LANDSCAPE,VERTICAL}.mp4
//   INSPIRE_SHOWREEL_2026_THUMB_{LANDSCAPE,PORTRAIT}.jpg, INSPIRE_SHOWREEL_2026_<GAME>_THUMB_{LANDSCAPE,PORTRAIT}.jpg
// plus MANIFEST.json, SHA256SUMS.txt, RELEASE_NOTES.md and SOCIAL_COPY.md in release/ (git-ignored).
// Refuses to package anything that is not in renders/validation.json with ok=true, or that
// changed after it was validated.
//   --tag=showreel-2026-v1.0.0   release tag used for the download links
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { run, log, args, sha256File, main } = require('./lib/util');

const REPO = process.env.GITHUB_REPOSITORY || 'officialinspire/inspire-showreel';
const FORMAT = { '16x9': 'LANDSCAPE', '9x16': 'VERTICAL', '1x1': 'SQUARE' };
const GAME = (id) => id.toUpperCase().replace(/-/g, '_');
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

main(async () => {
  const a = args();
  const cfg = config.load();
  const tag = typeof a.tag === 'string' ? a.tag : 'showreel-2026-v1.0.0';
  const valFile = path.join(cfg.paths.renders, 'validation.json');
  if (!fs.existsSync(valFile)) throw new Error('renders/validation.json missing — run npm run validate:renders');
  const val = JSON.parse(fs.readFileSync(valFile, 'utf8'));
  const checkedAt = new Date(val.checkedAt).getTime();
  const byFile = new Map(val.results.map((r) => [r.file, r]));
  const outDir = path.join(cfg.paths.root, 'release');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const order = ['hardigan-boys', 'sticks-and-bones', 'card-parlor', 'shells-and-feathers', 'gridlock', 'emoji-elements'];

  const plan = [];
  for (const [fmt, name] of Object.entries(FORMAT)) plan.push({ src: `renders/trailer/enter-the-inspireverse-2026-${fmt}.mp4`, name: `INSPIRE_SHOWREEL_2026_${name}.mp4`, kind: 'showreel', fmt });
  for (const g of order) for (const fmt of ['16x9', '9x16']) plan.push({ src: `renders/highlights/${g}-${fmt}.mp4`, name: `INSPIRE_SHOWREEL_2026_${GAME(g)}_15S_${FORMAT[fmt]}.mp4`, kind: 'highlight', fmt, game: g });
  plan.push({ src: 'renders/thumbnails/inspire-showreel-2026-landscape.jpg', name: 'INSPIRE_SHOWREEL_2026_THUMB_LANDSCAPE.jpg', kind: 'thumbnail' });
  plan.push({ src: 'renders/thumbnails/inspire-showreel-2026-portrait.jpg', name: 'INSPIRE_SHOWREEL_2026_THUMB_PORTRAIT.jpg', kind: 'thumbnail' });
  for (const g of order) for (const o of ['landscape', 'portrait']) plan.push({ src: `renders/thumbnails/${g}-${o}.jpg`, name: `INSPIRE_SHOWREEL_2026_${GAME(g)}_THUMB_${o.toUpperCase()}.jpg`, kind: 'thumbnail', game: g });

  const assets = [];
  for (const p of plan) {
    const src = path.join(cfg.paths.root, p.src);
    if (!fs.existsSync(src)) throw new Error(`missing ${p.src} — run npm run render:all`);
    const entry = { name: p.name, kind: p.kind, game: p.game || null, source: p.src, bytes: fs.statSync(src).size, sha256: sha256File(src) };
    if (p.kind !== 'thumbnail') {
      const v = byFile.get(p.src);
      if (!v || !v.ok) throw new Error(`${p.src} has not passed validation (${v ? v.fails.join('; ') : 'not validated'})`);
      if (fs.statSync(src).mtimeMs > checkedAt + 1000) throw new Error(`${p.src} changed after validation — re-run npm run validate:renders`);
      const spec = JSON.parse(fs.readFileSync(src.replace(/\.mp4$/, '.json'), 'utf8'));
      Object.assign(entry, { width: spec.width, height: spec.height, fps: spec.fps, durationSec: v.durationSec, loudnessLUFS: v.loudnessLUFS, truePeakDb: v.truePeakDb, video: `H.264 High L${v.level} yuv420p BT.709`, audio: 'AAC-LC 320 kb/s 48 kHz stereo' });
    } else {
      const { out } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src]);
      const [w, h] = out.trim().split(',').map(Number);
      Object.assign(entry, { width: w, height: h });
    }
    fs.copyFileSync(src, path.join(outDir, p.name));
    entry.url = `https://github.com/${REPO}/releases/download/${tag}/${p.name}`;
    assets.push(entry);
  }
  fs.copyFileSync(path.join(cfg.paths.root, 'docs', 'marketing', 'SOCIAL_COPY.md'), path.join(outDir, 'SOCIAL_COPY.md'));
  fs.writeFileSync(path.join(outDir, 'SHA256SUMS.txt'), assets.map((x) => `${x.sha256}  ${x.name}`).join('\n') + '\n');
  const manifest = { tag, repo: REPO, packagedAt: new Date().toISOString(), validatedAt: val.checkedAt, commit: process.env.GITHUB_SHA || null, assets };
  fs.writeFileSync(path.join(outDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2));

  const row = (x) => `| [${x.name}](${x.url}) | ${x.width}×${x.height}${x.fps ? ` @ ${x.fps} fps` : ''} | ${x.durationSec ? `${x.durationSec.toFixed(2)} s` : '—'} | ${mb(x.bytes)} |`;
  const vids = (k) => assets.filter((x) => x.kind === k);
  const notes = `# ENTER THE INSPIREVERSE — Official Gameplay Showcase 2026

Genuine gameplay from six free INSPIRE browser games, opening with the original INSPIRE studio intro.

Every MP4 below passed \`npm run validate:renders\`:
- **Video:** H.264 High (level ≤ 4.2), yuv420p, BT.709, 60 fps.
- **Audio:** AAC-LC 48 kHz stereo.
- **Container:** \`+faststart\`.
- **Loudness:** −14 LUFS target (±1), true peak ≤ −1.5 dBFS.
- **Picture:** constant frame timing, A/V length matched, no black outside the intro.

## Showreel

| File | Resolution | Duration | Size |
|---|---|---|---|
${vids('showreel').map(row).join('\n')}

## 15-second game trailers

| File | Resolution | Duration | Size |
|---|---|---|---|
${vids('highlight').map(row).join('\n')}

## Thumbnails

| File | Resolution | Duration | Size |
|---|---|---|---|
${vids('thumbnail').map(row).join('\n')}

Also attached:
- \`SOCIAL_COPY.md\`: draft captions and promotional copy. Nothing is posted automatically.
- \`MANIFEST.json\`: per-file loudness, codecs and SHA-256.
- \`SHA256SUMS.txt\`: checksums.

**Games.** [The Hardigan Boys](https://officialinspire.github.io/THE-HARDIGAN-BOYS-vs-THE-MEXICAN-DRUG-CARTEL/) · [STICKS & BONES](https://officialinspire.github.io/STICKS_-_BONES/) · [INSPIRE Card Parlor](https://officialinspire.github.io/Inspire-card-parlor/) · [Shells & Feathers](https://officialinspire.github.io/SHELLS-FEATHERS/) · [GRIDLOCK](https://officialinspire.github.io/GRIDLOCK/) · [Emoji Elements](https://officialinspire.github.io/EMOJI-ELEMENTS-BETA-VERSION-/). Play free at www.inspireclothing.art.

**Music.** The bed is the OFFICIAL INSPIRE *Emoji Elements — Celestial Battle Theme*. Highlights use each game's own sound. Music rights must be confirmed by the owner before public posting; see \`docs/PRODUCTION_STATUS.md\`.

**Regenerate.** \`npm run produce:all\`, or run the *Production* workflow (Actions → Production → Run workflow).
`;
  fs.writeFileSync(path.join(outDir, 'RELEASE_NOTES.md'), notes);
  log.ok(`${assets.length} assets packaged in release/ (${mb(assets.reduce((t, x) => t + x.bytes, 0))}) for tag ${tag}`);
});
