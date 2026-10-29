import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Builds dist/ once so every e2e test talks to the real binary. */
export default function setup(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'ignore' });
}
