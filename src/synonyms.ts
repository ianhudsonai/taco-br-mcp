/**
 * Hand-written aliases: Brazilian regional names, spelling variants and cooking terms that the
 * TACO table words differently. Each entry maps a phrase a person may type to the TACO wording.
 *
 * Only true aliases belong here (aipim = mandioca), never "close enough" foods or brands.
 * Every alternative must find at least one food; test/search.test.ts enforces it.
 * Plural/gender and diacritics are ignored when matching, so list the singular masculine form.
 * When an alias fits several foods, list all of them: the tool then returns candidates.
 */
export const SYNONYMS: readonly (readonly [from: string, to: readonly string[]])[] = [
  // Regional names
  ['aipim', ['mandioca']],
  ['macaxeira', ['mandioca']],
  ['castelinha', ['mandioca']],
  ['mandioquinha', ['batata baroa']],
  ['batata salsa', ['batata baroa']],
  ['jerimum', ['abobora']],
  ['abobora japonesa', ['abobora cabotian']],
  ['cabotia', ['cabotian']],
  ['bergamota', ['tangerina', 'mexerica']],
  ['mexerica', ['tangerina']],
  ['ponkan', ['tangerina ponca']],
  ['fruta do conde', ['pinha']],
  ['ata', ['pinha']],
  ['papaya', ['mamao papaia']],
  ['mamao papaya', ['mamao papaia']],
  ['mungunza', ['canjica']],
  ['beiju', ['tapioca']],
  ['cachaca', ['cana aguardente']],
  ['pinga', ['cana aguardente']],
  ['garapa', ['cana caldo']],
  ['galinha', ['frango']],
  ['carne de boi', ['carne bovina']],
  ['carne de vaca', ['carne bovina']],
  ['bife', ['carne bovina']],
  ['carne de porco', ['porco']],
  ['suino', ['porco']],
  ['jaba', ['carne seca', 'charque']],
  ['alho frances', ['alho poro']],
  ['salsinha', ['salsa']],
  ['arugula', ['rucula']],
  ['cheiro verde', ['salsa', 'cebolinha']],
  ['quiui', ['kiwi']],
  ['kibe', ['quibe']],
  ['mignon', ['mingnon']], // the table spells it "mingnon"
  ['strogonoff', ['estrogonofe']],
  ['stroganoff', ['estrogonofe']],
  ['contrafile', ['contra file']],
  ['couveflor', ['couve flor']],
  ['espiga de milho', ['milho verde']],
  ['feijao de corda', ['feijao fradinho']],
  ['caupi', ['feijao fradinho']],
  ['macassar', ['feijao fradinho']],
  ['carioquinha', ['carioca']],
  ['refri', ['refrigerante']],
  ['miojo', ['macarrao instantaneo']],
  ['espaguete', ['macarrao trigo']],
  ['spaghetti', ['macarrao trigo']],
  ['talharim', ['macarrao trigo']],
  ['penne', ['macarrao trigo']],
  ['goiabada', ['goiaba doce em pasta']],
  ['bananada', ['banana doce em barra']],
  ['molho de soja', ['shoyu']],
  ['leite de soja', ['soja extrato soluvel']],
  ['massa de tomate', ['tomate extrato']],
  ['castanha do para', ['castanha do brasil']],
  ['amido de mandioca', ['fecula de mandioca']],
  ['farofa', ['mandioca farofa']],
  ['longa vida', ['uht']],

  // Bread and biscuits
  ['pao de sal', ['pao frances']],
  ['pao careca', ['pao frances']],
  ['cacetinho', ['pao frances']],
  ['paezinho', ['pao frances']],
  ['paozinho', ['pao frances']],
  ['bolacha', ['biscoito']],
  ['agua e sal', ['cream cracker']],

  // Cheese
  ['mussarela', ['mozarela']],
  ['mucarela', ['mozarela']],
  ['mozzarella', ['mozarela']],

  // Table words
  ['arroz branco', ['arroz tipo 1', 'arroz tipo 2']],
  ['arroz agulhinha', ['arroz tipo 1']],
  ['acucar branco', ['acucar refinado', 'acucar cristal']],
  ['ovo estrelado', ['ovo frito']],

  // Cooking terms
  ['na chapa', ['grelhado']],
  ['na brasa', ['grelhado']],
  ['no forno', ['assado']],
  ['fervido', ['cozido']],
  ['in natura', ['cru']]
];
