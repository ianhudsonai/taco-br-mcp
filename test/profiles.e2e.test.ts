import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/client';
import { connect } from './helpers/client.js';

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

interface Row {
  key: string;
  per_100g: unknown;
  amount: unknown;
}
interface Out {
  available: boolean;
  scaled: boolean;
  nutrients: Row[];
  trace_nutrients: string[];
  not_analyzed_nutrients: string[];
  foods_with_data?: { id: number; name: string }[];
  notes: string[];
  source: string;
}
const out = (r: { structuredContent?: unknown }) => r.structuredContent as Out;
const row = (o: Out, key: string) => o.nutrients.find((n) => n.key === key)!;

describe('get_fatty_acids', () => {
  it('returns the profile with trace and blank kept apart, and the citation', async () => {
    const r = await call('get_fatty_acids', { food_id: 1 });
    const o = out(r);
    expect(o.available).toBe(true);
    expect(o.nutrients).toHaveLength(22);
    expect(row(o, 'c16_0_g').per_100g).toBe(0.25);
    expect(row(o, 'c14_0_g').per_100g).toEqual({ trace: true });
    expect(row(o, 'dha_c22_6_g').per_100g).toBeNull();
    expect(o.trace_nutrients).toContain('c14_0_g');
    expect(o.not_analyzed_nutrients).toContain('dha_c22_6_g');
    expect(o.source).toBe(SOURCE);
    expect(text(r)).toContain(SOURCE);
    expect(text(r)).toContain('sem dado na TACO');
  });

  it('scales to grams and keeps trace and null as they are', async () => {
    const o = out(await call('get_fatty_acids', { food_id: 321, grams: 150 }));
    expect(o.scaled).toBe(true);
    expect(row(o, 'dha_c22_6_g').per_100g).toBe(0.06);
    expect(row(o, 'dha_c22_6_g').amount).toBe(0.09);
    expect(row(o, 'c12_0_g').amount).toEqual({ trace: true });
    expect(row(o, 'trans_c18_2_g').amount).toBeNull();
  });

  it('filters by key and explains the sum caveats', async () => {
    const o = out(
      await call('get_fatty_acids', { food_id: 321, nutrients: ['saturated_g', 'dha_c22_6_g'] })
    );
    expect(o.nutrients.map((n) => n.key)).toEqual(['saturated_g', 'dha_c22_6_g']);
    expect(o.notes.join(' ')).toMatch(/não incluem os ácidos graxos trans/);
  });

  it('says a food outside the table has no data, instead of zeros', async () => {
    // 39: Macarrão, instantâneo has no row in Tabela 2
    const r = await call('get_fatty_acids', { food_id: 39 });
    const o = out(r);
    expect(r.isError).toBeFalsy();
    expect(o.available).toBe(false);
    expect(o.nutrients).toEqual([]);
    expect(o.notes.join(' ')).toMatch(/não publica ácidos graxos/);
    expect(text(r)).toContain(SOURCE);
  });

  it('errors on an unknown food id', async () => {
    const r = await call('get_fatty_acids', { food_id: 9999 });
    expect(r.isError).toBe(true);
  });
});

describe('get_amino_acids', () => {
  it('returns the 18 amino acids with the source', async () => {
    const r = await call('get_amino_acids', { food_id: 463 });
    const o = out(r);
    expect(o.available).toBe(true);
    expect(o.nutrients).toHaveLength(18);
    expect(row(o, 'lysine_g').per_100g).toBe(2.06);
    expect(text(r)).toContain(SOURCE);
  });

  it('shows a published 0,00 as a number, not as missing', async () => {
    const o = out(await call('get_amino_acids', { food_id: 123 }));
    expect(row(o, 'tryptophan_g').per_100g).toBe(0);
    expect(o.not_analyzed_nutrients).toEqual([]);
    expect(o.notes.join(' ')).toMatch(/0,00/);
  });

  it('carries the numbering-error note on Maria mole', async () => {
    const o = out(await call('get_amino_acids', { food_id: 504 }));
    expect(o.available).toBe(true);
    expect(o.notes.join(' ')).toMatch(/número 468/);
  });

  it('lists the 26 foods that have data when asked for one that does not', async () => {
    // 1: Arroz, integral, cozido
    const r = await call('get_amino_acids', { food_id: 1 });
    const o = out(r);
    expect(o.available).toBe(false);
    expect(o.nutrients).toEqual([]);
    expect(o.foods_with_data).toHaveLength(26);
    expect(o.foods_with_data!.map((f) => f.id)).toContain(463);
    expect(text(r)).toContain('Queijo, mozarela');
    expect(text(r)).toContain(SOURCE);
  });

  it('rejects a key from the other table', async () => {
    const r = await call('get_amino_acids', { food_id: 463, nutrients: ['dha_c22_6_g'] }).catch(
      (e: unknown) => e
    );
    const failed = r instanceof Error || (r as { isError?: boolean }).isError === true;
    expect(failed).toBe(true);
  });
});
