'use strict';
// FFmpeg recorder: X11 screen (x11grab) + PulseAudio monitor into one Matroska file.
// Video: x264 ultrafast at near-lossless CRF so a 4-core machine keeps up with 1080p60.
// Audio: 48 kHz stereo PCM, untouched. Stopped gracefully with "q" on stdin.
const { spawn } = require('child_process');

class Recorder {
  constructor({ display, width, height, fps, audio, out, crf = 8 }) {
    Object.assign(this, { display, width, height, fps, audio, out, crf });
    this.stderr = '';
  }

  args() {
    const a = ['-hide_banner', '-loglevel', 'info', '-y',
      '-f', 'x11grab', '-framerate', String(this.fps), '-video_size', `${this.width}x${this.height}`, '-draw_mouse', '0',
      '-thread_queue_size', '4096', '-i', `${this.display}.0+0,0`];
    if (this.audio) a.push('-f', 'pulse', '-thread_queue_size', '4096', '-sample_rate', '48000', '-channels', '2', '-server', this.audio.server, '-i', this.audio.monitor);
    a.push('-map', '0:v');
    if (this.audio) a.push('-map', '1:a', '-c:a', 'pcm_s16le');
    a.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', String(this.crf), '-pix_fmt', 'yuv420p', '-g', String(this.fps), '-stats_period', '0.5', this.out);
    return a;
  }

  /** Resolves once FFmpeg reports its first encoded frame. */
  start(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      this.proc = spawn('ffmpeg', this.args(), { stdio: ['pipe', 'ignore', 'pipe'] });
      this.startedAt = null;
      const timer = setTimeout(() => reject(new Error(`recorder did not start within ${timeoutMs} ms:\n${this.stderr.slice(-800)}`)), timeoutMs);
      this.proc.stderr.on('data', (d) => {
        this.stderr = (this.stderr + d).slice(-20000);
        if (!this.startedAt && /frame=\s*[1-9]/.test(String(d))) {
          this.startedAt = Date.now();
          clearTimeout(timer);
          resolve(this.startedAt);
        }
      });
      this.proc.on('exit', (code) => {
        this.exitCode = code;
        if (!this.startedAt) { clearTimeout(timer); reject(new Error(`ffmpeg exited ${code} before recording:\n${this.stderr.slice(-800)}`)); }
      });
    });
  }

  /** Seconds since the first recorded frame (for shot event timestamps). */
  elapsed() {
    return this.startedAt ? +((Date.now() - this.startedAt) / 1000).toFixed(3) : 0;
  }

  stop(timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      if (!this.proc || this.exitCode !== undefined) return resolve(this.exitCode);
      const timer = setTimeout(() => { this.proc.kill('SIGKILL'); reject(new Error('recorder did not stop; killed')); }, timeoutMs);
      this.proc.on('exit', (code) => { clearTimeout(timer); code === 0 || code === 255 ? resolve(code) : reject(new Error(`ffmpeg exited ${code}:\n${this.stderr.slice(-800)}`)); });
      try { this.proc.stdin.write('q'); this.proc.stdin.end(); } catch { this.proc.kill('SIGINT'); }
    });
  }
}

module.exports = { Recorder };
