import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { SOURCE } from '../constants.js';
import { formatValue, nutrientValueSchema } from '../format.js';
import { searchFoods } from '../search.js';

const outputSchema = z.object({
  query: z.string().describe('The query as received.'),
  total_matches: z.number().int().describe('How many foods in the table match the query.'),
  results: z
    .array(
      z.object({
        id: z.number().int().describe('TACO food number. Pass it to get_nutrients.'),
        name: z.string().describe('Food name exactly as in the TACO table.'),
        category: z.string().describe('TACO food group.'),
        energy_kcal: nutrientValueSchema.describe('Energy per 100 g of edible portion, in kcal.'),
        matched_via_synonym: z
          .string()
          .optional()
          .describe('Set when the food was found through this synonym of the query.')
      })
    )
    .describe('Best matches first.'),
  source: z.string().describe('Citation for the data.')
});

export function registerSearchFood(server: McpServer): void {
  server.registerTool(
    'search_food',
    {
      title: 'Search foods in TACO',
      description:
        'Find foods in the Brazilian TACO table (597 items, per 100 g) by name in Portuguese. Accent-insensitive; knows a few synonyms (aipim, macaxeira, pão de sal). Returns ids to use with get_nutrients. Restaurant dishes and brands are mostly absent.',
      inputSchema: z.object({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe('Food name in Portuguese, e.g. "feijão carioca cozido" or "pao de queijo".'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .default(10)
          .describe('Maximum number of results (default 10).')
      }),
      outputSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ query, limit }) => {
      const hits = searchFoods(query);
      const results = hits.slice(0, limit).map(({ food, via }) => ({
        id: food.id,
        name: food.name,
        category: food.category,
        energy_kcal: food.nutrients.energy_kcal ?? null,
        ...(via ? { matched_via_synonym: via } : {})
      }));
      const output = { query, total_matches: hits.length, results, source: SOURCE };

      const lines =
        results.length === 0
          ? [
              `Nenhum alimento da TACO corresponde a "${query}". A tabela traz ingredientes e alguns preparos básicos, não pratos de restaurante nem marcas; tente o nome do ingrediente.`
            ]
          : [
              `${hits.length} alimento(s) para "${query}" (mostrando ${results.length}), energia por 100 g:`,
              ...results.map(
                (r) =>
                  `- [${r.id}] ${r.name} (${r.category}): ${formatValue(r.energy_kcal, 'kcal')}${
                    r.matched_via_synonym ? ` (sinônimo: ${r.matched_via_synonym})` : ''
                  }`
              )
            ];
      lines.push(`Fonte: ${SOURCE}`);
      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
        structuredContent: output
      };
    }
  );
}
