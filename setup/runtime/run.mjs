// Runs a child program with an argument array (never a shell), copies its output to the screen and to a log file,
// and stops it when the user presses Ctrl+C.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Child environment. Node's own downloads (Remotion's browser) ignore HTTPS_PROXY unless asked; Node 22.21+ can honour it. */
export function childEnv(base = process.env) {
  const proxied = base.HTTPS_PROXY || base.https_proxy || base.HTTP_PROXY || base.http_proxy;
  return proxied && !base.NODE_USE_ENV_PROXY ? { ...base, NODE_USE_ENV_PROXY: '1' } : base;
}

export function logDir() {
  const dir = process.env.DAMEX_LOG_DIR || path.join(os.tmpdir(), 'p2-logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Resolves { code, signal, logFile }. Never rejects for a non-zero exit. */
export function runLogged(cmd, args, { cwd, env, logName, quiet = false } = {}) {
  const logFile = path.join(logDir(), `${logName ?? path.basename(cmd)}.log`);
  const log = fs.createWriteStream(logFile, { flags: 'a' });
  log.write(`\n$ ${[cmd, ...args].join(' ')}   (cwd ${cwd ?? process.cwd()}, ${new Date().toISOString()})\n`);
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: childEnv(env ?? process.env), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const onSignal = () => { child.kill('SIGTERM'); };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    const pipe = (stream, sink) => stream.on('data', (chunk) => { log.write(chunk); if (!quiet) sink.write(chunk); });
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    child.on('error', (error) => {
      log.write(`spawn error: ${error.message}\n`);
      process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
      log.end(() => resolve({ code: 127, signal: null, logFile, error }));
    });
    child.on('close', (code, signal) => {
      process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
      log.end(() => resolve({ code, signal, logFile }));
    });
  });
}

/** Run and capture stdout (small outputs), no logging. */
export function capture(cmd, args, { cwd, env, timeout = 20000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '', err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', (error) => { clearTimeout(timer); resolve({ code: 127, out, err: err || error.message }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
  });
}
