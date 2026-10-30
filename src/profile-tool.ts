import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { SOURCE } from './constants.js';
import { getFood } from './data/foods.js';
import { getProfileValues, getTable, profileFoodIds, type ProfileTable } from './data/profiles.js';
import { formatValue, isTrace, nutrientValueSchema, scaleValue } from './format.js';

const outputSchema = z.object({
  food: z.object({
    id: z.number().int().describe('TACO food number.'),
    name: z.string().describe('Food name exactly as in the TACO table.'),
    category: z.string().describe('TACO food group.')
  }),
  available: z
    .boolean()
    .describe(
      'False when this TACO table has no row for the food. That is missing data, not zero: nutrients is empty.'
    ),
  basis_grams: z.number().describe('Quantity the amounts refer to, in grams of edible portion.'),
  scaled: z
    .boolean()
    .describe(
      'True when amounts were computed from the per-100 g table values for another quantity.'
    ),
  nutrients: z
    .array(
      z.object({
        key: z.string().describe('Key of the fatty acid or amino acid.'),
        label_pt: z.string().describe('Name in Portuguese.'),
        unit: z.string().describe('Unit of per_100g and amount.'),
        per_100g: nutrientValueSchema.describe('Value in the TACO table, per 100 g.'),
        amount: nutrientValueSchema.describe(
          'Value for basis_grams (equals per_100g when not scaled).'
        )
      })
    )
    .describe('Requested entries, in table order. Empty when available is false.'),
  trace_nutrients: z.array(z.string()).describe('Keys reported as trace (Tr).'),
  not_analyzed_nutrients: z
    .array(z.string())
    .describe('Keys with no value in the TACO table; not zero.'),
  foods_with_data: z
    .array(z.object({ id: z.number().int(), name: z.string() }))
    .optional()
    .describe('Only when available is false and the table is small: the foods it does cover.'),
  notes: z.array(z.string()).describe('Caveats about this table, this food or this answer.'),
  source: z.string().describe('Citation for the data.')
});

/** Foods listed back to the model when asked for one outside a small table. */
const LIST_LIMIT = 40;

interface ProfileToolSpec {
  name: string;
  title: string;
  description: string;
  table: ProfileTable;
  /** Plural noun used in messages, e.g. "ácidos graxos". */
  noun: string;
  keysHint: string;
}

export function registerProfileTool(server: McpServer, spec: ProfileToolSpec): void {
  const { defs } = getTable(spec.table);
  const keys = defs.map((d) => d.key) as [string, ...string[]];

  server.registerTool(
    spec.name,
    {
      title: spec.title,
      description: spec.description,
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
          .array(z.enum(keys))
          .min(1)
          .optional()
          .describe(`Keys to return (e.g. ${spec.keysHint}). Omit for all.`)
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

      const table = getTable(spec.table);
      const profile = getProfileValues(spec.table, food_id);
      const basis = grams ?? 100;
      const wanted = new Set(nutrients ?? keys);
      const rows = profile
        ? table.defs
            .filter((d) => wanted.has(d.key))
            .map((def) => {
              const per100 = profile.values[def.key] ?? null;
              return {
                key: def.key,
                label_pt: def.label_pt,
                unit: def.unit,
                per_100g: per100,
                amount: scaleValue(per100, basis, def)
              };
            })
        : [];

      const notes = [
        'Valores da TACO por 100 g de parte comestível. Não é aconselhamento médico ou nutricional.'
      ];
      if (profile) {
        notes.push(...table.notes);
        if (profile.note) notes.push(profile.note);
        if (basis !== 100)
          notes.push(
            `Quantidades calculadas proporcionalmente a ${basis} g a partir dos valores por 100 g.`
          );
      } else {
        notes.push(
          `A TACO não publica ${spec.noun} para este alimento (a tabela cobre ${table.count} dos 597 alimentos). Isso é falta de dado, não zero: não estime nem use o valor de outro alimento como se fosse da TACO.`
        );
      }

      const ids = profileFoodIds(spec.table);
      const foodsWithData =
        !profile && ids.length <= LIST_LIMIT
          ? ids.map((id) => ({ id, name: getFood(id)?.name ?? String(id) }))
          : undefined;

      const output = {
        food: { id: food.id, name: food.name, category: food.category },
        available: Boolean(profile),
        basis_grams: basis,
        scaled: basis !== 100,
        nutrients: rows,
        trace_nutrients: rows.filter((r) => isTrace(r.per_100g)).map((r) => r.key),
        not_analyzed_nutrients: rows.filter((r) => r.per_100g === null).map((r) => r.key),
        ...(foodsWithData ? { foods_with_data: foodsWithData } : {}),
        notes,
        source: SOURCE
      };

      const text = [
        `[${food.id}] ${food.name} (${food.category}) — ${table.title_pt}, ${basis} g de parte comestível`,
        ...(profile
          ? rows.map((r) => `- ${r.label_pt}: ${formatValue(r.amount, r.unit)}`)
          : ['Sem dado na TACO para este alimento.']),
        ...(output.not_analyzed_nutrients.length
          ? [`Sem dado na TACO (não é zero): ${output.not_analyzed_nutrients.join(', ')}`]
          : []),
        ...notes.slice(1),
        ...(foodsWithData
          ? [
              `Alimentos com ${spec.noun} na TACO: ${foodsWithData.map((f) => `[${f.id}] ${f.name}`).join('; ')}`
            ]
          : []),
        `Fonte: ${SOURCE}`
      ].join('\n');
      return { content: [{ type: 'text' as const, text }], structuredContent: output };
    }
  );
}
