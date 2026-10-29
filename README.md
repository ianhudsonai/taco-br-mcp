# taco-br-mcp

MCP server (stdio) that lets an AI answer with exact numbers from the **TACO** — Tabela Brasileira de Composição de Alimentos, 4ª ed. (NEPA/UNICAMP, 2011) — instead of guessing.

> Work in progress (v0.1.0 scaffold). Currently exposes a `ping` tool; data is generated (`npm run build:data`) but not yet served by tools. Works with Claude Desktop, Claude Code and Cursor (stdio). Remote HTTP (ChatGPT) is not part of v1.

## Development

```bash
npm install
npm run build
npm test
npm run inspect   # MCP Inspector against dist/server.js
```

Never write to stdout (`console.log`) — it is the protocol channel. Use `console.error`.

## Data & license

Code: MIT. Nutritional data belongs to NEPA/UNICAMP (TACO) and IBGE (POF); see `NOTICE.md` (to be completed in step 2). Not medical or nutritional advice.
