'use strict';
const test = require('node:test');
const assert = require('node:assert');
const config = require('../scripts/lib/config');
const { loadAdapter, ADAPTER_IDS } = require('../scripts/capture/adapters');
const { Recorder } = require('../scripts/capture/recorder');
const { ANALYTICS_HOSTS } = require('../scripts/capture/browser');

test('every configured game has a capture adapter', () => {
  const cfg = config.load();
  assert.deepStrictEqual([...ADAPTER_IDS].sort(), cfg.games.games.map((g) => g.id).sort());
});

test('adapters are well formed: layouts, boot, unique shot ids', () => {
  for (const id of ADAPTER_IDS) {
    const a = loadAdapter(id);
    assert.ok(a.layouts.length >= 1 && a.layouts.every((l) => ['landscape', 'portrait'].includes(l)), `${id} layouts`);
    if (!a.layouts.includes('portrait')) assert.ok(a.layoutNotes, `${id} must explain why portrait is not captured`);
    const ids = a.shots.map((s) => s.id);
    assert.strictEqual(new Set(ids).size, ids.length, `${id} duplicate shot ids`);
    assert.ok(a.shots.length >= 2, `${id} needs multiple distinct shots`);
  }
});

test('each segment points at a shot the adapter records in that layout', () => {
  const cfg = config.load();
  for (const g of cfg.games.games) {
    const a = loadAdapter(g.id);
    const shot = a.shots.find((s) => s.id === g.segment.shot);
    assert.ok(shot, `${g.id}: unknown shot ${g.segment.shot}`);
    assert.ok(a.layouts.includes(g.segment.layout) && (!shot.layouts || shot.layouts.includes(g.segment.layout)), `${g.id}: shot not recorded in ${g.segment.layout}`);
  }
});

test('recorder grabs the X display and the Pulse monitor at the configured rate', () => {
  const r = new Recorder({ display: ':95', width: 1920, height: 1080, fps: 60, audio: { server: 'unix:/tmp/x/native', monitor: 'showreel.monitor' }, out: '/tmp/x.mkv' });
  const a = r.args().join(' ');
  assert.match(a, /-f x11grab -framerate 60 -video_size 1920x1080 -draw_mouse 0/);
  assert.match(a, /-f pulse .*-server unix:\/tmp\/x\/native -i showreel\.monitor/);
  assert.match(a, /-c:a pcm_s16le/);
});

test('analytics hosts used by the games are blocked', () => {
  for (const h of ['us.i.posthog.com', 'us-assets.i.posthog.com', 'www.google-analytics.com']) assert.ok(ANALYTICS_HOSTS.test(h), h);
  for (const h of ['officialinspire.github.io', 'raw.githubusercontent.com']) assert.ok(!ANALYTICS_HOSTS.test(h), h);
});
