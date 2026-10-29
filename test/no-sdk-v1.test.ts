import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const FORBIDDEN = [
  '@modelcontextprotocol/sdk',
  'server.tool(',
  'StdioServerTransport',
  'console.log('
];

describe('guard against SDK v1 habits and stdout writes', () => {
  const files = ['src', 'scripts']
    .flatMap((d) => {
      try {
        return walk(join(root, d));
      } catch {
        return [];
      }
    })
    .filter((f) => f.endsWith('.ts'));

  it.each(FORBIDDEN)('no source file contains %s', (needle) => {
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(needle));
    expect(offenders).toEqual([]);
  });

  it('package.json does not depend on the v1 SDK package', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps)).not.toContain('@modelcontextprotocol/sdk');
    expect(deps['@modelcontextprotocol/server']).toBeDefined();
  });
});
