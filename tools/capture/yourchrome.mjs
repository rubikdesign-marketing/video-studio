// Reaches the person's own Google Chrome through Microsoft's Playwright Extension (Chrome Web Store, free, Apache 2.0),
// the way Playwright MCP's --extension mode does. Used by capture.mjs only.
//
// How it works:
// 1. A small relay starts on this Mac only (127.0.0.1, a random port and a random address nobody can guess).
// 2. The person's Chrome is asked to open the extension's own "connect" page, which points at the relay.
// 3. The person picks a tab there ("Allow & select"). The extension then talks to the relay, and the relay speaks the
//    Chrome DevTools Protocol to Playwright, so the capture tool drives Chrome the usual way.
// 4. The relay never takes over the tab the person picked. It asks the extension for a new tab of its own, next to
//    it, and drives only that tab and any pop-up that tab opens. The extension itself only ever offers the relay the
//    tabs it has been allowed (it filters everything else out), so the person's other tabs, bookmarks, history,
//    passwords and cookies are never seen.
// 5. At the end the tool closes its own tab and the relay; the extension lets go of Chrome.
//
// The relay follows Playwright's own (packages/playwright-core/src/tools/mcp/cdpRelay.ts and browserModel.ts,
// Microsoft, Apache 2.0), extension protocol version 2, with two changes: the picked tab is never attached, and a
// page may have extra DevTools sessions (the tool's picture feed), which Playwright's relay does not offer.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

export const EXTENSION_ID = 'mmlmfjhmonkocbjadbfplnigmagldckm';
export const EXTENSION_STORE = `https://chromewebstore.google.com/detail/playwright-extension/${EXTENSION_ID}`;
export const PROTOCOL = 2;
// The person's own Chrome: DAMEX_CHROME first, then the usual install places per OS (same list as capture.mjs),
// including a per-user install on Windows and google-chrome-stable / Chromium on Linux.
const CHROME_CANDIDATES = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', path.join(os.homedir(), 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome')],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  win32: [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean).map((base) => path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe')),
}[process.platform] ?? [];
export const CHROME_BIN = [process.env.DAMEX_CHROME, ...CHROME_CANDIDATES].filter(Boolean).find((p) => fs.existsSync(p)) ?? CHROME_CANDIDATES[0];

const PICTURE_EVENTS = new Set(['Page.screencastFrame', 'Page.screencastVisibilityChanged']);

export class Relay {
  constructor({ log = () => {} } = {}) {
    const id = randomUUID();
    Object.assign(this, {
      log,
      extPath: `/extension/${id}`,
      cdpPath: `/cdp/${id}`,
      ext: null,
      cdp: null,
      pending: new Map(),
      lastId: 0,
      picked: null, // the tab the person picked in the extension: never attached, never driven
      sessions: new Map(), // tabId -> { tabId, sessionId, targetInfo, children: Set, side: Set }
      owners: new Map(), // any session id -> tabId (main and extra sessions)
      own: new Set(), // tabs the tool opened (and pop-ups they opened): the only tabs it drives
      autoAttach: false,
      next: 1,
      closedReason: null,
    });
    this.ready = new Promise((resolve, reject) => { this.resolveReady = resolve; this.rejectReady = reject; });
    this.ready.catch(() => {});
  }

  async start() {
    const { wsServer: WebSocketServer } = require('playwright-core/lib/utilsBundle');
    this.server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise((resolve, reject) => { this.server.once('listening', resolve); this.server.once('error', reject); });
    this.port = this.server.address().port;
    this.server.on('connection', (ws, req) => {
      const where = new URL(req.url, 'http://127.0.0.1').pathname;
      if (where === this.extPath) this.onExtension(ws);
      else if (where === this.cdpPath) this.onPlaywright(ws);
      else ws.close(1000, 'Unknown address');
    });
  }

  get cdpUrl() { return `ws://127.0.0.1:${this.port}${this.cdpPath}`; }

  /** The extension's own page, in the person's Chrome, that asks which tab to allow. */
  connectPage(clientName) {
    const url = new URL(`chrome-extension://${EXTENSION_ID}/connect.html`);
    url.searchParams.set('mcpRelayUrl', `ws://127.0.0.1:${this.port}${this.extPath}`);
    url.searchParams.set('client', JSON.stringify({ name: clientName }));
    url.searchParams.set('protocolVersion', String(PROTOCOL));
    return url.href;
  }

  /**
   * Asks the person's Chrome to open the connect page: the running Chrome gets it as a new tab (or Chrome starts).
   * Nothing is read from the person's Chrome folder. `profile` is a Chrome profile folder name, like "Profile 2".
   */
  openConnectPage(clientName, { profile = null, userDataDir = null } = {}) {
    const args = [];
    if (userDataDir) args.push(`--user-data-dir=${userDataDir}`); // only for the studio's own tests, never the person's folder
    if (profile) args.push(`--profile-directory=${profile}`);
    args.push(this.connectPage(clientName));
    const child = spawn(CHROME_BIN, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  }

  // ------------------------------------------------------------------ the extension's side

  onExtension(ws) {
    if (this.ext) { ws.close(1000, 'Another extension connection already established'); return; }
    this.ext = ws;
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch { ws.close(); return; }
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(typeof msg.error === 'string' ? msg.error : msg.error.message ?? 'extension error'));
        else p.resolve(msg.result);
      } else if (msg.method) this.onExtensionEvent(msg.method, msg.params ?? []);
    });
    ws.on('close', (code, reason) => {
      const why = String(reason || 'the extension let go');
      this.closedReason ??= why;
      for (const p of this.pending.values()) p.reject(new Error(`The extension disconnected: ${why}`));
      this.pending.clear();
      this.rejectReady(new Error(`The extension disconnected before it was ready: ${why}`));
      if (this.cdp?.readyState === 1) this.cdp.close(1000, `Extension disconnected: ${why}`);
    });
    ws.on('error', () => {});
  }

  toExtension(method, params) {
    if (!this.ext || this.ext.readyState !== 1) return Promise.reject(new Error('The Playwright Extension is not connected'));
    const id = ++this.lastId;
    this.ext.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  onExtensionEvent(method, params) {
    switch (method) {
      case 'extension.initialized': this.resolveReady(); break;
      case 'chrome.tabs.onCreated': {
        const [tab] = params;
        if (tab?.id === undefined) break;
        // The first tab the extension offers is the one the person picked: it is only the door, never driven.
        if (!this.picked) { this.picked = tab; break; }
        // Later ones are pop-ups or new tabs opened by a tab the tool drives (the extension only reports those).
        if (this.own.has(tab.openerTabId)) {
          this.own.add(tab.id);
          if (this.autoAttach) this.attach(tab.id).catch(() => {});
        }
        break;
      }
      case 'chrome.tabs.onRemoved': this.detached(params[0]); break;
      case 'chrome.debugger.onDetach': this.detached(params[0]?.tabId); break;
      case 'chrome.debugger.onEvent': {
        const [source, cdpMethod, cdpParams] = params;
        const s = this.sessions.get(source?.tabId);
        if (!s) break;
        const child = cdpParams?.sessionId;
        if (cdpMethod === 'Target.attachedToTarget' && child) { s.children.add(child); this.owners.set(child, s.tabId); }
        if (cdpMethod === 'Target.detachedFromTarget' && child) { s.children.delete(child); this.owners.delete(child); }
        if (source.sessionId) { this.emit({ sessionId: source.sessionId, method: cdpMethod, params: cdpParams }); break; }
        // The picture feed belongs to the extra session that asked for it; Playwright's own session never sees it.
        if (!(PICTURE_EVENTS.has(cdpMethod) && s.side.size)) this.emit({ sessionId: s.sessionId, method: cdpMethod, params: cdpParams });
        for (const side of s.side) this.emit({ sessionId: side, method: cdpMethod, params: cdpParams });
        break;
      }
    }
  }

  /** Opens a tab of the tool's own in the person's Chrome (next to the picked tab) and attaches to it. */
  async openOwnTab(url = 'about:blank') {
    const tab = await this.toExtension('chrome.tabs.create', [{ url, active: true }]);
    if (tab?.id === undefined) throw new Error('Chrome did not open a new tab');
    this.own.add(tab.id);
    return this.attach(tab.id);
  }

  async attach(tabId) {
    const have = this.sessions.get(tabId);
    if (have) return have;
    if (!this.own.has(tabId)) throw new Error('The capture tool only drives tabs it opened itself');
    await this.toExtension('chrome.debugger.attach', [{ tabId }, '1.3']);
    const r = await this.toExtension('chrome.debugger.sendCommand', [{ tabId }, 'Target.getTargetInfo']);
    const s = { tabId, sessionId: `pw-tab-${this.next++}`, targetInfo: r?.targetInfo, children: new Set(), side: new Set() };
    this.sessions.set(tabId, s);
    this.owners.set(s.sessionId, tabId);
    if (this.autoAttach) this.announce(s);
    return s;
  }

  announce(s) {
    this.emit({ method: 'Target.attachedToTarget', params: { sessionId: s.sessionId, targetInfo: { ...s.targetInfo, attached: true }, waitingForDebugger: false } });
  }

  detached(tabId) {
    const s = this.sessions.get(tabId);
    if (!s) return;
    this.sessions.delete(tabId);
    for (const id of [s.sessionId, ...s.children, ...s.side]) this.owners.delete(id);
    for (const side of s.side) this.emit({ sessionId: 'pw-browser', method: 'Target.detachedFromTarget', params: { sessionId: side } });
    this.emit({ method: 'Target.detachedFromTarget', params: { sessionId: s.sessionId, targetId: s.targetInfo?.targetId } });
  }

  /** Closes every tab the tool opened (and their pop-ups). The tab the person picked is left alone. */
  async closeOwnTabs() {
    for (const tabId of [...this.own].reverse()) {
      if (this.picked && tabId === this.picked.id) continue;
      await this.toExtension('chrome.tabs.remove', [tabId]).catch(() => {});
    }
  }

  stop() {
    try { this.ext?.close(1000, 'The capture tool is done'); } catch {}
    try { this.cdp?.close(1000, 'The capture tool is done'); } catch {}
    try { this.server?.close(); } catch {}
  }

  // ------------------------------------------------------------------ Playwright's side

  onPlaywright(ws) {
    if (!this.ext || this.cdp) { ws.close(1000, this.cdp ? 'Another client already connected' : 'Extension not connected'); return; }
    this.cdp = ws;
    ws.on('message', async (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); } catch { return; }
      const { id, sessionId, method, params } = msg;
      try { this.reply({ id, sessionId, result: (await this.command(method, params ?? {}, sessionId)) ?? {} }); }
      catch (e) { this.reply({ id, sessionId, error: { message: e.message } }); }
    });
    ws.on('close', () => { try { this.ext?.close(1000, 'Playwright disconnected'); } catch {} });
    ws.on('error', () => {});
  }

  reply(msg) { if (this.cdp?.readyState === 1) this.cdp.send(JSON.stringify(msg)); }
  emit(msg) { if (this.cdp?.readyState === 1) this.cdp.send(JSON.stringify(msg)); }

  firstTab() {
    const s = this.sessions.values().next().value;
    if (!s) throw new Error('No tab is attached');
    return s.tabId;
  }

  async command(method, params, sessionId) {
    // The browser-wide session Playwright opens to make extra sessions for a page (newCDPSession).
    if (!sessionId || sessionId === 'pw-browser') {
      switch (method) {
        case 'Browser.getVersion': return { protocolVersion: '1.3', product: 'Chrome/Extension-Bridge', userAgent: 'CDP-Bridge-Server/1.0.0', revision: '', jsVersion: '' };
        case 'Browser.setDownloadBehavior': return {};
        case 'Target.attachToBrowserTarget': return { sessionId: 'pw-browser' };
        case 'Target.setAutoAttach':
          if (sessionId) return {};
          this.autoAttach = true;
          for (const s of this.sessions.values()) this.announce(s);
          return {};
        case 'Target.setDiscoverTargets': return {};
        case 'Target.createTarget': {
          const s = await this.openOwnTab(params.url || 'about:blank');
          return { targetId: s.targetInfo?.targetId };
        }
        case 'Target.closeTarget': {
          const s = [...this.sessions.values()].find((x) => x.targetInfo?.targetId === params.targetId);
          if (!s) return { success: false };
          await this.toExtension('chrome.tabs.remove', [s.tabId]);
          return { success: true };
        }
        case 'Target.attachToTarget': {
          const s = [...this.sessions.values()].find((x) => x.targetInfo?.targetId === params.targetId);
          if (!s) throw new Error('No such tab, or not one the capture tool opened');
          const side = `pw-extra-${this.next++}`;
          s.side.add(side);
          this.owners.set(side, s.tabId);
          return { sessionId: side };
        }
        case 'Target.detachFromTarget': {
          const tabId = this.owners.get(params.sessionId);
          const s = this.sessions.get(tabId);
          if (s?.side.delete(params.sessionId)) {
            this.owners.delete(params.sessionId);
            if (![...s.side].length) await this.toExtension('chrome.debugger.sendCommand', [{ tabId }, 'Page.stopScreencast']).catch(() => {});
            this.emit({ sessionId: 'pw-browser', method: 'Target.detachedFromTarget', params: { sessionId: params.sessionId } });
          }
          return {};
        }
      }
      return this.toExtension('chrome.debugger.sendCommand', [{ tabId: this.firstTab() }, method, params]);
    }
    const tabId = this.owners.get(sessionId);
    const s = this.sessions.get(tabId);
    if (!s) throw new Error(`No tab for session ${sessionId}`);
    if (sessionId === s.sessionId && method === 'Target.getTargetInfo') return { targetInfo: s.targetInfo };
    const child = s.children.has(sessionId) ? sessionId : undefined;
    return this.toExtension('chrome.debugger.sendCommand', [{ tabId, ...(child ? { sessionId: child } : {}) }, method, params]);
  }
}

/**
 * Connects to the person's own Chrome through the extension. Resolves once the person has picked a tab and the tool
 * has opened its own tab next to it. Returns { browser, context, page, relay }.
 */
export async function connectYourChrome(chromium, { clientName, profile = null, wait = 180, say = console.log, onWaiting = null } = {}) {
  const relay = new Relay();
  await relay.start();
  relay.openConnectPage(clientName, { profile, userDataDir: process.env.STUDIO_TEST_CHROME_DIR || null });
  onWaiting?.(relay);
  let timer;
  const gaveUp = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), wait * 1000); });
  try {
    await Promise.race([relay.ready, gaveUp]);
  } catch (e) {
    relay.stop();
    const err = new Error(e.message === 'timeout' ? 'no-answer' : 'refused');
    err.detail = e.message;
    throw err;
  } finally { clearTimeout(timer); }
  await relay.openOwnTab('about:blank');
  const browser = await chromium.connectOverCDP(relay.cdpUrl, { isLocal: true, timeout: 0, noDefaults: true });
  browser.on('disconnected', () => relay.stop());
  const context = browser.contexts()[0];
  const until = Date.now() + 10000;
  while (!context.pages().length && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
  const page = context.pages()[0];
  if (!page) { relay.stop(); throw new Error('no-tab'); }
  return { browser, context, page, relay };
}
