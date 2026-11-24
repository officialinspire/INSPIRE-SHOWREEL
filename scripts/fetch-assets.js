#!/usr/bin/env node
'use strict';
// Downloads source assets from the game repos at their pinned commits (read-only: raw.githubusercontent.com)
// and verifies each by SHA-256. Studio branding goes to assets/branding/ (committed, small);
// per-game title cards and music go to paths.vendor (git-ignored).
//   --force   re-download even when a verified copy exists
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { log, args, sha256File, main } = require('./lib/util');

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 40).toString().startsWith('version https://git-lfs')) throw new Error(`${url} is a Git LFS pointer, not the media file`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.part`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, dest);
}

async function ensure({ dest, sha256, sources, owner, force }) {
  if (!force && fs.existsSync(dest) && sha256File(dest) === sha256) return { dest, status: 'cached' };
  const tried = [];
  for (const s of sources) {
    const url = config.rawUrl(owner, s.repo, s.commit, s.path);
    try {
      await download(url, dest);
      const got = sha256File(dest);
      if (got !== sha256) throw new Error(`sha256 mismatch (got ${got.slice(0, 12)}…, want ${sha256.slice(0, 12)}…)`);
      return { dest, status: 'downloaded', from: `${s.repo}@${s.commit.slice(0, 7)}:${s.path}` };
    } catch (e) {
      tried.push(`${s.repo}: ${e.message}`);
    }
  }
  throw new Error(`could not obtain ${path.basename(dest)}:\n    ${tried.join('\n    ')}`);
}

main(async () => {
  const a = args();
  const cfg = config.load();
  const owner = cfg.games.owner;
  const manifest = { generatedAt: new Date().toISOString(), studio: {}, games: {} };

  log.step('Studio branding');
  for (const kind of ['intro', 'logo']) {
    const spec = cfg.games.studio[kind];
    const r = await ensure({ dest: cfg.paths[kind], sha256: spec.sha256, sources: spec.sources, owner, force: a.force });
    log.ok(`${kind}: ${r.status}${r.from ? ` from ${r.from}` : ''} → ${path.relative(cfg.paths.root, r.dest)}`);
    manifest.studio[kind] = { file: spec.file, sha256: spec.sha256, sources: spec.sources };
  }

  log.step('Per-game assets');
  for (const g of config.selectGames(cfg, a.only)) {
    manifest.games[g.id] = {};
    for (const kind of ['titleCard', 'music']) {
      const spec = g.assets[kind];
      const dest = config.vendorPath(cfg, g, kind);
      const r = await ensure({ dest, sha256: spec.sha256, sources: [{ repo: g.repo, commit: g.commit, path: spec.path }], owner, force: a.force });
      log.ok(`${g.id} ${kind}: ${r.status} → ${path.relative(cfg.paths.root, dest)}`);
      manifest.games[g.id][kind] = { source: `${g.repo}@${g.commit}:${spec.path}`, sha256: spec.sha256, local: path.relative(cfg.paths.root, dest) };
    }
  }

  const out = path.join(cfg.paths.vendor, 'manifest.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  log.ok(`manifest: ${path.relative(cfg.paths.root, out)}`);
});
