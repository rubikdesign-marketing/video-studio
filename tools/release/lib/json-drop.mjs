// Entries dropped from JSON lists (a reference film by a company that must not appear).
// Per file the rule is one match object, or an array of them: an entry goes when it matches any one.
// Returns the problems (a match object that matched nothing), one per match object.
import fs from 'node:fs';
import path from 'node:path';

export function applyJsonDrop(stageDir, jsonDrop = {}) {
  const problems = [];
  for (const [file, rule] of Object.entries(jsonDrop)) {
    const full = path.join(stageDir, file);
    const list = JSON.parse(fs.readFileSync(full, 'utf8'));
    const wheres = Array.isArray(rule) ? rule : [rule];
    const matches = (item, where) => Object.entries(where).every(([k, v]) => item[k] === v);
    for (const where of wheres) {
      if (!list.some((item) => matches(item, where))) problems.push(`json_drop: nothing matched ${JSON.stringify(where)} in ${file}`);
    }
    const kept = list.filter((item) => !wheres.some((where) => matches(item, where)));
    fs.writeFileSync(full, JSON.stringify(kept, null, 1) + '\n');
  }
  return problems;
}
