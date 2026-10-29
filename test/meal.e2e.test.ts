import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { connect } from './helpers/client.js';

const SOURCE = 'TACO 4ª ed. (NEPA/UNICAMP, 2011)';
type Value = number | { trace: true } | null;
interface Total {
  key: string;
  total: Value;
  is_lower_bound: boolean;
  not_analyzed_in: string[];
  trace_in: string[];
}
interface MealOut {
  items: { food_id: number; grams: number; amounts: Record<string, Value> }[];
  total_grams: number;
  totals: Total[];
  complete: boolean;
  notes: string[];
  source: string;
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
const failed = async (name: string, args: Record<string, unknown>) => {
  const r = await call(name, args).catch((e: Error) => e);
  return r instanceof Error || Boolean((r as { isError?: boolean }).isError);
};

// 150 g arroz tipo 1 cozido (id 3), 100 g feijão carioca cozido (561), 100 g peito de frango grelhado (410).
// Table values per 100 g:  id 3: 128 kcal, 2.5 P, 0.2 L, 28.1 C, 1.6 fibra, 1 Na
//                          id 561: 76 kcal, 4.8 P, 0.5 L, 13.6 C, 8.5 fibra, 2 Na, vitamina C = Tr
//                          id 410: 159 kcal, 32 P, 2.5 L, 0 C, fibra = NA, 50 Na, vitamina C = NA
const MEAL = [
  { food_id: 3, grams: 150 },
  { food_id: 561, grams: 100 },
  { food_id: 410, grams: 100 }
];

describe('calc_meal', () => {
  it('sums the default nutrients by hand-checked arithmetic and cites the source', async () => {
    const r = await call('calc_meal', { items: MEAL });
    const out = r.structuredContent as MealOut;
    const total = (key: string) => out.totals.find((t) => t.key === key)!;
    expect(out.total_grams).toBe(350);
    expect(out.totals.map((t) => t.key)).toEqual([
      'energy_kcal',
      'protein_g',
      'lipids_g',
      'carbohydrate_g',
      'dietary_fiber_g',
      'sodium_mg'
    ]);
    expect(total('energy_kcal').total).toBe(427); // 192 + 76 + 159
    expect(total('protein_g').total).toBe(40.55); // 3.75 + 4.8 + 32
    expect(total('lipids_g').total).toBe(3.3); // 0.3 + 0.5 + 2.5
    expect(total('carbohydrate_g').total).toBe(55.75); // 42.15 + 13.6 + 0
    expect(total('sodium_mg').total).toBe(53.5); // 1.5 + 2 + 50
    expect(out.source).toBe(SOURCE);
    expect(text(r)).toContain(SOURCE);
  });

  it('marks a total as a lower bound when an item has no data (NA) for it', async () => {
    const r = await call('calc_meal', { items: MEAL });
    const out = r.structuredContent as MealOut;
    const fiber = out.totals.find((t) => t.key === 'dietary_fiber_g')!;
    expect(fiber.total).toBe(10.9); // 2.4 + 8.5, chicken has no fiber data
    expect(fiber.is_lower_bound).toBe(true);
    expect(fiber.not_analyzed_in).toEqual(['Frango, peito, sem pele, grelhado']);
    expect(out.complete).toBe(false);
    expect(text(r)).toMatch(/pelo menos 10.9 g \(limite inferior/);
    // complete totals are not flagged
    expect(out.totals.find((t) => t.key === 'energy_kcal')!.is_lower_bound).toBe(false);
    expect(out.notes.join(' ')).toMatch(/total real é maior/);
  });

  it('reports complete: true when every requested nutrient has data for every item', async () => {
    const r = await call('calc_meal', {
      items: MEAL,
      nutrients: ['energy_kcal', 'protein_g']
    });
    const out = r.structuredContent as MealOut;
    expect(out.complete).toBe(true);
    expect(out.totals.every((t) => !t.is_lower_bound)).toBe(true);
  });

  it('never turns NA or Tr into 0 in totals', async () => {
    const r = await call('calc_meal', {
      items: MEAL,
      nutrients: ['vitamin_c_mg', 'cholesterol_mg']
    });
    const out = r.structuredContent as MealOut;
    const vc = out.totals.find((t) => t.key === 'vitamin_c_mg')!;
    expect(vc.total).toEqual({ trace: true }); // only trace data
    expect(vc.trace_in).toEqual(['Feijão, carioca, cozido']);
    expect(vc.not_analyzed_in).toHaveLength(2);
    // cholesterol: only the chicken has a value (89 mg per 100 g)
    const chol = out.totals.find((t) => t.key === 'cholesterol_mg')!;
    expect(chol.total).toBe(89);
    expect(chol.is_lower_bound).toBe(true);
    // a nutrient nobody analyzed is null, not 0
    const only = await call('calc_meal', {
      items: [{ food_id: 3, grams: 100 }],
      nutrients: ['cholesterol_mg']
    });
    const t = (only.structuredContent as MealOut).totals[0]!;
    expect(t.total).toBeNull();
    expect(t.is_lower_bound).toBe(false);
    expect(text(only)).toMatch(/sem dado em nenhum item/);
  });

  it('gives the per-item amounts it summed', async () => {
    const r = await call('calc_meal', { items: MEAL, nutrients: ['energy_kcal'] });
    const out = r.structuredContent as MealOut;
    expect(out.items.map((i) => i.amounts.energy_kcal)).toEqual([192, 76, 159]);
  });

  it('accepts the same food twice and adds both', async () => {
    const r = await call('calc_meal', {
      items: [
        { food_id: 53, grams: 50 },
        { food_id: 53, grams: 50 }
      ],
      nutrients: ['energy_kcal']
    });
    expect((r.structuredContent as MealOut).totals[0]!.total).toBe(300);
  });

  it('carries the clamped-carbohydrate note', async () => {
    const r = await call('calc_meal', {
      items: [{ food_id: 288, grams: 100 }],
      nutrients: ['carbohydrate_g']
    });
    expect((r.structuredContent as MealOut).notes.join(' ')).toMatch(/original spreadsheet/);
  });

  it('refuses unknown ids and computes nothing', async () => {
    const r = await call('calc_meal', { items: [...MEAL, { food_id: 9999, grams: 10 }] });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/9999/);
    expect(text(r)).toMatch(/search_food/);
  });

  it('rejects empty meals, bad grams and unknown nutrients', async () => {
    expect(await failed('calc_meal', { items: [] })).toBe(true);
    expect(await failed('calc_meal', { items: [{ food_id: 3, grams: 0 }] })).toBe(true);
    expect(await failed('calc_meal', { items: [{ food_id: 3, grams: -1 }] })).toBe(true);
    expect(
      await failed('calc_meal', { items: [{ food_id: 3, grams: 10 }], nutrients: ['nope'] })
    ).toBe(true);
    expect(await failed('calc_meal', { items: [{ food: 'arroz', grams: 10 }] })).toBe(true);
  });
});

describe('compare_foods', () => {
  it('lines up foods and nutrients, one value per food in order', async () => {
    const r = await call('compare_foods', {
      food_ids: [1, 3],
      nutrients: ['energy_kcal', 'dietary_fiber_g']
    });
    const out = r.structuredContent as {
      basis: string;
      foods: { id: number; name: string }[];
      nutrients: { key: string; values: Value[] }[];
      source: string;
    };
    expect(out.basis).toBe('per 100 g of edible portion');
    expect(out.foods.map((f) => f.name)).toEqual([
      'Arroz, integral, cozido',
      'Arroz, tipo 1, cozido'
    ]);
    expect(out.nutrients).toMatchObject([
      { key: 'energy_kcal', values: [124, 128] },
      { key: 'dietary_fiber_g', values: [2.7, 1.6] }
    ]);
    expect(out.source).toBe(SOURCE);
    expect(text(r)).toContain(SOURCE);
  });

  it('keeps NA as null and warns not to read it as less', async () => {
    const r = await call('compare_foods', {
      food_ids: [561, 410],
      nutrients: ['dietary_fiber_g', 'vitamin_c_mg']
    });
    const out = r.structuredContent as {
      nutrients: { key: string; values: Value[] }[];
      notes: string[];
    };
    expect(out.nutrients.find((n) => n.key === 'dietary_fiber_g')!.values).toEqual([8.5, null]);
    expect(out.nutrients.find((n) => n.key === 'vitamin_c_mg')!.values).toEqual([
      { trace: true },
      null
    ]);
    expect(out.notes.join(' ')).toMatch(/não conclua/);
  });

  it('uses the core nutrients by default', async () => {
    const r = await call('compare_foods', { food_ids: [1, 53] });
    const keys = (r.structuredContent as { nutrients: { key: string }[] }).nutrients.map(
      (n) => n.key
    );
    expect(keys).toEqual([
      'energy_kcal',
      'protein_g',
      'lipids_g',
      'carbohydrate_g',
      'dietary_fiber_g',
      'sodium_mg'
    ]);
  });

  it('refuses unknown ids; needs 2 to 10 foods', async () => {
    const r = await call('compare_foods', { food_ids: [1, 9999] });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/9999/);
    expect(await failed('compare_foods', { food_ids: [1] })).toBe(true);
    expect(await failed('compare_foods', { food_ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })).toBe(
      true
    );
  });
});
