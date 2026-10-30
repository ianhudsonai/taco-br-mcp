/** Column tables for the TACO fatty acid (Tabela 2) and amino acid (Tabela 3) profiles. */

export interface ProfileColumn {
  /** Column name in the upstream CSV. */
  column: string;
  /** Key used in data/profiles.json and in tool outputs. */
  key: string;
  unit: 'g';
  label_pt: string;
  label_en: string;
  /** Decimals printed in the TACO publication. */
  decimals: number;
}

const col = (
  column: string,
  key: string,
  label_pt: string,
  label_en: string,
  decimals = 2
): ProfileColumn => ({ column, key, unit: 'g', label_pt, label_en, decimals });

export const FATTY_ACIDS: ProfileColumn[] = [
  col('saturados_g', 'saturated_g', 'Ácidos graxos saturados', 'Saturated fatty acids', 1),
  col(
    'monoinsaturados_g',
    'monounsaturated_g',
    'Ácidos graxos monoinsaturados',
    'Monounsaturated fatty acids',
    1
  ),
  col(
    'poliinsaturados_g',
    'polyunsaturated_g',
    'Ácidos graxos poli-insaturados',
    'Polyunsaturated fatty acids',
    1
  ),
  col('c12_0_g', 'c12_0_g', 'Láurico (12:0)', 'Lauric (12:0)'),
  col('c14_0_g', 'c14_0_g', 'Mirístico (14:0)', 'Myristic (14:0)'),
  col('c16_0_g', 'c16_0_g', 'Palmítico (16:0)', 'Palmitic (16:0)'),
  col('c18_0_g', 'c18_0_g', 'Esteárico (18:0)', 'Stearic (18:0)'),
  col('c20_0_g', 'c20_0_g', 'Araquídico (20:0)', 'Arachidic (20:0)'),
  col('c22_0_g', 'c22_0_g', 'Behênico (22:0)', 'Behenic (22:0)'),
  col('c24_0_g', 'c24_0_g', 'Lignocérico (24:0)', 'Lignoceric (24:0)'),
  col('c14_1_g', 'c14_1_g', 'Miristoleico (14:1)', 'Myristoleic (14:1)'),
  col('c16_1_g', 'c16_1_g', 'Palmitoleico (16:1)', 'Palmitoleic (16:1)'),
  col('c18_1_g', 'c18_1_g', 'Oleico (18:1)', 'Oleic (18:1)'),
  col('c20_1_g', 'c20_1_g', 'Gadoleico (20:1)', 'Gadoleic (20:1)'),
  col('c18_2n6_g', 'c18_2_n6_g', 'Linoleico (18:2 n-6)', 'Linoleic (18:2 n-6)'),
  col('c18_3n3_g', 'c18_3_n3_g', 'Alfa-linolênico (18:3 n-3)', 'Alpha-linolenic (18:3 n-3)'),
  col('c20_4_g', 'c20_4_g', 'Araquidônico (20:4)', 'Arachidonic (20:4)'),
  col('c20_5_g', 'epa_c20_5_g', 'EPA (20:5)', 'EPA (20:5)'),
  col('c22_5_g', 'dpa_c22_5_g', 'DPA (22:5)', 'DPA (22:5)'),
  col('c22_6_g', 'dha_c22_6_g', 'DHA (22:6)', 'DHA (22:6)'),
  col('c18_1t_g', 'trans_c18_1_g', 'Trans-oleico (18:1t)', 'Trans-oleic (18:1t)'),
  col('c18_2t_g', 'trans_c18_2_g', 'Trans-linoleico (18:2t)', 'Trans-linoleic (18:2t)')
];

export const AMINO_ACIDS: ProfileColumn[] = [
  col('triptofano_g', 'tryptophan_g', 'Triptofano', 'Tryptophan'),
  col('treonina_g', 'threonine_g', 'Treonina', 'Threonine'),
  col('isoleucina_g', 'isoleucine_g', 'Isoleucina', 'Isoleucine'),
  col('leucina_g', 'leucine_g', 'Leucina', 'Leucine'),
  col('lisina_g', 'lysine_g', 'Lisina', 'Lysine'),
  col('metionina_g', 'methionine_g', 'Metionina', 'Methionine'),
  col('cistina_g', 'cystine_g', 'Cistina', 'Cystine'),
  col('fenilalanina_g', 'phenylalanine_g', 'Fenilalanina', 'Phenylalanine'),
  col('tirosina_g', 'tyrosine_g', 'Tirosina', 'Tyrosine'),
  col('valina_g', 'valine_g', 'Valina', 'Valine'),
  col('arginina_g', 'arginine_g', 'Arginina', 'Arginine'),
  col('histidina_g', 'histidine_g', 'Histidina', 'Histidine'),
  col('alanina_g', 'alanine_g', 'Alanina', 'Alanine'),
  col('acido_aspartico_g', 'aspartic_acid_g', 'Ácido aspártico', 'Aspartic acid'),
  col('acido_glutamico_g', 'glutamic_acid_g', 'Ácido glutâmico', 'Glutamic acid'),
  col('glicina_g', 'glycine_g', 'Glicina', 'Glycine'),
  col('prolina_g', 'proline_g', 'Prolina', 'Proline'),
  col('serina_g', 'serine_g', 'Serina', 'Serine')
];
