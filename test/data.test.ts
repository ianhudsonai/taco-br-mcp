import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { roundValue } from '../scripts/build-data.js';
import { NUTRIENTS } from '../scripts/nutrients.js';

const root = fileURLToPath(new URL('..', import.meta.url));
type Value = number | { trace: true } | null;
interface Food {
  id: number;
  name: string;
  category: string;
  nutrients: Record<string, Value>;
  notes?: string[];
}
const foodsFile = JSON.parse(readFileSync(join(root, 'data/foods.json'), 'utf8')) as {
  meta: { source: string; count: number; upstream: { sha: string } };
  foods: Food[];
};
const upstream = JSON.parse(readFileSync(join(root, 'data/raw/brolesi/UPSTREAM.json'), 'utf8'));
const byId = (id: number) => foodsFile.foods.find((f) => f.id === id)!;
const allValues = foodsFile.foods.flatMap((f) => Object.values(f.nutrients));
const isTrace = (v: Value): v is { trace: true } => typeof v === 'object' && v !== null;

describe('foods.json structure', () => {
  it('has the 597 foods of TACO 4th edition with unique ids', () => {
    expect(foodsFile.foods).toHaveLength(597);
    expect(foodsFile.meta.count).toBe(597);
    expect(new Set(foodsFile.foods.map((f) => f.id)).size).toBe(597);
  });

  it('cites the source and the pinned upstream commit', () => {
    expect(foodsFile.meta.source).toBe('TACO 4ª ed. (NEPA/UNICAMP, 2011)');
    expect(foodsFile.meta.upstream.sha).toBe(upstream.sha);
  });

  it('pinned raw CSVs match their recorded sha256', () => {
    for (const [name, meta] of Object.entries<{ sha256: string }>(upstream.files)) {
      const buf = readFileSync(join(root, 'data/raw/brolesi', name));
      expect(createHash('sha256').update(buf).digest('hex')).toBe(meta.sha256);
    }
  });

  it('every food carries every nutrient key, each a number, {trace:true} or null', () => {
    const keys = NUTRIENTS.map((n) => n.key).sort();
    for (const food of foodsFile.foods) {
      expect(Object.keys(food.nutrients).sort()).toEqual(keys);
    }
    for (const v of allValues) {
      expect(v === null || typeof v === 'number' || (isTrace(v) && v.trace === true)).toBe(true);
    }
  });
});

describe('Tr / NA handling', () => {
  it('keeps the counts found in the audit: 15522 cells, 1863 traces, 2117 not analyzed', () => {
    expect(allValues).toHaveLength(15522);
    expect(allValues.filter(isTrace)).toHaveLength(1863);
    expect(allValues.filter((v) => v === null)).toHaveLength(2117);
  });

  it('never turns a trace into a number (no 1e-05 leaks, no tiny positives)', () => {
    const numbers = allValues.filter((v): v is number => typeof v === 'number');
    expect(numbers.filter((n) => n > 0 && n < 0.001)).toEqual([]);
    expect(numbers.every((n) => n >= 0)).toBe(true);
  });

  it('clamps the 4 negative carbohydrate means to 0 and annotates them', () => {
    const annotated = foodsFile.foods.filter((f) => f.notes).map((f) => f.id);
    expect(annotated.sort((a, b) => a - b)).toEqual([288, 322, 337, 400]);
    for (const id of annotated) {
      expect(byId(id).nutrients.carbohydrate_g).toBe(0);
      expect(byId(id).notes![0]).toMatch(/carbohydrate_g.*original spreadsheet/);
    }
  });

  it('roundValue keeps real small values instead of collapsing them to 0', () => {
    expect(roundValue(76.4242, 0)).toBe(76);
    expect(roundValue(4.775, 1)).toBe(4.8);
    expect(roundValue(0.0203, 1)).toBe(0.02);
    expect(roundValue(0, 1)).toBe(0);
  });
});

/**
 * Cells transcribed from the official TACO PDF (taco_4_edicao_ampliada_e_revisada.pdf,
 * Tabela 1, two printed blocks per food). 'Tr' = trace, 'NA' or an empty cell = not analyzed.
 * Order: moisture, kcal, kJ, protein, lipids, cholesterol, carbs, fiber, ash, calcium, magnesium |
 *        manganese, phosphorus, iron, sodium, potassium, copper, zinc, retinol, RE, RAE,
 *        thiamine, riboflavin, pyridoxine, niacin, vitamin C
 */
const KEYS = [
  'moisture_pct',
  'energy_kcal',
  'energy_kj',
  'protein_g',
  'lipids_g',
  'cholesterol_mg',
  'carbohydrate_g',
  'dietary_fiber_g',
  'ash_g',
  'calcium_mg',
  'magnesium_mg',
  'manganese_mg',
  'phosphorus_mg',
  'iron_mg',
  'sodium_mg',
  'potassium_mg',
  'copper_mg',
  'zinc_mg',
  'retinol_mcg',
  're_mcg',
  'rae_mcg',
  'thiamine_mg',
  'riboflavin_mg',
  'pyridoxine_mg',
  'niacin_mg',
  'vitamin_c_mg'
] as const;
type Cell = number | 'Tr' | 'NA';
const PDF: Record<number, [string, Cell[]]> = {
  1: [
    'Arroz, integral, cozido',
    [
      70.1,
      124,
      517,
      2.6,
      1.0,
      'NA',
      25.8,
      2.7,
      0.5,
      5,
      59,
      0.63,
      106,
      0.3,
      1,
      75,
      0.02,
      0.7,
      'NA',
      'NA',
      'NA',
      0.08,
      'Tr',
      0.08,
      'Tr',
      'NA'
    ]
  ],
  53: [
    'Pão, trigo, francês',
    [
      28.5,
      300,
      1254,
      8.0,
      3.1,
      'NA',
      58.6,
      2.3,
      1.8,
      16,
      25,
      0.46,
      95,
      1.0,
      648,
      142,
      0.13,
      0.8,
      3,
      'NA',
      'NA',
      0.39,
      0.67,
      0.6,
      2.34,
      'NA'
    ]
  ],
  182: [
    'Banana, prata, crua',
    [
      71.9,
      98,
      411,
      1.3,
      0.1,
      'NA',
      26.0,
      2.0,
      0.8,
      8,
      26,
      0.42,
      22,
      0.4,
      'Tr',
      358,
      0.05,
      0.1,
      'NA',
      32,
      16,
      'Tr',
      0.02,
      0.1,
      'Tr',
      21.6
    ]
  ],
  410: [
    'Frango, peito, sem pele, grelhado',
    [
      63.8,
      159,
      666,
      32.0,
      2.5,
      89,
      0.0,
      'NA',
      1.4,
      5,
      18,
      'Tr',
      295,
      0.3,
      50,
      387,
      0.02,
      0.8,
      'Tr',
      'Tr',
      'Tr',
      0.11,
      'Tr',
      'Tr',
      24.83,
      'NA'
    ]
  ],
  488: [
    'Ovo, de galinha, inteiro, cozido/10minutos',
    [
      75.8,
      146,
      610,
      13.3,
      9.5,
      397,
      0.6,
      'NA',
      0.8,
      49,
      11,
      0.02,
      184,
      1.5,
      146,
      139,
      0.04,
      1.2,
      32,
      'NA',
      'NA',
      0.08,
      0.3,
      'Tr',
      'Tr',
      'NA'
    ]
  ],
  561: [
    'Feijão, carioca, cozido',
    [
      80.4,
      76,
      320,
      4.8,
      0.5,
      'NA',
      13.6,
      8.5,
      0.7,
      27,
      42,
      0.28,
      87,
      1.3,
      2,
      255,
      0.19,
      0.7,
      'NA',
      'NA',
      'NA',
      0.04,
      'Tr',
      'Tr',
      'Tr',
      'Tr'
    ]
  ]
};

describe('values checked against the official PDF', () => {
  it.each(Object.entries(PDF))('food %s matches the printed table', (id, [name, cells]) => {
    const food = byId(Number(id));
    expect(food.name).toBe(name);
    expect(cells).toHaveLength(KEYS.length);
    const expected = Object.fromEntries(
      KEYS.map((key, i) => {
        const c = cells[i]!;
        return [key, c === 'Tr' ? { trace: true } : c === 'NA' ? null : c];
      })
    );
    expect(food.nutrients).toEqual(expected);
  });
});

describe('household.json (curated)', () => {
  const household = JSON.parse(readFileSync(join(root, 'data/household.json'), 'utf8')) as {
    meta: { source: string; count: number };
    foods: {
      taco_id: number;
      pof: { code: string; preparation_code: string };
      measures: { key: string; measure: string; grams: number; source_description: string }[];
    }[];
  };
  const pofCsv = readFileSync(join(root, 'data/raw/brolesi/pof_medidas_caseiras.csv'), 'utf8');

  it('only maps ids that exist in foods.json, once each', () => {
    const ids = household.foods.map((h) => h.taco_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(household.meta.count).toBe(ids.length);
    for (const id of ids) expect(byId(id)).toBeDefined();
  });

  it('maps the expected TACO foods', () => {
    expect(byId(3).name).toBe('Arroz, tipo 1, cozido');
    expect(byId(561).name).toBe('Feijão, carioca, cozido');
    expect(byId(567).name).toBe('Feijão, preto, cozido');
    expect(byId(129).name).toBe('Mandioca, cozida');
    expect(byId(458).name).toBe('Leite, de vaca, integral');
  });

  it('never exposes GRAMA/QUILO/MILILITRO and has unique measure keys per food', () => {
    for (const h of household.foods) {
      const keys = h.measures.map((m) => m.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const m of h.measures) expect(m.measure).not.toMatch(/^(grama|quilo|mililitro)$/i);
    }
  });

  it('grams come straight from the POF row (spot checks)', () => {
    const grams = (id: number, key: string) =>
      household.foods.find((h) => h.taco_id === id)!.measures.find((m) => m.key === key)!.grams;
    expect(grams(3, 'colher_de_sopa')).toBe(25);
    expect(grams(3, 'prato_fundo')).toBe(200);
    expect(grams(1, 'colher_de_sopa')).toBe(20);
    expect(grams(488, 'unidade')).toBe(45);
    expect(grams(53, 'unidade')).toBe(50);
    expect(grams(458, 'copo_americano')).toBe(150);
    // the POF CSV really contains those rows
    expect(pofCsv).toContain(
      '6300101,"ARROZ (POLIDO, PARBOILIZADO)",99,NAO SE APLICA,16,COLHER DE SOPA'
    );
  });
});
