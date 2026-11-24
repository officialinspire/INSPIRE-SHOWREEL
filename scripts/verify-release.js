#!/usr/bin/env node
'use strict';
// Verifies a published GitHub release against release/MANIFEST.json over the REST API:
// it must be published (not a draft), every asset must be attached with the right size, and every
// file is downloaded from its public URL and checked by SHA-256; MP4s are re-probed (H.264 + AAC,
// size, duration).   npm run verify:release -- [tag]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { run, log, sha256File, main } = require('./lib/util');

const ghJson = (args) => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

main(async () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release', 'MANIFEST.json'), 'utf8'));
  const tag = process.argv[2] || manifest.tag;
  const repo = process.env.GITHUB_REPOSITORY || manifest.repo;
  const rel = ghJson([`repos/${repo}/releases/tags/${tag}`]);
  const fails = [];
  if (rel.draft) fails.push('release is still a draft');
  const assets = new Map(ghJson([`repos/${repo}/releases/${rel.id}/assets?per_page=100`]).map((a) => [a.name, a]));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'showreel-release-'));
  try {
    for (const a of manifest.assets) {
      const r = assets.get(a.name);
      if (!r) { fails.push(`${a.name}: not attached`); continue; }
      if (r.size !== a.bytes) { fails.push(`${a.name}: ${r.size} bytes attached, ${a.bytes} expected`); continue; }
      if (r.browser_download_url.toLowerCase() !== a.url.toLowerCase()) fails.push(`${a.name}: download URL ${r.browser_download_url} differs from the release notes (${a.url})`);
      const f = path.join(dir, a.name);
      await download(r.browser_download_url, f);
      if (sha256File(f) !== a.sha256) { fails.push(`${a.name}: SHA-256 mismatch after download`); continue; }
      if (a.name.endsWith('.mp4')) {
        const { out } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'json', f]);
        const j = JSON.parse(out);
        const v = j.streams.find((s) => s.width);
        if (!v || v.codec_name !== 'h264' || v.width !== a.width || v.height !== a.height || !j.streams.some((s) => s.codec_name === 'aac')) fails.push(`${a.name}: unexpected streams`);
        if (Math.abs(Number(j.format.duration) - a.durationSec) > 0.05) fails.push(`${a.name}: duration ${j.format.duration}`);
      }
      fs.rmSync(f);
      log.ok(`${a.name}  ${(a.bytes / 1048576).toFixed(1)} MB  downloaded, sha256 ok`);
    }
    for (const extra of ['SOCIAL_COPY.md', 'MANIFEST.json', 'SHA256SUMS.txt']) if (!assets.has(extra)) fails.push(`${extra}: not attached`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  if (fails.length) throw new Error(`release ${tag} failed verification:\n  ${fails.join('\n  ')}`);
  log.ok(`${rel.html_url} — published, ${manifest.assets.length} deliverables verified by download`);
});
