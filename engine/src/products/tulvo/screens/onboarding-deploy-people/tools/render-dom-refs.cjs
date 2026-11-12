/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console, document */
// Render captured DOM snapshots (with their captured CSS) to PNG references for screens that have no
// matching screenshot. usage: node render-dom-refs.cjs <out dir> <snapshot.html>:<css> ...   (SCALE=2 default)
// Uses the Playwright install in research/ui-capture. Strips <script>/<link> and the extension overlay. Blocks every
// network request: Inter comes from the engine's local file.
// TEST ARTEFACT ONLY: snapshots hold AI sample data (possibly-real brands) and the account e-mail.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
// The app's Inter (opsz + wght variable, Latin) from the engine's local copy, inlined: nothing is fetched online.
const INTER = fs
  .readFileSync(path.resolve(__dirname, "../../../../../../public/brands/tulvo/fonts/inter-latin-opsz-normal.woff2"))
  .toString("base64");

(async () => {
  const [outDir, ...jobs] = process.argv.slice(2);
  const scale = Number(process.env.SCALE || 2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 805 }, deviceScaleFactor: scale });
  for (const job of jobs) {
    const [src, css, name] = job.split(":");
    let html = fs.readFileSync(src, "utf8");
    html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    html = html.replace(/<link\b[^>]*>/gi, "");
    const add =
      `<style>${fs.readFileSync(css, "utf8")}</style>` +
      `<style>@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:block;src:url(data:font/woff2;base64,${INTER}) format('woff2');}</style>` +
      `<style>#claude-phantom-cursor,#claude-agent-glow-border{display:none!important}</style>`;
    html = html.replace("<head>", "<head>" + add);
    const page = await ctx.newPage();
    await page.route("**/*", (r) => {
      const u = r.request().url();
      if (u.startsWith("data:") || u.startsWith("about:")) return r.continue();
      return r.abort();
    });
    await page.setContent(html, { waitUntil: "load", timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(800);
    // restore captured scroll offsets if the snapshot recorded any (data-scroll-top is not captured; no-op)
    const out = path.join(outDir, (name || path.basename(src, ".html")) + (scale === 1 ? "" : `@${scale}x`) + ".png");
    await page.screenshot({ path: out });
    console.log(out);
    await page.close();
  }
  await browser.close();
})();
