import { createMcpHandler } from '@modelcontextprotocol/server';
import { SERVER_NAME, SERVER_VERSION, SOURCE } from './constants.js';
import { createServer } from './create-server.js';
import type { RateLimiter } from './rate-limit.js';

export interface HttpAppOptions {
  onerror?: (error: Error) => void;
}

/** Per-request facts only the host (Worker or Node) knows. */
export interface RequestContext {
  /** Identifies the caller for rate limiting (an IP address in practice). */
  clientKey: string;
  /** Checked before every request to the MCP endpoint. Omitted = no limit. */
  rateLimiter?: RateLimiter;
}

export type HttpApp = (request: Request, context: RequestContext) => Promise<Response>;

export const MCP_PATH = '/mcp';

const RETRY_AFTER_SECONDS = '30';

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers }
  });
}

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-expose-headers', 'mcp-session-id, retry-after');
  headers.set('vary', 'origin');
  if (request.method === 'OPTIONS') {
    headers.set('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
    headers.set(
      'access-control-allow-headers',
      request.headers.get('access-control-request-headers') ?? '*'
    );
    headers.set('access-control-max-age', '86400');
  }
  return new Response(response.body, { status: response.status, headers });
}

/**
 * Web-standard (Request -> Response) app: runs unchanged on Cloudflare Workers
 * and, through a thin adapter, on Node. Stateless and open (no auth): the data
 * is public and every tool is read-only.
 */
export function createApp(options: HttpAppOptions = {}): HttpApp {
  const mcp = createMcpHandler(createServer, { onerror: options.onerror });

  async function route(request: Request, context: RequestContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    if (pathname === '/' || pathname === '/health') {
      return json({
        ok: true,
        server: SERVER_NAME,
        version: SERVER_VERSION,
        mcp_endpoint: MCP_PATH,
        source: SOURCE
      });
    }

    if (pathname === MCP_PATH) {
      if (context.rateLimiter && !(await context.rateLimiter.allow(context.clientKey))) {
        return json({ error: 'rate_limited', message: 'Too many requests, slow down.' }, 429, {
          'retry-after': RETRY_AFTER_SECONDS
        });
      }
      return mcp.fetch(request);
    }

    return json({ error: 'not_found', mcp_endpoint: MCP_PATH }, 404);
  }

  return async (request, context) => {
    try {
      return withCors(await route(request, context), request);
    } catch (error) {
      options.onerror?.(error instanceof Error ? error : new Error(String(error)));
      return withCors(json({ error: 'internal_error' }, 500), request);
    }
  };
}
