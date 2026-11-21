// Minimal MCP server over newline-delimited JSON-RPC 2.0. No packages. Only JSON-RPC replies go to the output stream.
import { StringDecoder } from 'node:string_decoder';

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const reply = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
const messageOf = (e) => (e instanceof Error ? e.message : String(e)) || 'Something went wrong.';

export function createServer({ name, version, tools, handlers }) {
  const call = (params) => {
    const toolName = params && typeof params.name === 'string' ? params.name : '';
    if (!toolName || !own(handlers, toolName) || typeof handlers[toolName] !== 'function') {
      return { content: [{ type: 'text', text: `Unknown tool ${toolName}` }], isError: true };
    }
    const args = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};
    try {
      const out = handlers[toolName](args);
      return { content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out };
    } catch (e) {
      return { content: [{ type: 'text', text: messageOf(e) }], isError: true };
    }
  };

  function handle(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) return fail(null, -32600, 'Invalid request');
    if (!own(message, 'id')) return null; // a notification never gets a reply
    const { id, method, params } = message;
    if (typeof method !== 'string') return fail(id, -32600, 'Invalid request');
    switch (method) {
      case 'initialize': {
        const asked = params && params.protocolVersion;
        return reply(id, { protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0], capabilities: { tools: {} }, serverInfo: { name, version } });
      }
      case 'ping': return reply(id, {});
      case 'tools/list': return reply(id, { tools });
      case 'tools/call': return reply(id, call(params));
      default: return fail(id, -32601, `Method not found: ${method}`);
    }
  }
  return { handle };
}

export function serveStdio(server, input = process.stdin, output = process.stdout) {
  const decoder = new StringDecoder('utf8');
  let buffer = '';
  const send = (obj) => output.write(JSON.stringify(obj) + '\n');
  const line = (text) => {
    if (!text.trim()) return;
    let message;
    try { message = JSON.parse(text); } catch { send(fail(null, -32700, 'Parse error')); return; }
    let out;
    try { out = server.handle(message); } catch (e) { out = fail(message && message.id !== undefined ? message.id : null, -32603, messageOf(e)); }
    if (out) send(out);
  };
  input.on('data', (chunk) => {
    buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk);
    let i;
    while ((i = buffer.indexOf('\n')) >= 0) { const l = buffer.slice(0, i); buffer = buffer.slice(i + 1); line(l); }
  });
  input.on('end', () => { buffer += decoder.end(); const l = buffer; buffer = ''; line(l); });
}
