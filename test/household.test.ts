import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { describe, expect, it } from 'vitest';
import { getFood } from '../src/data/foods.js';
import { getHousehold, HOUSEHOLD } from '../src/data/household.js';
import { findMeasure, parseMeasureText, resolveHousehold } from '../src/household.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const pof = parse(readFileSync(join(root, 'data/raw/brolesi/pof_medidas_caseiras.csv'), 'utf8'), {
  columns: true
}) as Record<string, string>[];

describe('curated household data', () => {
  it('has a meaningful starter set', () => {
    expect(HOUSEHOLD.length).toBeGreaterThanOrEqual(60);
  });

  it('only maps existing TACO foods, once each, with unique measure keys', () => {
    const ids = HOUSEHOLD.map((h) => h.taco_id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of HOUSEHOLD) {
      expect(getFood(h.taco_id), `TACO ${h.taco_id}`).toBeDefined();
      const keys = h.measures.map((m) => m.key);
      expect(new Set(keys).size, `TACO ${h.taco_id}`).toBe(keys.length);
      expect(h.measures.length).toBeGreaterThan(0);
    }
  });

  it('every weight is a real POF row for that food and preparation', () => {
    for (const h of HOUSEHOLD) {
      for (const m of h.measures) {
        const row = pof.find(
          (r) =>
            r.codigo_alimento === h.pof.code &&
            r.codigo_preparacao === h.pof.preparation_code &&
            r.descricao_fonte === m.source_description &&
            Number(r.quantidade_g) === m.grams
        );
        expect(row, `TACO ${h.taco_id} ${m.key}`).toBeDefined();
      }
    }
  });

  it('never exposes trivial gram/kilo/millilitre measures', () => {
    for (const h of HOUSEHOLD) {
      for (const m of h.measures) expect(m.key).not.toMatch(/^(grama|quilo|mililitro|litro)$/);
    }
  });

  it('keeps the reviewed exclusions (sources that do not match the food)', () => {
    const keys = (id: number) => getHousehold(id)!.measures.map((m) => m.key);
    expect(keys(533)).not.toContain('colher_de_sopa'); // spoon weights there are of corn flour
    expect(keys(235)).not.toContain('copo_medio'); // "diluição para o preparo" of juice
    expect(keys(410)).not.toContain('peito'); // bone-in roasted breast
    expect(keys(448)).not.toContain('colher_de_sopa'); // source is cream
    expect(getHousehold(398)).toBeUndefined(); // bone-in drumstick vs edible-portion table
    expect(getHousehold(62)).toBeUndefined(); // polenta: cooked angu vs pre-cooked product
  });

  it('spot checks against the POF rows', () => {
    const grams = (id: number, key: string) =>
      getHousehold(id)!.measures.find((m) => m.key === key)!.grams;
    expect(grams(3, 'colher_de_sopa')).toBe(25);
    expect(grams(53, 'unidade')).toBe(50);
    expect(grams(488, 'unidade')).toBe(45);
    expect(grams(494, 'colher_de_sopa')).toBe(24);
    expect(grams(272, 'colher_de_sopa')).toBe(8);
    expect(grams(222, 'unidade')).toBe(150);
    expect(grams(457, 'copo_americano')).toBe(150);
  });
});

describe('measure parsing and matching', () => {
  it('splits a leading quantity from the measure', () => {
    expect(parseMeasureText('2 colheres de sopa')).toEqual({
      text: 'colheres de sopa',
      quantity: 2
    });
    expect(parseMeasureText('1/2 unidade')).toEqual({ text: 'unidade', quantity: 0.5 });
    expect(parseMeasureText('1,5 concha')).toEqual({ text: 'concha', quantity: 1.5 });
    expect(parseMeasureText('colher de sopa')).toEqual({ text: 'colher de sopa' });
  });

  const rice = getHousehold(3)!;
  it.each([
    ['colher de sopa', 'colher_de_sopa'],
    ['colheres de sopa', 'colher_de_sopa'],
    ['Colher de Sopa cheia', 'colher_de_sopa'],
    ['colher de servir', 'colher_de_arroz'],
    ['colher de arroz', 'colher_de_arroz'],
    ['conchas', 'concha'],
    ['prato fundo', 'prato_fundo'],
    ['porção', 'porcao'],
    ['porções', 'porcao']
  ])('"%s" -> %s for rice', (text, key) => {
    expect(findMeasure(rice, text)?.key).toBe(key);
  });

  it('does not guess ambiguous or unknown measures', () => {
    expect(findMeasure(rice, 'colher')).toBeUndefined();
    expect(findMeasure(rice, 'prato')).toBeUndefined();
    expect(findMeasure(rice, 'xícara')).toBeUndefined();
    expect(findMeasure(rice, 'fatia')).toBeUndefined();
    expect(findMeasure(rice, '')).toBeUndefined();
  });

  it('handles unit words for countable foods', () => {
    const bread = getHousehold(53)!;
    expect(findMeasure(bread, 'unidades')?.key).toBe('unidade');
    expect(findMeasure(bread, 'pão inteiro')).toBeUndefined();
    expect(findMeasure(bread, 'meio')?.key).toBe('metade');
    expect(findMeasure(bread, 'metade')?.key).toBe('metade');
  });

  it('resolves grams as quantity x weight, never guessing', () => {
    const ok = resolveHousehold(3, '2 colheres de sopa');
    expect(ok).toMatchObject({ ok: true, grams: 50, quantity: 2 });
    expect(resolveHousehold(3, 'colher de sopa', 0.5)).toMatchObject({ ok: true, grams: 12.5 });
    expect(resolveHousehold(3, 'colher')).toMatchObject({ ok: false, reason: 'unknown_measure' });
    expect(resolveHousehold(40, 'colher de sopa')).toMatchObject({
      ok: false,
      reason: 'no_household_data'
    });
    expect(resolveHousehold(9999, 'unidade')).toMatchObject({ ok: false, reason: 'unknown_food' });
    expect(resolveHousehold(3, '2 colheres de sopa', 3)).toMatchObject({ ok: false });
  });
});
