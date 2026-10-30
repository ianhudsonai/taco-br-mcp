import householdFile from '../../data/household.json' with { type: 'json' };

export interface HouseholdMeasure {
  key: string;
  /** Portuguese label, e.g. "colher de sopa". */
  measure: string;
  grams: number;
  /** Description of the POF source row, e.g. "Arroz cozido - colher de sopa cheia". */
  source_description: string;
}

export interface HouseholdEntry {
  taco_id: number;
  pof: { code: string; preparation_code: string; name: string; preparation: string };
  note?: string;
  measures: HouseholdMeasure[];
}

const data = householdFile as unknown as { foods: HouseholdEntry[] };

export const HOUSEHOLD: readonly HouseholdEntry[] = data.foods;

const byFood = new Map(HOUSEHOLD.map((h) => [h.taco_id, h]));

export function getHousehold(foodId: number): HouseholdEntry | undefined {
  return byFood.get(foodId);
}
