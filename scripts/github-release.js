#!/usr/bin/env node
'use strict';
// GitHub release publishing over the REST API only (`gh api`), so it works anywhere gh is
// authenticated (CI: GH_TOKEN=${{ github.token }}). Creates the release as a draft, uploads every
// asset from release/MANIFEST.json (replacing same-name assets on update), then publishes it.
//   npm run release:github -- [tag]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { log, main } = require('./lib/util');

const gh = (args, opts = {}) => execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
const ghJson = (args) => JSON.parse(gh(args) || 'null');
const TYPES = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.json': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain' };

main(async () => {
  const root = path.resolve(__dirname, '..');
  const rel = path.join(root, 'release');
  const manifest = JSON.parse(fs.readFileSync(path.join(rel, 'MANIFEST.json'), 'utf8'));
  const tag = process.argv[2] || manifest.tag;
  if (tag !== manifest.tag) throw new Error(`tag ${tag} does not match the package (${manifest.tag}); re-run npm run package:release -- --tag=${tag}`);
  const repo = process.env.GITHUB_REPOSITORY || manifest.repo;
  const files = [...manifest.assets.map((a) => a.name), 'SOCIAL_COPY.md', 'MANIFEST.json', 'SHA256SUMS.txt'];
  for (const f of files) if (!fs.existsSync(path.join(rel, f))) throw new Error(`release/${f} missing`);
  const body = fs.readFileSync(path.join(rel, 'RELEASE_NOTES.md'), 'utf8');
  const name = `ENTER THE INSPIREVERSE — Official Gameplay Showcase 2026 (${tag})`;
  const target = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

  let release = null;
  try { release = ghJson([`repos/${repo}/releases/tags/${tag}`]); } catch { /* not found */ }
  if (!release) {
    release = ghJson([`repos/${repo}/releases`, '-X', 'POST', '-f', `tag_name=${tag}`, '-f', `target_commitish=${target}`, '-f', `name=${name}`, '-F', 'draft=true', '-f', `body=${body}`]);
    log.ok(`created draft release ${tag} (id ${release.id})`);
  } else {
    ghJson([`repos/${repo}/releases/${release.id}`, '-X', 'PATCH', '-f', `name=${name}`, '-f', `body=${body}`]);
    log.ok(`updating release ${tag} (id ${release.id})`);
  }
  const existing = new Map((ghJson([`repos/${repo}/releases/${release.id}/assets?per_page=100`]) || []).map((a) => [a.name, a]));
  for (const f of files) {
    if (existing.has(f)) gh([`repos/${repo}/releases/assets/${existing.get(f).id}`, '-X', 'DELETE']);
    const file = path.join(rel, f);
    const up = ghJson(['-X', 'POST', `https://uploads.github.com/repos/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(f)}`,
      '-H', `Content-Type: ${TYPES[path.extname(f)] || 'application/octet-stream'}`, '--input', file]);
    if (up.size !== fs.statSync(file).size) throw new Error(`${f}: uploaded ${up.size} bytes, expected ${fs.statSync(file).size}`);
    log.ok(`uploaded ${f} (${(up.size / 1048576).toFixed(1)} MB)`);
  }
  const done = ghJson([`repos/${repo}/releases/${release.id}`, '-X', 'PATCH', '-F', 'draft=false', '-F', 'make_latest=true']);
  log.ok(`published ${done.html_url}`);
});
