import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const src = fileURLToPath(new URL('..', import.meta.url));
const allowed = 'theme/tokens.css';
const textFile = /\.(ts|tsx|css|html|svg|json|md)$/;

// A hex colour of 3, 4, 6 or 8 digits, or a colour written as an rgb or hsl function, with or without alpha.
const literal = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|\b(?:rgb|hsl)a?\(/gi;

const files = readdirSync(src, { recursive: true, encoding: 'utf8' })
  .map((file) => file.replaceAll('\\', '/'))
  .filter((file) => textFile.test(file) && file !== allowed);

describe('colours', () => {
  it('finds files to check', () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain('ui/ui.css');
  });

  it('appear as literals only in theme/tokens.css', () => {
    const found = files.flatMap((file) =>
      readFileSync(`${src}/${file}`, 'utf8')
        .split('\n')
        .flatMap((line, index) => (line.match(literal) ?? []).map((hit) => `${file}:${index + 1} ${hit}`)),
    );
    expect(found).toEqual([]);
  });

  it('would be caught if one slipped in', () => {
    const samples = ['#' + 'fff', '#' + 'A1b2C3', 'rgb' + '(1, 2, 3)', 'hsl' + 'a(0 0% 0% / 1)'];
    for (const sample of samples) expect(sample.match(literal), sample).not.toBeNull();
    expect('#root .shell-top'.match(literal)).toBeNull();
  });
});
