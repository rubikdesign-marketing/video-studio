// Stopping a program and everything it started, on every OS.
// Windows has no process groups: taskkill /T walks the tree. Elsewhere a child started with { detached: true } leads its own
// group, so a negative pid reaches all of it; a child that is not a group leader is stopped on its own.
import { spawnSync } from 'node:child_process';

/** killTree(child) stops the child and its descendants. signal is ignored on Windows (taskkill /F is always forceful). */
export function killTree(child, signal = 'SIGTERM') {
  const pid = typeof child === 'number' ? child : child?.pid;
  if (!pid) return false;
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); return true; } catch { return false; }
  }
  try { process.kill(-pid, signal); return true; } catch {}
  try { process.kill(pid, signal); return true; } catch { return false; }
}

/** Options that make a child lead its own process group where that exists (everywhere but Windows, where a detached child
 *  would open its own console window). Pair with killTree. */
export const groupLeader = () => (process.platform === 'win32' ? { windowsHide: true } : { detached: true });
