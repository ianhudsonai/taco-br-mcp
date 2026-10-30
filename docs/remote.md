# Remote HTTP server and ChatGPT

`taco-br-mcp` speaks stdio by default (Claude Code, Claude Desktop, Cursor). ChatGPT can only reach MCP servers over the internet, so the same six tools are also served over **Streamable HTTP** at `/mcp`. The server is stateless, open (no login: TACO is public data, every tool is read-only) and rate limited per client address.

## Run it yourself

```bash
npx -y taco-br-mcp --http                 # http://127.0.0.1:3000/mcp
npx -y taco-br-mcp --http --port 8080 --host 0.0.0.0 --rate-limit 120 --trust-proxy
```

`--rate-limit` is requests per minute per client (default 120). Use `--trust-proxy` only behind a proxy you control: it takes the client address from `X-Forwarded-For`. `PORT` and `HOST` environment variables work too. Other routes: `GET /` and `GET /health` return a small JSON status.

## Deploy on Cloudflare Workers (free)

Why Workers: the free plan needs no credit card, has no cold-start sleep (unlike free Render services), and the whole server is ~190 KiB gzipped. The free plan allows 100,000 requests per day; past that, Cloudflare rejects requests instead of billing. The endpoint is `src/worker.ts`; settings are in `wrangler.toml` (300 requests per minute per IP through Cloudflare's Rate Limiting binding).

1. Create a free account at <https://dash.cloudflare.com/sign-up> and verify the email.
2. In the repository: `npm install`, then `npx wrangler login` (opens the browser; approve).
3. `npm run deploy:worker`. Wrangler prints the URL, like `https://taco-br-mcp.<your-subdomain>.workers.dev`. On the first deploy it asks you to pick the `workers.dev` subdomain.
4. Check it: `curl https://taco-br-mcp.<your-subdomain>.workers.dev/health`. The MCP endpoint is the same URL plus `/mcp`.

To try it locally first: `npm run dev:worker` serves it on `http://localhost:8787/mcp`.

## Add it to ChatGPT

Custom MCP connectors are in ChatGPT's developer mode and depend on your plan and workspace settings; menu names change, so follow the current OpenAI help page if they differ.

1. Settings → Apps & Connectors (or Connectors) → Advanced settings → turn on **Developer mode**.
2. Back in Apps & Connectors, **Create** a new connector:
   - Name: `TACO Brasil`
   - MCP server URL: `https://taco-br-mcp.<your-subdomain>.workers.dev/mcp`
   - Authentication: **No authentication**
3. In a new chat, enable the connector for that chat (the **+** menu → More / Developer mode) and ask, for example: _"Quantas kcal tem 4 colheres de sopa de arroz e 100 g de feijão carioca? Use a TACO."_

ChatGPT calls the server from OpenAI's addresses, shared by many users, which is why the default limit is generous. Change `limit` in `wrangler.toml` if you see 429 responses.
