import { createApp } from './http-app.js';

/** Cloudflare's Rate Limiting binding (see wrangler.toml). */
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  RATE_LIMITER?: RateLimitBinding;
}

const app = createApp({ onerror: (error) => console.error('[taco-br] error:', error) });

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const binding = env.RATE_LIMITER;
    return app(request, {
      clientKey: request.headers.get('cf-connecting-ip') ?? 'anonymous',
      rateLimiter: binding && { allow: async (key) => (await binding.limit({ key })).success }
    });
  }
};
