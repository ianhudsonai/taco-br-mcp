import { FOODS, type Food } from './data/foods.js';
import { SYNONYMS } from './synonyms.js';

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

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o']);

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
  /** The query as corrected for probable typos, when the literal query found nothing. */
  corrected?: string;
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

interface SynonymRule {
  from: string;
  fromStems: string[];
  to: string[];
}

const RULES: SynonymRule[] = SYNONYMS.map(([from, to]) => ({
  from,
  fromStems: tokenize(from).map(stem),
  to: [...to]
}));

/** Variants of the query with one synonym applied, or two when aliases chain ("bolacha água e sal"). */
function synonymVariants(tokens: string[]): { tokens: string[]; via: string }[] {
  const out: { tokens: string[]; via: string }[] = [];
  const seen = new Set([tokens.join(' ')]);
  let frontier = [{ tokens, via: '' }];
  for (let depth = 0; depth < 2; depth++) {
    const next: typeof frontier = [];
    for (const current of frontier) {
      const stems = current.tokens.map(stem);
      for (const rule of RULES) {
        const at = stems.findIndex((_, i) => rule.fromStems.every((t, j) => stems[i + j] === t));
        if (at < 0) continue;
        for (const alt of rule.to) {
          const replaced = [
            ...current.tokens.slice(0, at),
            ...tokenize(alt),
            ...current.tokens.slice(at + rule.fromStems.length)
          ];
          const key = replaced.join(' ');
          if (seen.has(key)) continue;
          seen.add(key);
          const variant = { tokens: replaced, via: current.via || rule.from };
          out.push(variant);
          next.push(variant);
        }
      }
    }
    frontier = next;
  }
  return out;
}

/** Literal hits first, then hits found through synonyms. Ties keep the table's own order. */
function searchTokens(tokens: string[]): SearchHit[] {
  const literal: SearchHit[] = rank(queryStems(tokens.join(' ')));
  const seen = new Set(literal.map((h) => h.food.id));
  const extra: SearchHit[] = [];
  for (const variant of synonymVariants(tokens)) {
    for (const hit of rank(queryStems(variant.tokens.join(' ')))) {
      if (seen.has(hit.food.id)) continue;
      seen.add(hit.food.id);
      extra.push({ ...hit, score: hit.score - 1000, via: variant.via });
    }
  }
  return [...literal, ...extra].sort((a, b) => b.score - a.score || a.food.id - b.food.id);
}

/**
 * Spelling key: collapses sounds Brazilians commonly confuse (s/z/c/ss, ch/x, g/j, qu/k, y/i,
 * silent h, doubled letters), so "beringela" and "berinjela" or "xuxu" and "chuchu" compare equal.
 */
function spellingKey(word: string): string {
  return word
    .replace(/ch/g, 'x')
    .replace(/h/g, '')
    .replace(/qu(?=[ei])/g, 'k')
    .replace(/gu(?=[ei])/g, 'g')
    .replace(/c(?=[ei])/g, 's')
    .replace(/j/g, 'g')
    .replace(/z/g, 's')
    .replace(/k/g, 'c')
    .replace(/y/g, 'i')
    .replace(/w/g, 'u')
    .replace(/(.)\1+/g, '$1');
}

/** Edit distance counting a swap of two adjacent letters as one edit (optimal string alignment). */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = best;
    }
  }
  return d[a.length]![b.length]!;
}

function sameLetters(a: string, b: string): boolean {
  return [...a].sort().join('') === [...b].sort().join('');
}

interface VocabWord {
  /** A normalized word as it appears in a food name or synonym phrase. */
  word: string;
  stem: string;
  key: string;
}

/** Every distinct word the search can match, from food names and from synonym phrases. */
const VOCAB: VocabWord[] = (() => {
  const words = new Set<string>();
  for (const { food } of INDEX) tokenize(food.name).forEach((t) => words.add(t));
  for (const rule of RULES) tokenize(rule.from).forEach((t) => words.add(t));
  return [...words]
    .filter((w) => !STOPWORDS.has(w) && !/^\d+$/.test(w))
    .map((word) => ({ word, stem: stem(word), key: spellingKey(word) }));
})();

const MIN_TYPO_LENGTH = 4;
const MAX_CANDIDATES_PER_WORD = 3;
const MAX_CORRECTIONS = 9;

function isKnown(token: string): boolean {
  const s = stem(token);
  return VOCAB.some((v) => matches(s, v.stem));
}

/**
 * Vocabulary words within a couple of edits of `token`, nearest only (several when they tie).
 * Short words are strict: a one-letter substitution turns "peixe" into "peito", so there only
 * a missing, extra or swapped letter counts. The first letter must agree.
 */
function nearestWords(token: string): { word: string; distance: number }[] {
  const key = spellingKey(token);
  if (key.length < MIN_TYPO_LENGTH) return [];
  const limit = key.length >= 8 ? 2 : 1;
  const strict = key.length <= 5;
  const found: { word: string; distance: number }[] = [];
  for (const v of VOCAB) {
    if (v.key.length < MIN_TYPO_LENGTH || v.key[0] !== key[0]) continue;
    if (Math.abs(v.key.length - key.length) > limit) continue;
    const distance = editDistance(key, v.key);
    if (distance > limit) continue;
    if (strict && distance === 1 && v.key.length === key.length && !sameLetters(key, v.key))
      continue;
    found.push({ word: v.word, distance });
  }
  const best = Math.min(...found.map((f) => f.distance));
  return found
    .filter((f) => f.distance === best)
    .sort((a, b) => a.word.localeCompare(b.word))
    .slice(0, MAX_CANDIDATES_PER_WORD)
    .map((f) => ({ word: f.word, distance: Math.max(f.distance, 1) })); // a respelling still counts
}

/** Retry with each word that matches nothing replaced by its nearest vocabulary word(s). */
function searchWithCorrections(tokens: string[]): SearchHit[] {
  const options = tokens.map((t) =>
    STOPWORDS.has(t) || isKnown(t) ? [{ word: t, distance: 0 }] : nearestWords(t)
  );
  if (options.some((o) => o.length === 0)) return [];

  let combos: { tokens: string[]; distance: number }[] = [{ tokens: [], distance: 0 }];
  for (const choices of options) {
    combos = combos
      .flatMap((c) =>
        choices.map((o) => ({ tokens: [...c.tokens, o.word], distance: c.distance + o.distance }))
      )
      .slice(0, MAX_CORRECTIONS);
  }

  const best = new Map<number, SearchHit>();
  for (const combo of combos) {
    if (combo.distance === 0) continue;
    const corrected = combo.tokens.join(' ');
    for (const hit of searchTokens(combo.tokens)) {
      const score = hit.score - 2000 - 100 * combo.distance;
      const seen = best.get(hit.food.id);
      if (!seen || score > seen.score) best.set(hit.food.id, { ...hit, score, corrected });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.food.id - b.food.id);
}

/**
 * All foods matching `query`, best first: literal matches, then synonym matches, then (only when
 * nothing else matched) matches after correcting probable typos. Ties keep the table's own
 * order (by id), so results are deterministic.
 */
export function searchFoods(query: string): SearchHit[] {
  const tokens = tokenize(query);
  const hits = searchTokens(tokens);
  return hits.length > 0 ? hits : searchWithCorrections(tokens);
}
