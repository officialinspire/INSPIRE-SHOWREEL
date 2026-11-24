'use strict';
// Platform-safe placement: titles, labels, brand tags and end-card text must stay inside each
// format's safe area (9:16 keeps clear of the bottom ~22% and right ~16% used by platform UI).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const G = require('../scripts/edit/graphics');
const { loadEdl } = require('../scripts/edit/edl');

const edl = loadEdl('inspireverse');
const brand = { ...edl.brand, logo: 'logo.png' };
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gfx-test-'));
const num = (s) => Number(String(s).match(/^-?[\d.]+/)[0]);
const yOf = (f) => num(/:y='([^']+)'/.exec(f)[1]);
const sizeOf = (f) => Number(/fontsize=(\d+)/.exec(f)[1]);

for (const [name, fmt] of Object.entries(edl.formats)) {
  const { width: W, height: H, safe } = fmt;
  const top = H * safe.top;
  const bottom = H * (1 - safe.bottom);
  for (const mode of ['full', 'fit']) {
    test(`${name}/${mode}: section title block inside the safe area`, () => {
      const L = new G.Layer(work, `t-${name}-${mode}`);
      const t = G.sectionTitle(L, fmt, { mode }, brand, { text: 'INSPIRE CARD PARLOR', tagline: 'Classic card games, one strange story', accent: '0xE0B44C' }, { start: 0.2, hold: 2.5, beat: 0.44 });
      for (const f of t.filters) {
        const y = yOf(f);
        assert.ok(y >= top - 1 && y + sizeOf(f) * 1.2 <= bottom + 1, `${name} text at y=${y} size ${sizeOf(f)} outside ${top}-${bottom}`);
        const x0 = num(/:x='([^']+)'/.exec(f)[1]);
        assert.ok(x0 >= W * safe.left - 1, `${name} x=${x0} left of safe area`);
        const textW = 'INSPIRE CARD PARLOR'.length * 0.62 * sizeOf(f);
        if (/textfile='[^']*-t1\.txt'/.test(f) || f.includes('BlackItalic')) assert.ok(x0 + textW <= W * (1 - safe.right) + 2, `${name} title runs into the right safe margin`);
      }
    });
    test(`${name}/${mode}: montage label inside the safe area`, () => {
      const L = new G.Layer(work, `l-${name}-${mode}`);
      const m = G.montageLabel(L, fmt, { mode }, brand, { text: 'EMOJI ELEMENTS', accent: '0xB98CFF' }, 1.76);
      const f = m.filters[0];
      assert.ok(yOf(f) + sizeOf(f) <= bottom + 1, `label bottom ${yOf(f) + sizeOf(f)} > ${bottom}`);
    });
  }
  test(`${name}: highlight brand tag inside the safe area`, () => {
    const L = new G.Layer(work, `b-${name}`);
    const b = G.brandTag(L, fmt, brand, { start: 12, durSec: 15, logoFile: 'logo.png', url: 'WWW.INSPIRECLOTHING.ART' });
    const f = b.filters[0];
    assert.ok(yOf(f) + sizeOf(f) <= bottom + 1, `tag text bottom ${yOf(f) + sizeOf(f)} > ${bottom}`);
    const len = 'PLAY FREE  ·  WWW.INSPIRECLOTHING.ART'.length;
    assert.ok(len * 0.6 * sizeOf(f) <= W * (1 - safe.left - safe.right) + 1, 'tag wider than the safe width');
  });
  test(`${name}: end card lines fit the safe width`, () => {
    const L = new G.Layer(work, `e-${name}`);
    const e = G.endCard(L, fmt, brand, edl.endCard.lines, { beat: 0.44, durSec: 7, logoFile: 'logo.png' });
    const s1 = sizeOf(e.filters[0]);
    assert.ok(edl.endCard.lines[0].length * 0.62 * s1 <= W * (1 - safe.left - safe.right) + 1, 'ENTER THE INSPIREVERSE wider than the safe width');
    for (const f of e.filters) assert.ok(yOf(f) >= top && yOf(f) + sizeOf(f) <= bottom, `end card line at ${yOf(f)} outside the safe band`);
  });
}
