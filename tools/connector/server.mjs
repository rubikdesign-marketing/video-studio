// Entry point the studio's .mcp.json starts: node tools/connector/server.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS, makeHandlers } from './lib/tools.mjs';
import { createServer, serveStdio } from './lib/rpc.mjs';

const root = process.env.DAMEX_STUDIO_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let version = '0.0.0';
try { const v = JSON.parse(fs.readFileSync(path.join(root, 'RELEASE.json'), 'utf8')).version; if (typeof v === 'string' && v) version = v; } catch { /* no release file */ }

serveStdio(createServer({ name: 'damex-engine', version, tools: TOOLS, handlers: makeHandlers(root) }));
process.stderr.write(`damex-engine ${version} ready\n`);
