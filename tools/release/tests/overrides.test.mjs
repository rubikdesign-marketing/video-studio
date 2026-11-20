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
