import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { SERVER_NAME, SERVER_VERSION, SOURCE } from '../constants.js';

const outputSchema = z.object({
  ok: z.literal(true).describe('Always true when the server is alive.'),
  server: z.string().describe('Server name.'),
  version: z.string().describe('Server version.'),
  source: z.string().describe('Citation for the data this server exposes.')
});

export function registerPing(server: McpServer): void {
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description:
        'Health check for the taco-br server. Returns the server name, version and the data source citation.',
      inputSchema: z.object({
        echo: z.string().max(200).optional().describe('Optional text to echo back in the message.')
      }),
      outputSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ echo }) => {
      const output = {
        ok: true as const,
        server: SERVER_NAME,
        version: SERVER_VERSION,
        source: SOURCE
      };
      const text = `pong${echo ? `: ${echo}` : ''} — ${SERVER_NAME} v${SERVER_VERSION}. Fonte: ${SOURCE}`;
      return { content: [{ type: 'text' as const, text }], structuredContent: output };
    }
  );
}
