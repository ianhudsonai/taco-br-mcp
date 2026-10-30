// Scores eval/results/*.json against eval/questions.json and prints a Markdown table.
// Usage: node eval/score.mjs [--detail]
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const { questions } = JSON.parse(readFileSync(join(root, 'eval', 'questions.json'), 'utf8'));
const dir = join(root, 'eval', 'results');
const TOL = 0.05;

const finalLine = (text) => {
  const m = [...text.matchAll(/RESPOSTA_FINAL:\s*(.+)/g)].pop();
  return m ? m[1].trim() : null;
};
// "1.234,5" / "12,5" / "12.5" -> numbers, in order
const numbers = (s) =>
  [...s.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2').matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) =>
    Number(m[0].replace(',', '.'))
  );
const close = (got, want) => Math.abs(got - want) <= Math.max(TOL * Math.abs(want), 1e-9);

function score(q, text) {
  const body = text.toLowerCase();
  const line = finalLine(text);
  if (line === null) return { ok: false, why: 'sem linha RESPOSTA_FINAL' };
  const lower = line.toLowerCase();
  const nums = numbers(line);
  if (q.expectNoData) {
    const ok = /sem dado|n[aã]o public|n[aã]o (traz|consta|h[aá])/.test(lower) && nums.length === 0;
    return { ok, why: ok ? '' : `deu número ou não admitiu falta de dado: ${line}`, line };
  }
  const hits = q.expect.every((want) => nums.some((n) => close(n, want)));
  if (!hits)
    return {
      ok: false,
      abstained: /sem dado/.test(lower) && nums.length === 0,
      why: `esperado ${q.expect.join(' e ')}, veio: ${line}`,
      line
    };
  if (q.mustMention && !lower.includes(q.mustMention))
    return { ok: false, why: `não apontou ${q.mustMention}: ${line}`, line };
  if (
    q.mustFlagGap &&
    !/(pelo menos|m[ií]nim|ao menos|limite inferior|piso|n[aã]o (h[aá]|traz|consta))/.test(body)
  )
    return { ok: false, why: `número sem avisar que é mínimo: ${line}`, line };
  return { ok: true, why: '', line };
}

const rows = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
const qById = new Map(questions.map((q) => [q.id, q]));

const stats = {}; // arm -> category -> {ok,n,src}
const failures = [];
for (const r of rows) {
  const q = qById.get(r.question);
  const text = r.result?.result ?? '';
  const s =
    r.result && !r.result.is_error
      ? score(q, text)
      : { ok: false, why: `execução falhou (exit ${r.code})` };
  const cites = /TACO/.test(text) && /(NEPA|UNICAMP)/.test(text);
  for (const key of [q.category, 'TOTAL']) {
    const c = ((stats[r.arm] ??= {})[key] ??= { ok: 0, n: 0, src: 0, cost: 0, abst: 0 });
    c.abst += s.abstained ? 1 : 0;
    c.n++;
    c.ok += s.ok ? 1 : 0;
    c.src += cites ? 1 : 0;
    c.cost += r.result?.total_cost_usd ?? 0;
  }
  if (!s.ok) failures.push({ arm: r.arm, q: q.id, rep: r.rep, why: s.why });
}

const cats = [...new Set(questions.map((q) => q.category)), 'TOTAL'];
const cell = (arm, cat) => {
  const c = stats[arm]?.[cat];
  return c ? `${c.ok}/${c.n}` : '-';
};
console.log('| Categoria | Sem MCP | Com MCP |\n| --- | --- | --- |');
for (const cat of cats) console.log(`| ${cat} | ${cell('nomcp', cat)} | ${cell('mcp', cat)} |`);
for (const arm of ['nomcp', 'mcp']) {
  const t = stats[arm]?.TOTAL;
  if (t)
    console.log(
      `\n${arm}: cita a fonte em ${t.src}/${t.n}; disse "sem dado" onde a TACO tem o valor: ${t.abst}; custo US$ ${t.cost.toFixed(2)}`
    );
}
if (process.argv.includes('--detail')) {
  console.log('\nErros:');
  for (const f of failures.sort((a, b) => a.arm.localeCompare(b.arm) || a.q - b.q))
    console.log(`- ${f.arm} Q${f.q} r${f.rep}: ${f.why}`);
}
