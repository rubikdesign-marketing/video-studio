// Pure parts of publishing a release to the damex.digital download bucket (tools/release/publish.mjs).
// The website reads releases/<version>/release.json, the zip beside it, and current.json ({"version": "<version>"}).

const NOT_FOUND = 'The start prompt was not found under step 3 of ONBOARDING.md, so nothing was published.';

// The first fenced `text` block after the line starting "3. **Start it.**", without its indentation.
export function extractStartPrompt(onboardingMd) {
  const lines = String(onboardingMd).split(/\r?\n/);
  const step = lines.findIndex((l) => l.startsWith('3. **Start it.**'));
  if (step < 0) throw new Error(NOT_FOUND);
  for (let i = step + 1; i < lines.length; i++) {
    // The next numbered step starts, so step 3 had no block.
    if (/^\d+\. /.test(lines[i])) break;
    const open = lines[i].match(/^(\s*)```text\s*$/);
    if (!open) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*```\s*$/.test(lines[j])) {
        const text = body.map((l) => (l.startsWith(open[1]) ? l.slice(open[1].length) : l.trimStart())).join('\n').trim();
        if (!text) throw new Error(NOT_FOUND);
        return text;
      }
      body.push(lines[j]);
    }
    break;
  }
  throw new Error(NOT_FOUND);
}

export function buildReleaseJson({ version, file, bytes, sha256, released, onboarding, readme, license }) {
  return {
    version, file, bytes, sha256, released,
    prompt: extractStartPrompt(onboarding),
    guides: [
      { name: 'ONBOARDING', markdown: onboarding },
      { name: 'README', markdown: readme },
      { name: 'LICENSE', markdown: license },
    ],
  };
}

// What goes into the bucket, in order. current.json is last: it is what makes the new version the one buyers see.
export function uploadPlan(version, file) {
  return [
    { key: `releases/${version}/${file}`, source: 'zip' },
    { key: `releases/${version}/release.json`, source: 'json' },
    { key: 'current.json', source: 'json' },
  ];
}
