#!/usr/bin/env node
'use strict';
// Removes generated media. Default: capture, footage, renders. --all also removes fetched vendor assets.
// Never touches assets/branding (the committed originals).
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { log, args, main } = require('./lib/util');

main(async () => {
  const a = args();
  const cfg = config.load();
  const keys = ['capture', 'footage', 'renders', ...(a.all ? ['vendor'] : [])];
  for (const k of keys) {
    const dir = cfg.paths[k];
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (entry === '.gitkeep' || entry === 'README.md') continue;
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
    log.ok(`cleaned ${path.relative(cfg.paths.root, dir) || dir}`);
  }
});
