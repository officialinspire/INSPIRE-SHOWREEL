#!/usr/bin/env node
'use strict';
// Turns captures + original assets into uniform segments in paths.footage, all with identical
// codec parameters so render.js can concatenate them without re-encoding:
//   footage/00-intro.mp4        studio intro (original picture + soundtrack, only scaled/resampled)
//   footage/NN-<game>.mp4       trimmed capture + lower third + watermark + original game music
//   footage/99-endcard.mp4      INSPIRE logo end card
//   --only=a,b   rebuild only these games (intro/end card are rebuilt unless --games-only)
const fs = require('fs');
const path = require('path');
const config = require('./lib/config');
const { probe, encodeArgs } = require('./lib/media');
const { log, args, run, main } = require('./lib/util');

const fadeAlpha = (s, e, f = 0.4) => `if(lt(t,${s}),0,if(lt(t,${s + f}),(t-${s})/${f},if(lt(t,${e - f}),1,if(lt(t,${e}),(${e}-t)/${f},0))))`;

async function buildIntro(cfg, out) {
  const { width: W, height: H } = cfg.trailer.video;
  const intro = cfg.trailer.intro;
  const scale = intro.mode === 'fit' ? `scale=-2:${H}:flags=lanczos+accurate_rnd+full_chroma_int,` : '';
  const vf = `${scale}pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${intro.background},setsar=1,format=yuv420p`;
  const af = `aresample=${cfg.trailer.audio.sampleRate}`;
  await run('ffmpeg', ['-y', '-hide_banner', '-i', cfg.paths.intro, '-map', '0:v:0', '-map', '0:a:0', '-vf', vf, '-af', af, ...encodeArgs(cfg.trailer, { crf: intro.crf }), out]);
}

async function buildGame(cfg, game, out, workDir) {
  const t = cfg.trailer;
  const { width: W, height: H, fps } = t.video;
  const seg = game.segment;
  const manifestFile = path.join(cfg.paths.capture, game.id, 'manifest.json');
  if (!fs.existsSync(manifestFile)) throw new Error(`no capture for ${game.id} — run npm run capture:${game.id}`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const shot = manifest.shots.find((s) => s.id === seg.shot && s.layout === seg.layout);
  if (!shot || shot.status === 'fail' || !shot.file) throw new Error(`${game.id}: shot ${seg.layout}/${seg.shot} has no usable recording (status ${shot?.status ?? 'missing'})`);
  const raw = path.join(cfg.paths.root, shot.file);
  const start = seg.fromSec;
  const capLen = (await probe(raw)).duration;
  let dur = seg.durationSec;
  if (start + dur > capLen - 0.2) {
    dur = +(capLen - 0.2 - start).toFixed(2);
    log.warn(`${game.id}: shot shorter than requested, segment trimmed to ${dur}s`);
  }
  if (dur < 3) throw new Error(`${game.id}: only ${dur}s usable after ${start}s in ${seg.shot}`);

  const fade = t.segments.fadeSec;
  const lt = t.segments.lowerThird;
  const wm = t.segments.watermark;
  const music = config.vendorPath(cfg, game, 'music');
  if (!fs.existsSync(music)) throw new Error(`${game.id}: music missing — run npm run fetch`);

  fs.mkdirSync(workDir, { recursive: true });
  const titleTxt = path.join(workDir, 'title.txt');
  const tagTxt = path.join(workDir, 'tagline.txt');
  fs.writeFileSync(titleTxt, game.title);
  fs.writeFileSync(tagTxt, game.tagline || '');

  const v = [`[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,fps=${fps},setsar=1`];
  if (lt.enabled) {
    const s = lt.showFromSec;
    const e = Math.min(s + lt.showForSec, dur - fade);
    const a = fadeAlpha(s, e);
    const font = lt.fontFile.replace(/\\/g, '/').replace(/:/g, '\\:');
    v.push(`drawbox=x=0:y=ih-300:w=iw:h=220:color=black@0.55:t=fill:enable='between(t,${s},${e})'`);
    v.push(`drawtext=fontfile='${font}':textfile='${titleTxt}':fontsize=${lt.fontSize}:fontcolor=white:x=96:y=h-280:alpha='${a}'`);
    v.push(`drawtext=fontfile='${font}':textfile='${tagTxt}':fontsize=${lt.taglineSize}:fontcolor=white@0.85:x=98:y=h-170:alpha='${a}'`);
  }
  v.push(`fade=t=in:st=0:d=${fade},fade=t=out:st=${(dur - fade).toFixed(3)}:d=${fade}`);
  let graph = `${v.join(',')}[base]`;
  let vOut = '[base]';
  if (wm.enabled) {
    graph += `;[2:v]scale=${wm.widthPx}:-1:flags=lanczos,format=rgba,colorchannelmixer=aa=${wm.opacity}[wm];[base][wm]overlay=W-w-${wm.marginPx}:${wm.marginPx}:format=auto[vwm]`;
    vOut = '[vwm]';
  }
  graph += `;${vOut}format=yuv420p[v]`;
  const au = t.audio;
  const af = [`aformat=sample_rates=${au.sampleRate}:channel_layouts=stereo`, `volume=${t.segments.audio === 'music' ? au.musicVolume : 1}`];
  if (au.loudnorm.enabled) af.push(`loudnorm=I=${au.loudnorm.I}:TP=${au.loudnorm.TP}:LRA=${au.loudnorm.LRA}`, `aresample=${au.sampleRate}`);
  af.push(`afade=t=in:st=0:d=${fade}`, `afade=t=out:st=${(dur - fade * 2).toFixed(3)}:d=${fade * 2}`);
  const mode = t.segments.audio;
  const src = mode === 'music' ? '[1:a]' : '[0:a]';
  if (mode === 'mix') graph += `;[1:a]volume=${t.segments.musicUnderGame}[bed];[0:a][bed]amix=inputs=2:duration=first:normalize=0[pre];[pre]${af.join(',')}[a]`;
  else graph += `;${src}${af.join(',')}[a]`;

  const inputs = ['-ss', String(start), '-t', String(dur), '-i', raw, '-ss', String(game.assets.music.startSec || 0), '-t', String(dur), '-i', music];
  if (wm.enabled) inputs.push('-i', cfg.paths.logo);
  await run('ffmpeg', ['-y', '-hide_banner', ...inputs, '-filter_complex', graph, '-map', '[v]', '-map', '[a]', '-t', String(dur), ...encodeArgs(t), out]);
}

async function buildEndCard(cfg, out, workDir) {
  const t = cfg.trailer;
  const ec = t.endCard;
  const { width: W, height: H, fps } = t.video;
  const d = ec.durationSec;
  fs.mkdirSync(workDir, { recursive: true });
  const txt = path.join(workDir, 'endcard.txt');
  fs.writeFileSync(txt, ec.text);
  const font = t.segments.lowerThird.fontFile.replace(/:/g, '\\:');
  const graph = [
    `[1:v]scale=${ec.logoWidthPx}:-1:flags=lanczos[logo]`,
    `[0:v][logo]overlay=(W-w)/2:(H-h)/2-60,drawtext=fontfile='${font}':textfile='${txt}':fontsize=${ec.fontSize}:fontcolor=white@0.9:x=(w-text_w)/2:y=h/2+${Math.round(ec.logoWidthPx * 0.15) + 20},fade=t=in:st=0:d=0.6,fade=t=out:st=${d - 0.8}:d=0.8,format=yuv420p[v]`,
  ].join(';');
  await run('ffmpeg', ['-y', '-hide_banner', '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:r=${fps}:d=${d}`, '-i', cfg.paths.logo,
    '-f', 'lavfi', '-i', `anullsrc=r=${t.audio.sampleRate}:cl=stereo`, '-filter_complex', graph, '-map', '[v]', '-map', '2:a', '-t', String(d), ...encodeArgs(t), out]);
}

main(async () => {
  const a = args();
  const cfg = config.load();
  const games = config.selectGames(cfg, a.only);
  const work = path.join(cfg.paths.footage, '.work');
  fs.mkdirSync(work, { recursive: true });

  if (!a['games-only']) {
    if (cfg.trailer.intro.enabled) {
      log.info('studio intro');
      await buildIntro(cfg, path.join(cfg.paths.footage, '00-intro.mp4'));
      log.ok('footage/00-intro.mp4');
    }
    if (cfg.trailer.endCard.enabled) {
      log.info('end card');
      await buildEndCard(cfg, path.join(cfg.paths.footage, '99-endcard.mp4'), work);
      log.ok('footage/99-endcard.mp4');
    }
  }
  const failures = [];
  for (const g of games) {
    const idx = cfg.trailer.segments.order.indexOf(g.id) + 1;
    const name = `${String(idx).padStart(2, '0')}-${g.id}.mp4`;
    log.info(`segment ${g.id}`);
    try {
      await buildGame(cfg, g, path.join(cfg.paths.footage, name), path.join(work, g.id));
      log.ok(`footage/${name}`);
    } catch (e) {
      log.err(`${g.id}: ${e.message}`);
      failures.push(g.id);
    }
  }
  if (failures.length) throw new Error(`segment build failed for: ${failures.join(', ')}`);
});
