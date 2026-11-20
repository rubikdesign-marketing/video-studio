// Preview links to files the release leaves out (the motion and background mp4s). In each listed JSON file, every
// object inside any array loses its `preview` key when that path is not in the stage. Returns [{ file, dropped }].
import fs from 'node:fs';
import path from 'node:path';

export function stripMissingPreviews(stageDir, indexFiles = []) {
  const report = [];
  for (const file of indexFiles) {
    const full = path.join(stageDir, file);
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    let dropped = 0;
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      if (typeof node.preview === 'string' && !fs.existsSync(path.join(stageDir, node.preview))) {
        delete node.preview;
        dropped++;
      }
      Object.values(node).forEach(walk);
    };
    walk(data);
    fs.writeFileSync(full, JSON.stringify(data, null, 1) + '\n');
    report.push({ file, dropped });
  }
  return report;
}
