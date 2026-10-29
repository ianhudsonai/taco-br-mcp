import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
let client: Client;

beforeAll(async () => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'ignore' });
  client = new Client({ name: 'taco-test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({ command: 'node', args: ['dist/server.js'], cwd: root })
  );
});

afterAll(async () => {
  await client.close();
});

describe('ping (stdio, built binary)', () => {
  it('lists the ping tool as read-only', async () => {
    const { tools } = await client.listTools();
    const ping = tools.find((t) => t.name === 'ping');
    expect(ping).toBeDefined();
    expect(ping?.annotations?.readOnlyHint).toBe(true);
  });

  it('returns structured output with the source citation', async () => {
    const result = await client.callTool({ name: 'ping', arguments: { echo: 'oi' } });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      server: 'taco-br',
      source: 'TACO 4ª ed. (NEPA/UNICAMP, 2011)'
    });
    expect(JSON.stringify(result.content)).toContain('pong: oi');
  });
});
