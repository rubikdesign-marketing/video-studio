// The brief page's local connector (tools/connector/server.mjs) is registered in the studio's .mcp.json by the start
// step, with the absolute path of the Node that ran it (so the portable .runtime/node works) and the absolute path of
// the server. The health check starts it the same way and asks for its tools. A moved studio folder leaves the old
// paths in .mcp.json: the probe fails, and running the start step again rewrites them.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { STUDIO } from './resolve.mjs';

export const CONNECTOR_NAME = 'damex-engine';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Writes the connector's entry into <root>/.mcp.json, keeping every other server and key. */
export function registerConnector(root = STUDIO, nodePath = process.execPath) {
  const file = path.join(root, '.mcp.json');
  let config = {};
  if (fs.existsSync(file)) config = readJson(file);
  if (!config || typeof config !== 'object' || Array.isArray(config)) config = {};
  if (!config.mcpServers || typeof config.mcpServers !== 'object') config.mcpServers = {};
  const entry = { type: 'stdio', command: nodePath, args: [path.join(path.resolve(root), 'tools', 'connector', 'server.mjs')] };
  const before = config.mcpServers[CONNECTOR_NAME];
  if (before && JSON.stringify(before) === JSON.stringify(entry)) return 'unchanged';
  config.mcpServers[CONNECTOR_NAME] = entry;
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
  return before ? 'updated' : 'added';
}

/** Starts the registered connector, asks for its tools, stops it. Always resolves. */
export function probeConnector(root = STUDIO, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    let entry;
    try { entry = readJson(path.join(root, '.mcp.json')).mcpServers?.[CONNECTOR_NAME]; }
    catch (e) { return resolve({ ok: false, tools: [], error: `.mcp.json could not be read (${e.code ?? e.message})` }); }
    if (!entry || typeof entry.command !== 'string') return resolve({ ok: false, tools: [], error: `.mcp.json has no ${CONNECTOR_NAME} entry` });

    let child, done = false, buffer = '', stderr = '';
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { child?.kill(); } catch { /* already gone */ }
      resolve({ ok: false, tools: [], error: null, ...result });
    };
    const timer = setTimeout(() => finish({ error: `the connector did not answer within ${Math.round(timeoutMs / 1000 * 10) / 10} s (timed out)` }), timeoutMs);
    const send = (msg) => { try { child.stdin.write(JSON.stringify(msg) + '\n'); } catch { /* exit handler reports it */ } };

    try {
      child = spawn(entry.command, entry.args ?? [], { cwd: root, env: { ...process.env, ...(entry.env ?? {}) }, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    } catch (e) { return finish({ error: `the connector would not start (${e.message})` }); }
    child.on('error', (e) => finish({ error: `the connector would not start (${e.code ?? e.message})` }));
    child.on('exit', (code) => finish({ error: `the connector stopped (exit ${code})${stderr.trim() ? `: ${stderr.trim().split('\n')[0].slice(0, 200)}` : ''}` }));
    child.stdin.on('error', () => { /* exit handler reports it */ });
    child.stderr.on('data', (d) => { stderr += d; if (stderr.length > 4000) stderr = stderr.slice(-4000); });
    child.stdout.on('data', (d) => {
      buffer += d;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, i).trim();
        buffer = buffer.slice(i + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { return finish({ error: 'the connector answered with something that is not JSON' }); }
        if (msg.id === 1) {
          if (msg.error) return finish({ error: `the connector refused to start: ${msg.error.message ?? 'unknown'}` });
          send({ jsonrpc: '2.0', method: 'notifications/initialized' });
          send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
        } else if (msg.id === 2) {
          const tools = msg.result?.tools;
          if (!Array.isArray(tools) || !tools.length) return finish({ error: 'the connector lists no tools' });
          return finish({ ok: true, tools: tools.map((t) => t.name) });
        }
      }
    });
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'damex-doctor', version: '1' } } });
  });
}
