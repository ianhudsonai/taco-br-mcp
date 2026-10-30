# Notice

## Nutritional data

TACO — Tabela Brasileira de Composição de Alimentos, 4ª ed. ampliada e revisada. NEPA/UNICAMP, 2011. Values per 100 g of edible portion.
The publication states: "É permitida a reprodução total ou parcial do material, desde que seja citada a fonte."

## Household measures

POF 2008-2009, IBGE — Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil. TACO and POF share no key; the mapping in `data/curation/household-map.json` (69 foods) is hand-curated for this project, keeping only measures whose POF source description matches the food. IBGE's terms of use for redistribution have not been verified yet.

## Processed CSVs

Both tables were taken in their processed form from https://github.com/brolesi/taco (code under MIT; the data belongs to the original sources), pinned at commit `b800c910dfc9d2e8e6bab45dd42e5b8f5167b466`. The copies in `data/raw/brolesi/` are verified by sha256 (see `UPSTREAM.json`). `data/foods.json` and `data/household.json` are generated from them by `scripts/build-data.ts`: `Tr` becomes `{"trace":true}`, empty cells become `null`, values are rounded to the precision printed in the TACO publication, and 4 slightly negative carbohydrate means are shown as 0 with a note.

This is not medical or nutritional advice.
