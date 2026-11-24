#!/usr/bin/env node
'use strict';
// Prints the capture results from capture/<id>/manifest.json as Markdown tables (for
// docs/PRODUCTION_STATUS.md). Reports exactly what the manifests say, failures included.
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { main } = require('./lib/util');

main(async () => {
  const cfg = config.load();
  const out = [];
  const games = config.selectGames(cfg, []);
  out.push('| Game | Layout | Shots ok | Usable footage | Capture fps (min) | Complete |', '|------|--------|----------|----------------|-------------------|----------|');
  const details = [];
  for (const g of games) {
    const f = path.join(cfg.paths.capture, g.id, 'manifest.json');
    if (!fs.existsSync(f)) { out.push(`| ${g.title} | — | — | not captured | — | ❌ |`); continue; }
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const [layout, s] of Object.entries(m.summary || {})) {
      out.push(`| ${g.title} | ${layout} | ${s.passed}/${s.shots} | ${s.usableSec} s | ${s.minCaptureFps ?? '—'} | ${s.complete ? '✅' : '❌'} |`);
    }
    if (m.layoutNotes) details.push(`\n_${g.title}: ${m.layoutNotes}_`);
    details.push(`\n#### ${g.title}\n`, '| Layout | Take | Shot | Status | Length | Capture fps | Page fps | Audio peak | Static / longest hold | Notes |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const s of m.shots) {
      const v = s.validation?.metrics || {};
      const notes = [...(s.validation?.problems || []), ...(s.validation?.warnings || []), s.error].filter(Boolean).join('; ').replace(/\|/g, '/');
      details.push(`| ${s.layout} | ${s.variant === 'sfx' ? `SFX-only (${s.musicBlocked} music requests blocked)` : 'full audio'} | \`${s.id}\` — ${s.title || ''} | ${s.status} (attempt ${s.attempt}) | ${v.durationSec ?? '—'} s | ${v.captureFps ?? '—'} | ${s.pageFps ?? '—'} | ${v.audioMaxDb ?? '—'} dB | ${v.frozenSec ?? '—'} s / ${v.longestFrozenSec ?? '—'} s | ${notes || '—'} |`);
    }
    const blocked = m.shots.reduce((t, s) => t + (s.analyticsBlocked || 0), 0);
    details.push(`\nAnalytics requests blocked during capture: ${blocked}. Environment: ${m.environment?.method || '—'}; Chromium ${m.environment?.chromium || '—'}.`);
  }
  console.log([...out, '', '### Shots', ...details].join('\n'));
});
