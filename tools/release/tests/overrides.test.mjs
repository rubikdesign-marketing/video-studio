// The override files ship in the zip and the guides render on the buyer's studio page, so review notes such as
// HTML comments must never be left in them (an HTML comment shows as visible text there).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../../../release/overrides/", import.meta.url);

test("release overrides carry no HTML comments or draft markers", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  assert.ok(files.includes("LICENSE.md"));
  for (const f of files) {
    const text = readFileSync(new URL(f, dir), "utf8");
    assert.doesNotMatch(text, /<!--/, `${f} has an HTML comment`);
    assert.doesNotMatch(text, /lawyer to approve/i, `${f} has a draft marker`);
  }
});

test("ONBOARDING points support at contact@damex.digital, not a purchase email", () => {
  const text = readFileSync(new URL("ONBOARDING.md", dir), "utf8");
  assert.match(text, /contact@damex\.digital/);
  assert.doesNotMatch(text, /purchase email/i);
});

test("ONBOARDING and README tell the buyer about the brief page", () => {
  for (const f of ["ONBOARDING.md", "README.md"]) {
    const text = readFileSync(new URL(f, dir), "utf8");
    assert.match(text, /brief page/i, `${f} does not mention the brief page`);
  }
});

test("the shipped studio.json has no brief_page, so the first chat publishes it", () => {
  const studio = JSON.parse(readFileSync(new URL("studio.json", dir), "utf8"));
  assert.equal("brief_page" in studio, false);
});

test("the release manifest does not exclude the connector or the brief page", () => {
  const manifest = JSON.parse(readFileSync(new URL("../../../release/manifest.json", import.meta.url), "utf8"));
  for (const keep of ["tools/connector", "studio/brief-desk", "setup/runtime/connector.mjs"]) {
    const hit = manifest.exclude.find((e) => keep === e || keep.startsWith(e + "/"));
    assert.equal(hit, undefined, `${keep} is excluded by ${hit}`);
  }
});

test("CLAUDE override covers opening the brief page and approving the connector", () => {
  const text = readFileSync(new URL("CLAUDE.md", dir), "utf8");
  assert.match(text, /Open my brief page/);
  assert.match(text, /damex-engine/);
});

test("CLAUDE.md mentions the style library in plain words", () => {
  const text = readFileSync(new URL("CLAUDE.md", dir), "utf8");
  assert.match(text, /style library/i);
  assert.match(text, /brief page/i);
});

test("README and ONBOARDING each say the brief page holds a style library", () => {
  for (const f of ["README.md", "ONBOARDING.md"]) {
    const text = readFileSync(new URL(f, dir), "utf8");
    assert.match(text, /style library/i, `${f} does not mention the style library`);
  }
});
