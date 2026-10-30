# Notice

## Nutritional data

TACO — Tabela Brasileira de Composição de Alimentos, 4ª ed. ampliada e revisada. NEPA/UNICAMP, 2011. Values per 100 g of edible portion.
The publication states: "É permitida a reprodução total ou parcial do material, desde que seja citada a fonte."

## Household measures

Fonte: IBGE, Pesquisa de Orçamentos Familiares (POF) 2008-2009 — _Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil_ (Rio de Janeiro, 2011). This is the aggregate reference table that IBGE publishes for download (file `tabelamedidas_bd`), with the weight in grams of each household measure; it is not restricted microdata from the IBGE microdata portal. A few rows cite the _Guia Alimentar para a População Brasileira_ as their original source; their `source_description` says so.

IBGE allows reuse of its tables in new publications provided the source is credited, and asks that whoever transforms the data identifies itself as responsible for the new operation. The transformation here is the **hand-curated mapping between TACO foods and POF foods** in `data/curation/household-map.json` (69 foods), made by the taco-br-mcp project: TACO and POF share no key, and only measures whose POF source description matches the food were kept. The grams themselves are IBGE's values, unchanged. Errors in the mapping are this project's, not IBGE's. Responses that use a household measure cite both the IBGE table and this mapping.

## Processed CSVs

The processed CSVs of the TACO tables (composition, fatty acids, amino acids) and of the POF household measures were taken in their processed form from https://github.com/brolesi/taco (code under MIT; the data belongs to the original sources), pinned at commit `b800c910dfc9d2e8e6bab45dd42e5b8f5167b466`. The copies in `data/raw/brolesi/` are verified by sha256 (see `UPSTREAM.json`). `data/foods.json`, `data/profiles.json` (fatty acids, Tabela 2, and amino acids, Tabela 3 of the TACO) and `data/household.json` are generated from them by `scripts/build-data.ts`: `Tr` becomes `{"trace":true}`, empty cells become `null`, values are rounded to the precision printed in the TACO publication, and 4 slightly negative carbohydrate means are shown as 0 with a note.

The fatty acid and amino acid CSVs were compared cell by cell against the official PDF and the official NEPA spreadsheet (9,306 + 468 cells, no difference at the printed precision). The TACO itself prints one amino acid row under the wrong number ("468 Maria mole"; 468 is requeijão cremoso, Maria mole is 504); the values are Maria mole's, so `scripts/build-profiles.ts` assigns them to 504 and the response carries a note saying so.

This is not medical or nutritional advice.
