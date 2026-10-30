# AGENTS.md — taco-br-mcp

MCP server (TypeScript, stdio and Streamable HTTP) that answers questions about the TACO table
(Tabela Brasileira de Composição de Alimentos, 4ª ed., NEPA/UNICAMP, 2011)
with exact numbers and a citation, instead of letting the model guess.
This file only routes. Facts live in the files linked below.

## Commands

- `npm run lint && npm run typecheck && npm test` — must pass before any commit
- `npm run build` — tsup to `dist/`
- `npm run build:data` — regenerate `data/foods.json`, `data/household.json` and `data/profiles.json` from the pinned CSVs (add `-- --fetch` to re-download them from the pinned SHA)
- `npm run inspect` — build and open MCP Inspector against `dist/server.js`

## Layout

- `src/server.ts` — entry point: stdio (`serveStdio`) by default, `--http` for Streamable HTTP on Node
- `src/http-app.ts` — web-standard `Request -> Response` app (`createMcpHandler`, `/mcp`, `/health`, CORS, 429); shared by Node and the Worker
- `src/node-http.ts` (node:http adapter), `src/worker.ts` (Cloudflare Workers entry), `src/rate-limit.ts`; `wrangler.toml` — Worker config; `docs/remote.md` — deploy and ChatGPT setup
- `src/create-server.ts` — builds the McpServer and registers every tool
- `src/tools/<tool>.ts` — one file per tool, exports `registerX(server)`; `get_fatty_acids` and `get_amino_acids` are thin wrappers over `src/profile-tool.ts`, data in `src/data/profiles.ts`
- `src/constants.ts` — server name/version and the citation string
- `scripts/build-data.ts` — CSV -> JSON pipeline (`scripts/build-profiles.ts` for fatty/amino acids, `scripts/upstream.ts` for the pinned-CSV loader); `scripts/nutrients.ts`, `scripts/profiles.ts` and `scripts/measures.ts` hold the column and measure-label tables; `src/household.ts` matches user wording to measures
- `data/foods.json`, `data/household.json`, `data/profiles.json` — generated, committed, shipped in the package; never edit by hand
- `data/raw/brolesi/` — pinned upstream CSVs (brolesi/taco) + `UPSTREAM.json` (commit SHA and sha256); never edit by hand
- `data/curation/household-map.json` — the only hand-edited data file (TACO -> POF mapping)
- `test/` — vitest; `*.e2e.test.ts` talk to the built server through the MCP client; `data.test.ts` checks the data against values transcribed from the official PDF
- `NOTICE.md` — data attribution; `README.md` — user-facing docs

## Hard rules

1. MCP SDK v2 only: `@modelcontextprotocol/server`, `registerTool`, `serveStdio`,
   `zod/v4`. Never the v1 package or API. `test/no-sdk-v1.test.ts` enforces this.
2. stdout belongs to the protocol (stdio mode). Never `console.log`; log to stderr if needed.
3. TypeScript strict, ESM, Node >= 20. No `any` to silence the compiler.
4. Every tool response cites "TACO 4ª ed. (NEPA/UNICAMP, 2011)".
5. Data semantics: `Tr` -> `{ trace: true }`; empty/missing -> `null`; never `0`.
   The only zeros that were not measured are the 4 negative carbohydrate means,
   clamped to 0 with a `notes` entry; surface that note. Never invent or estimate
   a value that is not in the table. Fatty/amino acid tables cover only 423/26 foods: a food outside
   one gets `available: false`, never a row of nulls or zeros. Amino acids have a published `0`
   (TACO prints 0,00 under 0.005 g/100 g); that 0 is data, not missing. TACO prints the amino acid
   row of Maria mole (504) under number 468; `build-profiles.ts` corrects it with a note.
6. `calc_meal` totals are lower bounds when any ingredient value is missing, and
   the response must say so.
7. Household measures (TACO <-> POF) have no shared key. Use
   `data/curation/household-map.json` only; do not fuzzy-match. A food without an
   entry has no household measures: say so, do not guess. When adding an entry,
   check the POF `descricao_fonte` of every measure (it often belongs to another
   food, e.g. flour instead of cooked couscous) and keep only the matching ones.
8. Add a new tool = new file in `src/tools/` + one line in `create-server.ts` +
   a test. Keep tool descriptions short; they are read by models.
9. Changing `data/raw/` or the pinned SHA means rerunning `npm run build:data`,
   updating `NOTICE.md`, and rechecking the PDF-based cases in `test/data.test.ts`.

## Release

Tag `v*` triggers `.github/workflows/release.yml` (npm publish with
`--provenance`, needs `NPM_TOKEN`). Registry name: `io.github.ianhudsonai/taco-br`.
Do not publish by hand.

## Scope

stdio is the default (Claude Code, Claude Desktop, Cursor). HTTP (`--http`, Cloudflare Worker) exists for ChatGPT: open, stateless, read-only, no auth. The Worker is deployed by hand with `npm run deploy:worker`; it is not part of the npm release. No sessions or state in HTTP mode.
