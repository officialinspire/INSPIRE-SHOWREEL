'use strict';
// Edit decision list: loads config/trailers/<name>.json and resolves every clip to a real capture.
// Clips point at manifest events ("anchor" + occurrence + offset), not raw timestamps, so the edit
// survives re-captures. Timeline positions are bar-locked and frame-accurate (no drift).
const fs = require('fs');
const path = require('path');
const config = require('../lib/config');

function loadEdl(name = 'inspireverse') {
  const file = path.isAbsolute(name) ? name : path.join(config.ROOT, 'config', 'trailers', `${name.replace(/\.json$/, '')}.json`);
  const edl = JSON.parse(fs.readFileSync(file, 'utf8'));
  edl.file = file;
  return edl;
}

const manifests = new Map();
function manifest(cfg, game) {
  if (!manifests.has(game)) {
    const f = path.join(cfg.paths.capture, game, 'manifest.json');
    if (!fs.existsSync(f)) throw new Error(`no capture manifest for ${game} — run npm run capture:${game}`);
    manifests.set(game, JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  return manifests.get(game);
}

/** Find a usable take and the source start time for a clip spec. */
function resolveSource(cfg, { game, shot, layout, variant, anchor, occurrence = 1, offset = 0, durSec }) {
  const m = manifest(cfg, game);
  const take = m.shots.find((s) => s.id === shot && s.layout === layout && (s.variant || 'full') === variant && s.status !== 'fail' && s.file);
  if (!take) {
    const have = m.shots.filter((s) => s.id === shot).map((s) => `${s.layout}/${s.variant || 'full'}:${s.status}`).join(', ') || 'none';
    throw new Error(`${game}: no usable ${layout}/${variant} take of "${shot}" (have: ${have}) — run npm run capture:${variant === 'sfx' ? 'sfx' : game}`);
  }
  const events = take.events.filter((e) => e.t !== null && e.kind !== 'screenshot' && (e.label === anchor || e.label.startsWith(`${anchor}`)));
  if (!events.length) {
    const labels = [...new Set(take.events.filter((e) => e.t !== null).map((e) => e.label.replace(/[: ].*$/, '')))].join(', ');
    throw new Error(`${game}/${shot} (${layout}/${variant}): anchor "${anchor}" not found (labels: ${labels})`);
  }
  // Live gameplay varies between takes: if this take has fewer occurrences, use its last one.
  const fallback = occurrence > events.length;
  const ev = events[Math.min(occurrence, events.length) - 1];
  const len = take.validation.metrics.durationSec;
  let start = Math.max(0, ev.t + offset);
  const warnings = fallback ? [`${game}/${shot} (${layout}/${variant}): "${anchor}" #${occurrence} not in this take; used #${events.length}`] : [];
  if (start + durSec > len - 0.05) {
    const s2 = Math.max(0, len - 0.05 - durSec);
    warnings.push(`${game}/${shot}: clip would overrun the take by ${(start + durSec - len).toFixed(2)}s; moved start ${start.toFixed(2)}→${s2.toFixed(2)}`);
    start = s2;
  }
  return { file: path.join(cfg.paths.root, take.file), start: +start.toFixed(3), takeLen: len, anchorAt: ev.t, warnings, take: `${take.layout}${take.variant === 'sfx' ? '/sfx' : ''}/${take.id}` };
}

/** Framing for a clip: format default, then the game, then "game/shot" (most specific wins). */
function framingFor(edl, format, game, shot) {
  const f = edl.framing[format] || {};
  return { ...(f.default || { source: 'landscape', mode: 'fit' }), ...(f[game] || {}), ...(shot ? f[`${game}/${shot}`] || {} : {}) };
}

/** Full trailer timeline for one format. */
function trailerTimeline(cfg, edl, format, { variant = 'sfx' } = {}) {
  const fps = edl.fps;
  const bar = (60 / edl.music.bpm) * 4;
  const frameAt = (bars) => Math.round(bars * bar * fps);
  const clips = [];
  let bars = 0;
  edl.sections.forEach((section, si) => {
    section.clips.forEach((c, ci) => {
      const game = c.game || section.game;
      const fr = framingFor(edl, format, game, c.shot);
      const f0 = frameAt(bars);
      const f1 = frameAt(bars + c.bars);
      const frames = f1 - f0;
      const src = resolveSource(cfg, { game, shot: c.shot, layout: fr.source, variant, anchor: c.anchor, occurrence: c.occurrence, offset: c.offset, durSec: frames / fps + 0.1 });
      clips.push({
        kind: 'clip', index: clips.length, section: section.id, sectionIndex: si, game, shot: c.shot, framing: fr, src,
        frames, durSec: frames / fps, startBar: bars, bars: c.bars,
        firstInSection: ci === 0, lastInSection: ci === section.clips.length - 1, montage: !!section.montage,
        title: c.title ? { text: section.title, tagline: section.tagline, kicker: c.kicker, accent: section.accent } : null,
        label: c.label ? { text: c.label, accent: c.accent || section.accent } : null,
      });
      bars += c.bars;
    });
  });
  const ec = edl.endCard;
  const endFrames = frameAt(bars + ec.bars) - frameAt(bars);
  const bgGame = ec.background.game;
  const bgFr = framingFor(edl, format, bgGame, ec.background.shot);
  const bg = resolveSource(cfg, { ...ec.background, game: bgGame, layout: bgFr.source, variant, durSec: endFrames / fps + 0.1 });
  clips.push({ kind: 'endcard', index: clips.length, frames: endFrames, durSec: endFrames / fps, startBar: bars, bars: ec.bars, src: bg, framing: bgFr, game: bgGame, lines: ec.lines });
  bars += ec.bars;
  return { fps, bar, beat: bar / 4, totalBars: bars, musicSec: frameAt(bars) / fps, clips };
}

/** Highlight timeline for one game. */
function highlightTimeline(cfg, edl, format, gameId) {
  const fps = edl.fps;
  const specs = edl.highlights.games[gameId];
  if (!specs) throw new Error(`no highlight spec for ${gameId}`);
  const total = Math.round(edl.highlights.durationSec * fps);
  const sum = specs.reduce((t, s) => t + s.sec, 0);
  let used = 0;
  const clips = specs.map((s, i) => {
    const fr = framingFor(edl, format, gameId, s.shot);
    const frames = i === specs.length - 1 ? total - used : Math.round((s.sec / sum) * total);
    used += frames;
    const src = resolveSource(cfg, { game: gameId, shot: s.shot, layout: fr.source, variant: 'full', anchor: s.anchor, occurrence: s.occurrence, offset: s.offset, durSec: frames / fps + 0.1 });
    return { kind: 'clip', index: i, game: gameId, shot: s.shot, framing: fr, src, frames, durSec: frames / fps, firstInSection: true, lastInSection: true };
  });
  return { fps, clips, totalSec: total / fps };
}

module.exports = { loadEdl, trailerTimeline, highlightTimeline, framingFor, resolveSource };
