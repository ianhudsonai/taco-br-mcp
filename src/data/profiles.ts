import profilesFile from '../../data/profiles.json' with { type: 'json' };
import type { NutrientDef, NutrientValue } from './foods.js';

export type ProfileTable = 'fatty_acids' | 'amino_acids';

interface TableFile {
  title_pt: string;
  notes: string[];
  columns: NutrientDef[];
  foods: { id: number; v: NutrientValue[]; note?: string }[];
}

const tables = (profilesFile as unknown as { tables: Record<ProfileTable, TableFile> }).tables;

export interface Profile {
  /** Column definitions of the table, in table order. */
  defs: readonly NutrientDef[];
  /** Table-wide caveats, in Portuguese. */
  notes: readonly string[];
  title_pt: string;
  /** Number of foods the table covers. */
  count: number;
}

export function getTable(table: ProfileTable): Profile {
  const t = tables[table];
  return { defs: t.columns, notes: t.notes, title_pt: t.title_pt, count: t.foods.length };
}

const byTableAndId = new Map(
  (Object.keys(tables) as ProfileTable[]).map((name) => [
    name,
    new Map(tables[name].foods.map((f) => [f.id, f]))
  ])
);

/** Values of one food in one table, keyed by column key; undefined when the table has no row for it. */
export function getProfileValues(
  table: ProfileTable,
  foodId: number
): { values: Record<string, NutrientValue>; note?: string } | undefined {
  const row = byTableAndId.get(table)?.get(foodId);
  if (!row) return undefined;
  const values: Record<string, NutrientValue> = {};
  tables[table].columns.forEach((def, i) => {
    values[def.key] = row.v[i] ?? null;
  });
  return row.note ? { values, note: row.note } : { values };
}

/** Ids of the foods a table covers, in ascending order. */
export function profileFoodIds(table: ProfileTable): number[] {
  return tables[table].foods.map((f) => f.id);
}
