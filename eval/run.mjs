// Runs the mini-evaluation: every question x {nomcp, mcp} x REPS through the nested `claude` CLI.
// Usage: node eval/run.mjs [--reps 3] [--model claude-sonnet-5-5] [--concurrency 4] [--only mcp|nomcp] [--limit N]
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const REPS = Number(opt('reps', 3));
const MODEL = opt('model', 'claude-sonnet-5-5');
const CONC = Number(opt('concurrency', 4));
const ONLY = opt('only', undefined);
const LIMIT = Number(opt('limit', 0));

const root = resolve(import.meta.dirname, '..');
const out = join(root, 'eval', 'results', MODEL); // one folder per model so runs never hit another model's cache
mkdirSync(out, { recursive: true });
const { suffix, questions } = JSON.parse(
  readFileSync(join(root, 'eval', 'questions.json'), 'utf8')
);

const scratch = mkdtempSync(join(tmpdir(), 'taco-eval-'));
const mcpConfig = join(scratch, 'mcp.json');
writeFileSync(
  mcpConfig,
  JSON.stringify({
    mcpServers: { 'taco-br': { command: 'node', args: [join(root, 'dist', 'server.js')] } }
  })
);
const emptyConfig = join(scratch, 'empty.json');
writeFileSync(emptyConfig, JSON.stringify({ mcpServers: {} }));

const jobs = [];
for (const rep of Array.from({ length: REPS }, (_, i) => i + 1))
  for (const q of questions)
    for (const arm of ['nomcp', 'mcp']) {
      if (ONLY && ONLY !== arm) continue;
      jobs.push({
        q,
        arm,
        rep,
        file: join(out, `${arm}-q${String(q.id).padStart(2, '0')}-r${rep}.json`)
      });
    }
const todo = jobs.filter((j) => !existsSync(j.file)).slice(0, LIMIT || undefined);
console.error(`[eval] ${todo.length} runs (${jobs.length - todo.length} cached), model ${MODEL}`);

function run({ q, arm, rep, file }) {
  const cliArgs = [
    '-p',
    `${q.text}\n\n${suffix}${arm === 'nomcp' ? ' Você não tem ferramentas neste ambiente: responda direto.' : ''}`,
    '--model',
    MODEL,
    '--output-format',
    'json',
    '--no-session-persistence',
    '--strict-mcp-config',
    '--max-budget-usd',
    '1',
    ...(arm === 'mcp'
      ? ['--mcp-config', mcpConfig, '--allowedTools', 'mcp__taco-br__*']
      : ['--mcp-config', emptyConfig, '--tools', ''])
  ];
  return new Promise((done) => {
    const p = spawn('claude', cliArgs, { cwd: scratch, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => (stdout += d));
    p.stderr.on('data', (d) => (stderr += d));
    p.on('close', (code) => {
      let parsed = null;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        /* keep raw */
      }
      writeFileSync(
        file,
        JSON.stringify(
          {
            question: q.id,
            arm,
            rep,
            model: MODEL,
            code,
            result: parsed,
            raw: parsed ? undefined : stdout,
            stderr: stderr.slice(-500)
          },
          null,
          2
        )
      );
      console.error(
        `[eval] ${arm} q${q.id} r${rep} exit ${code} $${parsed?.total_cost_usd ?? '?'}`
      );
      done();
    });
  });
}

const queue = [...todo];
await Promise.all(
  Array.from({ length: CONC }, async () => {
    for (let j = queue.shift(); j; j = queue.shift()) await run(j);
  })
);
