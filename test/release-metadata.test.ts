import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SERVER_VERSION } from '../src/constants.js';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json')) as {
  version: string;
  mcpName: string;
  repository?: { url?: string };
};
const server = JSON.parse(read('server.json')) as {
  name: string;
  description: string;
  version: string;
  repository: { url: string };
  packages: { identifier: string; version: string }[];
};

// npm --provenance rejects a publish whose package.json repository.url does not match the
// GitHub repository that built it (E422), so catch it before a tag does.
describe('release metadata', () => {
  it('points package.json at the GitHub repository that publishes it', () => {
    expect(pkg.repository?.url).toMatch(/github\.com\/ianhudsonai\/taco-br-mcp(\.git)?$/);
  });

  it('keeps the version identical in package.json, server.json, CITATION.cff and the server', () => {
    expect(server.version).toBe(pkg.version);
    expect(server.packages[0]?.version).toBe(pkg.version);
    expect(SERVER_VERSION).toBe(pkg.version);
    expect(read('CITATION.cff')).toMatch(new RegExp(`^version: ${pkg.version}$`, 'm'));
  });

  it('keeps the registry name and package identifier in sync with package.json', () => {
    expect(server.name).toBe(pkg.mcpName);
    expect(server.packages[0]?.identifier).toBe('taco-br-mcp');
    expect(server.repository.url).toBe('https://github.com/ianhudsonai/taco-br-mcp');
    expect(server.description.length).toBeLessThanOrEqual(100);
  });
});
