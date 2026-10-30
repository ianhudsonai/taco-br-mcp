import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { connect } from './helpers/client.js';

const SOURCE = 'TACO 4ª ed. (NEPA/UNICAMP, 2011)';
const POF = 'POF 2008-2009 (IBGE)';
type Value = number | { trace: true } | null;

interface Convert {
  status: string;
  food?: { id: number; name: string };
  measure?: { key: string; label: string; source_description: string };
  quantity?: number;
  grams_per_measure?: number;
  grams?: number;
  candidates?: { id: number; name: string; has_household_measures: boolean }[];
  available_measures?: { key: string; label: string; grams: number }[];
  notes: string[];
  source: string;
  household_source: string;
}
interface Meal {
  items: {
    food_id: number;
    grams: number;
    household?: { measure: string; quantity: number; grams_per_measure: number };
    amounts: Record<string, Value>;
  }[];
  total_grams: number;
  totals: { key: string; total: Value }[];
  notes: string[];
  source: string;
  household_source?: string;
}

let client: Client;
beforeAll(async () => {
  client = await connect();
});
afterAll(async () => {
  await client.close();
});

const call = (name: string, args: Record<string, unknown>) =>
  client.callTool({ name, arguments: args });
const text = (r: { content?: unknown }) => JSON.stringify(r.content);
const convert = async (args: Record<string, unknown>) =>
  (await call('convert_household_measure', args)).structuredContent as Convert;

describe('convert_household_measure', () => {
  it('converts 2 colheres de sopa of rice to 50 g and cites both sources', async () => {
    const r = await call('convert_household_measure', {
      food_id: 3,
      measure: 'colheres de sopa',
      quantity: 2
    });
    const out = r.structuredContent as Convert;
    expect(out).toMatchObject({
      status: 'ok',
      food: { id: 3, name: 'Arroz, tipo 1, cozido' },
      measure: { key: 'colher_de_sopa', label: 'colher de sopa' },
      quantity: 2,
      grams_per_measure: 25,
      grams: 50,
      source: SOURCE
    });
    expect(out.household_source).toContain(POF);
    expect(out.measure!.source_description).toBe('Arroz cozido - colher de sopa cheia');
    expect(text(r)).toContain('= 50 g');
    expect(text(r)).toContain(POF);
  });

  it('accepts the quantity inside the measure text and fractions', async () => {
    expect((await convert({ food_id: 3, measure: '2 colheres de sopa' })).grams).toBe(50);
    expect((await convert({ food_id: 53, measure: 'unidade', quantity: 0.5 })).grams).toBe(25);
    expect((await convert({ food_id: 488, measure: 'unidade', quantity: 2 })).grams).toBe(90);
  });

  it('resolves a food_query only when it matches exactly one food', async () => {
    const out = await convert({ food_query: 'pão de queijo assado', measure: 'unidade' });
    expect(out).toMatchObject({ status: 'ok', food: { id: 140 }, grams: 20 });
  });

  it('returns candidates instead of guessing when the query is ambiguous', async () => {
    const out = await convert({ food_query: 'arroz cozido', measure: 'colher de sopa' });
    expect(out.status).toBe('ambiguous_food');
    expect(out.grams).toBeUndefined();
    expect(out.candidates!.map((c) => c.id).sort((a, b) => a - b)).toEqual([1, 3, 5]);
    expect(out.candidates!.every((c) => c.has_household_measures)).toBe(true);
  });

  it('reports a food with no curated measures and asks for grams', async () => {
    const out = await convert({ food_id: 40, measure: 'colher de sopa' });
    expect(out).toMatchObject({ status: 'no_household_data', food: { id: 40 } });
    expect(out.grams).toBeUndefined();
    expect(out.notes.join(' ')).toMatch(/gramas/);
  });

  it('lists the known measures when the measure is not recognized', async () => {
    const out = await convert({ food_id: 3, measure: 'colher' });
    expect(out.status).toBe('unknown_measure');
    expect(out.grams).toBeUndefined();
    expect(out.available_measures).toContainEqual({
      key: 'colher_de_sopa',
      label: 'colher de sopa',
      grams: 25
    });
  });

  it('reports an unmatched food_query', async () => {
    expect((await convert({ food_query: 'marmita', measure: 'unidade' })).status).toBe(
      'no_food_match'
    );
  });

  it('errors on bad input', async () => {
    const both = await call('convert_household_measure', { measure: 'unidade' });
    expect(both.isError).toBe(true);
    const twice = await call('convert_household_measure', {
      food_id: 3,
      food_query: 'arroz',
      measure: 'unidade'
    });
    expect(twice.isError).toBe(true);
    const unknown = await call('convert_household_measure', { food_id: 9999, measure: 'unidade' });
    expect(unknown.isError).toBe(true);
    expect(text(unknown)).toMatch(/search_food/);
    const bad = await call('convert_household_measure', {
      food_id: 3,
      measure: 'unidade',
      quantity: 0
    }).catch((e: Error) => e);
    expect(bad instanceof Error || (bad as { isError?: boolean }).isError).toBeTruthy();
  });
});

describe('calc_meal with household measures', () => {
  it('gives the same totals for 6 colheres de sopa as for 150 g of rice', async () => {
    const byMeasure = (
      await call('calc_meal', {
        items: [{ food_id: 3, household_measure: 'colher de sopa', quantity: 6 }],
        nutrients: ['energy_kcal', 'protein_g']
      })
    ).structuredContent as Meal;
    const byGrams = (
      await call('calc_meal', {
        items: [{ food_id: 3, grams: 150 }],
        nutrients: ['energy_kcal', 'protein_g']
      })
    ).structuredContent as Meal;
    expect(byMeasure.total_grams).toBe(150);
    expect(byMeasure.totals).toEqual(byGrams.totals);
    expect(byMeasure.items[0]).toMatchObject({
      grams: 150,
      household: { measure: 'colher de sopa', quantity: 6, grams_per_measure: 25 }
    });
    expect(byMeasure.household_source).toContain(POF);
    expect(byMeasure.notes.join(' ')).toMatch(/pesos médios da POF/);
    expect(byGrams.household_source).toBeUndefined();
  });

  it('mixes grams and household measures in one meal', async () => {
    const r = await call('calc_meal', {
      items: [
        { food_id: 3, household_measure: 'colher de sopa', quantity: 6 },
        { food_id: 561, grams: 100 },
        { food_id: 488, household_measure: 'unidade', quantity: 2 }
      ],
      nutrients: ['energy_kcal']
    });
    const out = r.structuredContent as Meal;
    expect(out.items.map((i) => i.grams)).toEqual([150, 100, 90]);
    expect(out.total_grams).toBe(340);
    // 192 (rice) + 76 (beans) + 131.4 -> 131 (egg: 146 kcal/100 g x 90 g)
    expect(out.totals[0]!.total).toBe(399);
    expect(text(r)).toContain('(6 colher de sopa)');
  });

  it('refuses the whole meal, naming every problem, and calculates nothing', async () => {
    const r = await call('calc_meal', {
      items: [
        { food_id: 3, grams: 100, household_measure: 'colher de sopa' },
        { food_id: 3 },
        { food_id: 40, household_measure: 'colher de sopa' },
        { food_id: 3, household_measure: 'colher' },
        { food_id: 3, grams: 10, quantity: 2 }
      ]
    });
    expect(r.isError).toBe(true);
    const t = text(r);
    expect(t).toMatch(/item 1.*não os dois/);
    expect(t).toMatch(/item 2.*falta grams/);
    expect(t).toMatch(/item 3.*medidas caseiras curadas/);
    expect(t).toMatch(/item 4.*Medidas disponíveis/);
    expect(t).toMatch(/item 5.*quantity só vale/);
    expect(r.structuredContent).toBeUndefined();
  });
});
