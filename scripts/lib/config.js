'use strict';
// Loads config/games.json + config/trailer.json and resolves every path.
// Path overrides: SHOWREEL_<KEY>_DIR (e.g. SHOWREEL_RENDERS_DIR=/mnt/out),
// config overrides: SHOWREEL_GAMES_CONFIG / SHOWREEL_TRAILER_CONFIG.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot read ${path.relative(ROOT, file) || file}: ${err.message}`);
  }
}

function resolveFrom(base, p) {
  return path.isAbsolute(p) ? p : path.resolve(base, p);
}

function validate(games, trailer) {
  const errors = [];
  const ids = new Set();
  if (!Array.isArray(games.games) || games.games.length === 0) errors.push('games.json: "games" must be a non-empty array');
  for (const g of games.games || []) {
    for (const k of ['id', 'title', 'repo', 'commit', 'url']) if (!g[k]) errors.push(`games.json: game missing "${k}" (${g.id || '?'})`);
    if (ids.has(g.id)) errors.push(`games.json: duplicate id "${g.id}"`);
    ids.add(g.id);
    if (g.commit && !/^[0-9a-f]{40}$/.test(g.commit)) errors.push(`games.json: ${g.id}.commit must be a full 40-char SHA`);
    if (g.url && !/^https:\/\//.test(g.url)) errors.push(`games.json: ${g.id}.url must be https`);
    if (!g.capture || !Array.isArray(g.capture.steps)) errors.push(`games.json: ${g.id}.capture.steps missing`);
    const marks = new Set((g.capture?.steps || []).filter((s) => s.do === 'mark').map((s) => s.name));
    if (g.segment && !marks.has(g.segment.from)) errors.push(`games.json: ${g.id}.segment.from "${g.segment.from}" has no matching mark step`);
    for (const s of g.capture?.steps || []) {
      if (!['wait', 'press', 'click', 'waitFor', 'mark', 'hover', 'mouse'].includes(s.do)) errors.push(`games.json: ${g.id} unknown step "${s.do}"`);
    }
    for (const kind of ['titleCard', 'music']) {
      const a = g.assets?.[kind];
      if (!a?.path || !/^[0-9a-f]{64}$/.test(a?.sha256 || '')) errors.push(`games.json: ${g.id}.assets.${kind} needs path + sha256`);
    }
  }
  for (const id of trailer.segments?.order || []) if (!ids.has(id)) errors.push(`trailer.json: segments.order references unknown game "${id}"`);
  for (const k of ['assets', 'vendor', 'capture', 'footage', 'renders']) if (!trailer.paths?.[k]) errors.push(`trailer.json: paths.${k} missing`);
  if (!['fit', 'native'].includes(trailer.intro?.mode)) errors.push('trailer.json: intro.mode must be "fit" or "native"');
  return errors;
}

function load({ strict = true } = {}) {
  const gamesFile = resolveFrom(ROOT, process.env.SHOWREEL_GAMES_CONFIG || 'config/games.json');
  const trailerFile = resolveFrom(ROOT, process.env.SHOWREEL_TRAILER_CONFIG || 'config/trailer.json');
  const games = readJson(gamesFile);
  const trailer = readJson(trailerFile);
  const errors = validate(games, trailer);
  if (strict && errors.length) throw new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);

  const paths = { root: ROOT };
  for (const [key, rel] of Object.entries(trailer.paths)) {
    const env = process.env[`SHOWREEL_${key.toUpperCase()}_DIR`];
    paths[key] = resolveFrom(ROOT, env || rel);
  }
  paths.intro = resolveFrom(ROOT, games.studio.intro.file);
  paths.logo = resolveFrom(ROOT, games.studio.logo.file);
  paths.output = path.join(paths.renders, trailer.output);

  return { games, trailer, paths, errors, files: { gamesFile, trailerFile } };
}

/** Games in render order, optionally filtered by --only=a,b */
function selectGames(cfg, only) {
  const byId = new Map(cfg.games.games.map((g) => [g.id, g]));
  let ids = cfg.trailer.segments.order;
  if (only && only.length) {
    const unknown = only.filter((id) => !byId.has(id));
    if (unknown.length) throw new Error(`Unknown game id(s): ${unknown.join(', ')}. Known: ${[...byId.keys()].join(', ')}`);
    ids = ids.filter((id) => only.includes(id));
  }
  return ids.map((id) => byId.get(id));
}

function rawUrl(owner, repo, commit, file) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${file.split('/').map(encodeURIComponent).join('/')}`;
}

/** Local path of a fetched per-game asset */
function vendorPath(cfg, game, kind) {
  const a = game.assets[kind];
  return path.join(cfg.paths.vendor, game.id, `${kind}${path.extname(a.path).toLowerCase()}`);
}

module.exports = { ROOT, load, validate, selectGames, rawUrl, vendorPath };
