import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

export async function connect(): Promise<Client> {
  const client = new Client({ name: 'taco-test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({ command: 'node', args: ['dist/server.js'], cwd: root })
  );
  return client;
}
