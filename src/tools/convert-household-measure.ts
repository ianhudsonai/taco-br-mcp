import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { SOURCE } from '../constants.js';
import { getFood } from '../data/foods.js';
import { getHousehold } from '../data/household.js';
import { availableMeasures, HOUSEHOLD_SOURCE, resolveHousehold } from '../household.js';
import { searchFoods } from '../search.js';

const foodRef = z.object({
  id: z.number().int().describe('TACO food number.'),
  name: z.string().describe('Food name exactly as in the TACO table.')
});

const outputSchema = z.object({
  status: z
    .enum(['ok', 'ambiguous_food', 'no_food_match', 'no_household_data', 'unknown_measure'])
    .describe(
      'ok: grams computed. ambiguous_food: the query matched several foods, pick an id from candidates. no_food_match: no food found. no_household_data: this food has no curated household measures, ask for grams. unknown_measure: use one of available_measures.'
    ),
  food: foodRef
    .optional()
    .describe('The resolved food (not set for ambiguous_food / no_food_match).'),
  measure: z
    .object({
      key: z.string().describe('Stable measure key.'),
      label: z.string().describe('Measure name in Portuguese.'),
      source_description: z.string().describe('Description of the POF row the weight comes from.')
    })
    .optional()
    .describe('The matched household measure (status ok).'),
  quantity: z.number().optional().describe('How many of the measure (status ok).'),
  grams_per_measure: z.number().optional().describe('Weight of one measure in grams (status ok).'),
  grams: z.number().optional().describe('quantity x grams_per_measure (status ok).'),
  candidates: z
    .array(
      foodRef.extend({
        has_household_measures: z.boolean().describe('Whether this food can be converted.')
      })
    )
    .optional()
    .describe('Foods matching the query (status ambiguous_food), best first.'),
  available_measures: z
    .array(
      z.object({
        key: z.string().describe('Stable measure key.'),
        label: z.string().describe('Measure name in Portuguese.'),
        grams: z.number().describe('Weight of one measure in grams.')
      })
    )
    .optional()
    .describe('Measures known for this food (status unknown_measure).'),
  notes: z.array(z.string()).describe('Caveats and next steps.'),
  source: z.string().describe('Citation for the nutrient table.'),
  household_source: z.string().describe('Citation for the household measure weights.')
});

type Out = z.infer<typeof outputSchema>;

export function registerConvertHouseholdMeasure(server: McpServer): void {
  server.registerTool(
    'convert_household_measure',
    {
      title: 'Convert a household measure to grams',
      description:
        'Convert a Brazilian household measure (e.g. 2 colheres de sopa, 1 unidade, 1 fatia) of a TACO food to grams, using the IBGE POF table through a hand-curated mapping. Only some foods are covered; it never guesses: on ambiguity it returns candidates, and for uncovered foods or measures it says so. Pass food_id (from search_food) or food_query.',
      inputSchema: z.object({
        food_id: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('TACO food number, as returned by search_food. Preferred over food_query.'),
        food_query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            'Food name in Portuguese, used only when food_id is not given; must match exactly one food.'
          ),
        measure: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .describe(
            'Household measure in Portuguese, e.g. "colher de sopa", "unidade", "fatia", "concha", "copo americano".'
          ),
        quantity: z
          .number()
          .positive()
          .max(1000)
          .optional()
          .describe('How many of the measure (default 1; may be fractional, e.g. 0.5).')
      }),
      outputSchema,
      annotations: { readOnlyHint: true }
    },
    async ({ food_id, food_query, measure, quantity }) => {
      const base = { source: SOURCE, household_source: HOUSEHOLD_SOURCE };
      const reply = (out: Out, text: string) => ({
        content: [
          { type: 'text' as const, text: `${text}\nFonte: ${SOURCE}; medidas: ${HOUSEHOLD_SOURCE}` }
        ],
        structuredContent: out
      });

      if ((food_id === undefined) === (food_query === undefined)) {
        return {
          isError: true,
          content: [
            { type: 'text' as const, text: 'Informe exatamente um entre food_id e food_query.' }
          ]
        };
      }

      let id = food_id;
      if (id === undefined) {
        const hits = searchFoods(food_query!);
        if (hits.length === 0) {
          return reply(
            {
              status: 'no_food_match',
              notes: ['Nenhum alimento encontrado; tente search_food com outro nome.'],
              ...base
            },
            `Nenhum alimento da TACO corresponde a "${food_query}".`
          );
        }
        // A typo-corrected match is a guess about what the user meant: confirm it with an id.
        const corrected = hits[0]!.corrected;
        if (hits.length > 1 || corrected) {
          const candidates = hits.slice(0, 10).map((h) => ({
            id: h.food.id,
            name: h.food.name,
            has_household_measures: getHousehold(h.food.id) !== undefined
          }));
          return reply(
            {
              status: 'ambiguous_food',
              candidates,
              notes: [
                corrected
                  ? `Nada corresponde a "${food_query}" como escrito; talvez seja "${corrected}". Confirme chamando de novo com food_id.`
                  : 'Mais de um alimento corresponde: chame de novo com food_id.'
              ],
              ...base
            },
            [
              corrected
                ? `Nada corresponde a "${food_query}" como escrito; talvez seja "${corrected}". Escolha um id:`
                : `"${food_query}" corresponde a ${hits.length} alimentos; escolha um id:`,
              ...candidates.map(
                (c) =>
                  `- [${c.id}] ${c.name}${c.has_household_measures ? '' : ' (sem medidas caseiras curadas)'}`
              )
            ].join('\n')
          );
        }
        id = hits[0]!.food.id;
      }

      const food = getFood(id);
      if (!food) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Não existe alimento com id ${id} na TACO (ids vão de 1 a 597). Use search_food para encontrar o id.`
            }
          ]
        };
      }
      const ref = { id: food.id, name: food.name };

      const r = resolveHousehold(id, measure, quantity);
      if (!r.ok) {
        if (r.reason === 'no_household_data') {
          return reply(
            {
              status: 'no_household_data',
              food: ref,
              notes: [
                'Sem medidas caseiras curadas para este alimento: peça a quantidade em gramas ao usuário.'
              ],
              ...base
            },
            r.message
          );
        }
        const entry = getHousehold(id)!;
        return reply(
          {
            status: 'unknown_measure',
            food: ref,
            available_measures: availableMeasures(entry),
            notes: [r.message],
            ...base
          },
          r.message
        );
      }

      const notes = [
        'Pesos de medidas caseiras são médias referidas pela POF/IBGE (2008-2009), não pesagens do prato do usuário. Use calc_meal ou get_nutrients com este peso.'
      ];
      if (r.entry.note) notes.push(r.entry.note);
      const grams = r.grams;
      const out: Out = {
        status: 'ok',
        food: ref,
        measure: {
          key: r.measure.key,
          label: r.measure.measure,
          source_description: r.measure.source_description
        },
        quantity: r.quantity,
        grams_per_measure: r.measure.grams,
        grams,
        notes,
        ...base
      };
      return reply(
        out,
        [
          `${r.quantity} ${r.measure.measure} de "${food.name}" [${food.id}] = ${grams} g (${r.measure.grams} g cada; origem POF: ${r.measure.source_description}).`,
          ...notes
        ].join('\n')
      );
    }
  );
}
