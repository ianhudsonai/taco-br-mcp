import * as z from 'zod/v4';
import type { NutrientDef, NutrientValue } from './data/foods.js';

export const nutrientValueSchema = z
  .union([z.number(), z.object({ trace: z.literal(true) }), z.null()])
  .describe(
    'A number in the nutrient unit; {"trace":true} when the table reports a trace (Tr, below the quantification limit); null when the nutrient was not analyzed (NA). Never read null or trace as 0.'
  );

export function isTrace(v: NutrientValue): v is { trace: true } {
  return typeof v === 'object' && v !== null;
}

export function formatValue(v: NutrientValue, unit: string): string {
  if (v === null) return 'sem dado (NA)';
  if (isTrace(v)) return 'traço (Tr)';
  return `${v} ${unit}`;
}

/** Decimals shown for computed amounts: one more than the table prints, none for energy. */
export function amountDecimals(def: NutrientDef): number {
  return def.unit === 'kcal' || def.unit === 'kJ' ? 0 : Math.min(def.decimals + 1, 3);
}

export function roundAmount(n: number, def: NutrientDef): number {
  return Number(n.toFixed(amountDecimals(def)));
}

/** Scales a per-100 g table value to `grams`. Traces and missing values stay as they are. */
export function scaleValue(v: NutrientValue, grams: number, def: NutrientDef): NutrientValue {
  if (v === null || isTrace(v)) return v;
  if (grams === 100) return v;
  return roundAmount((v * grams) / 100, def);
}
