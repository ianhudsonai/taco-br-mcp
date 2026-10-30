# Notice

## Nutritional data

TACO — Tabela Brasileira de Composição de Alimentos, 4ª ed. ampliada e revisada. NEPA/UNICAMP, 2011. Values per 100 g of edible portion.
The publication states: "É permitida a reprodução total ou parcial do material, desde que seja citada a fonte."

## Household measures

Fonte: IBGE, Pesquisa de Orçamentos Familiares (POF) 2008-2009 — _Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil_ (Rio de Janeiro, 2011). This is the aggregate reference table that IBGE publishes for download (file `tabelamedidas_bd`), with the weight in grams of each household measure; it is not restricted microdata from the IBGE microdata portal. A few rows cite the _Guia Alimentar para a População Brasileira_ as their original source; their `source_description` says so.

IBGE allows reuse of its tables in new publications provided the source is credited, and asks that whoever transforms the data identifies itself as responsible for the new operation. The transformation here is the **hand-curated mapping between TACO foods and POF foods** in `data/curation/household-map.json` (69 foods), made by the taco-br-mcp project: TACO and POF share no key, and only measures whose POF source description matches the food were kept. The grams themselves are IBGE's values, unchanged. Errors in the mapping are this project's, not IBGE's. Responses that use a household measure cite both the IBGE table and this mapping.

## Processed CSVs

Both tables were taken in their processed form from https://github.com/brolesi/taco (code under MIT; the data belongs to the original sources), pinned at commit `b800c910dfc9d2e8e6bab45dd42e5b8f5167b466`. The copies in `data/raw/brolesi/` are verified by sha256 (see `UPSTREAM.json`). `data/foods.json` and `data/household.json` are generated from them by `scripts/build-data.ts`: `Tr` becomes `{"trace":true}`, empty cells become `null`, values are rounded to the precision printed in the TACO publication, and 4 slightly negative carbohydrate means are shown as 0 with a note.

This is not medical or nutritional advice.
