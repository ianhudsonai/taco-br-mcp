export interface NutrientDef {
  /** Column name in the upstream CSV. */
  column: string;
  /** Key used in data/foods.json and in tool outputs. */
  key: string;
  unit: string;
  label_pt: string;
  label_en: string;
  /** Decimal places kept in the output. */
  decimals: number;
}

export const NUTRIENTS: NutrientDef[] = [
  {
    column: 'umidade_pct',
    key: 'moisture_pct',
    unit: '%',
    label_pt: 'Umidade',
    label_en: 'Moisture',
    decimals: 1
  },
  {
    column: 'energia_kcal',
    key: 'energy_kcal',
    unit: 'kcal',
    label_pt: 'Energia',
    label_en: 'Energy',
    decimals: 0
  },
  {
    column: 'energia_kj',
    key: 'energy_kj',
    unit: 'kJ',
    label_pt: 'Energia',
    label_en: 'Energy',
    decimals: 0
  },
  {
    column: 'proteina_g',
    key: 'protein_g',
    unit: 'g',
    label_pt: 'Proteína',
    label_en: 'Protein',
    decimals: 1
  },
  {
    column: 'lipideos_g',
    key: 'lipids_g',
    unit: 'g',
    label_pt: 'Lipídeos',
    label_en: 'Total fat',
    decimals: 1
  },
  {
    column: 'colesterol_mg',
    key: 'cholesterol_mg',
    unit: 'mg',
    label_pt: 'Colesterol',
    label_en: 'Cholesterol',
    decimals: 0
  },
  {
    column: 'carboidrato_g',
    key: 'carbohydrate_g',
    unit: 'g',
    label_pt: 'Carboidrato',
    label_en: 'Carbohydrate',
    decimals: 1
  },
  {
    column: 'fibra_g',
    key: 'dietary_fiber_g',
    unit: 'g',
    label_pt: 'Fibra alimentar',
    label_en: 'Dietary fiber',
    decimals: 1
  },
  { column: 'cinzas_g', key: 'ash_g', unit: 'g', label_pt: 'Cinzas', label_en: 'Ash', decimals: 1 },
  {
    column: 'calcio_mg',
    key: 'calcium_mg',
    unit: 'mg',
    label_pt: 'Cálcio',
    label_en: 'Calcium',
    decimals: 0
  },
  {
    column: 'magnesio_mg',
    key: 'magnesium_mg',
    unit: 'mg',
    label_pt: 'Magnésio',
    label_en: 'Magnesium',
    decimals: 0
  },
  {
    column: 'manganes_mg',
    key: 'manganese_mg',
    unit: 'mg',
    label_pt: 'Manganês',
    label_en: 'Manganese',
    decimals: 2
  },
  {
    column: 'fosforo_mg',
    key: 'phosphorus_mg',
    unit: 'mg',
    label_pt: 'Fósforo',
    label_en: 'Phosphorus',
    decimals: 0
  },
  {
    column: 'ferro_mg',
    key: 'iron_mg',
    unit: 'mg',
    label_pt: 'Ferro',
    label_en: 'Iron',
    decimals: 1
  },
  {
    column: 'sodio_mg',
    key: 'sodium_mg',
    unit: 'mg',
    label_pt: 'Sódio',
    label_en: 'Sodium',
    decimals: 0
  },
  {
    column: 'potassio_mg',
    key: 'potassium_mg',
    unit: 'mg',
    label_pt: 'Potássio',
    label_en: 'Potassium',
    decimals: 0
  },
  {
    column: 'cobre_mg',
    key: 'copper_mg',
    unit: 'mg',
    label_pt: 'Cobre',
    label_en: 'Copper',
    decimals: 2
  },
  {
    column: 'zinco_mg',
    key: 'zinc_mg',
    unit: 'mg',
    label_pt: 'Zinco',
    label_en: 'Zinc',
    decimals: 1
  },
  {
    column: 'retinol_mcg',
    key: 'retinol_mcg',
    unit: 'µg',
    label_pt: 'Retinol',
    label_en: 'Retinol',
    decimals: 0
  },
  {
    column: 'RE_mcg',
    key: 're_mcg',
    unit: 'µg',
    label_pt: 'Equivalente de retinol (RE)',
    label_en: 'Retinol equivalents (RE)',
    decimals: 0
  },
  {
    column: 'RAE_mcg',
    key: 'rae_mcg',
    unit: 'µg',
    label_pt: 'Equivalente de atividade de retinol (RAE)',
    label_en: 'Retinol activity equivalents (RAE)',
    decimals: 0
  },
  {
    column: 'tiamina_mg',
    key: 'thiamine_mg',
    unit: 'mg',
    label_pt: 'Tiamina (B1)',
    label_en: 'Thiamine (B1)',
    decimals: 2
  },
  {
    column: 'riboflavina_mg',
    key: 'riboflavin_mg',
    unit: 'mg',
    label_pt: 'Riboflavina (B2)',
    label_en: 'Riboflavin (B2)',
    decimals: 2
  },
  {
    column: 'piridoxina_mg',
    key: 'pyridoxine_mg',
    unit: 'mg',
    label_pt: 'Piridoxina (B6)',
    label_en: 'Pyridoxine (B6)',
    decimals: 2
  },
  {
    column: 'niacina_mg',
    key: 'niacin_mg',
    unit: 'mg',
    label_pt: 'Niacina (B3)',
    label_en: 'Niacin (B3)',
    decimals: 2
  },
  {
    column: 'vitamina_c_mg',
    key: 'vitamin_c_mg',
    unit: 'mg',
    label_pt: 'Vitamina C',
    label_en: 'Vitamin C',
    decimals: 1
  }
];
