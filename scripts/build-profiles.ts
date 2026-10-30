/**
 * Builds data/profiles.json: the TACO fatty acid (Tabela 2, 423 foods) and amino acid
 * (Tabela 3, 26 foods) tables, from the pinned upstream CSVs. Called by build-data.ts.
 *
 * Same value encoding as foods.json (number | {"trace":true} | null), with one difference:
 * the amino acid table has no "Tr"; TACO prints 0,00 for amounts below 0.005 g/100 g, so an
 * exact 0 in the spreadsheet is a published value and stays 0.
 *
 * A food that is not in a table at all has no entry; that is "not published", not a row of nulls.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import type { FoodRecord } from './build-data.js';
import { AMINO_ACIDS, FATTY_ACIDS, type ProfileColumn } from './profiles.js';
import { loadUpstream, root, roundValue, SOURCE, upstream } from './upstream.js';

const TRACE_RAW = 1e-5;
/** Smallest real value in either table is 0.0006; anything under this is not a measurement. */
const MIN_PLAUSIBLE = 1e-4;

type Value = number | { trace: true } | null;

function encode(raw: string, def: ProfileColumn, foodId: string): Value {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`food ${foodId}: ${def.column} not numeric: ${raw}`);
  if (n === TRACE_RAW) return { trace: true };
  if (n < 0) throw new Error(`food ${foodId}: unexpected negative ${def.column} = ${raw}`);
  if (n > 0 && n < MIN_PLAUSIBLE)
    throw new Error(`food ${foodId}: ${def.column} = ${raw} is neither trace nor plausible`);
  return roundValue(n, def.decimals);
}

/** The sheets differ in case/spacing for a few names (e.g. "Palmito, Juçara", "fresco,cru"). */
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

interface IdCorrection {
  /** Number printed in the TACO table. */
  from: number;
  /** Food the row really describes. */
  to: number;
  /** Shown to the user with the food's data. */
  note: string;
}

/**
 * Numbering errors in the TACO publication itself (present in the PDF and the official .xls).
 * Each one is checked below: the description printed in the row must match the corrected food.
 */
const ID_CORRECTIONS: Record<string, IdCorrection[]> = {
  'taco_aminoacidos.csv': [
    {
      from: 468,
      to: 504,
      note: 'Na Tabela 3 da TACO esta linha traz o número 468 (queijo requeijão cremoso) mas a descrição "Maria mole". Os valores são da Maria mole (soma dos aminoácidos 3,6 g/100 g, proteína da Maria mole 3,8 g; requeijão tem 9,6 g), então foram atribuídos ao nº 504. Erro de numeração da publicação.'
    }
  ]
};

function buildTable(
  csv: Buffer,
  columns: ProfileColumn[],
  foods: Map<number, FoodRecord>,
  corrections: IdCorrection[] = []
) {
  const rows = parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const seen = new Set<number>();
  const out = rows.map((row) => {
    const printedId = Number(row.numero_alimento);
    const correction = corrections.find((c) => c.from === printedId);
    const id = correction ? correction.to : printedId;
    const food = foods.get(id);
    if (!food) throw new Error(`profile: unknown TACO id ${id}`);
    if (seen.has(id)) throw new Error(`profile: duplicate TACO id ${id}`);
    seen.add(id);
    if (norm(row.descricao!) !== norm(food.name))
      throw new Error(`profile: id ${id} is "${row.descricao}" here but "${food.name}" in foods`);
    const values = columns.map((def) => {
      if (!(def.column in row)) throw new Error(`missing column ${def.column}`);
      return encode(row[def.column]!, def, String(id));
    });
    return correction ? { id, v: values, note: correction.note } : { id, v: values };
  });
  return out.sort((a, b) => a.id - b.id);
}

const line = (f: unknown) => '        ' + JSON.stringify(f);

function serializeTable(
  title_pt: string,
  notes: string[],
  columns: ProfileColumn[],
  foods: { id: number; v: Value[]; note?: string }[]
): string {
  const defs = columns.map(({ key, unit, label_pt, label_en, decimals }) => ({
    key,
    unit,
    label_pt,
    label_en,
    decimals
  }));
  return (
    `{\n      "title_pt": ${JSON.stringify(title_pt)},\n      "notes": ${JSON.stringify(notes)},\n` +
    `      "columns": ${JSON.stringify(defs)},\n      "count": ${foods.length},\n` +
    `      "foods": [\n${foods.map(line).join(',\n')}\n      ]\n    }`
  );
}

export async function buildProfiles(fetchRemote: boolean, foodList: FoodRecord[]): Promise<void> {
  const foods = new Map(foodList.map((f) => [f.id, f]));
  const agCsv = await loadUpstream('taco_acidos_graxos.csv', fetchRemote);
  const aaCsv = await loadUpstream('taco_aminoacidos.csv', fetchRemote);
  const ag = buildTable(agCsv, FATTY_ACIDS, foods, ID_CORRECTIONS['taco_acidos_graxos.csv']);
  const aa = buildTable(aaCsv, AMINO_ACIDS, foods, ID_CORRECTIONS['taco_aminoacidos.csv']);
  if (ag.length !== 423) throw new Error(`expected 423 foods with fatty acids, got ${ag.length}`);
  if (aa.length !== 26) throw new Error(`expected 26 foods with amino acids, got ${aa.length}`);

  const meta = {
    source: SOURCE,
    basis: 'per 100 g of edible portion',
    upstream: {
      repo: upstream.repo,
      sha: upstream.sha,
      files: [
        upstream.files['taco_acidos_graxos.csv']!.path,
        upstream.files['taco_aminoacidos.csv']!.path
      ]
    },
    encoding:
      'value = number | {"trace":true} (Tr) | null (no value published in the table); a food absent from a table has no data in it',
    columns_order: 'each food row "v" follows the table "columns" order'
  };
  const fattyNotes = [
    'Saturados, monoinsaturados e poli-insaturados incluem ácidos graxos que a tabela não lista individualmente; por isso podem ser maiores que a soma das colunas abaixo deles.',
    'Monoinsaturados e poli-insaturados não incluem os ácidos graxos trans (18:1t e 18:2t, colunas à parte).',
    'Limite de quantificação dos ácidos graxos: 0,01 g/100 g; traço (Tr) indica quantidade abaixo do que a TACO consegue quantificar.',
    'Célula sem valor na TACO = sem dado (não é zero).'
  ];
  const aminoNotes = [
    'A TACO só publica aminoácidos para 26 alimentos.',
    'Aminoácidos totais, por hidrólise ácida e CLAE (método descrito na TACO). A TACO imprime 2 casas decimais: quantidades abaixo de 0,005 g/100 g aparecem como 0,00 na publicação; aqui, 0 é esse valor publicado e valores pequenos mantêm mais casas. Nenhum dos dois é dado ausente.'
  ];
  const body =
    `{\n  "meta": ${JSON.stringify(meta)},\n  "tables": {\n    "fatty_acids": ` +
    serializeTable('Ácidos graxos (Tabela 2)', fattyNotes, FATTY_ACIDS, ag) +
    `,\n    "amino_acids": ` +
    serializeTable('Aminoácidos (Tabela 3)', aminoNotes, AMINO_ACIDS, aa) +
    `\n  }\n}\n`;
  writeFileSync(join(root, 'data/profiles.json'), body);
  console.error(`[build-data] wrote data/profiles.json (${ag.length} + ${aa.length} foods)`);
}
