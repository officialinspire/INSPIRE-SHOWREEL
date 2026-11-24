'use strict';
// Virtual display (Xvfb) and virtual sound card (PulseAudio null sink) for headed capture.
// Chromium renders into the Xvfb screen and plays into the null sink; FFmpeg grabs both.
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, what) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (fn()) return;
    await sleep(100);
  }
  throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
}

function freeDisplay(start = 90) {
  for (let n = start; n < start + 60; n++) {
    if (!fs.existsSync(`/tmp/.X11-unix/X${n}`) && !fs.existsSync(`/tmp/.X${n}-lock`)) return n;
  }
  throw new Error('no free X display number');
}

/** Start Xvfb with an exact screen size. Returns { display: ':N', width, height, stop() }. */
async function startDisplay({ width, height }) {
  const n = freeDisplay();
  const proc = spawn('Xvfb', [`:${n}`, '-screen', '0', `${width}x${height}x24`, '-nolisten', 'tcp', '-ac', '+extension', 'RANDR', '-dpi', '96'], { stdio: 'ignore' });
  let exited = null;
  proc.on('exit', (code) => (exited = code));
  await waitFor(() => exited !== null || fs.existsSync(`/tmp/.X11-unix/X${n}`), 10000, `Xvfb :${n}`);
  if (exited !== null) throw new Error(`Xvfb :${n} exited with code ${exited}`);
  return {
    display: `:${n}`, width, height,
    stop: async () => { proc.kill('SIGTERM'); await sleep(200); },
  };
}

/** Start a private PulseAudio server with a 48 kHz stereo null sink as default output. */
async function startAudio({ sampleRate = 48000 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'showreel-pulse-'));
  const socket = path.join(dir, 'native');
  const sink = 'showreel';
  const env = { ...process.env, PULSE_RUNTIME_PATH: dir, PULSE_STATE_PATH: dir, HOME: process.env.HOME || dir };
  const proc = spawn('pulseaudio', [
    '--daemonize=no', '--exit-idle-time=-1', '--disallow-exit', '-n', '--use-pid-file=no', '--log-target=stderr', '--log-level=error',
    `--load=module-native-protocol-unix socket=${socket} auth-anonymous=1`,
    `--load=module-null-sink sink_name=${sink} rate=${sampleRate} channels=2 sink_properties=device.description=showreel`,
    '--load=module-always-sink',
  ], { env, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  let exited = null;
  proc.stderr.on('data', (d) => (stderr += d));
  proc.on('exit', (code) => (exited = code));
  const server = `unix:${socket}`;
  await waitFor(() => exited !== null || fs.existsSync(socket), 10000, 'PulseAudio socket');
  if (exited !== null) throw new Error(`pulseaudio exited (${exited}): ${stderr.trim().split('\n').pop()}`);
  const r = spawnSync('pactl', ['set-default-sink', sink], { env: { ...env, PULSE_SERVER: server }, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`pactl set-default-sink failed: ${r.stderr}`);
  return {
    server, sink, monitor: `${sink}.monitor`, sampleRate,
    stop: async () => { proc.kill('SIGTERM'); await sleep(200); fs.rmSync(dir, { recursive: true, force: true }); },
  };
}

module.exports = { startDisplay, startAudio, sleep };
