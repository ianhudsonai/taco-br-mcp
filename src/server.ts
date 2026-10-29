import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './create-server.js';

// stdout is the protocol channel: log only with console.error.
serveStdio(createServer, {
  onerror: (error) => console.error('[taco-br] error:', error)
});
console.error('[taco-br] stdio server ready');
