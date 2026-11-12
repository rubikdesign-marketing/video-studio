// In-page helpers for the "layer" and "snapshot" steps (tools/capture/README.md, "Layers and snapshots").
// Every function here runs inside the product's page (page.evaluate), so each one is self-contained.

/**
 * layer: hides everything on the page except the thing marked data-studio-layer (and what is inside it), and makes
 * the page's own background see-through, so a screenshot of its box is the thing alone on a transparent background.
 * Returns where the thing is (page pixels, from the top left of the window) and how far its shadow reaches.
 */
export function layerOn() {
  const el = document.querySelector('[data-studio-layer]');
  if (!el) return null;
  const style = document.createElement('style');
  style.id = 'studio-layer-style';
  style.textContent = `
    html, body { background: transparent !important; background-image: none !important; }
    body *, body::before, body::after, html::before, html::after { visibility: hidden !important; }
    [data-studio-layer], [data-studio-layer] * { visibility: visible !important; }
    [data-studio-layer] [data-studio-hide], [data-studio-layer] [data-studio-yours] { visibility: hidden !important; }
  `;
  document.documentElement.appendChild(style);
  const r = el.getBoundingClientRect();
  // How far the thing's own shadow and outline reach outside its box, so they are kept in the picture.
  let reach = 0;
  const cs = getComputedStyle(el);
  for (const m of (cs.boxShadow === 'none' ? '' : cs.boxShadow).matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px(?:\s+([\d.]+)px)?(?:\s+(-?[\d.]+)px)?/g)) {
    const [, x, y, blur = 0, spread = 0] = m.map(Number);
    if (/inset/.test(cs.boxShadow)) continue;
    reach = Math.max(reach, Math.abs(x) + Number(blur) + Math.max(0, Number(spread)), Math.abs(y) + Number(blur) + Math.max(0, Number(spread)));
  }
  reach = Math.max(reach, (parseFloat(cs.outlineWidth) || 0) + Math.max(0, parseFloat(cs.outlineOffset) || 0));
  return { x: r.x, y: r.y, w: r.width, h: r.height, reach: Math.ceil(reach), radius: cs.borderRadius, scroll: [scrollX, scrollY], viewport: [innerWidth, innerHeight] };
}

/** Puts the page back as it was after a layer. */
export function layerOff() {
  document.getElementById('studio-layer-style')?.remove();
  document.querySelectorAll('[data-studio-layer]').forEach((el) => el.removeAttribute('data-studio-layer'));
}

/**
 * snapshot: the code of the thing marked data-studio-snap, made to stand on its own. Returns its outer HTML (scripts
 * and event handlers removed, field values and pictures' addresses baked in, each row and number tagged with
 * data-studio-part), and the page's CSS rules that apply inside it, scoped to one class the way the old screen kit's
 * scope-css did (every selector gains the same one class, so the product's own cascade inside it is unchanged, and
 * nothing outside it is touched). Media queries are decided for the page size the snapshot was taken at.
 */
export function snapshotOf({ scope }) {
  const root = document.querySelector('[data-studio-snap]');
  if (!root) return null;
  const S = `.${scope}`;
  const all = [root, ...root.querySelectorAll('*')];
  const PSEUDO = /::?(before|after|placeholder|marker|selection|first-line|first-letter|backdrop|file-selector-button|-webkit-[a-z-]+)|:(hover|focus|focus-visible|focus-within|active|visited|target|checked|disabled|enabled|indeterminate|placeholder-shown|autofill|-webkit-autofill)\b/g;
  const matchesAny = (sel) => {
    const plain = sel.replace(PSEUDO, '').trim() || '*';
    try { return all.some((el) => el.matches(plain)); } catch { return false; }
  };
  // Splits a selector list at its top-level commas (not those inside :is(...), [attr="a,b"] and the like).
  const split = (text) => {
    const out = []; let depth = 0, quote = null, cur = '';
    for (const ch of text) {
      if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  // :root, html and body become the scope itself; anything else is looked for inside it.
  const scoped = (sel) => {
    const m = sel.match(/^(:root|html|body)((?:[.#[:][^\s>+~]*)?)(.*)$/i);
    if (m) return `${S}${S}${m[2]}${m[3]}`.trim();
    return `${S} ${sel}`;
  };
  const absolute = (cssText, base) => cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, u) => {
    if (/^(data:|https?:|blob:|#)/i.test(u)) return all;
    try { return `url("${new URL(u, base).href}")`; } catch { return all; }
  });
  const keyframes = new Map();
  const used = new Set();
  const customs = new Set();
  const unread = [];
  let kept = 0;
  const walk = (rules, base) => {
    const out = [];
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        for (let i = 0; i < rule.style.length; i++) if (rule.style[i].startsWith('--')) customs.add(rule.style[i]);
        const sels = split(rule.selectorText).filter(matchesAny);
        if (!sels.length) continue;
        const name = rule.style.animationName || (rule.style.animation || '').split(/[\s,]+/).find((w) => w && !/^[\d.]+m?s$|^(infinite|linear|ease|ease-in|ease-out|ease-in-out|forwards|backwards|both|none|alternate|reverse|normal|running|paused)$/.test(w));
        if (name) name.split(',').forEach((n) => used.add(n.trim()));
        const body = absolute(rule.style.cssText, base);
        const nested = rule.cssRules?.length ? walk(rule.cssRules, base).join('\n') : '';
        out.push(`${sels.map(scoped).join(', ')} { ${body}${nested ? `\n${nested}\n` : ''} }`);
        kept++;
      } else if (rule instanceof CSSMediaRule) {
        // Decided for the page as it is now: a matching query's rules are kept, the others dropped.
        if (matchMedia(rule.conditionText ?? rule.media.mediaText).matches) out.push(...walk(rule.cssRules, base));
      } else if (rule instanceof CSSSupportsRule) {
        if (CSS.supports(rule.conditionText)) out.push(...walk(rule.cssRules, base));
      } else if (typeof CSSLayerBlockRule !== 'undefined' && rule instanceof CSSLayerBlockRule) {
        const inner = walk(rule.cssRules, base);
        if (inner.length) out.push(`@layer ${rule.name} {\n${inner.join('\n')}\n}`);
      } else if (typeof CSSLayerStatementRule !== 'undefined' && rule instanceof CSSLayerStatementRule) {
        out.push(rule.cssText);
      } else if (rule instanceof CSSKeyframesRule) {
        keyframes.set(rule.name, absolute(rule.cssText, base));
      } else if (rule instanceof CSSFontFaceRule) {
        out.push(absolute(rule.cssText, base));
      } else if (typeof CSSContainerRule !== 'undefined' && rule instanceof CSSContainerRule) {
        out.push(`@container ${rule.conditionText} {\n${walk(rule.cssRules, base).join('\n')}\n}`);
      } else if (rule instanceof CSSImportRule) {
        try { out.push(...walk(rule.styleSheet.cssRules, rule.styleSheet.href ?? base)); } catch { unread.push(rule.href); }
      }
    }
    return out;
  };
  const css = [];
  for (const sheet of [...document.styleSheets, ...(document.adoptedStyleSheets ?? [])]) {
    if (sheet.disabled || ['studio-layer-style', '__studio_clean_screen'].includes(sheet.ownerNode?.id)) continue;
    let rules;
    try { rules = sheet.cssRules; } catch { unread.push(sheet.href ?? '(a style sheet from another site)'); continue; }
    css.push(...walk(rules, sheet.href ?? document.baseURI));
  }
  // Keyframe names are global, so each is renamed to the scope's own (as scope-css did), and so are its uses.
  for (const name of used) {
    if (!keyframes.has(name)) continue;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const use = new RegExp(`(animation(?:-name)?:[^;}]*?)(^|[\\s,])${esc}(?=[\\s,;]|$)`, 'g');
    for (let i = 0; i < css.length; i++) css[i] = css[i].replace(use, `$1$2${scope}-${name}`);
    css.push(keyframes.get(name).replace(/^@keyframes\s+\S+/, `@keyframes ${scope}-${name}`));
  }
  // What the snapshot inherits from the page around it, set on the scope itself: the type, its colour, and the
  // values of the product's CSS variables at that place.
  const cs = getComputedStyle(root.parentElement ?? root);
  const inherited = ['font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'color', 'direction', 'text-align', 'text-transform', 'word-spacing', 'white-space', 'font-feature-settings', 'font-variation-settings', '-webkit-font-smoothing', 'text-rendering', 'color-scheme'];
  const vars = [...customs].map((v) => [v, getComputedStyle(root).getPropertyValue(v).trim()]).filter(([, v]) => v);
  // A line height inherits as a factor of each element's own type size, so it is passed on as one, not in pixels.
  const value = (p) => {
    const v = cs.getPropertyValue(p);
    if (p === 'line-height' && /px$/.test(v)) return String(Math.round((parseFloat(v) / parseFloat(cs.fontSize)) * 1000) / 1000);
    return v;
  };
  const scopeRule = `${S} { ${inherited.map((p) => `${p}: ${value(p)};`).join(' ')} ${vars.map(([k, v]) => `${k}: ${v};`).join(' ')} }`;

  // The thing's code, copied, with each row and number tagged so the engine can move it on its own.
  const box = root.getBoundingClientRect();
  const parts = [];
  let id = 0;
  const ROW = 'li,tr,[role=row],[role=listitem],[role=option],[role=gridcell]';
  const NUMBER = /^[\s+\-−$€£¥#~]*\d[\d.,:\s]*\s*(%|k|K|m|M|bn|x|×|h|min|s|ms|pts?|°)?\s*$/;
  const tag = new Map();
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const text = (el.innerText ?? '').trim();
    const leaf = ![...el.children].some((c) => (c.innerText ?? '').trim());
    let kind = null;
    if (el !== root && el.matches(ROW)) kind = 'row';
    else if (leaf && text && NUMBER.test(text)) kind = 'number';
    else if (leaf && text && el !== root) kind = 'text';
    if (!kind) continue;
    const pid = `p${++id}`;
    tag.set(el, pid);
    parts.push({ id: pid, kind, text: text.slice(0, 200), box: [r.x - box.x, r.y - box.y, r.width, r.height].map((v) => Math.round(v * 10) / 10) });
  }
  const clone = root.cloneNode(true);
  const originals = all;
  const copies = [clone, ...clone.querySelectorAll('*')];
  copies.forEach((c, i) => {
    const o = originals[i];
    if (tag.has(o)) c.setAttribute('data-studio-part', tag.get(o));
    for (const a of [...c.attributes]) {
      if (/^on/i.test(a.name)) c.removeAttribute(a.name);
      if (/^data-studio-(snap|track|mask|layer|yours)$/.test(a.name)) c.removeAttribute(a.name);
    }
    if (o instanceof HTMLImageElement && o.currentSrc) { c.setAttribute('src', o.currentSrc); c.removeAttribute('srcset'); c.removeAttribute('loading'); }
    if (o instanceof HTMLInputElement) { if (o.type === 'password') c.setAttribute('value', ''); else c.setAttribute('value', o.value); if (o.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked'); }
    if (o instanceof HTMLTextAreaElement) c.textContent = o.value;
    if (o instanceof HTMLSelectElement) [...c.options].forEach((opt, k) => opt.toggleAttribute('selected', o.options[k]?.selected));
    if (o instanceof HTMLCanvasElement) {
      try { const img = document.createElement('img'); img.src = o.toDataURL('image/png'); img.setAttribute('style', c.getAttribute('style') ?? ''); img.className = c.className; img.width = o.width; img.height = o.height; c.replaceWith(img); } catch {}
    }
    if (o instanceof HTMLAnchorElement && o.href) c.setAttribute('href', o.href);
  });
  clone.querySelectorAll('script,noscript,template,[data-studio-hide],[data-studio-yours]').forEach((x) => x.remove());
  // A masked thing's words never leave the page: the copy keeps its shape, with dots for words, blurred.
  [clone, ...clone.querySelectorAll('[data-studio-mask]')].filter((x) => x.hasAttribute('data-studio-mask')).forEach((x) => {
    x.querySelectorAll('*').forEach((c) => { for (const n of c.childNodes) if (n.nodeType === 3) n.textContent = n.textContent.replace(/\S/g, '•'); });
    for (const n of x.childNodes) if (n.nodeType === 3) n.textContent = n.textContent.replace(/\S/g, '•');
    x.setAttribute('style', `${x.getAttribute('style') ?? ''}; filter: blur(6px)`);
    x.removeAttribute('data-studio-mask');
  });
  return {
    html: clone.outerHTML,
    css: [scopeRule, ...css].join('\n'),
    box: [box.x, box.y, box.width, box.height].map((v) => Math.round(v * 10) / 10),
    scroll: [scrollX, scrollY],
    viewport: [innerWidth, innerHeight],
    background: (() => { for (let a = root; a; a = a.parentElement) { const b = getComputedStyle(a).backgroundColor; if (b && b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b; } return 'rgb(255, 255, 255)'; })(),
    parts,
    rules: kept,
    unread,
  };
}
