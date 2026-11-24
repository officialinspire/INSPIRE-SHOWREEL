#!/usr/bin/env node
'use strict';
// HTTP-checks every deployed game URL and its <title>, plus each pinned commit's intro/asset paths.
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { log, args, main } = require('./lib/util');

async function check(url, { method = 'GET' } = {}) {
  const res = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  const body = method === 'GET' ? await res.text() : '';
  return { status: res.status, body, finalUrl: res.url };
}

main(async () => {
  const a = args();
  const cfg = config.load();
  const games = config.selectGames(cfg, a.only);
  const report = { checkedAt: new Date().toISOString(), games: [] };
  let failures = 0;

  for (const g of games) {
    const entry = { id: g.id, url: g.url };
    try {
      const r = await check(g.url);
      const title = (/<title>([^<]*)<\/title>/i.exec(r.body) || [])[1]?.replace(/&amp;/g, '&').trim() || '';
      entry.status = r.status;
      entry.title = title;
      entry.titleMatches = title.toUpperCase().includes(String(g.expectTitle || g.title).toUpperCase());
      const ok = r.status === 200 && entry.titleMatches;
      (ok ? log.ok : log.err)(`${g.id.padEnd(20)} ${r.status} "${title}"`);
      if (!ok) failures++;
    } catch (e) {
      entry.error = e.message;
      log.err(`${g.id.padEnd(20)} ${e.message}`);
      failures++;
    }
    for (const kind of ['titleCard', 'music']) {
      const u = config.rawUrl(cfg.games.owner, g.repo, g.commit, g.assets[kind].path);
      try {
        const r = await check(u, { method: 'HEAD' });
        entry[`${kind}Status`] = r.status;
        if (r.status !== 200) { failures++; log.err(`  ${kind} ${r.status} ${u}`); }
      } catch (e) {
        failures++;
        log.err(`  ${kind} ${e.message}`);
      }
    }
    report.games.push(entry);
  }

  const out = path.join(cfg.paths.capture, 'url-report.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  log.info(`report: ${path.relative(cfg.paths.root, out)}`);
  if (failures) throw new Error(`${failures} URL check(s) failed`);
});
