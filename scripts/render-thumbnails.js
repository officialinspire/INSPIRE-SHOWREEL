#!/usr/bin/env node
'use strict';
// Thumbnails from genuine capture frames + studio branding (no stock art).
//   renders/thumbnails/inspire-showreel-2026-{landscape,portrait}.jpg   main collage, 1920x1080 / 1080x1920
//   renders/thumbnails/<game>-{landscape,portrait}.jpg                    per game
// Frames/crops come from config/trailers/inspireverse.json "thumbnails".
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { loadEdl, resolveSource } = require('./edit/edl');
const G = require('./edit/graphics');
const { run, log, args, main } = require('./lib/util');

const esc = (p) => p.replace(/:/g, '\\:').replace(/'/g, "\\'");

async function grab(cfg, spec, game, layout, out) {
  const s = resolveSource(cfg, { game, shot: spec.shot, layout, variant: 'full', anchor: spec.anchor, occurrence: spec.occurrence, offset: spec.offset, durSec: 0.1 });
  await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-ss', String(s.start), '-i', s.file, '-frames:v', '1', out]);
  return { file: out, src: `${s.take} @ ${s.start}s` };
}

function textFile(work, name, text) {
  const f = path.join(work, `${name}.txt`);
  fs.writeFileSync(f, text);
  return esc(f);
}

main(async () => {
  const a = args();
  const cfg = config.load();
  const edl = loadEdl(typeof a.edl === 'string' ? a.edl : 'inspireverse');
  const T = edl.thumbnails.games;
  const out = path.join(cfg.paths.renders, 'thumbnails');
  const work = path.join(cfg.paths.footage, '.thumbnails');
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  const brand = edl.brand;
  const logo = path.join(cfg.paths.root, brand.logo);
  const font = esc(brand.font);
  const sub = esc(brand.fontSub);
  const order = edl.sections.flatMap((s) => (s.game ? [s.game] : s.clips.map((c) => c.game))).filter((g, i, x) => x.indexOf(g) === i);
  const report = { generatedAt: new Date().toISOString(), files: [] };

  // Source frames (landscape takes; portrait takes where the game has them).
  const frames = {};
  for (const g of order) {
    frames[g] = { landscape: await grab(cfg, T[g], g, 'landscape', path.join(work, `${g}-landscape.png`)) };
    try { frames[g].portrait = await grab(cfg, T[g], g, 'portrait', path.join(work, `${g}-portrait.png`)); } catch { frames[g].portrait = null; }
  }

  // Main landscape: 3 tiles (640x360) / brand band (1920x360) / 3 tiles — every game fully visible.
  {
    const inputs = order.flatMap((g) => ['-i', frames[g].landscape.file]);
    const tiles = order.map((g, i) => { const [x, y, w, h] = T[g].tile; return `[${i}:v]crop=${w}:${h}:${x}:${y},scale=640:360:flags=lanczos,setsar=1,eq=saturation=1.08[t${i}]`; });
    const f = path.join(out, 'inspire-showreel-2026-landscape.jpg');
    const g = [
      ...tiles,
      `color=c=0x0B0B10:s=1920x360,drawbox=x=0:y=0:w=1920:h=6:color=${brand.accent}:t=fill,drawbox=x=0:y=354:w=1920:h=6:color=${brand.accent}:t=fill,drawtext=fontfile='${font}':textfile='${textFile(work, 'l1', 'ENTER THE INSPIREVERSE')}':fontsize=104:fontcolor=white:x=(w-text_w)/2:y=168,drawtext=fontfile='${sub}':textfile='${textFile(work, 'l2', 'OFFICIAL GAMEPLAY SHOWCASE 2026')}':fontsize=40:fontcolor=${brand.accent}:x=(w-text_w)/2:y=292[band0]`,
      `[6:v]scale=430:-2[lg]`, `[band0][lg]overlay=(W-w)/2:28[band]`,
      `[t0][t1][t2]hstack=3[top]`, `[t3][t4][t5]hstack=3[bot]`, `[top][band][bot]vstack=3[v]`,
    ].join(';');
    await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', ...inputs, '-i', logo, '-filter_complex', g, '-map', '[v]', '-frames:v', '1', '-q:v', '2', f]);
    report.files.push({ file: path.relative(cfg.paths.root, f), size: '1920x1080', sources: order.map((x) => frames[x].landscape.src) });
  }
  // Main portrait: 3 gameplay strips (1080x270) / brand block (1080x300) / 3 strips.
  {
    const inputs = order.flatMap((g) => ['-i', frames[g].landscape.file]);
    const bands = order.map((g, i) => { const [x, y, w, h] = T[g].band; return `[${i}:v]crop=${w}:${h}:${x}:${y},scale=1080:270:flags=lanczos,setsar=1,eq=saturation=1.08[b${i}]`; });
    const f = path.join(out, 'inspire-showreel-2026-portrait.jpg');
    const g = [
      ...bands,
      `color=c=0x0B0B10:s=1080x300,drawbox=x=0:y=0:w=1080:h=5:color=${brand.accent}:t=fill,drawbox=x=0:y=295:w=1080:h=5:color=${brand.accent}:t=fill,drawtext=fontfile='${font}':textfile='${textFile(work, 'p1', 'ENTER THE INSPIREVERSE')}':fontsize=70:fontcolor=white:x=(w-text_w)/2:y=150,drawtext=fontfile='${sub}':textfile='${textFile(work, 'p3', 'OFFICIAL GAMEPLAY SHOWCASE 2026')}':fontsize=32:fontcolor=${brand.accent}:x=(w-text_w)/2:y=242[blk0]`,
      `[6:v]scale=360:-2[lg]`, `[blk0][lg]overlay=(W-w)/2:22[blk]`,
      `[b0][b1][b2][blk][b3][b4][b5]vstack=7[v]`,
    ].join(';');
    await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', ...inputs, '-i', logo, '-filter_complex', g, '-map', '[v]', '-frames:v', '1', '-q:v', '2', f]);
    report.files.push({ file: path.relative(cfg.paths.root, f), size: '1080x1920', sources: order.map((x) => frames[x].landscape.src) });
  }
  // Per game: landscape (full frame + left gradient title) and portrait (portrait take, or fitted landscape).
  const titles = Object.fromEntries(edl.sections.filter((s) => s.game).map((s) => [s.game, s.title]));
  for (const c of edl.sections.flatMap((s) => s.clips)) if (c.game && c.label) titles[c.game] = titles[c.game] || c.label;
  for (const g of order) {
    const title = titles[g];
    const fl = path.join(out, `${g}-landscape.jpg`);
    const tl = textFile(work, `${g}-t`, title);
    const size = Math.min(130, Math.floor(1100 / (title.length * 0.62)));
    await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-i', frames[g].landscape.file, '-i', logo, '-filter_complex',
      `[0:v]scale=1920:1080,eq=saturation=1.08,drawbox=x=0:y=640:w=1920:h=440:color=black@0.55:t=fill,drawtext=fontfile='${font}':textfile='${tl}':fontsize=${size}:fontcolor=white:x=96:y=760:shadowcolor=black@0.6:shadowx=4:shadowy=4,drawtext=fontfile='${sub}':textfile='${textFile(work, `${g}-s`, 'PLAY FREE  ·  WWW.INSPIRECLOTHING.ART')}':fontsize=40:fontcolor=${brand.accent}:x=100:y=${760 + size + 30}[bg];[1:v]scale=380:-2[lg];[bg][lg]overlay=W-w-90:H-h-90[v]`,
      '-map', '[v]', '-frames:v', '1', '-q:v', '2', fl]);
    const fp = path.join(out, `${g}-portrait.jpg`);
    const psize = Math.min(110, Math.floor(860 / (title.length * 0.62)));
    const base = frames[g].portrait
      ? `[0:v]scale=1080:1920,setsar=1`
      : `[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:3,eq=brightness=-0.22[bgb];[b]scale=1080:-2[fg];[bgb][fg]overlay=0:(H-h)/2`;
    await run('ffmpeg', ['-y', '-hide_banner', '-nostdin', '-i', (frames[g].portrait || frames[g].landscape).file, '-i', logo, '-filter_complex',
      `${base},eq=saturation=1.08,drawbox=x=0:y=1180:w=1080:h=330:color=black@0.6:t=fill,drawtext=fontfile='${font}':textfile='${tl}':fontsize=${psize}:fontcolor=white:x=70:y=1230:shadowcolor=black@0.6:shadowx=3:shadowy=3,drawtext=fontfile='${sub}':textfile='${textFile(work, `${g}-s2`, 'PLAY FREE')}':fontsize=44:fontcolor=${brand.accent}:x=74:y=${1230 + psize + 24}[bg];[1:v]scale=300:-2[lg];[bg][lg]overlay=70:290[v]`,
      '-map', '[v]', '-frames:v', '1', '-q:v', '2', fp]);
    report.files.push({ file: path.relative(cfg.paths.root, fl), size: '1920x1080', sources: [frames[g].landscape.src] }, { file: path.relative(cfg.paths.root, fp), size: '1080x1920', sources: [(frames[g].portrait || frames[g].landscape).src] });
  }
  for (const f of report.files) f.bytes = fs.statSync(path.join(cfg.paths.root, f.file)).size;
  fs.writeFileSync(path.join(out, 'thumbnails.json'), JSON.stringify(report, null, 2));
  log.ok(`${report.files.length} thumbnails → ${path.relative(cfg.paths.root, out)}/`);
});
