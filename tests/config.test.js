'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const config = require('../scripts/lib/config');
const { sha256File } = require('../scripts/lib/util');

const REQUIRED = ['hardigan-boys', 'sticks-and-bones', 'card-parlor', 'shells-and-feathers', 'gridlock', 'emoji-elements'];

test('configuration loads and validates', () => {
  const cfg = config.load();
  assert.deepStrictEqual(cfg.errors, []);
});

test('all six required games are configured and ordered', () => {
  const cfg = config.load();
  assert.deepStrictEqual([...cfg.trailer.segments.order].sort(), [...REQUIRED].sort());
  for (const g of cfg.games.games) assert.match(g.url, /^https:\/\/officialinspire\.github\.io\//);
});

test('validation catches broken config', () => {
  const cfg = config.load();
  const games = structuredClone(cfg.games);
  games.games[0].commit = 'main';
  games.games[1].segment.from = 'nope';
  const trailer = structuredClone(cfg.trailer);
  trailer.segments.order.push('ghost');
  const errs = config.validate(games, trailer);
  assert.ok(errs.some((e) => e.includes('40-char SHA')));
  assert.ok(errs.some((e) => e.includes('no matching mark')));
  assert.ok(errs.some((e) => e.includes('"ghost"')));
});

test('path overrides via environment', () => {
  process.env.SHOWREEL_RENDERS_DIR = '/tmp/showreel-test-renders';
  try {
    const cfg = config.load();
    assert.strictEqual(cfg.paths.renders, '/tmp/showreel-test-renders');
    assert.strictEqual(path.dirname(cfg.paths.output), '/tmp/showreel-test-renders');
  } finally {
    delete process.env.SHOWREEL_RENDERS_DIR;
  }
});

test('--only filter keeps render order and rejects unknown ids', () => {
  const cfg = config.load();
  assert.deepStrictEqual(config.selectGames(cfg, ['gridlock', 'hardigan-boys']).map((g) => g.id), ['hardigan-boys', 'gridlock']);
  assert.throws(() => config.selectGames(cfg, ['nope']), /Unknown game/);
});

test('raw URLs encode spaces and special characters', () => {
  assert.strictEqual(
    config.rawUrl('o', 'r', 'abc', 'assets/audio/music/Domino Table (Subtle Vibe).mp3'),
    'https://raw.githubusercontent.com/o/r/abc/assets/audio/music/Domino%20Table%20(Subtle%20Vibe).mp3',
  );
});

test('committed studio branding matches the recorded originals', () => {
  const cfg = config.load();
  for (const kind of ['intro', 'logo']) {
    const spec = cfg.games.studio[kind];
    assert.ok(fs.existsSync(cfg.paths[kind]), `${spec.file} missing`);
    assert.strictEqual(sha256File(cfg.paths[kind]), spec.sha256, `${spec.file} differs from original`);
    assert.strictEqual(fs.statSync(cfg.paths[kind]).size, spec.bytes);
  }
});
