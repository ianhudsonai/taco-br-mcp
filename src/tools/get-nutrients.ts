import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { SOURCE } from '../constants.js';
import { getFood, NUTRIENT_DEFS, NUTRIENT_KEYS } from '../data/foods.js';
import { formatValue, isTrace, nutrientValueSchema, scaleValue } from '../format.js';

const outputSchema = z.object({
  food: z.object({
    id: z.number().int().describe('TACO food number.'),
    name: z.string().describe('Food name exactly as in the TACO table.'),
    category: z.string().describe('TACO food group.')
  }),
  basis_grams: z.number().describe('Quantity the amounts refer to, in grams of edible portion.'),
  scaled: z
    .boolean()
    .describe(
      'True when amounts were computed from the per-100 g table values for another quantity.'
    ),
  nutrients: z
    .array(
      z.object({
        key: z.string().describe('Nutrient key.'),
        label_pt: z.string().describe('Nutrient name in Portuguese.'),
        unit: z.string().describe('Unit of per_100g and amount.'),
        per_100g: nutrientValueSchema.describe('Value in the TACO table, per 100 g.'),
        amount: nutrientValueSchema.describe(
          'Value for basis_grams (equals per_100g when not scaled).'
        )
      })
    )
    .describe('Requested nutrients, in table order.'),
  trace_nutrients: z.array(z.string()).describe('Keys reported as trace (Tr).'),
  not_analyzed_nutrients: z
    .array(z.string())
    .describe('Keys with no value in the TACO table; not zero.'),
  notes: z.array(z.string()).describe('Caveats about this food or this answer.'),
  source: z.string().describe('Citation for the data.')
});

export function registerGetNutrients(server: McpServer): void {
  server.registerTool(
    'get_nutrients',
    {
      title: 'Get nutrients of a food',
      description:
        'Full composition of one TACO food by id (from search_food), per 100 g or scaled to a quantity in grams. Missing data is reported as null (not analyzed) or {"trace":true}, never as 0.',
      inputSchema: z.object({
        food_id: z
          .number()
          .int()
          .positive()
          .describe('TACO food number, as returned by search_food.'),
        grams: z
          .number()
          .positive()
          .max(10000)
          .optional()
          .describe('Quantity in grams of edible portion. Omit for the table basis of 100 g.'),
        nutrients: z
          .array(z.enum(NUTRIENT_KEYS))
          .min(1)
          .optional()
          .describe(
            'Nutrient keys to return (e.g. "energy_kcal", "protein_g", "iron_mg"). Omit for all.'
          )
      }),
      outputSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ food_id, grams, nutrients }) => {
      const food = getFood(food_id);
      if (!food) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Não existe alimento com id ${food_id} na TACO (ids vão de 1 a 597). Use search_food para encontrar o id.`
            }
          ]
        };
      }

      const basis = grams ?? 100;
      const wanted = new Set(nutrients ?? NUTRIENT_KEYS);
      const rows = NUTRIENT_DEFS.filter((d) => wanted.has(d.key)).map((def) => {
        const per100 = food.nutrients[def.key] ?? null;
        return {
          key: def.key,
          label_pt: def.label_pt,
          unit: def.unit,
          per_100g: per100,
          amount: scaleValue(per100, basis, def)
        };
      });

      const notes = [
        'Valores da TACO por 100 g de parte comestível. Não é aconselhamento médico ou nutricional.',
        ...(food.notes ?? [])
      ];
      if (basis !== 100)
        notes.push(
          `Quantidades calculadas proporcionalmente a ${basis} g a partir dos valores por 100 g.`
        );

      const output = {
        food: { id: food.id, name: food.name, category: food.category },
        basis_grams: basis,
        scaled: basis !== 100,
        nutrients: rows,
        trace_nutrients: rows.filter((r) => isTrace(r.per_100g)).map((r) => r.key),
        not_analyzed_nutrients: rows.filter((r) => r.per_100g === null).map((r) => r.key),
        notes,
        source: SOURCE
      };

      const text = [
        `[${food.id}] ${food.name} (${food.category}) — ${basis} g de parte comestível`,
        ...rows.map((r) => `- ${r.label_pt}: ${formatValue(r.amount, r.unit)}`),
        ...(output.not_analyzed_nutrients.length
          ? [`Sem dado na TACO (não é zero): ${output.not_analyzed_nutrients.join(', ')}`]
          : []),
        ...notes.slice(1),
        `Fonte: ${SOURCE}`
      ].join('\n');
      return { content: [{ type: 'text' as const, text }], structuredContent: output };
    }
  );
}
