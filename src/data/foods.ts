import foodsFile from '../../data/foods.json' with { type: 'json' };

export type NutrientValue = number | { trace: true } | null;

export interface NutrientDef {
  key: string;
  unit: string;
  label_pt: string;
  label_en: string;
  decimals: number;
}

export interface Food {
  id: number;
  name: string;
  category: string;
  base: string;
  preparation: string | null;
  qualifiers: string | null;
  nutrients: Record<string, NutrientValue>;
  notes?: string[];
}

const data = foodsFile as unknown as { nutrients: NutrientDef[]; foods: Food[] };

export const NUTRIENT_DEFS: readonly NutrientDef[] = data.nutrients;
export const NUTRIENT_KEYS = NUTRIENT_DEFS.map((n) => n.key) as [string, ...string[]];
export const FOODS: readonly Food[] = data.foods;

const byId = new Map(FOODS.map((f) => [f.id, f]));

export function getFood(id: number): Food | undefined {
  return byId.get(id);
}
