/** Shared by the data build scripts: the pinned upstream CSVs (brolesi/taco) and value rounding. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const rawDir = join(root, 'data/raw/brolesi');
export const upstream = JSON.parse(readFileSync(join(rawDir, 'UPSTREAM.json'), 'utf8')) as {
  repo: string;
  sha: string;
  files: Record<string, { path: string; sha256: string }>;
};

export const SOURCE = 'TACO 4ª ed. (NEPA/UNICAMP, 2011)';

const sha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

export async function loadUpstream(name: string, fetchRemote: boolean): Promise<Buffer> {
  const meta = upstream.files[name];
  if (!meta) throw new Error(`unknown upstream file ${name}`);
  const local = join(rawDir, name);
  let buf: Buffer;
  if (fetchRemote || !existsSync(local)) {
    const url = `https://raw.githubusercontent.com/brolesi/taco/${upstream.sha}/${meta.path}`;
    console.error(`[build-data] fetching ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url} -> HTTP ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(local, buf);
  } else {
    buf = readFileSync(local);
  }
  const got = sha256(buf);
  if (got !== meta.sha256) {
    throw new Error(`${name}: sha256 ${got} does not match pinned ${meta.sha256}`);
  }
  return buf;
}

/** Rounds to `decimals`; if a real (non-trace) value would collapse to 0, keeps more digits. */
export function roundValue(raw: number, decimals: number): number {
  for (let d = decimals; d <= decimals + 3; d++) {
    const r = Number(raw.toFixed(d));
    if (r !== 0 || raw === 0) return r;
  }
  return Number(raw.toPrecision(2));
}
