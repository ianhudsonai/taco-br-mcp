import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getFood } from '../src/data/foods.js';
import { getProfileValues, getTable, profileFoodIds } from '../src/data/profiles.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const upstream = JSON.parse(readFileSync(join(root, 'data/raw/brolesi/UPSTREAM.json'), 'utf8'));
const file = JSON.parse(readFileSync(join(root, 'data/profiles.json'), 'utf8')) as {
  meta: { source: string; upstream: { sha: string } };
};

type Cell = number | 'Tr' | null;

/** Mirrors how the tests for Tabela 1 read the PDF: 'Tr' = trace, null = blank cell. */
function expectRow(
  table: 'fatty_acids' | 'amino_acids',
  id: number,
  expected: Record<string, Cell>
): void {
  const row = getProfileValues(table, id);
  expect(row, `food ${id}`).toBeDefined();
  for (const [key, cell] of Object.entries(expected)) {
    const got = row!.values[key];
    if (cell === 'Tr') expect(got, `${id} ${key}`).toEqual({ trace: true });
    else if (cell === null) expect(got, `${id} ${key}`).toBeNull();
    else expect(got, `${id} ${key}`).toBe(cell);
  }
}

describe('profiles.json structure', () => {
  it('cites the source and the pinned upstream commit', () => {
    expect(file.meta.source).toBe('TACO 4ª ed. (NEPA/UNICAMP, 2011)');
    expect(file.meta.upstream.sha).toBe(upstream.sha);
  });

  it('covers 423 foods with fatty acids and 26 with amino acids, ids unique and in foods.json', () => {
    for (const [table, n] of [
      ['fatty_acids', 423],
      ['amino_acids', 26]
    ] as const) {
      const ids = profileFoodIds(table);
      expect(ids).toHaveLength(n);
      expect(new Set(ids).size).toBe(n);
      expect(getTable(table).count).toBe(n);
      for (const id of ids) expect(getFood(id), `${table} ${id}`).toBeDefined();
    }
  });

  it('has 22 fatty acid columns and 18 amino acid columns, every row complete', () => {
    expect(getTable('fatty_acids').defs).toHaveLength(22);
    expect(getTable('amino_acids').defs).toHaveLength(18);
    for (const table of ['fatty_acids', 'amino_acids'] as const) {
      const keys = getTable(table).defs.map((d) => d.key);
      for (const id of profileFoodIds(table)) {
        expect(Object.keys(getProfileValues(table, id)!.values)).toEqual(keys);
      }
    }
  });
});

describe('Tr / blank handling', () => {
  it('keeps the audited counts: 9306 fatty acid cells (738 traces, 3017 blank), 468 amino acid cells', () => {
    const count = (table: 'fatty_acids' | 'amino_acids') => {
      const cells = profileFoodIds(table).flatMap((id) =>
        Object.values(getProfileValues(table, id)!.values)
      );
      return {
        total: cells.length,
        trace: cells.filter((v) => typeof v === 'object' && v !== null).length,
        blank: cells.filter((v) => v === null).length
      };
    };
    expect(count('fatty_acids')).toEqual({ total: 9306, trace: 738, blank: 3017 });
    expect(count('amino_acids')).toEqual({ total: 468, trace: 0, blank: 0 });
  });

  it('never leaks the 1e-05 sentinel or a tiny positive as a number', () => {
    for (const table of ['fatty_acids', 'amino_acids'] as const) {
      for (const id of profileFoodIds(table)) {
        for (const v of Object.values(getProfileValues(table, id)!.values)) {
          if (typeof v === 'number') expect(v === 0 || v >= 0.0005).toBe(true);
        }
      }
    }
  });
});

/**
 * Cells transcribed from the official TACO PDF (taco_4_edicao_ampliada_e_revisada.pdf),
 * Tabela 2 (two printed blocks per food) and Tabela 3. 'Tr' = trace, null = blank cell.
 * The whole table was also compared cell by cell against the PDF and the official .xls when
 * it was added: 9774 cells, no difference at the printed precision.
 */
describe('fatty acids against the official PDF', () => {
  it('1 Arroz, integral, cozido: traces and blank cells are kept apart', () => {
    expectRow('fatty_acids', 1, {
      saturated_g: 0.3,
      monounsaturated_g: 0.4,
      polyunsaturated_g: 0.3,
      c12_0_g: null,
      c14_0_g: 'Tr',
      c16_0_g: 0.25,
      c18_0_g: 0.02,
      c20_0_g: 'Tr',
      c22_0_g: 'Tr',
      c24_0_g: 'Tr',
      c14_1_g: null,
      c18_1_g: 0.36,
      c20_1_g: 'Tr',
      c18_2_n6_g: 0.31,
      c18_3_n3_g: 0.01,
      dpa_c22_5_g: 'Tr',
      dha_c22_6_g: null
    });
  });

  it('3 Arroz, tipo 1, cozido: the sums can be Tr', () => {
    expectRow('fatty_acids', 3, {
      saturated_g: 0.2,
      monounsaturated_g: 'Tr',
      polyunsaturated_g: 'Tr',
      c16_0_g: 0.16,
      c20_0_g: null,
      c18_1_g: 0.04,
      c18_2_n6_g: 0.06
    });
  });

  it('321 Sardinha, inteira, crua: EPA and DHA', () => {
    expectRow('fatty_acids', 321, {
      saturated_g: 1.7,
      monounsaturated_g: 0.5,
      polyunsaturated_g: 0.2,
      c12_0_g: 'Tr',
      c14_0_g: 0.21,
      c16_0_g: 1.0,
      c18_0_g: 0.27,
      c16_1_g: 0.13,
      c18_1_g: 0.28,
      c18_2_n6_g: 0.03,
      c18_3_n3_g: 0.02,
      c20_4_g: 0.01,
      epa_c20_5_g: 0.03,
      dpa_c22_5_g: 'Tr',
      dha_c22_6_g: 0.06,
      trans_c18_1_g: 'Tr',
      trans_c18_2_g: null
    });
  });

  it('594 Linhaça, semente: alpha-linolenic acid', () => {
    expectRow('fatty_acids', 594, {
      saturated_g: 4.2,
      monounsaturated_g: 7.1,
      polyunsaturated_g: 25.3,
      c16_0_g: 2.49,
      c18_0_g: 1.62,
      c18_1_g: 7.06,
      c18_2_n6_g: 5.42,
      c18_3_n3_g: 19.81,
      dha_c22_6_g: null
    });
  });

  it('has no row for foods the table does not cover (no row of nulls)', () => {
    expect(profileFoodIds('fatty_acids')).toContain(597);
    const missing = Array.from({ length: 597 }, (_, i) => i + 1).filter(
      (id) => !profileFoodIds('fatty_acids').includes(id)
    );
    expect(missing).toHaveLength(597 - 423);
    for (const id of missing) expect(getProfileValues('fatty_acids', id)).toBeUndefined();
  });
});

describe('amino acids against the official PDF', () => {
  it('56 Pastel, de carne, frito', () => {
    expectRow('amino_acids', 56, {
      tryptophan_g: 0.12,
      threonine_g: 0.3,
      isoleucine_g: 0.41,
      leucine_g: 0.81,
      lysine_g: 0.39,
      methionine_g: 0.19,
      cystine_g: 0.07,
      phenylalanine_g: 0.5,
      tyrosine_g: 0.36,
      valine_g: 0.5,
      arginine_g: 0.41,
      histidine_g: 0.18,
      alanine_g: 0.31,
      aspartic_acid_g: 0.54,
      glutamic_acid_g: 3.37,
      glycine_g: 0.3,
      proline_g: 1.18,
      serine_g: 0.47
    });
  });

  it('463 Queijo, mozarela', () => {
    expectRow('amino_acids', 463, {
      tryptophan_g: 0.38,
      lysine_g: 2.06,
      leucine_g: 2.38,
      proline_g: 2.76,
      glutamic_acid_g: 5.91
    });
  });

  it('keeps amounts the PDF prints as 0,00 as a published 0 or a small number, never null', () => {
    // 123 Farinha, de puba: tryptophan 0,00 (exactly 0 in the spreadsheet), methionine 0,00 (0.0006).
    expectRow('amino_acids', 123, { tryptophan_g: 0, methionine_g: 0.001, cystine_g: 0.02 });
    // 80 Alface, roxa: tryptophan 0,00 (0.0019 in the spreadsheet).
    expectRow('amino_acids', 80, { tryptophan_g: 0.002, threonine_g: 0.03 });
  });

  it('attaches the row printed as "468 Maria mole" to Maria mole (504), with a note', () => {
    expect(getFood(504)!.name).toBe('Maria mole');
    expect(getFood(468)!.name).toBe('Queijo, requeijão, cremoso');
    expect(getProfileValues('amino_acids', 468)).toBeUndefined();
    const row = getProfileValues('amino_acids', 504)!;
    expect(row.note).toMatch(/468.*Maria mole/);
    expectRow('amino_acids', 504, {
      tryptophan_g: 0,
      threonine_g: 0.03,
      isoleucine_g: 0.05,
      glycine_g: 0.99,
      proline_g: 0.58
    });
  });
});
