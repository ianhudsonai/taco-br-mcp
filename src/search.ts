import { FOODS, type Food } from './data/foods.js';

/** Lowercase, no diacritics, only [a-z0-9] tokens. */
export function tokenize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Light Portuguese stemmer: plural and gender endings, so "moída" ~ "moído", "ovos" ~ "ovo". */
export function stem(token: string): string {
  let t = token.replace(/(oes|aes)$/, 'ao');
  if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
  if (t.length > 3 && /[aoe]$/.test(t)) t = t.slice(0, -1);
  return t;
}

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/**
 * Hand-written synonyms, each checked against the table by test/search.test.ts.
 * A matching query phrase (normalized tokens) is also searched as each alternative.
 */
const SYNONYMS: [from: string, to: string[]][] = [
  ['aipim', ['mandioca']],
  ['macaxeira', ['mandioca']],
  ['jerimum', ['abobora']],
  ['bergamota', ['tangerina', 'mexerica']],
  ['mexerica', ['tangerina']],
  ['pao de sal', ['pao frances']],
  ['cacetinho', ['pao frances']],
  ['paezinho', ['pao frances']],
  ['paes', ['pao']],
  ['mussarela', ['mozarela']],
  ['mucarela', ['mozarela']],
  ['mozzarella', ['mozarela']]
];

interface FoodIndex {
  food: Food;
  stems: string[];
}

const INDEX: FoodIndex[] = FOODS.map((food) => ({ food, stems: tokenize(food.name).map(stem) }));

export interface SearchHit {
  food: Food;
  score: number;
  /** The synonym phrase that produced this hit, when it was not found by the literal query. */
  via?: string;
}

function queryStems(text: string): string[] {
  return tokenize(text)
    .filter((t) => !STOPWORDS.has(t))
    .map(stem);
}

function matches(queryStem: string, nameStem: string): boolean {
  return nameStem === queryStem || (queryStem.length >= 3 && nameStem.startsWith(queryStem));
}

function scoreOne(q: string[], entry: FoodIndex): number | null {
  const positions: number[] = [];
  for (const qs of q) {
    const i = entry.stems.findIndex((ns) => matches(qs, ns));
    if (i < 0) return null;
    positions.push(i);
  }
  let score = 100;
  if (positions[0] === 0) score += 50; // the query starts with the food's base name
  if (positions.every((p, i) => i === 0 || p > positions[i - 1]!)) score += 20; // same order
  score += q.filter((qs) => entry.stems.includes(qs)).length * 5; // exact stems beat prefixes
  return score;
}

function rank(q: string[]): { food: Food; score: number }[] {
  if (q.length === 0) return [];
  const hits: { food: Food; score: number }[] = [];
  for (const entry of INDEX) {
    const score = scoreOne(q, entry);
    if (score !== null) hits.push({ food: entry.food, score });
  }
  return hits;
}

/** All foods matching `query`, best first. Ties keep the table's own order (by id), so results are deterministic. */
export function searchFoods(query: string): SearchHit[] {
  const literal = rank(queryStems(query)).map((h): SearchHit => h);
  const seen = new Set(literal.map((h) => h.food.id));
  const phrase = tokenize(query).join(' ');
  const extra: SearchHit[] = [];
  for (const [from, alternatives] of SYNONYMS) {
    const fromTokens = from.split(' ');
    const qTokens = phrase.split(' ');
    const at = qTokens.findIndex((_, i) => fromTokens.every((t, j) => qTokens[i + j] === t));
    if (at < 0) continue;
    for (const alt of alternatives) {
      const replaced = [...qTokens.slice(0, at), alt, ...qTokens.slice(at + fromTokens.length)];
      for (const hit of rank(queryStems(replaced.join(' ')))) {
        if (seen.has(hit.food.id)) continue;
        seen.add(hit.food.id);
        extra.push({ ...hit, score: hit.score - 1000, via: from });
      }
    }
  }
  return [...literal, ...extra].sort((a, b) => b.score - a.score || a.food.id - b.food.id);
}
