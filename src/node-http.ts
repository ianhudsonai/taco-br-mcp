import { createServer as createHttpServer, type Server } from 'node:http';
import { Readable } from 'node:stream';
import { createApp } from './http-app.js';
import { createMemoryRateLimiter } from './rate-limit.js';

export interface NodeHttpOptions {
  port: number;
  host: string;
  /** Requests per minute allowed for each client address. */
  limitPerMinute: number;
  /** Read the client address from X-Forwarded-For (only behind a proxy you control). */
  trustProxy: boolean;
}

/** Plain node:http server around the web-standard app, for local use or self-hosting. */
export function startHttpServer(options: NodeHttpOptions): Promise<Server> {
  const app = createApp({ onerror: (error) => console.error('[taco-br] error:', error) });
  const rateLimiter = createMemoryRateLimiter(options.limitPerMinute, 60_000);

  const server = createHttpServer(async (req, res) => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    const forwarded = options.trustProxy
      ? headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      : '';
    const clientKey = forwarded || req.socket.remoteAddress || 'anonymous';

    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    const request = new Request(`http://${headers.get('host') ?? 'localhost'}${req.url ?? '/'}`, {
      method: req.method,
      headers,
      signal: abort.signal,
      ...(hasBody ? { body: Readable.toWeb(req) as ReadableStream, duplex: 'half' } : {})
    } as RequestInit);

    const response = await app(request, { clientKey, rateLimiter });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (!response.body) return void res.end();
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, options.host, () => resolve(server));
  });
}
