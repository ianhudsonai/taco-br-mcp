# taco-br-mcp

MCP server (stdio) that lets an AI answer with exact numbers from the **TACO** — Tabela Brasileira de Composição de Alimentos, 4ª ed. (NEPA/UNICAMP, 2011) — instead of guessing.

> Work in progress (pre-0.1.0). Tools so far: `search_food`, `get_nutrients`, `calc_meal`, `compare_foods` and `convert_household_measure`, plus a `ping` health check. Works with Claude Desktop, Claude Code and Cursor (stdio). Remote HTTP (ChatGPT) is not part of v1.

## Tools

| Tool                        | What it does                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_food`               | Find foods by Portuguese name (accent-insensitive, a few synonyms such as aipim/macaxeira). Returns ids and kcal per 100 g.                                                                                         |
| `get_nutrients`             | Full composition of one food by id, per 100 g or scaled to a number of grams. Trace (`Tr`) is `{"trace":true}` and a value the table does not publish is `null`, never 0.                                           |
| `calc_meal`                 | Sum nutrients over `[{food_id, grams}]` or `[{food_id, household_measure, quantity}]`. A total is flagged `is_lower_bound` (and the foods without data are named) when some item has no data for that nutrient.     |
| `compare_foods`             | 2 to 10 foods side by side on chosen nutrients, per 100 g. Missing data stays `null`.                                                                                                                               |
| `convert_household_measure` | "2 colheres de sopa" of a food to grams, from the IBGE POF table through a hand-curated mapping (69 foods so far). Ambiguous food names return candidates; uncovered foods or measures are reported, never guessed. |

Every response cites TACO 4ª ed. (NEPA/UNICAMP, 2011).

## Mini-avaliação

15 perguntas sobre a TACO, respondidas por `claude -p` (modelo `claude-sonnet-5-5`) com e sem o servidor, 3 repetições cada (90 execuções, 30 de outubro de 2026). Acerto = dentro de 5% do valor da tabela; nas duas perguntas de honestidade, só vale admitir que a TACO não traz o valor (leite integral) ou que o total é um mínimo (fibra da refeição com frango).

| Categoria      | Sem MCP | Com MCP |
| -------------- | ------- | ------- |
| Busca direta   | 16/18   | 18/18   |
| Gramas         | 9/9     | 9/9     |
| Comparação     | 3/3     | 3/3     |
| Medida caseira | 1/6     | 6/6     |
| Refeição       | 0/3     | 3/3     |
| Honestidade    | 3/6     | 6/6     |
| **Total**      | 32/45   | 45/45   |

Leitura honesta: o modelo já sabe de cabeça muitos valores isolados da TACO (busca direta e contas em gramas). O ganho está em medida caseira e refeição, onde sem o servidor ele costuma responder "sem dado" (9 vezes) ou chuta o peso da unidade, e em não repetir o que "todo mundo sabe": a TACO 4ª ed. não publica a energia do leite integral, e sem o servidor o modelo respondeu 61 kcal nas 3 tentativas. Limites: um único modelo, 15 perguntas, 3 repetições, correção por regra (a tolerância de 5% aceitou uma resposta sem o MCP que errou o valor do arroz, mas ficou perto da soma). Perguntas, gabarito e respostas cruas estão em [`eval/`](eval); para repetir: `npm run build && node eval/run.mjs && node eval/score.mjs --detail`.

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
