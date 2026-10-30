import { getFood } from './data/foods.js';
import { getHousehold, type HouseholdEntry, type HouseholdMeasure } from './data/household.js';
import { stem, tokenize } from './search.js';

export const HOUSEHOLD_SOURCE =
  'POF 2008-2009 (IBGE), Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil; associação com os alimentos da TACO feita por taco-br-mcp';

/** Other ways people write a measure, per measure key. Forms are compared token by token after stemming. */
const ALIASES: Record<string, string[]> = {
  colher_de_arroz: ['colher de arroz', 'colher de servir', 'colher de arroz de servir'],
  porcao: ['porção', 'porção do guia alimentar', 'porção guia alimentar'],
  metade: ['metade', 'meio', 'meia', 'meia unidade', 'banda', '1/2'],
  unidade: ['unidade', 'unidade média', 'inteiro', 'inteira'],
  unidade_pequena: ['unidade pequena', 'pequena', 'pequeno'],
  fatia: ['fatia', 'fatia média'],
  pedaco: ['pedaço', 'pedaço médio'],
  file: ['filé', 'filé médio'],
  bife: ['bife', 'bife médio'],
  xicara_de_cha: ['xícara de chá', 'xícara'],
  xicara_de_cafe: ['xícara de café', 'xicrinha']
};

const IGNORED = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'um',
  'uma',
  'cheia',
  'cheias',
  'cheio'
]);

function forms(text: string): string {
  return tokenize(text.replace(/1\/2/g, 'metade'))
    .filter((t) => !IGNORED.has(t))
    .map(stem)
    .join(' ');
}

function measureForms(m: HouseholdMeasure): Set<string> {
  const out = new Set([forms(m.measure)]);
  for (const alias of ALIASES[m.key] ?? []) out.add(forms(alias));
  return out;
}

/** Splits "2 colheres de sopa" into 2 and "colheres de sopa"; the quantity is optional. */
export function parseMeasureText(text: string): { text: string; quantity?: number } {
  const m = text.trim().match(/^(\d+(?:[.,]\d+)?|\d+\/\d+)\s+(.*)$/);
  if (!m) return { text };
  const raw = m[1]!;
  const quantity = raw.includes('/')
    ? Number(raw.split('/')[0]) / Number(raw.split('/')[1])
    : Number(raw.replace(',', '.'));
  return Number.isFinite(quantity) && quantity > 0 ? { text: m[2]!, quantity } : { text };
}

export function findMeasure(entry: HouseholdEntry, text: string): HouseholdMeasure | undefined {
  const wanted = forms(text);
  if (!wanted) return undefined;
  return entry.measures.find((m) => measureForms(m).has(wanted));
}

export function availableMeasures(
  entry: HouseholdEntry
): { key: string; label: string; grams: number }[] {
  return entry.measures.map((m) => ({ key: m.key, label: m.measure, grams: m.grams }));
}

export interface ResolvedHousehold {
  grams: number;
  measure: HouseholdMeasure;
  quantity: number;
  entry: HouseholdEntry;
}

export type ResolveResult =
  | ({ ok: true } & ResolvedHousehold)
  | {
      ok: false;
      reason: 'unknown_food' | 'no_household_data' | 'unknown_measure';
      message: string;
    };

/** food + "2 colheres de sopa" -> grams, or a precise reason why not. Never guesses. */
export function resolveHousehold(
  foodId: number,
  measureText: string,
  quantity?: number
): ResolveResult {
  const food = getFood(foodId);
  if (!food) {
    return {
      ok: false,
      reason: 'unknown_food',
      message: `Não existe alimento com id ${foodId} na TACO.`
    };
  }
  const entry = getHousehold(foodId);
  if (!entry) {
    return {
      ok: false,
      reason: 'no_household_data',
      message: `"${food.name}" [${foodId}] ainda não tem medidas caseiras curadas; informe a quantidade em gramas.`
    };
  }
  const parsed = parseMeasureText(measureText);
  const q = quantity ?? parsed.quantity ?? 1;
  if (quantity !== undefined && parsed.quantity !== undefined && quantity !== parsed.quantity) {
    return {
      ok: false,
      reason: 'unknown_measure',
      message: `A medida "${measureText}" já traz a quantidade ${parsed.quantity}, mas quantity=${quantity}. Informe a quantidade em um só lugar.`
    };
  }
  const measure = findMeasure(entry, parsed.text);
  if (!measure) {
    const list = entry.measures.map((m) => m.measure).join(', ');
    return {
      ok: false,
      reason: 'unknown_measure',
      message: `"${measureText}" não é uma medida conhecida para "${food.name}" [${foodId}]. Medidas disponíveis: ${list}.`
    };
  }
  return { ok: true, grams: Number((measure.grams * q).toFixed(3)), measure, quantity: q, entry };
}
