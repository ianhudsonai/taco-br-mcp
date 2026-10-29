import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { connect } from './helpers/client.js';

let client: Client;

beforeAll(async () => {
  client = await connect();
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
