// Which model aliases the settings allow. Reads settings only; never writes them.
// Files, in order: ~/.claude/settings.json, ROOT/.claude/settings.json, ROOT/.claude/settings.local.json, managed settings.
// CONDUCTOR_SETTINGS_FILES (separated by |; prefix a path with "managed:") replaces that list, for tests. Set but empty means none.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, policy } from './util.mjs';

const MANAGED = {
  darwin: '/Library/Application Support/ClaudeCode/managed-settings.json',
  linux: '/etc/claude-code/managed-settings.json',
};

export function settingsFiles(env = process.env) {
  if (env.CONDUCTOR_SETTINGS_FILES !== undefined) {
    return env.CONDUCTOR_SETTINGS_FILES.split('|').filter(Boolean).map((p) => (p.startsWith('managed:') ? { file: p.slice(8), managed: true } : { file: p, managed: false }));
  }
  const files = [
    { file: path.join(os.homedir(), '.claude', 'settings.json'), managed: false },
    { file: path.join(ROOT, '.claude', 'settings.json'), managed: false },
    { file: path.join(ROOT, '.claude', 'settings.local.json'), managed: false },
  ];
  const m = MANAGED[process.platform];
  if (m) {
    files.push({ file: m, managed: true });
    try { for (const n of fs.readdirSync(`${path.dirname(m)}/managed-settings.d`).sort()) if (n.endsWith('.json')) files.push({ file: `${path.dirname(m)}/managed-settings.d/${n}`, managed: true }); } catch {}
  }
  return files;
}

/** { lead, lists: [{source, managed, entries}], denied: [{source, entries}], read: [files found] } */
export function loadSettings(env = process.env) {
  const out = { lead: null, leadFrom: null, lists: [], denied: [], read: [] };
  const merged = { source: [], entries: [] };
  for (const { file, managed } of settingsFiles(env)) {
    let s; try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
    out.read.push(file);
    if (typeof s.model === 'string') { out.lead = s.model; out.leadFrom = file; }
    if (Array.isArray(s.availableModels)) {
      if (managed) out.lists.push({ source: file, managed, entries: s.availableModels });
      else { merged.source.push(file); merged.entries.push(...s.availableModels); }
    }
    if (Array.isArray(s.deniedModels)) out.denied.push({ source: file, entries: s.deniedModels });
  }
  // Non-managed lists merge (documented); a managed list is a separate constraint on top.
  if (merged.entries.length) out.lists.unshift({ source: merged.source.join(', '), managed: false, entries: merged.entries });
  return out;
}

// An entry matches an alias when it is the alias or a full model id naming that family (claude-haiku-4-5 matches haiku).
const matches = (entry, alias) => { const e = String(entry).toLowerCase(); const a = alias.toLowerCase(); return e === a || e.split(/[^a-z0-9]+/).includes(a); };

/** { alias, allowed, reason, source } for one alias. "lead" and "inherit" follow the session and are never blocked here. */
export function modelStatus(alias, settings = loadSettings()) {
  if (!alias || alias === 'lead' || alias === 'inherit') return { alias, allowed: true, reason: 'follows the session model' };
  for (const d of settings.denied) if (d.entries.some((e) => matches(e, alias))) return { alias, allowed: false, reason: `listed in deniedModels (${d.source})`, source: d.source };
  for (const l of settings.lists) if (!l.entries.some((e) => matches(e, alias))) return { alias, allowed: false, reason: `not in availableModels [${l.entries.join(', ')}] (${l.source})`, source: l.source };
  return { alias, allowed: true, reason: settings.lists.length ? 'in availableModels' : 'no availableModels restriction found' };
}

export function report(settings = loadSettings()) {
  const aliases = [...new Set(Object.values(policy().agents).map((a) => a.model))].sort();
  return { lead: settings.lead, leadFrom: settings.leadFrom, files: settings.read, aliases: aliases.map((a) => modelStatus(a, settings)), workers: Object.entries(policy().agents).map(([name, a]) => ({ name, ...modelStatus(a.model, settings) })) };
}
