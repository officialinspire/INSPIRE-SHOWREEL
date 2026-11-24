'use strict';
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

const color = (c) => (s) => (process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s);
const log = {
  info: (...a) => console.log(color(36)('•'), ...a),
  ok: (...a) => console.log(color(32)('✔'), ...a),
  warn: (...a) => console.warn(color(33)('!'), ...a),
  err: (...a) => console.error(color(31)('✖'), ...a),
  step: (s) => console.log(`\n${color(1)(s)}`),
};

/** Parse --flag, --key=value and --only=a,b */
function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (const a of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    if (!m) out._.push(a);
    else out[m[1]] = m[2] === undefined ? true : m[2];
  }
  out.only = typeof out.only === 'string' ? out.only.split(',').filter(Boolean) : [];
  return out;
}

/** Run a command, stream stderr only when verbose, reject with the tail of stderr on failure. */
function run(cmd, argv, { verbose = !!process.env.SHOWREEL_VERBOSE, cwd } = {}) {
  return new Promise((resolve, reject) => {
    if (verbose) log.info(`$ ${cmd} ${argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    const p = spawn(cmd, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => {
      err += d;
      if (verbose) process.stderr.write(d);
    });
    p.on('error', (e) => reject(new Error(`${cmd} could not start: ${e.message}`)));
    p.on('close', (code) => {
      if (code === 0) resolve({ out, err });
      else reject(new Error(`${cmd} exited ${code}\n${err.split('\n').slice(-15).join('\n')}`));
    });
  });
}

function which(cmd) {
  const r = spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function main(fn) {
  fn().catch((e) => {
    log.err(e.message);
    process.exit(1);
  });
}

module.exports = { log, args, run, which, sha256File, main };
