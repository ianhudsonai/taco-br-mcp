# taco-br-mcp

[MCP](https://modelcontextprotocol.io) server that lets an AI assistant answer with exact numbers from the **TACO** — _Tabela Brasileira de Composição de Alimentos_, 4ª ed. (NEPA/UNICAMP, 2011) — instead of guessing. 597 Brazilian foods, 26 nutrients, per 100 g of edible portion, plus household measures ("2 colheres de sopa", "1 unidade") from the IBGE POF.

> **Em português:** servidor MCP com a Tabela Brasileira de Composição de Alimentos (TACO). Busca alimentos, devolve nutrientes, soma refeições e converte medidas caseiras em gramas. Toda resposta cita a fonte, e o que a tabela não traz vem como "sem dado", nunca como zero.

stdio by default, for Claude Desktop, Claude Code, Cursor and other local MCP clients. It also serves Streamable HTTP (`--http`), which is how ChatGPT connects: see [Remote HTTP and ChatGPT](#remote-http-and-chatgpt).

## Install

Requires Node.js 20 or newer.

**Claude Code**

```bash
claude mcp add taco-br -- npx -y taco-br-mcp
```

**Claude Desktop** (`claude_desktop_config.json`) and **Cursor** (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "taco-br": { "command": "npx", "args": ["-y", "taco-br-mcp"] }
  }
}
```

Then ask, for example: _"Quantas kcal tem uma refeição de 4 colheres de sopa de arroz, 100 g de feijão carioca e 100 g de peito de frango grelhado?"_

## Remote HTTP and ChatGPT

ChatGPT cannot reach a server running on your PC, so the same tools are available over Streamable HTTP:

```bash
npx -y taco-br-mcp --http   # http://127.0.0.1:3000/mcp
```

A public instance runs at `https://taco-br-mcp.taco-br-mcp.workers.dev/mcp` (open, no login, rate limited; best effort, no uptime promise). The repository also ships a Cloudflare Workers deployment (free plan, open access, per-IP rate limit). Step-by-step deploy and the ChatGPT connector setup (Settings → Apps & Connectors, developer mode, authentication "No authentication") are in [docs/remote.md](docs/remote.md).

## Tools

| Tool                        | What it does                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_food`               | Find foods by Portuguese name (accent-insensitive, a few synonyms such as aipim/macaxeira). Returns ids and kcal per 100 g.                                                                                         |
| `get_nutrients`             | Full composition of one food by id, per 100 g or scaled to a number of grams. Trace (`Tr`) is `{"trace":true}` and a value the table does not publish is `null`, never 0.                                           |
| `calc_meal`                 | Sum nutrients over `[{food_id, grams}]` or `[{food_id, household_measure, quantity}]`. A total is flagged `is_lower_bound` (and the foods without data are named) when some item has no data for that nutrient.     |
| `compare_foods`             | 2 to 10 foods side by side on chosen nutrients, per 100 g. Missing data stays `null`.                                                                                                                               |
| `convert_household_measure` | "2 colheres de sopa" of a food to grams, from the IBGE POF table through a hand-curated mapping (69 foods so far). Ambiguous food names return candidates; uncovered foods or measures are reported, never guessed. |
| `ping`                      | Health check.                                                                                                                                                                                                       |

All tools are read-only. Every response cites _TACO 4ª ed. (NEPA/UNICAMP, 2011)_.

## How it treats missing data

- `Tr` (trace, below the quantification limit) is `{"trace": true}`, never 0.
- A value the table does not publish is `null` and shown as "sem dado na TACO", never 0. The source marks these cells in three ways (`NA`, `*` for "analyses under re-evaluation", or blank); the processed CSV merges them, so the server does not tell them apart. Whole milk, for example, has no published energy or protein.
- `calc_meal` totals are **lower bounds** when an item lacks data for a nutrient: the response says which foods are missing.
- Household weights are POF/IBGE averages, not your plate. Only foods and measures whose POF description matches the food were mapped; anything else is reported as not covered.

## Mini-evaluation

15 questions about the TACO, answered by `claude -p` (`claude-sonnet-5-5`) with and without the server, 3 repetitions each (90 runs, 30 October 2026). A numeric answer is correct when it is within 5% of the table value; for the two "honesty" questions it is correct only if it says the TACO does not publish the value (whole milk energy) or that the total is a minimum (fiber of a meal that includes chicken, which has no fiber value).

| Category        | Without MCP | With MCP  |
| --------------- | ----------- | --------- |
| Direct lookup   | 16/18       | 18/18     |
| Scaled grams    | 9/9         | 9/9       |
| Comparison      | 3/3         | 3/3       |
| Household units | 1/6         | 6/6       |
| Whole meal      | 0/3         | 3/3       |
| Honesty         | 3/6         | 6/6       |
| **Total**       | **32/45**   | **45/45** |

Reading: the model already remembers many single TACO values, so direct lookups and gram scaling barely move. The gain is in household measures and meals, where without the server it answered "no data" 9 times or guessed unit weights, and in not repeating common knowledge: the TACO does not publish the energy of whole milk, and without the server the model answered 61 kcal in all 3 runs. Limits: one model, 15 questions, 3 repetitions, rule-based scoring (the 5% tolerance accepted one no-MCP answer with a wrong rice value that landed near the right sum). Questions, answer key and raw answers are in [`eval/`](eval); to repeat: `npm run build && node eval/run.mjs && node eval/score.mjs --detail`.

## Development

```bash
npm install
npm run build
npm test
npm run inspect   # MCP Inspector against dist/server.js
npm run build:data -- --fetch   # regenerate data/ from the pinned upstream CSVs
```

Never write to stdout (`console.log`): it is the protocol channel. Use `console.error`. See [AGENTS.md](AGENTS.md) for the project rules.

## Data & license

Code: MIT. Nutritional data: TACO 4ª ed., NEPA/UNICAMP (2011). Household-measure weights: **Fonte: IBGE, POF 2008-2009**, _Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil_ — the grams are IBGE's, unchanged; the mapping between TACO and POF foods was curated by this project, which is responsible for it. See [NOTICE.md](NOTICE.md) for sources, processing and pinned versions. If you use this in research, see [CITATION.cff](CITATION.cff). Not medical or nutritional advice.
