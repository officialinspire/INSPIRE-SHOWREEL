'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const config = require('../scripts/lib/config');
const { loadEdl, trailerTimeline } = require('../scripts/edit/edl');

const edl = loadEdl('inspireverse');
const bar = (60 / edl.music.bpm) * 4;

test('trailer follows the required sequence', () => {
  assert.strictEqual(edl.intro.file, 'assets/branding/inspiresoftwareintro.mp4');
  assert.deepStrictEqual(edl.sections.map((s) => s.game || s.clips.map((c) => c.game).filter((g, i, a) => a.indexOf(g) === i).join('+')),
    ['hardigan-boys', 'sticks-and-bones', 'card-parlor', 'shells-and-feathers', 'gridlock+emoji-elements']);
  assert.deepStrictEqual(edl.endCard.lines, ['ENTER THE INSPIREVERSE', 'PLAY FREE', 'WWW.INSPIRECLOTHING.ART']);
});

test('trailer length is 45-60 s (intro + bar-locked edit)', () => {
  const bars = edl.sections.reduce((t, s) => t + s.clips.reduce((u, c) => u + c.bars, 0), 0) + edl.endCard.bars;
  const total = 5.869 + bars * bar;
  assert.ok(total >= 45 && total <= 60, `total ${total.toFixed(2)} s`);
});

test('three independent compositions and highlight formats', () => {
  assert.deepStrictEqual(Object.keys(edl.formats).sort(), ['16x9', '1x1', '9x16']);
  for (const f of edl.highlights.formats) assert.ok(edl.formats[f], f);
  for (const g of config.load().games.games) assert.ok(edl.highlights.games[g.id], `highlight for ${g.id}`);
  for (const [g, clips] of Object.entries(edl.highlights.games)) assert.strictEqual(clips.reduce((t, c) => t + c.sec, 0), 15, g);
});

const cfg = config.load();
const haveCaptures = ['hardigan-boys', 'emoji-elements'].every((g) => fs.existsSync(path.join(cfg.paths.capture, g, 'manifest.json')));
test('every clip anchor resolves against the capture manifests (full and SFX takes, every format)', { skip: !haveCaptures && 'no captures on this machine' }, () => {
  const sfx = fs.existsSync(path.join(cfg.paths.capture, 'emoji-elements', 'landscape', 'sfx'));
  for (const format of Object.keys(edl.formats)) for (const variant of sfx ? ['full', 'sfx'] : ['full']) {
    const tl = trailerTimeline(cfg, edl, format, { variant });
    const frames = tl.clips.reduce((t, c) => t + c.frames, 0);
    assert.strictEqual(frames, Math.round(tl.totalBars * bar * edl.fps), `${format}/${variant}: frame total must match the bar grid (no drift)`);
  }
});

test('theme song is the committed studio original with its recorded hash and beat grid', () => {
  const { sha256File } = require('../scripts/lib/util');
  const f = path.join(config.ROOT, edl.music.file);
  assert.ok(fs.existsSync(f), edl.music.file);
  assert.strictEqual(sha256File(f), edl.music.sha256);
  assert.ok(edl.music.bpm > 60 && edl.music.bpm < 200);
  // Story sections each take one 4-bar phrase; the montage starts on bar 16 (the drop).
  const story = edl.sections.filter((s) => !s.montage);
  for (const s of story) assert.strictEqual(s.clips.reduce((t, c) => t + c.bars, 0), 4, s.id);
});
