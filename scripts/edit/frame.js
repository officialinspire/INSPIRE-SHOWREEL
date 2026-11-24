'use strict';
// Reframing: puts a capture into a target canvas without blind cropping.
//   full  the capture already matches the canvas aspect (scaled only)
//   fit   the whole capture scaled into the canvas over a blurred, darkened copy (nothing cut off)
//   crop  a verified region [x, y, w, h] of the source that holds the action, scaled to the canvas
// Then a gentle push-in (motion), vignette and fades.

function reframe(input, { width: W, height: H }, fr, label) {
  const out = `${label}_fr`;
  if (fr.mode === 'crop') {
    const [x, y, w, h] = fr.rect;
    return { graph: `${input}crop=${w}:${h}:${x}:${y},scale=${W}:${H}:flags=lanczos,setsar=1[${out}]`, out: `[${out}]` };
  }
  if (fr.mode === 'fit') {
    const z = fr.zoom || 1;
    return {
      graph: [
        `${input}split=2[${label}_a][${label}_b]`,
        `[${label}_a]scale=${W}:${H}:force_original_aspect_ratio=increase:flags=bilinear,crop=${W}:${H},boxblur=28:3,eq=brightness=-0.22:saturation=0.75[${label}_bg]`,
        `[${label}_b]scale='trunc(min(${W}/iw,${H}/ih)*${z}*iw/2)*2':-2:flags=lanczos[${label}_fg]`,
        `[${label}_bg][${label}_fg]overlay=(W-w)/2:(H-h)/2,setsar=1[${out}]`,
      ].join(';'),
      out: `[${out}]`,
    };
  }
  return { graph: `${input}scale=${W}:${H}:flags=lanczos,setsar=1[${out}]`, out: `[${out}]` };
}

/** Push-in over the clip (scale grows by `amount`), re-cropped to the canvas; vignette; fades. */
function finish(input, { width: W, height: H }, { durSec, pushIn = 0, pulse = null, vignette = 0, fadeIn = 0, fadeOut = 0, fadeInColor = 'black', fps }, label) {
  const f = [];
  // Zoom = slow push-in, plus (montage) a short pulse on every beat: clips start on beat lines,
  // so mod(t, beat) is the time since the last beat of the music.
  const pulseTerm = pulse && pulse.amount > 0 ? `+${pulse.amount}*exp(-mod(t,${pulse.beat.toFixed(5)})/${pulse.decay})` : '';
  if (pushIn > 0 || pulseTerm) f.push(`scale=w='trunc(${W}*(1+${pushIn}*t/${durSec.toFixed(4)}${pulseTerm})/2)*2':h=-2:eval=frame:flags=bicubic`, `crop=${W}:${H}`);
  if (vignette > 0) f.push(`vignette=angle=${vignette}`);
  // Clone the last frame if a source runs short, so every intermediate has its exact frame count.
  f.push(`fps=${fps}`, 'tpad=stop_mode=clone:stop_duration=0.5', 'format=yuv420p');
  if (fadeIn > 0) f.push(`fade=t=in:st=0:d=${fadeIn}:color=${fadeInColor}`);
  if (fadeOut > 0) f.push(`fade=t=out:st=${(durSec - fadeOut).toFixed(4)}:d=${fadeOut}`);
  return { graph: `${input}${f.join(',')}[${label}_fin]`, out: `[${label}_fin]` };
}

module.exports = { reframe, finish };
