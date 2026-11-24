'use strict';
// Adapter registry. Each adapter module exports:
//   layouts: ['landscape', 'portrait']   layouts verified to work for this game
//   layoutNotes?: string                 why a layout is unsupported, if any
//   url?(game, layout): string           page URL (e.g. add analytics opt-out parameters)
//   boot(api): Promise                   UNRECORDED: start gate, intro skip, asset readiness, main menu
//   shots: [{ id, title, layouts?, maxSec?, minSec?, setup?(api), run(api) }]
//                                         setup is unrecorded; run is what ends up in the footage
const ADAPTERS = {
  'hardigan-boys': './hardigan-boys',
  'sticks-and-bones': './sticks-and-bones',
  'card-parlor': './card-parlor',
  'shells-and-feathers': './shells-and-feathers',
  gridlock: './gridlock',
  'emoji-elements': './emoji-elements',
};

function loadAdapter(id) {
  if (!ADAPTERS[id]) throw new Error(`no capture adapter for "${id}"`);
  const a = require(ADAPTERS[id]);
  if (!Array.isArray(a.layouts) || typeof a.boot !== 'function' || !Array.isArray(a.shots) || !a.shots.length) {
    throw new Error(`adapter ${id} is missing layouts, boot() or shots`);
  }
  for (const s of a.shots) if (!s.id || typeof s.run !== 'function') throw new Error(`adapter ${id}: every shot needs id and run()`);
  return a;
}

module.exports = { loadAdapter, ADAPTER_IDS: Object.keys(ADAPTERS) };
