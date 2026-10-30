# Changelog

## 0.2.0

- New tools `get_fatty_acids` (TACO Tabela 2: saturated, mono/polyunsaturated, omega-3/6, EPA, DHA, trans and individual acids; 423 of 597 foods) and `get_amino_acids` (Tabela 3; 26 foods). A food outside a table returns `available: false`, never zeros. The amino acid row the TACO prints as "468 Maria mole" is assigned to Maria mole (504), with a note.
- Household measures grow from 69 to 204 foods. Raw or dry staples whose POF weights are of the cooked food (rice, pasta, beans, chickpeas, lentils) are deliberately not mapped.
- `search_food` tolerates typos and knows more regional names.

## 0.1.1

- Repository metadata for npm provenance.
- Streamable HTTP mode (`--http`) and Cloudflare Worker for ChatGPT.

## 0.1.0

- First release: `search_food`, `get_nutrients`, `calc_meal`, `compare_foods`, `convert_household_measure`, `ping` over stdio.
