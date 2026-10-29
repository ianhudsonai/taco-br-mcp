import { describe, expect, it } from 'vitest';
import { FOODS } from '../src/data/foods.js';
import { searchFoods, stem, tokenize } from '../src/search.js';

const ids = (query: string) => searchFoods(query).map((h) => h.food.id);

describe('tokenize / stem', () => {
  it('removes accents, case and punctuation', () => {
    expect(tokenize('Pão, de Queijo (assado)')).toEqual(['pao', 'de', 'queijo', 'assado']);
  });

  it('merges plural and gender endings', () => {
    expect(stem('moida')).toBe(stem('moido'));
    expect(stem('ovos')).toBe(stem('ovo'));
    expect(stem('paes')).toBe(stem('pao'));
  });
});

describe('searchFoods', () => {
  it('is accent- and case-insensitive', () => {
    expect(ids('PAO DE QUEIJO')).toEqual(ids('pão de queijo'));
    expect(ids('feijao')).toEqual(ids('FEIJÃO'));
  });

  it('returns nothing for an empty or unknown query', () => {
    expect(searchFoods('')).toEqual([]);
    expect(searchFoods('   ')).toEqual([]);
    expect(searchFoods('marmita')).toEqual([]);
    expect(searchFoods('brigadeiro')).toEqual([]);
  });

  it('is deterministic', () => {
    expect(ids('arroz')).toEqual(ids('arroz'));
  });

  // Each case: a query a person would type -> a TACO id that must be among the results.
  // The ids were checked against the official PDF table (Número do Alimento).
  it.each([
    ['arroz tipo 1 cozido', 3],
    ['feijão carioca cozido', 561],
    ['feijao preto cozido', 567],
    ['pão francês', 53],
    ['pão de queijo assado', 140],
    ['ovo cozido', 488],
    ['banana prata', 182],
    ['frango peito grelhado', 410],
    ['mandioca cozida', 129],
    ['leite de vaca integral', 458],
    ['tapioca', 551],
    ['lentilha cozida', 577]
  ])('finds "%s" -> %i', (query, id) => {
    expect(ids(query)).toContain(id);
  });

  it('ranks the exact food first when the query is specific', () => {
    expect(ids('feijão carioca cozido')[0]).toBe(561);
    expect(ids('pão francês')[0]).toBe(53);
  });

  it('prefers foods whose base name starts the query over foods that merely contain it', () => {
    const top = searchFoods('leite integral')[0]!.food;
    expect(top.name).toBe('Leite, de vaca, integral');
  });

  it('handles plurals and gender', () => {
    expect(ids('ovos cozidos')).toContain(488);
    expect(ids('carne moída')).toContain(326);
  });

  describe('synonyms', () => {
    it.each([
      ['macaxeira', 129],
      ['aipim', 129],
      ['pão de sal', 53],
      ['jerimum', 64],
      ['bergamota', 251],
      ['mussarela', 463]
    ])('"%s" reaches food %i and says so', (query, id) => {
      const hit = searchFoods(query).find((h) => h.food.id === id);
      expect(hit?.via).toBeDefined();
    });

    it('literal matches come before synonym matches', () => {
      const hits = searchFoods('aipim');
      expect(hits[0]!.food.id).toBe(15); // "Bolo, pronto, aipim" is the only literal hit
      expect(hits[0]!.via).toBeUndefined();
    });

    it('every synonym target exists in the table', () => {
      const names = FOODS.map((f) => tokenize(f.name).join(' '));
      for (const target of ['mandioca', 'abobora', 'tangerina', 'mozarela', 'pao frances']) {
        const first = target.split(' ')[0]!;
        expect(names.some((n) => n.includes(first))).toBe(true);
      }
    });
  });
});
