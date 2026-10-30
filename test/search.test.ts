import { describe, expect, it } from 'vitest';
import { searchFoods, stem, tokenize } from '../src/search.js';
import { SYNONYMS } from '../src/synonyms.js';

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

    it('every alias finds at least one food', () => {
      for (const [from, targets] of SYNONYMS) {
        for (const target of targets) {
          expect(searchFoods(target).length, `${from} -> ${target}`).toBeGreaterThan(0);
        }
      }
    });

    it('aliases are written in normalized form', () => {
      for (const [from, targets] of SYNONYMS) {
        for (const phrase of [from, ...targets]) {
          expect(tokenize(phrase).join(' '), phrase).toBe(phrase);
        }
      }
    });

    it.each([
      ['mandioquinha', 86],
      ['batata salsa', 86],
      ['abóbora japonesa', 64],
      ['filé mignon', 357],
      ['contrafilé grelhado', 346],
      ['arroz branco cozido', 3],
      ['feijão de corda cozido', 563],
      ['leite em pó', 459],
      ['strogonoff de frango', 538],
      ['carne de porco', 427],
      ['aipim frito', 132],
      ['peito de frango no forno', 406],
      ['frango na chapa', 410],
      ['fruta do conde', 246]
    ])('"%s" -> %i', (query, id) => {
      expect(ids(query)).toContain(id);
    });

    it('chains aliases', () => {
      expect(ids('bolacha água e sal')).toEqual([13]);
    });

    it('ignores plural and gender in aliases', () => {
      expect(ids('mandioquinhas')).toEqual(ids('mandioquinha'));
    });
  });

  describe('typos', () => {
    it.each([
      ['feijao pretto cozido', 567],
      ['beringela', 96],
      ['xuxu', 113],
      ['hamburger', 417],
      ['yogurte natural', 448],
      ['frango gelhado', 410],
      ['quejo prato', 467],
      ['banana pratta', 182],
      ['mussarella', 463],
      ['abacachi', 164],
      ['macaxera', 129],
      ['assucar cristal', 492],
      ['taiti', 220],
      ['tomte', 157]
    ])('"%s" is corrected and finds %i', (query, id) => {
      const hit = searchFoods(query).find((h) => h.food.id === id);
      expect(hit?.corrected).toBeDefined();
    });

    it('says what it corrected to', () => {
      expect(searchFoods('feijao pretto cozido')[0]).toMatchObject({
        food: { id: 567 },
        corrected: 'feijao preto cozido'
      });
    });

    it('only corrects when the query as typed finds nothing', () => {
      expect(searchFoods('feijao preto cozido').every((h) => h.corrected === undefined)).toBe(true);
      expect(searchFoods('aipim').every((h) => h.corrected === undefined)).toBe(true);
    });

    it('returns every food of the corrected word, not just one', () => {
      const hits = searchFoods('mandiocaa');
      expect(hits.length).toBeGreaterThan(1);
      expect(hits.every((h) => tokenize(h.food.name).includes('mandioca'))).toBe(true);
    });

    it('does not turn a real but absent word into a different food', () => {
      for (const query of [
        'peixe',
        'pizza',
        'sorvete',
        'brigadeiro',
        'marmita',
        'hamburguer de frango'
      ]) {
        expect(searchFoods(query), query).toEqual([]);
      }
    });

    it('leaves very short words alone', () => {
      expect(searchFoods('ovvo')).toEqual([]);
      expect(searchFoods('uvo')).toEqual([]);
    });

    it('is deterministic', () => {
      expect(ids('feijao pretto')).toEqual(ids('feijao pretto'));
    });
  });
});
