import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { SOURCE } from '../constants.js';
import { getFood, NUTRIENT_KEYS, type Food } from '../data/foods.js';
import { formatValue, isTrace, nutrientValueSchema, roundAmount, scaleValue } from '../format.js';
import { HOUSEHOLD_SOURCE, resolveHousehold, type ResolvedHousehold } from '../household.js';
import { selectNutrients } from '../nutrient-select.js';

const outputSchema = z.object({
  items: z
    .array(
      z.object({
        food_id: z.number().int().describe('TACO food number.'),
        name: z.string().describe('Food name exactly as in the TACO table.'),
        grams: z.number().describe('Quantity of this item, in grams of edible portion.'),
        household: z
          .object({
            measure: z.string().describe('Household measure used, in Portuguese.'),
            quantity: z.number().describe('How many of the measure.'),
            grams_per_measure: z.number().describe('Weight of one measure in grams.'),
            source_description: z
              .string()
              .describe('Description of the POF row the weight comes from.')
          })
          .optional()
          .describe('Set when the item was given as a household measure and converted to grams.'),
        amounts: z
          .record(z.string(), nutrientValueSchema)
          .describe('Amount of each requested nutrient in this item, keyed by nutrient key.')
      })
    )
    .describe('The meal items in the order received.'),
  total_grams: z.number().describe('Sum of the item quantities.'),
  totals: z
    .array(
      z.object({
        key: z.string().describe('Nutrient key.'),
        label_pt: z.string().describe('Nutrient name in Portuguese.'),
        unit: z.string().describe('Unit of total.'),
        total: nutrientValueSchema.describe(
          'Sum over the items that have data. null when no item has data; {"trace":true} when every item is trace.'
        ),
        is_lower_bound: z
          .boolean()
          .describe(
            'True when at least one item has no data (NA) for this nutrient: the real total is higher than this number.'
          ),
        not_analyzed_in: z
          .array(z.string())
          .describe('Names of the items with no data (NA) for this nutrient.'),
        trace_in: z
          .array(z.string())
          .describe(
            'Names of the items reported as trace (Tr) for this nutrient; they add a tiny, unquantified amount.'
          )
      })
    )
    .describe('One entry per requested nutrient, in table order.'),
  complete: z
    .boolean()
    .describe(
      'True when every requested nutrient has data for every item (no total is a lower bound).'
    ),
  notes: z.array(z.string()).describe('Caveats about this answer.'),
  source: z.string().describe('Citation for the data.'),
  household_source: z
    .string()
    .optional()
    .describe('Citation for the household measure weights; set when any item used one.')
});

interface ResolvedItem {
  food: Food;
  grams: number;
  household: ResolvedHousehold | undefined;
}

export function registerCalcMeal(server: McpServer): void {
  server.registerTool(
    'calc_meal',
    {
      title: 'Calculate the nutrients of a meal',
      description:
        'Sum nutrients over a list of TACO foods (ids from search_food). Each item has either grams or a household_measure with quantity (e.g. "colher de sopa" x 2, covered foods only; see convert_household_measure). Totals are lower bounds when an item has no data for a nutrient: the response says which. Defaults to energy, protein, fat, carbohydrate, fiber and sodium.',
      inputSchema: z.object({
        items: z
          .array(
            z.object({
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
                .describe(
                  'Quantity of this food in grams of edible portion, as eaten (cooked weight for cooked foods). Give this or household_measure, not both.'
                ),
              household_measure: z
                .string()
                .trim()
                .min(1)
                .max(100)
                .optional()
                .describe(
                  'Household measure instead of grams, e.g. "colher de sopa", "unidade", "fatia", "concha". Only for foods with curated measures.'
                ),
              quantity: z
                .number()
                .positive()
                .max(1000)
                .optional()
                .describe(
                  'How many of household_measure (default 1; may be fractional). Not used with grams.'
                )
            })
          )
          .min(1)
          .max(50)
          .describe('Foods in the meal. The same food may appear more than once.'),
        nutrients: z
          .array(z.enum(NUTRIENT_KEYS))
          .min(1)
          .optional()
          .describe(
            'Nutrient keys to total. Omit for energy, protein, fat, carbohydrate, fiber and sodium.'
          )
      }),
      outputSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ items, nutrients }) => {
      const unknown = [...new Set(items.filter((i) => !getFood(i.food_id)).map((i) => i.food_id))];
      if (unknown.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Não existe alimento com id ${unknown.join(', ')} na TACO (ids vão de 1 a 597). Use search_food para encontrar os ids. Nada foi calculado.`
            }
          ]
        };
      }

      const problems: string[] = [];
      const resolved = items.flatMap<ResolvedItem>((item, index) => {
        const food = getFood(item.food_id)!;
        const where = `item ${index + 1} (${food.name} [${food.id}])`;
        if (item.grams !== undefined && item.household_measure !== undefined) {
          problems.push(`${where}: informe grams ou household_measure, não os dois.`);
          return [];
        }
        if (item.grams === undefined && item.household_measure === undefined) {
          problems.push(`${where}: falta grams ou household_measure.`);
          return [];
        }
        if (item.grams !== undefined) {
          if (item.quantity !== undefined) {
            problems.push(`${where}: quantity só vale com household_measure.`);
            return [];
          }
          return [{ food, grams: item.grams, household: undefined }];
        }
        const r = resolveHousehold(food.id, item.household_measure!, item.quantity);
        if (!r.ok) {
          problems.push(`${where}: ${r.message}`);
          return [];
        }
        return [{ food, grams: r.grams, household: r }];
      });
      if (problems.length > 0) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Nada foi calculado:\n${problems.map((p) => `- ${p}`).join('\n')}`
            }
          ]
        };
      }

      const defs = selectNutrients(nutrients);
      const usedHousehold = resolved.some((r) => r.household);

      const itemRows = resolved.map(({ food, grams, household }) => ({
        food_id: food.id,
        name: food.name,
        grams,
        ...(household
          ? {
              household: {
                measure: household.measure.measure,
                quantity: household.quantity,
                grams_per_measure: household.measure.grams,
                source_description: household.measure.source_description
              }
            }
          : {}),
        amounts: Object.fromEntries(
          defs.map((d) => [d.key, scaleValue(food.nutrients[d.key] ?? null, grams, d)])
        )
      }));

      const totals = defs.map((def) => {
        let sum = 0;
        let withNumber = 0;
        const notAnalyzed: string[] = [];
        const trace: string[] = [];
        for (const { food, grams } of resolved) {
          const v = food.nutrients[def.key] ?? null;
          if (v === null) notAnalyzed.push(food.name);
          else if (isTrace(v)) trace.push(food.name);
          else {
            sum += (v * grams) / 100;
            withNumber++;
          }
        }
        const total =
          withNumber > 0
            ? roundAmount(sum, def)
            : trace.length > 0
              ? { trace: true as const }
              : null;
        return {
          key: def.key,
          label_pt: def.label_pt,
          unit: def.unit,
          total,
          is_lower_bound: notAnalyzed.length > 0 && total !== null,
          not_analyzed_in: [...new Set(notAnalyzed)],
          trace_in: [...new Set(trace)]
        };
      });

      const complete = totals.every((t) => t.not_analyzed_in.length === 0);
      const notes = [
        'Valores da TACO por 100 g de parte comestível, proporcionais às gramas informadas. Não é aconselhamento médico ou nutricional.'
      ];
      if (!complete) {
        notes.push(
          'Nutrientes sem dado (NA) em algum item não entram na soma: onde is_lower_bound é verdadeiro, o total real é maior que o informado.'
        );
      }
      if (usedHousehold) {
        notes.push(
          'Itens em medida caseira foram convertidos em gramas com pesos médios da POF/IBGE, não pesagens do prato: a precisão desses itens é menor.'
        );
      }
      const foodNotes = [...new Set(resolved.flatMap(({ food }) => food.notes ?? []))];
      const householdNotes = [
        ...new Set(
          resolved.flatMap(({ household }) => (household?.entry.note ? [household.entry.note] : []))
        )
      ];
      notes.push(...foodNotes, ...householdNotes);

      const totalGrams = Number(resolved.reduce((s, r) => s + r.grams, 0).toFixed(3));
      const output = {
        items: itemRows,
        total_grams: totalGrams,
        totals,
        complete,
        notes,
        source: SOURCE,
        ...(usedHousehold ? { household_source: HOUSEHOLD_SOURCE } : {})
      };

      const lines = [
        `Refeição de ${totalGrams} g (${resolved.length} item(ns)):`,
        ...itemRows.map(
          (r) =>
            `- ${r.grams} g ${r.name} [${r.food_id}]${
              r.household ? ` (${r.household.quantity} ${r.household.measure})` : ''
            }`
        ),
        'Totais:',
        ...totals.map((t) => {
          const value = formatValue(t.total, t.unit);
          if (t.total !== null && t.is_lower_bound) {
            return `- ${t.label_pt}: pelo menos ${value} (limite inferior; sem dado em: ${t.not_analyzed_in.join('; ')})`;
          }
          if (t.total === null) {
            return `- ${t.label_pt}: sem dado em nenhum item (NA, não é zero)`;
          }
          return `- ${t.label_pt}: ${value}${t.trace_in.length ? ` (+ traço em: ${t.trace_in.join('; ')})` : ''}`;
        }),
        ...notes.slice(1),
        `Fonte: ${SOURCE}${usedHousehold ? `; medidas: ${HOUSEHOLD_SOURCE}` : ''}`
      ];
      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
        structuredContent: output
      };
    }
  );
}
