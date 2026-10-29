# AGENTS.md — taco-br-mcp

MCP server (TypeScript, stdio) that answers questions about the TACO table
(Tabela Brasileira de Composição de Alimentos, 4ª ed., NEPA/UNICAMP, 2011)
with exact numbers and a citation, instead of letting the model guess.
This file only routes. Facts live in the files linked below.

## Commands

- `npm run lint && npm run typecheck && npm test` — must pass before any commit
- `npm run build` — tsup to `dist/`
- `npm run build:data` — regenerate `data/foods.json` and `data/household.json` from the pinned CSVs (add `-- --fetch` to re-download them from the pinned SHA)
- `npm run inspect` — build and open MCP Inspector against `dist/server.js`

## Layout

- `src/server.ts` — stdio entry point (serveStdio only)
- `src/create-server.ts` — builds the McpServer and registers every tool
- `src/tools/<tool>.ts` — one file per tool, exports `registerX(server)`
- `src/constants.ts` — server name/version and the citation string
- `scripts/build-data.ts` — CSV -> JSON pipeline; `scripts/nutrients.ts` and `scripts/measures.ts` hold the column/label tables
- `data/foods.json`, `data/household.json` — generated, committed, shipped in the package; never edit by hand
- `data/raw/brolesi/` — pinned upstream CSVs (brolesi/taco) + `UPSTREAM.json` (commit SHA and sha256); never edit by hand
- `data/curation/household-map.json` — the only hand-edited data file (TACO -> POF mapping)
- `test/` — vitest; `*.e2e.test.ts` talk to the built server through the MCP client; `data.test.ts` checks the data against values transcribed from the official PDF
- `NOTICE.md` — data attribution; `README.md` — user-facing docs

## Hard rules

1. MCP SDK v2 only: `@modelcontextprotocol/server`, `registerTool`, `serveStdio`,
   `zod/v4`. Never the v1 package or API. `test/no-sdk-v1.test.ts` enforces this.
2. stdout belongs to the protocol. Never `console.log`; log to stderr if needed.
3. TypeScript strict, ESM, Node >= 20. No `any` to silence the compiler.
4. Every tool response cites "TACO 4ª ed. (NEPA/UNICAMP, 2011)".
5. Data semantics: `Tr` -> `{ trace: true }`; empty/missing -> `null`; never `0`.
   The only zeros that were not measured are the 4 negative carbohydrate means,
   clamped to 0 with a `notes` entry; surface that note. Never invent or estimate
   a value that is not in the table.
6. `calc_meal` totals are lower bounds when any ingredient value is missing, and
   the response must say so.
7. Household measures (TACO <-> POF) have no shared key. Use
   `data/curation/household-map.json` only; do not fuzzy-match. A food without an
   entry has no household measures: say so, do not guess.
8. Add a new tool = new file in `src/tools/` + one line in `create-server.ts` +
   a test. Keep tool descriptions short; they are read by models.
9. Changing `data/raw/` or the pinned SHA means rerunning `npm run build:data`,
   updating `NOTICE.md`, and rechecking the PDF-based cases in `test/data.test.ts`.

## Release

Tag `v*` triggers `.github/workflows/release.yml` (npm publish with
`--provenance`, needs `NPM_TOKEN`). Registry name: `io.github.ianhudsonai/taco-br`.
Do not publish by hand.

## Scope

v1 is stdio only (Claude Code, Claude Desktop, Cursor). HTTP/ChatGPT is v1.1.
