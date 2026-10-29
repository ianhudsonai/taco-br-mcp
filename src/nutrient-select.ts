import { NUTRIENT_DEFS, type NutrientDef } from './data/foods.js';

/** Shown when a tool is called without an explicit nutrient list. */
export const CORE_NUTRIENTS = [
  'energy_kcal',
  'protein_g',
  'lipids_g',
  'carbohydrate_g',
  'dietary_fiber_g',
  'sodium_mg'
] as const;

/** Definitions for `keys`, in table order. Falls back to the core set. */
export function selectNutrients(keys?: readonly string[]): NutrientDef[] {
  const wanted = new Set(keys ?? CORE_NUTRIENTS);
  return NUTRIENT_DEFS.filter((d) => wanted.has(d.key));
}
