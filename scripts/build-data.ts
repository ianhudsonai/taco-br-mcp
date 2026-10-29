/**
 * Builds data/foods.json and data/household.json from the pinned upstream CSVs
 * (brolesi/taco, see data/raw/brolesi/UPSTREAM.json).
 *
 *   npm run build:data            # reads the committed copies in data/raw/brolesi
 *   npm run build:data -- --fetch # re-downloads them from the pinned SHA and verifies sha256
 *
 * Value encoding for every nutrient: number | { "trace": true } | null
 *   - upstream 1e-05 (TACO "Tr")     -> { "trace": true }
 *   - upstream empty (TACO "NA")     -> null
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { NUTRIENTS } from './nutrients.js';
import { MEASURE_LABELS } from './measures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDir = join(root, 'data/raw/brolesi');
const upstream = JSON.parse(readFileSync(join(rawDir, 'UPSTREAM.json'), 'utf8')) as {
  repo: string;
  sha: string;
  files: Record<string, { path: string; sha256: string }>;
};

export const SOURCE = 'TACO 4ª ed. (NEPA/UNICAMP, 2011)';
const TRACE_RAW = 1e-5;

export type NutrientValue = number | { trace: true } | null;

export interface FoodRecord {
  id: number;
  name: string;
  category: string;
  base: string;
  preparation: string | null;
  qualifiers: string | null;
  nutrients: Record<string, NutrientValue>;
  notes?: string[];
}

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

async function loadUpstream(name: string, fetchRemote: boolean): Promise<Buffer> {
  const meta = upstream.files[name];
  if (!meta) throw new Error(`unknown upstream file ${name}`);
  const local = join(rawDir, name);
  let buf: Buffer;
  if (fetchRemote || !existsSync(local)) {
    const url = `https://raw.githubusercontent.com/brolesi/taco/${upstream.sha}/${meta.path}`;
    console.error(`[build-data] fetching ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} -> HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(local, buf);
  } else {
    buf = readFileSync(local);
  }
  const got = sha256(buf);
  if (got !== meta.sha256) {
    throw new Error(`${name}: sha256 ${got} does not match pinned ${meta.sha256}`);
  }
  return buf;
}

/** Rounds to `decimals`; if a real (non-trace) value would collapse to 0, keeps more digits. */
export function roundValue(raw: number, decimals: number): number {
  for (let d = decimals; d <= decimals + 3; d++) {
    const r = Number(raw.toFixed(d));
    if (r !== 0 || raw === 0) return r;
  }
  return Number(raw.toPrecision(2));
}

function encode(
  raw: string,
  decimals: number,
  column: string,
  foodId: string,
  notes: string[]
): NutrientValue {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`food ${foodId}: ${column} not numeric: ${raw}`);
  if (n === TRACE_RAW) return { trace: true };
  if (n > 0 && n < 0.001)
    throw new Error(`food ${foodId}: ${column} = ${raw} is neither trace nor a plausible value`);
  if (n < 0) {
    if (column !== 'carboidrato_g')
      throw new Error(`food ${foodId}: unexpected negative ${column} = ${raw}`);
    notes.push(
      `carbohydrate_g is ${roundValue(n, 3)} g in the original spreadsheet (computed by difference); shown as 0.`
    );
    return 0;
  }
  return roundValue(n, decimals);
}

function buildFoods(csv: Buffer): FoodRecord[] {
  const rows = parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  return rows.map((row) => {
    const id = String(row.numero_alimento);
    const notes: string[] = [];
    const nutrients: Record<string, NutrientValue> = {};
    for (const def of NUTRIENTS) {
      if (!(def.column in row)) throw new Error(`missing column ${def.column}`);
      nutrients[def.key] = encode(row[def.column]!, def.decimals, def.column, id, notes);
    }
    const food: FoodRecord = {
      id: Number(id),
      name: row.descricao!,
      category: row.categoria!,
      base: row.base!,
      preparation: row.preparo ? row.preparo : null,
      qualifiers: row.qualificadores ? row.qualificadores : null,
      nutrients
    };
    if (notes.length) food.notes = notes;
    return food;
  });
}

interface MapEntry {
  taco_id: number;
  pof_code: string;
  pof_prep: string;
  note?: string;
  measures: string[];
}

export interface HouseholdRecord {
  taco_id: number;
  pof: { code: string; preparation_code: string; name: string; preparation: string };
  note?: string;
  measures: { key: string; measure: string; grams: number; source_description: string }[];
}

/** Applies the hand-curated map to the POF CSV. Fails loudly on any unmatched measure. */
function buildHousehold(pofCsv: Buffer, foodIds: Set<number>): HouseholdRecord[] {
  const rows = parse(pofCsv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];
  const map = JSON.parse(readFileSync(join(root, 'data/curation/household-map.json'), 'utf8')) as {
    entries: MapEntry[];
  };
  const seen = new Set<number>();
  return map.entries.map((entry) => {
    if (!foodIds.has(entry.taco_id))
      throw new Error(`household map: unknown TACO id ${entry.taco_id}`);
    if (seen.has(entry.taco_id))
      throw new Error(`household map: duplicate TACO id ${entry.taco_id}`);
    seen.add(entry.taco_id);
    const candidates = rows.filter(
      (r) => r.codigo_alimento === entry.pof_code && r.codigo_preparacao === entry.pof_prep
    );
    if (candidates.length === 0) {
      throw new Error(`household map: no POF rows for ${entry.pof_code}/${entry.pof_prep}`);
    }
    const measures = entry.measures.map((name) => {
      const hits = candidates.filter((r) => r.descricao_medida === name);
      if (hits.length !== 1) {
        throw new Error(
          `household map: ${entry.taco_id} ${name}: expected 1 POF row, got ${hits.length}`
        );
      }
      const label = MEASURE_LABELS[name];
      if (!label) throw new Error(`household map: no label for measure ${name}`);
      const grams = Number(hits[0]!.quantidade_g);
      if (!(grams > 0)) throw new Error(`household map: ${entry.taco_id} ${name}: bad grams`);
      return {
        key: label.key,
        measure: label.pt,
        grams,
        source_description: hits[0]!.descricao_fonte!
      };
    });
    const first = candidates[0]!;
    const record: HouseholdRecord = {
      taco_id: entry.taco_id,
      pof: {
        code: entry.pof_code,
        preparation_code: entry.pof_prep,
        name: first.descricao_alimento!,
        preparation: first.descricao_preparacao!
      },
      measures
    };
    if (entry.note) record.note = entry.note;
    return record;
  });
}

/** One food per line keeps diffs reviewable. */
function serialize(meta: unknown, nutrients: unknown, foods: unknown[]): string {
  const lines = foods.map((f) => '    ' + JSON.stringify(f)).join(',\n');
  return `{\n  "meta": ${JSON.stringify(meta)},\n  "nutrients": ${JSON.stringify(nutrients)},\n  "foods": [\n${lines}\n  ]\n}\n`;
}

async function main() {
  const fetchRemote = process.argv.includes('--fetch');
  const taco = await loadUpstream('taco_composicao.csv', fetchRemote);
  const pof = await loadUpstream('pof_medidas_caseiras.csv', fetchRemote);

  const foods = buildFoods(taco);
  const ids = new Set(foods.map((f) => f.id));
  if (foods.length !== 597 || ids.size !== 597) {
    throw new Error(`expected 597 distinct foods, got ${foods.length}/${ids.size}`);
  }

  const meta = {
    source: SOURCE,
    basis: 'per 100 g of edible portion',
    upstream: {
      repo: upstream.repo,
      sha: upstream.sha,
      file: upstream.files['taco_composicao.csv']!.path
    },
    encoding: 'nutrient value = number | {"trace":true} (Tr) | null (NA, not analyzed)',
    count: foods.length
  };
  const nutrientDefs = NUTRIENTS.map(({ key, unit, label_pt, label_en, decimals }) => ({
    key,
    unit,
    label_pt,
    label_en,
    decimals
  }));
  writeFileSync(join(root, 'data/foods.json'), serialize(meta, nutrientDefs, foods));
  console.error(`[build-data] wrote data/foods.json (${foods.length} foods)`);

  const household = buildHousehold(pof, ids);
  const householdMeta = {
    source:
      'POF 2008-2009 (IBGE), Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil',
    status: 'starter set: hand-curated TACO -> POF mapping (see data/curation/household-map.json)',
    upstream: {
      repo: upstream.repo,
      sha: upstream.sha,
      file: upstream.files['pof_medidas_caseiras.csv']!.path
    },
    count: household.length
  };
  writeFileSync(
    join(root, 'data/household.json'),
    `{\n  "meta": ${JSON.stringify(householdMeta)},\n  "foods": [\n${household.map((h) => '    ' + JSON.stringify(h)).join(',\n')}\n  ]\n}\n`
  );
  console.error(`[build-data] wrote data/household.json (${household.length} foods)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[build-data] failed:', err);
    process.exit(1);
  });
}
