#!/usr/bin/env node
// Serves the demo product (a small made-up web app for the `demo` brand) on this Mac only, for the capture tool:
//   node library/fixtures/demo-product/serve.mjs [port]      (default 4317, address http://127.0.0.1:<port>)
// It films the style library's capture-family previews without any client's product. Everything is local: the
// files in this folder, the brand's colours and shapes read from brands/demo/brand.json (as /brand.css), its
// wordmark and mark from brands/demo/logo, and Inter from the engine's own npm package. No network.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, '..', '..', '..');
const BRAND = join(STUDIO, 'brands', 'demo');

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json' };

/** The brand's colours, type and corner radii as CSS variables. Radii in brand.json are shares of a 1080 px frame. */
export function brandCss(brand = JSON.parse(readFileSync(join(BRAND, 'brand.json'), 'utf8'))) {
  const light = brand.colours.light;
  const px = (share) => `${Math.round(share * 1080)}px`;
  const vars = {
    '--page': light.page,
    '--ink': light.ink,
    '--second': light.second,
    '--accent': light.accent,
    '--on-accent': light.on_accent ?? light.page,
    '--warm': light.warm,
    '--soft': light.soft,
    '--line': light.line,
    '--control-radius': px(brand.shape.control_radius),
    '--window-radius': px(brand.shape.window_radius),
    '--headline-weight': String(brand.fonts.headline.weight),
    '--headline-tracking': `${brand.fonts.headline.tracking_em}em`,
    '--label-weight': String(brand.fonts.label.weight),
  };
  const family = brand.fonts.headline.family;
  return `@font-face { font-family: "${family}"; src: url("/fonts/brand.woff2") format("woff2"); font-weight: ${brand.fonts.headline.weight_range}; font-display: block; }\n`
    + `:root {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join('\n')}\n  --font: "${family}", system-ui, sans-serif;\n}\n`;
}

/** Inter from the engine's installed package (the same file brand.json names). Null when the engine is not installed. */
function fontFile() {
  try {
    const brand = JSON.parse(readFileSync(join(BRAND, 'brand.json'), 'utf8'));
    const require = createRequire(join(STUDIO, 'engine', 'package.json'));
    return require.resolve(brand.fonts.headline.package);
  } catch { return null; }
}

/** Where a request path is served from, or null. Only files in this folder, plus the three brand routes. */
export function fileFor(urlPath) {
  const path = decodeURIComponent(urlPath.split('?')[0]);
  if (path === '/fonts/brand.woff2') return fontFile();
  if (path === '/logo/wordmark.svg') return join(BRAND, 'logo', 'demo-wordmark-on-light.svg');
  if (path === '/logo/mark.svg') return join(BRAND, 'logo', 'demo-mark-on-light.svg');
  // Every page of the app is the one index.html: /, /customers, /reports, /settings.
  if (path === '/' || /^\/(overview|customers|reports|settings)\/?$/.test(path)) return join(HERE, 'index.html');
  const file = normalize(join(HERE, path));
  if (!file.startsWith(HERE + sep) || file.endsWith('.mjs')) return null;
  return existsSync(file) && statSync(file).isFile() ? file : null;
}

export function serve(port = 4317) {
  const server = createServer((req, res) => {
    if (req.url.split('?')[0] === '/brand.css') {
      res.writeHead(200, { 'content-type': TYPES['.css'], 'cache-control': 'no-store' });
      res.end(brandCss());
      return;
    }
    const file = fileFor(req.url);
    if (!file) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not here'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 4317);
  serve(port).then(() => console.log(`The demo product is at http://127.0.0.1:${port} (this Mac only). Ctrl+C stops it.`));
}
