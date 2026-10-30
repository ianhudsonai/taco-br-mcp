# taco-br-mcp

MCP server (stdio) that lets an AI answer with exact numbers from the **TACO** — Tabela Brasileira de Composição de Alimentos, 4ª ed. (NEPA/UNICAMP, 2011) — instead of guessing.

> Work in progress (pre-0.1.0). Tools so far: `search_food`, `get_nutrients`, `calc_meal`, `compare_foods` and `convert_household_measure`, plus a `ping` health check. Works with Claude Desktop, Claude Code and Cursor (stdio). Remote HTTP (ChatGPT) is not part of v1.

## Tools

| Tool                        | What it does                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_food`               | Find foods by Portuguese name (accent-insensitive, a few synonyms such as aipim/macaxeira). Returns ids and kcal per 100 g.                                                                                         |
| `get_nutrients`             | Full composition of one food by id, per 100 g or scaled to a number of grams. Trace (`Tr`) is `{"trace":true}` and not analyzed (`NA`) is `null`, never 0.                                                          |
| `calc_meal`                 | Sum nutrients over `[{food_id, grams}]` or `[{food_id, household_measure, quantity}]`. A total is flagged `is_lower_bound` (and the foods without data are named) when some item has no data for that nutrient.     |
| `compare_foods`             | 2 to 10 foods side by side on chosen nutrients, per 100 g. Missing data stays `null`.                                                                                                                               |
| `convert_household_measure` | "2 colheres de sopa" of a food to grams, from the IBGE POF table through a hand-curated mapping (69 foods so far). Ambiguous food names return candidates; uncovered foods or measures are reported, never guessed. |

Every response cites TACO 4ª ed. (NEPA/UNICAMP, 2011).

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
