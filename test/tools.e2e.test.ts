import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { connect } from './helpers/client.js';
import { FOODS, NUTRIENT_DEFS } from '../src/data/foods.js';

const SOURCE = 'TACO 4ª ed. (NEPA/UNICAMP, 2011)';
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

describe('tool contract', () => {
  it('registers the tools, all read-only, with output schemas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_nutrients', 'ping', 'search_food']);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.outputSchema, tool.name).toBeDefined();
    }
  });

  it('describes every input field (the only documentation a model sees)', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      const props = (tool.inputSchema as { properties?: Record<string, { description?: string }> })
        .properties;
      for (const [field, schema] of Object.entries(props ?? {})) {
        expect(schema.description, `${tool.name}.${field}`).toBeTruthy();
      }
    }
  });
});

describe('search_food', () => {
  it('returns ids, names, categories and kcal, with the source', async () => {
    const r = await call('search_food', { query: 'feijão carioca cozido' });
    expect(r.structuredContent).toMatchObject({
      query: 'feijão carioca cozido',
      total_matches: 1,
      results: [
        {
          id: 561,
          name: 'Feijão, carioca, cozido',
          category: 'Leguminosas e derivados',
          energy_kcal: 76
        }
      ],
      source: SOURCE
    });
    expect(text(r)).toContain(SOURCE);
  });

  it('respects limit and reports the full match count', async () => {
    const r = await call('search_food', { query: 'arroz', limit: 3 });
    const out = r.structuredContent as { total_matches: number; results: unknown[] };
    expect(out.results).toHaveLength(3);
    expect(out.total_matches).toBe(11);
  });

  it('flags results found through a synonym', async () => {
    const r = await call('search_food', { query: 'macaxeira' });
    const out = r.structuredContent as { results: { id: number; matched_via_synonym?: string }[] };
    expect(out.results[0]).toMatchObject({ id: 129, matched_via_synonym: 'macaxeira' });
  });

  it('says plainly when nothing matches instead of guessing', async () => {
    const r = await call('search_food', { query: 'marmita' });
    expect(r.structuredContent).toMatchObject({ total_matches: 0, results: [], source: SOURCE });
    expect(text(r)).toMatch(/Nenhum alimento/);
  });

  it('rejects an empty query', async () => {
    const r = await call('search_food', { query: '   ' }).catch((e: Error) => e);
    expect(r instanceof Error || (r as { isError?: boolean }).isError).toBeTruthy();
  });
});

describe('get_nutrients', () => {
  it('returns the table values per 100 g, in table order, with the source', async () => {
    const r = await call('get_nutrients', { food_id: 561 });
    const out = r.structuredContent as {
      food: { id: number; name: string };
      basis_grams: number;
      scaled: boolean;
      nutrients: { key: string; per_100g: unknown; amount: unknown }[];
      source: string;
    };
    expect(out.food).toMatchObject({ id: 561, name: 'Feijão, carioca, cozido' });
    expect(out.basis_grams).toBe(100);
    expect(out.scaled).toBe(false);
    expect(out.nutrients.map((n) => n.key)).toEqual(NUTRIENT_DEFS.map((d) => d.key));
    const kcal = out.nutrients.find((n) => n.key === 'energy_kcal')!;
    expect(kcal).toMatchObject({ per_100g: 76, amount: 76 });
    expect(out.source).toBe(SOURCE);
    expect(text(r)).toContain(SOURCE);
  });

  it('scales by grams and says it did', async () => {
    const r = await call('get_nutrients', {
      food_id: 561,
      grams: 150,
      nutrients: ['energy_kcal', 'protein_g', 'iron_mg']
    });
    const out = r.structuredContent as {
      scaled: boolean;
      basis_grams: number;
      nutrients: { key: string; per_100g: number; amount: number }[];
      notes: string[];
    };
    expect(out.scaled).toBe(true);
    expect(out.basis_grams).toBe(150);
    expect(out.nutrients.map((n) => [n.key, n.per_100g, n.amount])).toEqual([
      ['energy_kcal', 76, 114],
      ['protein_g', 4.8, 7.2],
      ['iron_mg', 1.3, 1.95]
    ]);
    expect(out.notes.join(' ')).toMatch(/150 g/);
  });

  it('keeps Tr as {trace:true} and NA as null, never 0, also when scaled', async () => {
    const r = await call('get_nutrients', { food_id: 561, grams: 200 });
    const out = r.structuredContent as {
      nutrients: { key: string; per_100g: unknown; amount: unknown }[];
      trace_nutrients: string[];
      not_analyzed_nutrients: string[];
    };
    const get = (key: string) => out.nutrients.find((n) => n.key === key)!;
    expect(get('vitamin_c_mg')).toMatchObject({
      per_100g: { trace: true },
      amount: { trace: true }
    });
    expect(get('cholesterol_mg')).toMatchObject({ per_100g: null, amount: null });
    expect(out.trace_nutrients).toContain('vitamin_c_mg');
    expect(out.not_analyzed_nutrients).toContain('cholesterol_mg');
    expect(text(r)).toMatch(/Sem dado \(NA, não é zero\)/);
  });

  it('carries the note of foods with a negative carbohydrate mean', async () => {
    const r = await call('get_nutrients', { food_id: 288, nutrients: ['carbohydrate_g'] });
    const out = r.structuredContent as {
      nutrients: { amount: number }[];
      notes: string[];
    };
    expect(out.nutrients[0]!.amount).toBe(0);
    expect(out.notes.join(' ')).toMatch(/original spreadsheet/);
  });

  it('returns an error that points to search_food for an unknown id', async () => {
    const r = await call('get_nutrients', { food_id: 9999 });
    expect(r.isError).toBe(true);
    expect(text(r)).toMatch(/search_food/);
  });

  it('rejects unknown nutrient keys and non-positive grams', async () => {
    for (const args of [
      { food_id: 1, nutrients: ['not_a_nutrient'] },
      { food_id: 1, grams: 0 },
      { food_id: 1, grams: -5 }
    ]) {
      const r = await call('get_nutrients', args).catch((e: Error) => e);
      expect(
        r instanceof Error || (r as { isError?: boolean }).isError,
        JSON.stringify(args)
      ).toBeTruthy();
    }
  });

  it('answers for every one of the 597 foods without schema errors', async () => {
    const ids = FOODS.map((f) => f.id);
    for (const id of [ids[0]!, ids[100]!, ids[300]!, ids[596]!]) {
      const r = await call('get_nutrients', { food_id: id });
      expect(r.isError).toBeFalsy();
      expect((r.structuredContent as { food: { id: number } }).food.id).toBe(id);
    }
  });
});
