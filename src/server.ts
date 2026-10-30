import { parseArgs } from 'node:util';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './create-server.js';
import { startHttpServer } from './node-http.js';
import { MCP_PATH } from './http-app.js';

const USAGE = `taco-br-mcp [--http [--port 3000] [--host 127.0.0.1] [--rate-limit 120] [--trust-proxy]]

Default: stdio transport (Claude Code, Claude Desktop, Cursor).
--http  serve Streamable HTTP at ${MCP_PATH} instead (env: PORT, HOST).
`;

const { values } = parseArgs({
  options: {
    http: { type: 'boolean', default: false },
    port: { type: 'string' },
    host: { type: 'string' },
    'rate-limit': { type: 'string', default: '120' },
    'trust-proxy': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false }
  },
  strict: true
});

if (values.help) {
  // --help is the one place stdout is safe: no protocol is running.
  process.stdout.write(USAGE);
} else if (values.http) {
  const port = Number(values.port ?? process.env.PORT ?? 3000);
  const limitPerMinute = Number(values['rate-limit']);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${port}`);
  if (!Number.isInteger(limitPerMinute) || limitPerMinute < 1) {
    throw new Error('--rate-limit must be a positive integer (requests per minute per client)');
  }
  const host = values.host ?? process.env.HOST ?? '127.0.0.1';
  const server = await startHttpServer({
    port,
    host,
    limitPerMinute,
    trustProxy: values['trust-proxy']
  });
  const address = server.address();
  const actual = typeof address === 'object' && address ? address.port : port;
  console.error(`[taco-br] http server ready at http://${host}:${actual}${MCP_PATH}`);
} else {
  // stdout is the protocol channel: log only with console.error.
  serveStdio(createServer, {
    onerror: (error) => console.error('[taco-br] error:', error)
  });
  console.error('[taco-br] stdio server ready');
}
