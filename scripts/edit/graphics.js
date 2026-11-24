'use strict';
// Motion graphics for FFmpeg: animated game titles, montage labels and the end card.
// Text is drawtext (Inter Display, the INSPIRE-style heavy italic) with eased slide + fade
// expressions; accent bars and scrims are generated colour sources overlaid with per-frame
// positions (drawbox sizes are not animatable). All text goes through textfiles (no escaping).
const fs = require('fs');
const path = require('path');

const ease = (ts, d) => `(1-pow(1-min(max((t-${ts})/${d},0),1),3))`;
const alpha = (ts, te, fi = 0.25, fo = 0.3) => `if(lt(t,${ts}),0,if(lt(t,${ts + fi}),(t-${ts})/${fi},if(lt(t,${te - fo}),1,if(lt(t,${te}),(${te}-t)/${fo},0))))`;
const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

class Layer {
  constructor(work, id) { this.work = work; this.id = id; this.inputs = []; this.n = 0; this.steps = []; }
  text(s) { const f = path.join(this.work, `${this.id}-t${this.n++}.txt`); fs.writeFileSync(f, s); return esc(f); }
  /** Extra lavfi input (colour bar / gradient) or file input; returns its input index offset (resolved later). */
  input(args) { this.inputs.push(args); return this.inputs.length - 1; }
}

/** Fit a single line of heavy display text inside maxW (Inter Display Black ~0.62 em/char average). */
/** Platform-safe area for a format ({top,bottom,left,right} as fractions); from the EDL format. */
const safeOf = (fmt) => fmt.safe || (fmt.width > fmt.height ? { top: 0.05, bottom: 0.08, left: 0.05, right: 0.05 } : fmt.width === fmt.height ? { top: 0.06, bottom: 0.1, left: 0.06, right: 0.06 } : { top: 0.14, bottom: 0.22, left: 0.06, right: 0.16 });

const fitSize = (text, size, maxW) => Math.floor(Math.min(size, maxW / (Math.max(4, text.length) * 0.62)));

function drawText(L, { font, text, size, color = '0xFFFFFF', x, y, a, shadow = true, borderw = 0 }) {
  const f = `fontfile='${esc(font)}':textfile='${L.text(text)}':fontsize=${size}:fontcolor=${color}:x='${x}':y='${y}':alpha='${a}'`;
  const sh = shadow ? `:shadowcolor=black@0.55:shadowx=${Math.max(2, Math.round(size / 28))}:shadowy=${Math.max(2, Math.round(size / 28))}` : '';
  return `drawtext=${f}${sh}${borderw ? `:borderw=${borderw}:bordercolor=black@0.6` : ''}`;
}

/** Where titles go: in 'fit' framing, below the picture band (in the blurred fill); else lower third. */
function titleY(fmt, fr) {
  const { width: W, height: H } = fmt;
  if (fr.mode === 'fit') {
    const band = Math.min(H, W * (9 / 16) * (fr.zoom || 1));
    return Math.round((H + band) / 2 + H * 0.035);
  }
  return Math.round(H * (W > H ? 0.66 : W === H ? 0.62 : 0.6));
}

/**
 * Title card overlay for the first clip of a section.
 * Returns { filters: [...] (applied to the clip chain), overlays: [{input, x, y}] }.
 */
function sectionTitle(L, fmt, fr, brand, title, { start, hold, beat }) {
  const { width: W, height: H } = fmt;
  const S = Math.min(W, H);
  const safe = safeOf(fmt);
  const x0 = Math.round(Math.max(W > H ? W * 0.055 : W * 0.07, W * safe.left));
  const size = fitSize(title.text, S * (W > H ? 0.088 : 0.092), W - x0 - W * safe.right);
  const sub = Math.round(size * 0.36);
  // Keep the whole block (kicker, bar, title, tagline) inside the safe area.
  const y = Math.round(Math.min(Math.max(titleY(fmt, fr), H * safe.top + size * 0.9), H * (1 - safe.bottom) - size * 1.65));
  const te = start + hold;
  const out = { filters: [], overlays: [] };
  // Readability scrim (full-frame framings only; 'fit' text already sits on the darkened fill).
  if (fr.mode !== 'fit') {
    const sh = Math.round(size * 3.2);
    const i = L.input(['-f', 'lavfi', '-i', `color=c=black:s=${W}x${sh}:r=60,format=rgba,geq=r=0:g=0:b=0:a='150*pow(sin(PI*Y/H),1.4)',fade=t=in:st=${start}:d=0.3:alpha=1,fade=t=out:st=${te - 0.3}:d=0.3:alpha=1`]);
    out.overlays.push({ input: i, x: '0', y: String(y - Math.round(size * 1.05)) });
  }
  // Accent bar slides in from the left just above the title.
  const bw = Math.round(size * 1.6);
  const bi = L.input(['-f', 'lavfi', '-i', `color=c=${title.accent || brand.accent}:s=${bw}x${Math.max(5, Math.round(size / 14))}:r=60,format=rgba,fade=t=in:st=${start}:d=0.2:alpha=1,fade=t=out:st=${te - 0.3}:d=0.3:alpha=1`]);
  out.overlays.push({ input: bi, x: `${x0}-${bw}*(1-${ease(start, 0.45)})`, y: String(y - Math.round(size * 0.32)) });
  if (title.kicker) {
    out.filters.push(drawText(L, { font: brand.fontSub, text: title.kicker, size: Math.round(sub * 0.82), color: '0xFFFFFF@0.85', x: `${x0}`, y: `${y - Math.round(size * 0.32) - Math.round(sub * 1.5)}`, a: alpha(start + 0.1, te) }));
  }
  out.filters.push(drawText(L, { font: brand.font, text: title.text, size, x: `${x0}-60*(1-${ease(start + 0.05, 0.5)})`, y: `${y}`, a: alpha(start + 0.05, te) }));
  if (title.tagline) out.filters.push(drawText(L, { font: brand.fontSub, text: title.tagline.toUpperCase(), size: sub, color: '0xFFFFFF@0.92', x: `${x0}-40*(1-${ease(start + beat * 0.5, 0.5)})`, y: `${y + Math.round(size * 1.12)}`, a: alpha(start + beat * 0.5, te) }));
  return out;
}

/** Small persistent game label for montage cuts. */
function montageLabel(L, fmt, fr, brand, label, durSec) {
  const { width: W, height: H } = fmt;
  const S = Math.min(W, H);
  const size = Math.round(S * 0.042);
  const safe = safeOf(fmt);
  const x0 = Math.round(Math.max(W * 0.05, W * safe.left));
  const y = Math.round(Math.min(fr.mode === 'fit' ? titleY(fmt, fr) : H - S * 0.12, H * (1 - safe.bottom) - size * 1.3));
  const bi = L.input(['-f', 'lavfi', '-i', `color=c=${label.accent || brand.accent}:s=${Math.max(5, Math.round(size / 6))}x${Math.round(size * 1.05)}:r=60,format=rgba,fade=t=in:st=0.05:d=0.12:alpha=1`]);
  return {
    filters: [drawText(L, { font: brand.font, text: label.text, size, x: `${x0 + Math.round(size * 0.45)}+18*(1-${ease(0.05, 0.25)})`, y: `${y}`, a: alpha(0.05, durSec + 1, 0.15, 0.1), borderw: 3 })],
    overlays: [{ input: bi, x: String(x0), y: String(y - Math.round(size * 0.05)) }],
  };
}

/** End card: blurred gameplay behind the INSPIRE logo and three staggered lines on the beat. */
function endCard(L, fmt, brand, lines, { beat, durSec, logoFile }) {
  const { width: W, height: H } = fmt;
  const S = Math.min(W, H);
  const safe = safeOf(fmt);
  const sx = Math.round(W * safe.left);
  const sw = Math.round(W * (1 - safe.left - safe.right));
  const cx = (expr) => `${sx}+(${sw}-${expr})/2`; // centre within the safe region
  const logoW = Math.round(Math.min(W > H ? W * 0.34 : W * 0.62, sw * 0.8));
  const logoH = Math.round(logoW * (181 / 600));
  const s1 = fitSize(lines[0], S * 0.085, sw * 0.96);
  const s2 = Math.round(s1 * 0.78);
  const s3 = Math.round(s1 * 0.42);
  const blockH = logoH + s1 * 1.3 + s2 * 1.3 + s3 * 1.6 + S * 0.08;
  const top = Math.round((H - blockH) / 2);
  const yLogo = top;
  const y1 = Math.round(yLogo + logoH + S * 0.06);
  const y2 = Math.round(y1 + s1 * 1.35);
  const y3 = Math.round(y2 + s2 * 1.45);
  const t1 = beat * 2, t2 = beat * 4, t3 = beat * 6, te = durSec + 1;
  const li = L.input(['-loop', '1', '-framerate', '60', '-t', String(durSec + 0.5), '-i', logoFile]);
  const ri = L.input(['-f', 'lavfi', '-i', `color=c=${brand.accent}:s=${Math.round(s1 * 2.2)}x${Math.max(5, Math.round(s1 / 12))}:r=60,format=rgba,fade=t=in:st=${t2 - 0.1}:d=0.3:alpha=1`]);
  return {
    // The logo is scaled in from 92% with a fade (pre-processed in its own chain).
    logo: { input: li, chain: `scale=w='trunc(${logoW}*(0.92+0.08*${ease(0.1, 0.9)})/2)*2':h=-2:eval=frame,format=rgba,fade=t=in:st=0.1:d=0.6:alpha=1`, x: cx('w'), y: `${yLogo}+(${logoH}-h)/2` },
    filters: [
      drawText(L, { font: brand.font, text: lines[0], size: s1, x: cx('text_w'), y: `${y1}+24*(1-${ease(t1, 0.5)})`, a: alpha(t1, te) }),
      drawText(L, { font: brand.font, text: lines[1], size: s2, color: brand.accent, x: cx('text_w'), y: `${y2}+20*(1-${ease(t2, 0.45)})`, a: alpha(t2, te) }),
      drawText(L, { font: brand.fontSub, text: lines[2], size: s3, color: '0xFFFFFF@0.9', x: cx('text_w'), y: `${y3}`, a: alpha(t3, te) }),
    ],
    overlays: [{ input: ri, x: cx('w'), y: String(y2 - Math.round(s1 * 0.32)) }],
  };
}

/** Small closing tag for highlights: logo + PLAY FREE · URL in the last seconds. */
function brandTag(L, fmt, brand, { start, durSec, logoFile, url }) {
  const { width: W, height: H } = fmt;
  const S = Math.min(W, H);
  const safe = safeOf(fmt);
  // Centred in the safe region (not the full frame), so platform icons never cover it.
  const sx = Math.round(W * safe.left);
  const sw = Math.round(W * (1 - safe.left - safe.right));
  const text = `PLAY FREE  ·  ${url}`;
  const size = Math.round(Math.min(S * 0.034, sw / (text.length * 0.6)));
  const lw = Math.round(Math.min(S * 0.26, sw * 0.6));
  const lh = Math.round(lw * (181 / 600));
  const y = Math.round(Math.min(H - S * 0.08, H * (1 - safe.bottom)) - lh - size * 1.8);
  const li = L.input(['-loop', '1', '-framerate', '60', '-t', String(durSec + 0.5), '-i', logoFile]);
  return {
    logo: { input: li, chain: `scale=${lw}:-2,format=rgba,fade=t=in:st=${start}:d=0.4:alpha=1`, x: `${sx}+(${sw}-w)/2`, y: String(y) },
    filters: [drawText(L, { font: brand.font, text, size, x: `${sx}+(${sw}-text_w)/2`, y: `${y + lh + Math.round(size * 0.6)}`, a: alpha(start + 0.25, durSec + 1), borderw: 2 })],
    overlays: [],
  };
}

module.exports = { Layer, sectionTitle, montageLabel, endCard, brandTag, titleY, safeOf };
