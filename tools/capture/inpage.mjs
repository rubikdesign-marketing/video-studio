// Functions the capture tool runs inside the product's page. Each one is sent to Chrome on its own, so none of
// them may use anything from outside its own body. Used by capture.mjs only.

/**
 * The clean screen, installed in every page and frame before the product's own code runs, and kept applied as the
 * page changes: hides what the brand and the studio list, blurs masked things, steadies the text caret, hides
 * scrollbars and spellcheck lines. window.__studio.report() says what it hid and anything it failed to hide.
 */
export function dresser(cfg) {
  if (window.__studio) return;
  const KEEP = 'data-studio-keep', HIDE = 'data-studio-hide', MASK = 'data-studio-mask';
  const lower = (s) => String(s ?? '').toLowerCase();
  const hidden = new Map();
  const count = (what) => hidden.set(what, (hidden.get(what) ?? 0) + 1);
  // In your own Chrome: what your own Chrome extensions draw on the product's page. Known ones by name; any other
  // by the extension address its pictures, frames or styles come from, or by sitting outside the page's body.
  const YOURS = [
    ['Grammarly', 'grammarly-extension, grammarly-desktop-integration, grammarly-popups, grammarly-mirror, grammarly-card, [data-grammarly-part], [data-grammarly-shadow-root]'],
    ['LanguageTool', 'lt-toolbar, lt-highlighter, lt-mirror, lt-span, lt-div, .lt-toolbar'],
    ['LastPass', '[data-lastpass-root], [data-lastpass-icon-root], [data-lastpass-infield], #lp-pom-root'],
    ['1Password', 'com-1password-button, com-1password-menu, com-1password-notification, com-1password-op-button, onepassword-menu'],
    ['Bitwarden', '#bit-notification-bar, #bit-notification-bar-iframe, bit-inline-menu-button, bit-inline-menu-list, [data-bitwarden-overlay]'],
    ['Dashlane', '[data-dashlanecreated], #kw-iframe, dashlane-overlay'],
    ['Honey', '#honeyContainer, #honey-container, honey-extension'],
    ['Loom', '#loom-companion-mv3, #loom-companion, loom-container'],
    ['Google Translate', '#goog-gt-tt, .goog-te-banner-frame, .goog-te-spinner-pos, #google_translate_element'],
    ['Microsoft Editor', 'microsoft-editor, #microsoft-editor-root'],
  ];
  // Things that change the whole page, so they cannot be hidden: the take stops and names them.
  const WHOLE_PAGE = [
    ['Dark Reader (an extension that recolours pages)', 'style.darkreader, html[data-darkreader-mode], html[data-darkreader-scheme]'],
    ['Night Eye (an extension that recolours pages)', 'html[nighteye], style#nighteyedefaultcss'],
    ["Chrome's translation of the page", 'html.translated-ltr, html.translated-rtl'],
  ];
  const yours = new Map();
  const stoppers = new Set();
  const FROM_EXT = /^(chrome|moz|safari-web)-extension:/i;
  const hideYours = (el, name) => {
    if (el.hasAttribute('data-studio-yours')) return;
    el.setAttribute('data-studio-yours', name);
    yours.set(name, (yours.get(name) ?? 0) + 1);
    if (el.matches('input,textarea,select,[contenteditable]')) { el.style.setProperty('background-image', 'none', 'important'); return; } // an icon drawn inside a field: the field stays
    el.setAttribute('data-studio-hide', `${name} (your Chrome extension)`);
    el.style.setProperty('display', 'none', 'important');
  };
  const extName = (url) => { const id = String(url).match(FROM_EXT) ? String(url).split('/')[2] : ''; return ({ kbfnbcaeplbcioakkpcpgfkobkghlhen: 'Grammarly', hdokiejnpimakedhajhdlcegeplioahd: 'LastPass', aeblfdkhhhdcdjpifhhbdiojplfjncoa: '1Password', nngceckbapebfimnlniiiahkandclblb: 'Bitwarden', fdjamakpfbbddfjaooikfcpapjohcfmg: 'Dashlane', bmnlcjabgnpnenekpadlanbbkooimhnj: 'Honey', liecbddmkiiihnedobmlmillhodjkdmb: 'Loom', oldceeleldhonbafppcapldpdifcinji: 'LanguageTool', cjpalhdlnbpafiamejdnhcphjbkeiagm: 'uBlock Origin', gighmmpiobklfepjocnamgkkbiglidom: 'AdBlock', cfhdojbkjhnklbpkdaibdccddilifddb: 'Adblock Plus', eimadpbcbfnmbkopoojfekhnkhdbieeh: 'Dark Reader', aapbdbdomjkkjkaonfhkkikfgjllcleb: 'Google Translate' })[id] ?? `an extension (${id.slice(0, 8)}...)`; };
  const sweepYours = () => {
    for (const [name, sel] of YOURS) document.querySelectorAll(sel).forEach((el) => hideYours(el, name));
    for (const [name, sel] of WHOLE_PAGE) if (document.querySelector(sel)) stoppers.add(name);
    // Pictures, frames and objects an extension put on the page, and things drawn with its pictures.
    document.querySelectorAll('img[src],iframe[src],embed[src],object[data],video[src],source[src],[style*="-extension:"]').forEach((el) => {
      const url = el.getAttribute('src') ?? el.getAttribute('data') ?? '';
      if (FROM_EXT.test(url)) hideYours(el.tagName === 'SOURCE' ? el.parentElement : el, extName(url));
      else if (/-extension:/i.test(el.getAttribute('style') ?? '')) hideYours(el, extName((el.getAttribute('style').match(/(chrome|moz)-extension:\/\/[a-z]+/i) ?? [''])[0]));
    });
    // Anything added beside <head> and <body> (pages put nothing there; extensions often do).
    for (const el of document.documentElement?.children ?? []) {
      if (['HEAD', 'BODY', 'STYLE', 'SCRIPT', 'LINK', 'META'].includes(el.tagName) || el.tagName === 'STUDIO-NUDGE' || el.id === '__studio_clean_screen') continue;
      hideYours(el, 'something an extension added');
    }
    // Your autofill: fields are asked not to offer saved addresses and cards for the take. Chrome's own suggestion
    // pop-ups are drawn outside the page, so they never appear in a recording anyway.
    document.querySelectorAll('input:not([autocomplete=off]):not([type=password]),textarea:not([autocomplete=off]),form:not([autocomplete=off])').forEach((el) => { if (!el.hasAttribute('data-studio-autocomplete')) { el.setAttribute('data-studio-autocomplete', el.getAttribute('autocomplete') ?? ''); el.setAttribute('autocomplete', 'off'); } });
  };
  const valid = (sel) => { try { document.querySelector(sel); return true; } catch { return false; } };
  const hideSel = cfg.hide.filter((r) => r.selector && valid(r.selector));
  const hideText = cfg.hide.filter((r) => r.text).map((r) => ({ ...r, text: lower(r.text) }));
  const keepSel = cfg.keep.filter((r) => r.selector && valid(r.selector));
  const keepText = cfg.keep.filter((r) => r.text).map((r) => lower(r.text));
  const maskSel = cfg.masks.filter((m) => m.css && valid(m.css));
  const maskText = cfg.masks.filter((m) => m.words).map((m) => lower(m.words));
  const css = [
    'html::-webkit-scrollbar, *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important }',
    'html, body, * { scrollbar-width: none !important }',
    '*, *::before, *::after { caret-animation: manual !important }',
    'input:-webkit-autofill, textarea:-webkit-autofill, select:-webkit-autofill { transition: background-color 99999s step-end 0s, color 99999s step-end 0s !important }',
    `[${HIDE}]:not([${KEEP}]) { display: none !important }`,
    `[${MASK}] { filter: blur(14px) !important }`,
    ...hideSel.map((r) => `:is(${r.selector}):not([${KEEP}]) { display: none !important }`),
    ...maskSel.map((m) => `:is(${m.css}) { filter: blur(14px) !important }`),
  ].join('\n');
  let style = null;
  const ensureStyle = () => {
    if (style && style.isConnected) return;
    style = document.createElement('style');
    style.id = '__studio_clean_screen';
    style.textContent = css;
    (document.head ?? document.documentElement)?.appendChild(style);
  };
  const fixedish = (el) => {
    const s = getComputedStyle(el);
    return s.position === 'fixed' || s.position === 'sticky' || el.matches('dialog,[role=dialog],[role=alertdialog],[aria-modal=true]');
  };
  /** The box a line of words sits in: the nearest floating panel, else the element itself. */
  const boxOf = (el) => {
    for (let a = el, i = 0; a && a !== document.body && i < 12; a = a.parentElement, i++) if (fixedish(a)) return a;
    return el;
  };
  const markKeep = (el) => { for (let a = el; a && a !== document.documentElement; a = a.parentElement) if (!a.hasAttribute(KEEP)) a.setAttribute(KEEP, ''); };
  const hideEl = (el, what) => {
    if (el.closest(`[${KEEP}]`) && el.hasAttribute(KEEP)) return;
    if (!el.hasAttribute(HIDE)) { el.setAttribute(HIDE, what); count(what); }
    if (el.style.getPropertyValue('display') !== 'none' || el.style.getPropertyPriority('display') !== 'important') el.style.setProperty('display', 'none', 'important');
  };
  const textNodes = (fn) => {
    if (!document.body) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || p.closest('script,style,noscript')) continue;
      const s = lower(n.textContent);
      if (s.trim()) fn(n, p, s);
    }
  };
  const sweep = () => {
    ensureStyle();
    if (!document.body) return;
    keepSel.forEach((r) => document.querySelectorAll(r.selector).forEach(markKeep));
    if (keepText.length) textNodes((n, p, s) => { if (keepText.some((k) => s.includes(k))) markKeep(p); });
    hideSel.forEach((r) => document.querySelectorAll(r.selector).forEach((el) => { if (!el.hasAttribute(KEEP)) hideEl(el, r.what); }));
    if (hideText.length) textNodes((n, p, s) => {
      const rule = hideText.find((r) => s.includes(r.text));
      if (!rule) return;
      const box = rule.anywhere ? p : boxOf(p);
      if (!rule.anywhere && box === p && !fixedish(p)) return; // words in the page itself are not a banner: only floating panels are hidden by words
      if (!box.hasAttribute(KEEP)) hideEl(box, rule.what);
    });
    if (cfg.cookieWords) {
      // Cookie and consent banners the studio does not know by name: a floating panel that talks about cookies.
      const re = /\b(we use cookies|this (web)?site uses cookies|accept (all )?cookies|cookie (settings|preferences|policy|consent)|manage (your )?consent|privacy preferences)\b/i;
      textNodes((n, p, s) => {
        if (!re.test(s)) return;
        const box = boxOf(p);
        if (fixedish(box) && !box.hasAttribute(KEEP)) hideEl(box, "cookie or consent banner");
      });
    }
    if (maskText.length) {
      textNodes((n, p, s) => { if (maskText.some((m) => s.includes(m)) && !p.hasAttribute(MASK)) p.setAttribute(MASK, ''); });
      document.querySelectorAll('input,textarea').forEach((el) => { if (maskText.some((m) => lower(el.value).includes(m)) && !el.hasAttribute(MASK)) el.setAttribute(MASK, ''); });
    }
    document.querySelectorAll('input:not([spellcheck=false]),textarea:not([spellcheck=false]),[contenteditable]:not([spellcheck=false])').forEach((el) => el.setAttribute('spellcheck', 'false'));
    if (cfg.yours) sweepYours();
  };
  let queued = false;
  const later = () => { if (queued) return; queued = true; queueMicrotask(() => { queued = false; try { sweep(); } catch {} }); };
  const start = () => {
    sweep();
    new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true, characterData: hideText.length + keepText.length + maskText.length > 0 || cfg.cookieWords, attributes: true, attributeFilter: ['style', 'class', 'open', 'hidden'] });
  };
  ensureStyle();
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
  document.addEventListener('DOMContentLoaded', later);
  window.__studio = {
    sweep,
    report() {
      sweep();
      const still = [];
      for (const r of hideSel) {
        for (const el of document.querySelectorAll(r.selector)) {
          if (el.hasAttribute(KEEP)) continue;
          const b = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          if (b.width > 1 && b.height > 1 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0.05) { still.push(r.what); break; }
        }
      }
      for (const el of document.querySelectorAll('[data-studio-yours]')) {
        if (el.matches('input,textarea,select,[contenteditable]')) continue;
        const b = el.getBoundingClientRect();
        if (b.width > 1 && b.height > 1 && getComputedStyle(el).display !== 'none') still.push(`${el.getAttribute('data-studio-yours')} (drawn by your Chrome extension)`);
      }
      return { hidden: Object.fromEntries(hidden), still, masked: document.querySelectorAll(`[${MASK}]`).length, extensions: Object.fromEntries(yours), wholePage: [...stoppers] };
    },
  };
}

/** Fonts loaded and the pictures on screen decoded. */
export async function readyFacts() {
  const fonts = !document.fonts || document.fonts.status === 'loaded';
  const imgs = [...document.images].filter((img) => {
    const r = img.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && (img.currentSrc || img.src);
  });
  const loading = imgs.filter((img) => !img.complete).length;
  if (!loading) await Promise.all(imgs.map((img) => img.decode().catch(() => {})));
  // Loading placeholders on screen (grey skeleton cards, shimmer, spinners, busy areas): the page is still filling
  // in, even when the network looks quiet (found on Tulvo, 12 Nov 2026: its cards arrive over a live-update channel
  // after the skeleton has drawn, so the page looked settled 0.3 to 0.5 s too early). Kept or hidden things do not count.
  // WordPress's block editor names its whole layout "interface-interface-skeleton" (found 12 Nov 2026): not a placeholder.
  const SKELETON = '[aria-busy="true"],[class*="skeleton" i]:not([class*="interface-skeleton"]),[class*="shimmer" i],[class*="animate-pulse"],[class*="spinner" i],[role="progressbar"]:not([aria-valuenow])';
  let placeholders = 0;
  for (const el of document.querySelectorAll(SKELETON)) {
    if (el.closest('[data-studio-keep],[data-studio-hide]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && getComputedStyle(el).visibility !== 'hidden') placeholders++;
  }
  // Plain grey bars with nothing telling in their names (the usual "skeleton" lines of a card still loading): three or
  // more light (or, on a dark page, dark) grey blocks with rounded corners, 6 to 40 pixels tall, with no words, picture
  // or field in them. Fewer than three is more likely a divider or an empty progress bar, so it does not count.
  if (!placeholders) {
    let bars = 0;
    for (const el of document.body?.querySelectorAll('div,span,li,p') ?? []) {
      const r = el.getBoundingClientRect();
      if (r.height < 6 || r.height > 40 || r.width < 24 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      const st = getComputedStyle(el);
      const m = st.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
      if (!m || (m[4] !== undefined && Number(m[4]) < 0.9)) continue;
      const [cr, cg, cb] = [m[1], m[2], m[3]].map(Number);
      const light = Math.max(cr, cg, cb);
      if (light - Math.min(cr, cg, cb) > 12 || !((light >= 200 && light <= 238) || (light >= 25 && light <= 70))) continue;
      if (parseFloat(st.borderTopLeftRadius) < 2 || st.visibility === 'hidden' || Number(st.opacity) < 0.3) continue;
      if ((el.textContent ?? '').trim() || el.querySelector('img,svg,video,canvas,input,textarea,select,button')) continue;
      if (el.closest('[data-studio-keep],[data-studio-hide]')) continue;
      if (++bars >= 3) { placeholders = bars; break; }
    }
  }
  return { fonts, loading, placeholders, ready: document.readyState };
}

/** Things floating over the page that nobody listed: an open dialog, a big overlay, a widget from another site, a cookie banner. */
export function covering() {
  const out = [];
  const vw = innerWidth, vh = innerHeight;
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05) return null;
    const r = el.getBoundingClientRect();
    const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(vw, r.right), y1 = Math.min(vh, r.bottom);
    if (x1 - x0 < 2 || y1 - y0 < 2) return null;
    return { box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, area: ((x1 - x0) * (y1 - y0)) / (vw * vh) };
  };
  const listed = (el) => el.closest('[data-studio-keep],[data-studio-hide]');
  const words = (el) => (el.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const flagged = [];
  const under = (el) => flagged.some((f) => f.contains(el) || el.contains(f));
  for (const el of document.querySelectorAll('dialog[open],[role=dialog],[role=alertdialog],[aria-modal=true]')) {
    if (listed(el) || under(el)) continue;
    const v = vis(el);
    if (v && v.area > 0.01) { flagged.push(el); out.push({ what: 'an open dialog', words: words(el), box: v.box }); }
  }
  const layout = 'header,nav,aside,footer,[role=banner],[role=navigation],[role=complementary],[role=toolbar],[role=menubar]';
  for (const el of document.body?.querySelectorAll('*') ?? []) {
    if (getComputedStyle(el).position !== 'fixed' || listed(el) || under(el)) continue;
    const v = vis(el);
    if (!v) continue;
    const frame = el.tagName === 'IFRAME' ? el : el.querySelector('iframe');
    let host = null;
    try { host = frame && frame.src ? new URL(frame.src, location.href).host : null; } catch {}
    const text = words(el);
    if (host && host !== location.host) { flagged.push(el); out.push({ what: `a widget from ${host}`, words: text, box: v.box }); }
    else if (/cookie|consent/i.test(text)) { flagged.push(el); out.push({ what: 'what looks like a cookie banner', words: text, box: v.box }); }
    else if (v.area > 0.3 && !el.matches(layout)) { flagged.push(el); out.push({ what: `something covering ${Math.round(v.area * 100)}% of the page`, words: text, box: v.box }); }
  }
  return out.slice(0, 4);
}

/** Text on screen that a never-show rule forbids, with where it is. */
export function visibleMatches(rules) {
  const found = [];
  const onScreen = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const tests = rules.flatMap((rule) => [
    ...rule.text.map((t) => ({ rule, test: (s) => { const i = s.toLowerCase().indexOf(t.toLowerCase()); return i >= 0 ? { i, text: s.slice(i, i + t.length) } : null; } })),
    ...(rule.pattern ? [{ rule, test: (s) => { const re = new RegExp(rule.pattern, 'gi'); for (const m of s.matchAll(re)) if (!rule.allow.some((a) => m[0].toLowerCase().includes(a.toLowerCase()))) return { i: m.index, text: m[0] }; return null; } }] : []),
  ]);
  if (!tests.length || !document.body) return found;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const s = node.textContent;
    if (!s || !s.trim()) continue;
    const p = node.parentElement;
    if (!p || p.closest('script,style,noscript,[data-studio-hide]')) continue;
    const style = getComputedStyle(p);
    if (style.visibility === 'hidden' || style.opacity === '0') continue;
    for (const { rule, test } of tests) {
      const hit = test(s);
      if (!hit) continue;
      // The whole line the words are in is blurred in a failure still, not only the words themselves.
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter(onScreen).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
      if (rects.length) found.push({ what: rule.what, found: hit.text, line: s.trim(), rects });
    }
  }
  document.querySelectorAll('input,textarea').forEach((el) => {
    if (!el.value || el.type === 'password') return;
    for (const { rule, test } of tests) {
      const hit = test(el.value);
      const r = el.getBoundingClientRect();
      if (hit && onScreen(r)) found.push({ what: rule.what, found: hit.text, rects: [{ x: r.x, y: r.y, w: r.width, h: r.height }] });
    }
  });
  return found.slice(0, 6);
}

/**
 * E-mail addresses, phone numbers and people's names on screen that are not on the brand's safe list, with where
 * each one is, so the still can be blurred there and a person can look.
 */
export function privacyScan({ safe, allowEmail, firstNames }) {
  const hits = [];
  const safeL = safe.map((s) => s.toLowerCase()).filter(Boolean);
  const isSafe = (t) => { const l = t.toLowerCase(); return safeL.some((s) => l.includes(s) || s.includes(l)); };
  const names = new Set(firstNames);
  const onScreen = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}[\s.-]\d{2,4}[\s.-]?\d{2,5}(?:[\s.-]\d{2,4})?/g;
  const NAME = /\b([A-Z][a-z]+(?:[-'][A-Z][a-z]+)?)\s+([A-Z][a-z]+(?:[-'][A-Z][a-z]+)?|[A-Z]\.)/g;
  const find = (s) => {
    const out = [];
    for (const m of s.matchAll(EMAIL)) if (!allowEmail.some((a) => m[0].toLowerCase().includes(a.toLowerCase())) && !isSafe(m[0])) out.push({ kind: 'e-mail address', i: m.index, text: m[0] });
    for (const m of s.matchAll(PHONE)) {
      const digits = m[0].replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 15) continue;
      if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(m[0].trim()) || /^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(m[0].trim())) continue; // a date
      if (out.some((o) => o.kind === 'e-mail address' && m.index >= o.i && m.index < o.i + o.text.length)) continue;
      if (!isSafe(m[0])) out.push({ kind: 'phone number', i: m.index, text: m[0].trim() });
    }
    for (const m of s.matchAll(NAME)) if (names.has(m[1]) && !isSafe(m[0])) out.push({ kind: "person's name", i: m.index, text: m[0] });
    return out;
  };
  if (!document.body) return hits;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const s = node.textContent;
    const p = node.parentElement;
    if (!s || !s.trim() || !p || p.closest('script,style,noscript,[data-studio-hide],[data-studio-mask]')) continue;
    const st = getComputedStyle(p);
    if (st.visibility === 'hidden' || Number(st.opacity) < 0.05) continue;
    for (const f of find(s)) {
      const range = document.createRange();
      range.setStart(node, f.i);
      range.setEnd(node, Math.min(s.length, f.i + f.text.length));
      const rects = [...range.getClientRects()].filter(onScreen).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }));
      if (rects.length) hits.push({ kind: f.kind, text: f.text, rects });
    }
  }
  document.querySelectorAll('input,textarea').forEach((el) => {
    if (!el.value || el.type === 'password' || el.closest('[data-studio-mask],[data-studio-hide]')) return;
    const r = el.getBoundingClientRect();
    if (!onScreen(r)) return;
    for (const f of find(el.value)) hits.push({ kind: f.kind, text: f.text, rects: [{ x: r.x, y: r.y, w: r.width, h: r.height }] });
  });
  return hits.slice(0, 40);
}

/** The words a person can see on screen, top to bottom, one line per block. */
export function wordsOnScreen() {
  if (!document.body) return '';
  const rows = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const s = node.textContent.replace(/\s+/g, ' ').trim();
    const p = node.parentElement;
    if (!s || !p || p.closest('script,style,noscript,[data-studio-hide]')) continue;
    const st = getComputedStyle(p);
    if (st.visibility === 'hidden' || Number(st.opacity) < 0.05) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = [...range.getClientRects()].find((b) => b.width > 0 && b.height > 0 && b.bottom > 0 && b.top < innerHeight && b.right > 0 && b.left < innerWidth);
    if (r) rows.push({ y: Math.round(r.y), x: Math.round(r.x), s: p.closest('[data-studio-mask]') ? '[masked]' : s });
  }
  document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=hidden]),textarea,select').forEach((el) => {
    const r = el.getBoundingClientRect();
    const v = el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent : el.value;
    if (el.type !== 'password' && v && r.width > 0 && r.bottom > 0 && r.top < innerHeight) rows.push({ y: Math.round(r.y), x: Math.round(r.x), s: el.closest('[data-studio-mask]') ? '[masked field]' : `[field: ${v}]` });
  });
  document.querySelectorAll('input[type=checkbox],input[type=radio]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.bottom > 0 && r.top < innerHeight) rows.push({ y: Math.round(r.y), x: Math.round(r.x), s: el.checked ? '[ticked]' : '[not ticked]' });
  });
  rows.sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const r of rows) {
    const last = lines.at(-1);
    if (last && Math.abs(last.y - r.y) < 6) last.s += '  ' + r.s;
    else lines.push({ ...r });
  }
  return lines.map((l) => l.s).join('\n');
}

/**
 * Where the named things on screen sit, for the freshness check (tools/capture/freshness.mjs): buttons, links, tabs,
 * menu items, fields, check boxes and headings with their role, name (their label or words, as a person reads them)
 * and box in page pixels from the top left of the window, plus the tracked things. Private (masked) things are
 * named "[masked]" so no private words are saved.
 */
export function layoutNow() {
  const roleOf = (el) => {
    const r = el.getAttribute('role');
    if (r) return r;
    const t = el.tagName;
    if (t === 'BUTTON' || (t === 'INPUT' && /^(button|submit|reset)$/.test(el.type))) return 'button';
    if (t === 'A') return 'link';
    if (/^H[1-6]$/.test(t)) return 'heading';
    if (t === 'SELECT') return 'list';
    if (t === 'TEXTAREA' || t === 'INPUT') return el.type === 'checkbox' ? 'check box' : el.type === 'radio' ? 'option' : 'field';
    if (t === 'SUMMARY') return 'button';
    return 'thing';
  };
  const labelFor = (el) => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return l.innerText;
    }
    return el.closest('label')?.innerText ?? '';
  };
  const nameOf = (el) => {
    if (el.closest('[data-studio-mask]')) return '[masked]';
    const by = el.getAttribute('aria-labelledby');
    const labelled = by ? by.split(/\s+/).map((id) => document.getElementById(id)?.innerText ?? '').join(' ') : '';
    const raw = el.getAttribute('aria-label') || labelled || (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ? labelFor(el) || el.placeholder || el.name : el.innerText) || el.title || el.getAttribute('alt') || '';
    return raw.replace(/\s+/g, ' ').trim().slice(0, 80);
  };
  const selector = 'button,a[href],[role=button],[role=link],[role=tab],[role=menuitem],[role=option],[role=checkbox],[role=switch],[role=treeitem],input:not([type=hidden]):not([type=password]),textarea,select,summary,h1,h2,h3,h4,h5,h6';
  const things = [];
  for (const el of document.querySelectorAll(selector)) {
    if (el.closest('[data-studio-hide],script,style,noscript')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || Number(st.opacity) < 0.05) continue;
    const name = nameOf(el);
    if (!name) continue;
    things.push({ role: roleOf(el), name, box: [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10] });
    if (things.length >= 400) break;
  }
  const tracked = {};
  document.querySelectorAll('[data-studio-track]').forEach((el) => {
    const r = el.getBoundingClientRect();
    tracked[el.getAttribute('data-studio-track')] = r.width > 0 || r.height > 0 ? [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10] : null;
  });
  const se = document.scrollingElement ?? document.documentElement;
  return { page: [innerWidth, innerHeight], scroll: [Math.round(se.scrollLeft), Math.round(se.scrollTop)], things, tracked };
}

/** Names of things on screen that look most like the words a step looked for. */
export function lookalikes(wanted) {
  const w = wanted.toLowerCase().trim();
  const tokens = w.split(/\s+/).filter(Boolean);
  const seen = new Map();
  const kindOf = (el) => {
    const role = el.getAttribute('role');
    if (role) return role;
    const t = el.tagName.toLowerCase();
    return { a: 'link', button: 'button', input: 'field', textarea: 'field', select: 'list', label: 'label', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading' }[t] ?? 'text';
  };
  const add = (text, el) => {
    const s = (text ?? '').replace(/\s+/g, ' ').trim();
    if (!s || s.length > 60) return;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const l = s.toLowerCase();
    let score = 0;
    if (l.includes(w) || w.includes(l)) score += 2;
    score += tokens.filter((t) => l.includes(t)).length / Math.max(1, tokens.length);
    const common = [...new Set(l)].filter((c) => w.includes(c)).length / Math.max(1, new Set(w).size);
    score += common * 0.5;
    const key = `${s}|${kindOf(el)}`;
    if (score > 0.6 && !(seen.get(key) >= score)) seen.set(key, score);
  };
  document.querySelectorAll('button,a,[role],label,h1,h2,h3,h4,input,textarea,select,summary').forEach((el) => {
    add(el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder, el);
    if (el.placeholder) add(el.placeholder, el);
  });
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.parentElement) add(node.textContent, node.parentElement);
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => { const [text, kind] = k.split('|'); return { text, kind }; });
}

/** Where each tracked thing is right now, and the page's scroll. */
export function trackedNow() {
  const at = {};
  document.querySelectorAll('[data-studio-track]').forEach((el) => {
    const r = el.getBoundingClientRect();
    at[el.getAttribute('data-studio-track')] = r.width > 0 || r.height > 0 ? [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10] : null;
  });
  const se = document.scrollingElement ?? document.documentElement;
  return { at, scroll: [Math.round(se.scrollLeft), Math.round(se.scrollTop)] };
}

/** The element that scrolls to bring `el` into view: its nearest scrolling box, else the page. */
export function scrollerOf(el) {
  for (let a = el?.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
    const s = getComputedStyle(a);
    if (/(auto|scroll|overlay)/.test(s.overflowY) && a.scrollHeight > a.clientHeight + 1) return a;
  }
  return document.scrollingElement ?? document.documentElement;
}

/** The common first names the privacy scan uses to spot a person's name (first name then a capitalised word). */
export const FIRST_NAMES = `Aaron Abigail Adam Adrian Ahmed Aisha Alan Albert Alex Alexander Alexandra Alice Alicia Alison Amanda Amber Amelia Amina Amir Amy Ana Andrea Andrew Angela Anil Anita Ann Anna Anne Anthony Anton Arjun Arthur Ashley Barbara Ben Benjamin Beth Bill Bob Brandon Brian Bruce Carl Carlos Carmen Carol Caroline Catherine Charles Charlie Charlotte Chen Chloe Chris Christian Christina Christine Christopher Claire Clara Daniel Danielle David Deborah Dennis Diana Diego Dmitri Donald Dorothy Douglas Dylan Edward Elena Elijah Elizabeth Ella Ellen Emily Emma Eric Erin Ethan Eva Evelyn Farhan Fatima Felix Fiona Frank Gabriel Gary George Grace Gregory Hannah Harold Harry Hassan Heather Helen Henry Hiroshi Hugo Ian Imran Isaac Isabel Isabella Jack Jacob Jake James Jamie Jane Janet Jason Javier Jean Jennifer Jeremy Jessica Jill John Jonathan Jordan Jose Joseph Joshua Juan Judith Julia Julie Justin Karen Karim Kate Katherine Kathleen Kelly Kenneth Kevin Kim Kyle Laura Lauren Leo Liam Linda Lisa Lucas Lucy Luis Luke Mahmud Maria Marie Mark Martin Mary Mateo Matthew Maya Megan Melissa Mia Michael Michelle Mike Mohammed Muhammad Nadia Nancy Natalie Nathan Nicholas Nicole Noah Nora Olivia Omar Oscar Patricia Patrick Paul Paula Peter Priya Rachel Rahul Raj Rajesh Rebecca Richard Rita Robert Rosa Ryan Sam Samantha Samuel Sandra Sara Sarah Scott Sean Sergei Sharon Sophia Sophie Stephanie Stephen Steven Susan Tanvir Taylor Thomas Tim Timothy Tom Tyler Victoria Vincent Walter William Yuki Zara Zoe`.split(' ');

/**
 * Keeps Chrome's picture feed current. Chrome's screencast sometimes stops sending pictures after the page changes
 * until something else forces a new one (found on Tulvo, 12 Nov 2026: the cards had drawn but the recording showed
 * the placeholders 0.3 s longer). While the page may be changing (anything changed, loaded, moved or was typed in the
 * last second, or an animation is running), this changes one invisible pixel every animation frame (a mid-grey
 * pixel at 0.2% opacity, between 0.2% and 0.21%), so Chrome draws and sends a fresh picture each frame. The change
 * is far too small to alter any picture (less than a hundredth of a colour step), so a still page still gives
 * identical pictures. Tested 12 Nov 2026: 60 pictures a second, all identical, on a still page. It sits in a closed shadow root, so the product never sees its
 * changes; the product sees one empty element added to the page.
 */
export function nudger() {
  if (window.top !== window || window.__studioNudge) return;
  const WINDOW = 1000; // ms of repainting after the last sign of change
  let last = performance.now(), on = true, flip = false, frames = 0, inner = null, host = null, nudges = 0;
  const poke = () => { last = performance.now(); };
  for (const t of ['pointerdown', 'pointerup', 'pointermove', 'keydown', 'keyup', 'input', 'change', 'wheel', 'scroll', 'load', 'error', 'transitionrun', 'transitionend', 'animationstart', 'animationend', 'focusin', 'focusout', 'resize', 'visibilitychange']) addEventListener(t, poke, { capture: true, passive: true });
  const mo = new MutationObserver((records) => { for (const r of records) if (r.target !== host) { poke(); return; } });
  const observe = () => mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) observe(); else document.addEventListener('DOMContentLoaded', observe, { once: true });
  document.fonts?.addEventListener?.('loadingdone', poke);
  const place = () => {
    if (host?.isConnected) return true;
    const parent = document.body ?? document.documentElement;
    if (!parent) return false;
    host = document.createElement('studio-nudge');
    host.style.cssText = 'position:fixed!important;left:0!important;top:0!important;width:1px!important;height:1px!important;pointer-events:none!important;z-index:2147483647!important;display:block!important;contain:strict!important';
    const root = host.attachShadow({ mode: 'closed' });
    inner = document.createElement('div');
    inner.style.cssText = 'width:1px;height:1px;background:#808080;opacity:0.002;will-change:opacity';
    root.appendChild(inner);
    parent.appendChild(host);
    return true;
  };
  const tick = () => {
    requestAnimationFrame(tick);
    if (!on) return;
    frames++;
    let busy = performance.now() - last < WINDOW;
    if (!busy && frames % 10 === 0 && document.getAnimations?.().some((a) => a.playState === 'running')) { poke(); busy = true; }
    if (!busy || !place()) return;
    flip = !flip;
    inner.style.opacity = flip ? '0.0021' : '0.002';
    nudges++;
  };
  requestAnimationFrame(tick);
  window.__studioNudge = { set(v) { on = Boolean(v); if (on) poke(); }, poke, count: () => nudges };
}

/**
 * Recording by showing: notes what a person does on the page, in words the capture script uses. Clicks are named by
 * the words on the thing or its label (with words "near" it when two things share a name), typing by the field's
 * label and the final text (corrections are not kept), keys, scrolls, hovers that lasted, ticks, lists, drags, and a
 * mark when the person presses the mark key. Each click and key also reports, a moment later, whether the page
 * changed, so stray clicks and things undone at once can be dropped. Nothing typed into a password or sign-in code
 * field is ever read: the recorder only reports that such a field was used.
 */
export function showRecorder(cfg) {
  if (window.top !== window || window.__studioShow) return;
  window.__studioShow = true;
  const send = (ev) => { try { window.__studioShowEvent?.(ev); } catch {} };
  const SECRET = /pass(word|code|phrase)|one[- ]?time|\botp\b|verification code|security code|sign[- ]?in code|2fa|two[- ]factor|\bmfa\b|\bpin\b/i;
  const clean = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
  const firstLine = (t) => clean(String(t ?? '').split('\n').find((l) => l.trim()) ?? '');
  const shown = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const labelOf = (el) => {
    const by = el.getAttribute('aria-labelledby');
    return clean(el.getAttribute('aria-label'))
      || (by ? clean(by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ')) : '')
      || clean(el.labels?.[0]?.innerText) || clean(el.closest('label')?.innerText)
      || clean(el.getAttribute('placeholder')) || clean(el.getAttribute('title')) || '';
  };
  const isSecret = (el) => {
    if (!el?.matches) return false;
    if (el.tagName === 'INPUT' && el.type === 'password') return true;
    if (/current-password|new-password|one-time-code/.test(el.getAttribute('autocomplete') ?? '')) return true;
    return SECRET.test([el.name, el.id, el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.labels?.[0]?.innerText].join(' '));
  };
  const FIELD = 'input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]):not([type=color]),textarea,[contenteditable=""],[contenteditable=true],[role=textbox],[role=searchbox]';
  const ACT = 'button,a[href],input,textarea,select,summary,label,[role=button],[role=link],[role=tab],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=option],[role=checkbox],[role=radio],[role=switch],[role=treeitem],[role=gridcell],[role=row],[role=listitem],[role=combobox],[contenteditable=""],[contenteditable=true],[onclick],[tabindex]:not([tabindex="-1"])';
  const actionable = (el) => {
    const a = el?.closest ? el.closest(ACT) : null;
    return a?.tagName === 'LABEL' && a.control ? a.control : a; // a field's label stands for the field
  };
  const nameOf = (el) => {
    if (el.matches(FIELD) || el.tagName === 'SELECT') return labelOf(el);
    if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) return labelOf(el);
    return clean(el.getAttribute('aria-label')) || firstLine(el.innerText).slice(0, 60) || clean(el.getAttribute('title'))
      || clean(el.querySelector?.('img[alt]')?.getAttribute('alt')) || clean(el.querySelector?.('svg title')?.textContent)
      || (el.tagName === 'INPUT' ? clean(el.value) : '');
  };
  const centre = (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
  /** Words near a thing that appear only once on screen, to tell it apart from others with the same name. */
  const nearWords = (el, name) => {
    const c = centre(el);
    const counts = new Map(), spots = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n = 0;
    for (let t = walker.nextNode(); t && n < 4000; t = walker.nextNode(), n++) {
      const p = t.parentElement;
      if (!p || p.closest('script,style,noscript,[data-studio-hide]') || el.contains(p)) continue;
      const s = clean(t.textContent);
      if (s.length < 2 || s.length > 40 || s.toLowerCase() === name.toLowerCase()) continue;
      counts.set(s.toLowerCase(), (counts.get(s.toLowerCase()) ?? 0) + 1);
      const r = p.getBoundingClientRect();
      if (r.width && r.height && r.bottom > 0 && r.top < innerHeight) spots.push({ s, node: p, d: Math.hypot(r.x + r.width / 2 - c.x, r.y + r.height / 2 - c.y) });
    }
    // Words in the smallest box around the thing first (its row, card or panel), then the nearest on screen.
    for (let a = el.parentElement, i = 0; a && a !== document.body && i < 5; a = a.parentElement, i++) {
      const inside = spots.filter((x) => a.contains(x.node) && counts.get(x.s.toLowerCase()) === 1).sort((p, q) => p.d - q.d);
      if (inside.length) return inside[0].s;
    }
    spots.sort((a, b) => a.d - b.d);
    return spots.find((x) => counts.get(x.s.toLowerCase()) === 1 && x.d < 600)?.s ?? null;
  };
  const describe = (el) => {
    if (!el) return null;
    const secret = isSecret(el);
    const name = secret ? '' : nameOf(el);
    const role = el.getAttribute('role') || (el.tagName === 'INPUT' ? `input-${el.type}` : el.tagName.toLowerCase());
    const out = { words: name, role, field: el.matches(FIELD), secret };
    if (el.tagName === 'INPUT' && el.type === 'checkbox' || role === 'checkbox' || role === 'menuitemcheckbox') out.tick = 'checkbox';
    if (role === 'switch') out.tick = 'switch';
    if (el.tagName === 'INPUT' && el.type === 'radio' || role === 'radio') out.tick = 'radio';
    if (out.tick) out.checked = el.tagName === 'INPUT' ? el.checked : el.getAttribute('aria-checked') === 'true';
    if (!name) {
      if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) out.css = `#${el.id}`;
      else if (el.getAttribute('data-testid')) out.css = `[data-testid="${el.getAttribute('data-testid')}"]`;
      return out;
    }
    const lower = name.toLowerCase();
    const same = [...document.querySelectorAll(ACT)].filter((x) => x !== el && !x.contains(el) && !el.contains(x) && !(x.tagName === 'LABEL' && (x.control === el || x.contains(el))) && shown(x) && nameOf(x).toLowerCase() === lower);
    if (same.length) { out.twins = same.length + 1; out.near = nearWords(el, name); }
    return out;
  };
  let h = 0;
  const fingerprint = () => {
    const s = location.href + '|' + (document.body?.innerText ?? '') + '|' + document.querySelectorAll('[role=dialog],[role=menu],[role=listbox],dialog[open],[aria-expanded=true]').length;
    h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return h;
  };
  let ids = 0;
  const later = (id, before) => setTimeout(() => send({ kind: 'effect', id, before, after: fingerprint(), url: location.href }), 900);
  send({ kind: 'page', url: location.href, how: performance.getEntriesByType?.('navigation')?.[0]?.type ?? 'navigate' });
  // Back and forward: a page Chrome restores from memory runs nothing again, and an app that changes pages itself
  // only hears "popstate", so both are reported here.
  addEventListener('pageshow', (e) => { if (e.persisted) send({ kind: 'page', url: location.href, how: 'back_forward' }); });
  addEventListener('popstate', () => send({ kind: 'page', url: location.href, how: 'back_forward' }));

  // Pointer: clicks, double and right clicks, drags.
  let down = null;
  addEventListener('pointerdown', (e) => { if (e.isPrimary) down = { x: e.clientX, y: e.clientY, target: e.target, fp: fingerprint(), button: e.button }; }, true);
  addEventListener('pointerup', (e) => {
    if (!down || !e.isPrimary) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 12 && down.button === 0) {
      const from = actionable(down.target) ?? down.target;
      const toEl = document.elementFromPoint(e.clientX, e.clientY);
      const to = toEl ? (actionable(toEl) ?? toEl) : null;
      const id = ++ids;
      send({ kind: 'drag', id, from: describe(from), to: to && to !== from ? describe(to) : null, by: [Math.round(e.clientX - down.x), Math.round(e.clientY - down.y)], before: down.fp });
      later(id, down.fp);
      down = null;
    }
  }, true);
  addEventListener('click', (e) => {
    if (!down) return;
    const before = down.fp;
    down = null;
    const raw = e.target;
    const el = actionable(raw) ?? raw;
    const id = ++ids;
    const d = describe(el);
    if (!actionable(raw)) d.plain = true; // not a button, link, field or the like
    if (d?.tick) setTimeout(() => { const now = el.tagName === 'INPUT' ? el.checked : el.getAttribute('aria-checked') === 'true'; send({ kind: 'ticked', id, checked: now }); }, 0);
    send({ kind: 'click', id, target: d, detail: e.detail, before });
    later(id, before);
  }, true);
  addEventListener('dblclick', (e) => { const el = actionable(e.target) ?? e.target; send({ kind: 'dblclick', target: describe(el) }); }, true);
  addEventListener('contextmenu', (e) => { const el = actionable(e.target) ?? e.target; const id = ++ids; const before = fingerprint(); send({ kind: 'rightclick', id, target: describe(el), before }); later(id, before); }, true);

  // Typing: the field's final text when the person leaves it or presses Enter. Never a password or code field.
  let field = null;
  const flush = () => {
    if (!field) return;
    const f = field;
    const text = f.el.isContentEditable ? f.el.innerText : f.el.value;
    if (text !== f.initial) send({ kind: 'type', into: f.desc, text, initial: f.initial });
    f.initial = text;
  };
  addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el?.matches?.(FIELD)) return;
    flush();
    if (isSecret(el)) { field = null; send({ kind: 'secret' }); return; }
    field = { el, desc: describe(el), initial: el.isContentEditable ? el.innerText : el.value };
  }, true);
  addEventListener('focusout', (e) => { if (field && e.target === field.el) { flush(); field = null; } }, true);
  addEventListener('change', (e) => {
    const el = e.target;
    if (el?.tagName === 'SELECT') send({ kind: 'select', from: describe(el), value: clean(el.selectedOptions?.[0]?.textContent ?? el.value) });
    else if (field && el === field.el) flush();
  }, true);
  addEventListener('pagehide', () => flush(), true);

  // Keys: the mark key, Enter, Escape, Tab, arrows and shortcuts. Letters typed in fields come through "type".
  const mk = cfg.markKey;
  const named = (e) => [e.metaKey && 'Meta', e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && e.key.length > 1 && 'Shift', e.key.length === 1 ? e.key.toUpperCase() : e.key].filter(Boolean).join('+');
  addEventListener('keydown', (e) => {
    if (mk && e.key.toLowerCase() === mk.key && e.ctrlKey === mk.ctrl && e.metaKey === mk.meta && e.altKey === mk.alt && e.shiftKey === mk.shift) {
      e.preventDefault(); e.stopImmediatePropagation();
      flush();
      send({ kind: 'mark' });
      return;
    }
    const inField = Boolean(e.target?.matches?.(FIELD));
    if (inField && isSecret(e.target)) return;
    const special = ['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key) || (!inField && [' ', 'Delete', 'Backspace'].includes(e.key));
    const shortcut = (e.metaKey || e.ctrlKey) && e.key.length === 1;
    if (!special && !shortcut) return;
    if (inField && !shortcut && !['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    if (inField) flush();
    const id = ++ids;
    const before = fingerprint();
    send({ kind: 'press', id, key: e.key === ' ' ? 'Space' : named(e), inField, before });
    later(id, before);
  }, true);

  // Scrolls: one step per scroll the person makes, once it has come to rest.
  const scrolls = new Map();
  addEventListener('scroll', (e) => {
    const el = e.target === document ? document.scrollingElement : e.target;
    if (!el) return;
    const top = el.scrollTop;
    const s = scrolls.get(el) ?? { from: el.__studioLastTop ?? 0, timer: 0 };
    clearTimeout(s.timer);
    s.timer = setTimeout(() => {
      scrolls.delete(el);
      const page = el === document.scrollingElement || el === document.documentElement || el === document.body;
      const dy = Math.round(el.scrollTop - s.from);
      el.__studioLastTop = el.scrollTop;
      if (Math.abs(dy) < 2) return;
      let area = null;
      if (!page) {
        const heading = el.querySelector('h1,h2,h3,h4,[role=heading]');
        area = clean(el.getAttribute('aria-label')) || (el.id && /^[A-Za-z][\w-]*$/.test(el.id) ? `#${el.id}` : '') || clean(heading?.textContent).slice(0, 40) || null;
      }
      send({ kind: 'scroll', dy, area, pageScroll: page });
    }, 450);
    scrolls.set(el, s);
  }, true);

  // Hovers that lasted: resting on a thing for 0.8 s without clicking it.
  let rest = null;
  addEventListener('pointermove', (e) => {
    const el = actionable(e.target) ?? (e.target?.closest?.('[title]') ?? null);
    if (rest?.el === el) return;
    if (rest) clearTimeout(rest.timer);
    rest = el ? { el, timer: setTimeout(() => { const d = describe(el); if (d?.words || d?.css) send({ kind: 'hover', target: d }); }, 800) } : null;
  }, true);
  addEventListener('pointerdown', () => { if (rest) { clearTimeout(rest.timer); rest = null; } }, true);
}
