import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { SOURCE } from '../constants.js';
import { getFood, NUTRIENT_KEYS } from '../data/foods.js';
import { formatValue, nutrientValueSchema } from '../format.js';
import { selectNutrients } from '../nutrient-select.js';

const outputSchema = z.object({
  basis: z.string().describe('Quantity all values refer to.'),
  foods: z
    .array(
      z.object({
        id: z.number().int().describe('TACO food number.'),
        name: z.string().describe('Food name exactly as in the TACO table.'),
        category: z.string().describe('TACO food group.')
      })
    )
    .describe('The foods compared, in the order received.'),
  nutrients: z
    .array(
      z.object({
        key: z.string().describe('Nutrient key.'),
        label_pt: z.string().describe('Nutrient name in Portuguese.'),
        unit: z.string().describe('Unit of the values.'),
        values: z
          .array(nutrientValueSchema)
          .describe('One value per food, in the same order as foods.')
      })
    )
    .describe('One row per requested nutrient, in table order.'),
  notes: z.array(z.string()).describe('Caveats about this answer.'),
  source: z.string().describe('Citation for the data.')
});

export function registerCompareFoods(server: McpServer): void {
  server.registerTool(
    'compare_foods',
    {
      title: 'Compare foods side by side',
      description:
        'Compare 2 to 10 TACO foods (ids from search_food) on chosen nutrients, per 100 g of edible portion. Missing data stays null or {"trace":true}; do not rank a food with null as having less.',
      inputSchema: z.object({
        food_ids: z
          .array(z.number().int().positive())
          .min(2)
          .max(10)
          .describe('TACO food numbers to compare, as returned by search_food.'),
        nutrients: z
          .array(z.enum(NUTRIENT_KEYS))
          .min(1)
          .optional()
          .describe(
            'Nutrient keys to compare. Omit for energy, protein, fat, carbohydrate, fiber and sodium.'
          )
      }),
      outputSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ food_ids, nutrients }) => {
      const unknown = [...new Set(food_ids.filter((id) => !getFood(id)))];
      if (unknown.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Não existe alimento com id ${unknown.join(', ')} na TACO (ids vão de 1 a 597). Use search_food para encontrar os ids.`
            }
          ]
        };
      }

      const foods = food_ids.map((id) => getFood(id)!);
      const defs = selectNutrients(nutrients);
      const rows = defs.map((def) => ({
        key: def.key,
        label_pt: def.label_pt,
        unit: def.unit,
        values: foods.map((f) => f.nutrients[def.key] ?? null)
      }));

      const notes = [
        'Valores da TACO por 100 g de parte comestível. Alimentos com diferença de preparo ou de teor de água não são diretamente comparáveis por 100 g.',
        ...new Set(foods.flatMap((f) => f.notes ?? []))
      ];
      const hasGaps = rows.some((r) => r.values.some((v) => v === null));
      if (hasGaps) {
        notes.push(
          'null = sem dado (NA), não zero: não conclua que o alimento tem menos desse nutriente.'
        );
      }

      const output = {
        basis: 'per 100 g of edible portion',
        foods: foods.map((f) => ({ id: f.id, name: f.name, category: f.category })),
        nutrients: rows,
        notes,
        source: SOURCE
      };

      const text = [
        `Comparação por 100 g de parte comestível:`,
        ...foods.map((f, i) => `${i + 1}. [${f.id}] ${f.name}`),
        ...rows.map(
          (r) =>
            `- ${r.label_pt}: ${r.values.map((v, i) => `${i + 1}) ${formatValue(v, r.unit)}`).join(' | ')}`
        ),
        ...notes.slice(1),
        `Fonte: ${SOURCE}`
      ].join('\n');
      return { content: [{ type: 'text' as const, text }], structuredContent: output };
    }
  );
}
