// Proves that the five trial tasks are sound WITHOUT any AI: for each task the stub must fail the visible tests, and the reference solution must pass both the visible and the hidden tests.
// Also checks that a task folder has everything the harness needs. Usage: node check-tasks.mjs
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TASKS = fileURLToPath(new URL('./tasks/', import.meta.url));
const FILES = ['TASK.md', 'stub.mjs', 'reference.mjs', 'naive.mjs', 'visible.test.mjs', 'hidden.test.mjs'];
export const runTests = (dir, test) => spawnSync(process.execPath, ['--test', test], { cwd: dir, encoding: 'utf8', timeout: 60000 });
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`); if (!ok) failed += 1; };

const ids = readdirSync(TASKS).filter((d) => /^t\d/.test(d)).sort();
check('five tasks', ids.length === 5, ids.join(', '));
for (const id of ids) {
  const src = join(TASKS, id);
  check(`${id}: has ${FILES.join(', ')}`, FILES.every((f) => existsSync(join(src, f))));
  const work = mkdtempSync(join(tmpdir(), `vx-${id}-`));
  try {
    for (const f of ['visible.test.mjs', 'hidden.test.mjs']) copyFileSync(join(src, f), join(work, f));
    copyFileSync(join(src, 'stub.mjs'), join(work, 'solution.mjs'));
    check(`${id}: the stub fails the visible tests`, runTests(work, 'visible.test.mjs').status !== 0);
    copyFileSync(join(src, 'reference.mjs'), join(work, 'solution.mjs'));
    const v = runTests(work, 'visible.test.mjs'), h = runTests(work, 'hidden.test.mjs');
    check(`${id}: the reference passes the visible tests`, v.status === 0, v.status === 0 ? '' : v.stdout.slice(-300));
    copyFileSync(join(src, 'naive.mjs'), join(work, 'solution.mjs'));
    check(`${id}: the quick solution passes the visible tests and fails a hidden one`, runTests(work, 'visible.test.mjs').status === 0 && runTests(work, 'hidden.test.mjs').status !== 0);
    check(`${id}: the reference passes the hidden tests`, h.status === 0, h.status === 0 ? '' : h.stdout.slice(-300));
  } finally { rmSync(work, { recursive: true, force: true }); }
}
console.log(failed ? `\n${failed} check(s) failed` : '\nALL TASK CHECKS PASSED');
process.exit(failed ? 1 : 0);
