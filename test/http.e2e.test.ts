import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createApp } from '../src/http-app.js';
import { createMemoryRateLimiter } from '../src/rate-limit.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = 'TACO 4ª ed. (NEPA/UNICAMP, 2011)';

let child: ChildProcess;
let base: string;

beforeAll(async () => {
  child = spawn('node', ['dist/server.js', '--http', '--port', '0'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  base = await new Promise<string>((resolve, reject) => {
    let stderr = '';
    child.once('exit', (code) => reject(new Error(`server exited (${code}): ${stderr}`)));
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      const match = /ready at (http:\/\/\S+?)\/mcp/.exec(stderr);
      if (match) resolve(match[1]!);
    });
  });
});
afterAll(() => {
  child.kill();
});

describe('Streamable HTTP (node --http)', () => {
  it('serves the same tools through the MCP client', async () => {
    const client = new Client({ name: 'taco-http-test', version: '0.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`)));
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        'calc_meal',
        'compare_foods',
        'convert_household_measure',
        'get_amino_acids',
        'get_fatty_acids',
        'get_nutrients',
        'ping',
        'search_food'
      ]);
      const r = await client.callTool({ name: 'ping', arguments: { echo: 'oi' } });
      expect(JSON.stringify(r.content)).toContain(SOURCE);
      const s = await client.callTool({ name: 'search_food', arguments: { query: 'arroz' } });
      expect(JSON.stringify(s.content)).toContain(SOURCE);
    } finally {
      await client.close();
    }
  });

  it('answers a raw 2025-style JSON-RPC POST (what ChatGPT sends)', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'raw', version: '0' }
        }
      })
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.text()).toContain('taco-br');
  });

  it('has a health route and 404s elsewhere', async () => {
    const health = await (await fetch(`${base}/health`)).json();
    expect(health).toMatchObject({
      ok: true,
      server: 'taco-br',
      mcp_endpoint: '/mcp',
      source: SOURCE
    });
    expect((await fetch(`${base}/nope`)).status).toBe(404);
  });

  it('answers CORS preflight for browser clients', async () => {
    const res = await fetch(`${base}/mcp`, {
      method: 'OPTIONS',
      headers: { 'access-control-request-headers': 'content-type, mcp-protocol-version' }
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-headers')).toContain('mcp-protocol-version');
  });
});

describe('rate limiting', () => {
  const ping = () =>
    new Request('http://x/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    });

  it('returns 429 with Retry-After once a client exceeds its limit, per client', async () => {
    const app = createApp();
    const rateLimiter = createMemoryRateLimiter(2, 60_000);
    const statuses: number[] = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await app(ping(), { clientKey: 'a', rateLimiter })).status);
    }
    expect(statuses[2]).toBe(429);
    expect(statuses.slice(0, 2)).not.toContain(429);
    const limited = await app(ping(), { clientKey: 'a', rateLimiter });
    expect(limited.headers.get('retry-after')).toBe('30');
    expect(limited.headers.get('access-control-allow-origin')).toBe('*');
    expect((await app(ping(), { clientKey: 'b', rateLimiter })).status).not.toBe(429);
  });

  it('does not rate limit the health route', async () => {
    const app = createApp();
    const rateLimiter = createMemoryRateLimiter(1, 60_000);
    for (let i = 0; i < 3; i++) {
      const res = await app(new Request('http://x/health'), { clientKey: 'a', rateLimiter });
      expect(res.status).toBe(200);
    }
  });

  it('window resets after the period', async () => {
    const rateLimiter = createMemoryRateLimiter(1, 20);
    expect(rateLimiter.allow('a')).toBe(true);
    expect(rateLimiter.allow('a')).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(rateLimiter.allow('a')).toBe(true);
  });
});
