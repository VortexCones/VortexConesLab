// The live element of the video, with NO AI, no account and no spending: five small tasks, a plausible quick solution written for the video on purpose for each (naive.mjs, not the output of any tool under test) and a careful
// reference solution. Each is run against the visible tests (the ones a person or a tool would see) and the hidden edge-case tests, and the counts are printed. It shows that "passes the tests it can see"
// is not the same as "correct", which is the review burden that the studies point to. The numbers come from the run itself; the narration must match them (the run checks the facts it relies on).
// Usage: node run-demo.mjs [--json | --write]
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TASKS = fileURLToPath(new URL('./tasks/', import.meta.url));
const count = (out, key) => Number((out.match(new RegExp(`ℹ ${key} (\\d+)`)) ?? [])[1] ?? NaN);
function score(work, file) {
  const r = spawnSync(process.execPath, ['--test', file], { cwd: work, encoding: 'utf8', timeout: 60000 });
  return { pass: count(r.stdout, 'pass'), fail: count(r.stdout, 'fail') };
}
const rows = [];
for (const id of readdirSync(TASKS).filter((d) => /^t\d/.test(d)).sort()) {
  const src = join(TASKS, id), work = mkdtempSync(join(tmpdir(), `vx-demo-${id}-`));
  try {
    for (const f of ['visible.test.mjs', 'hidden.test.mjs']) copyFileSync(join(src, f), join(work, f));
    const row = { task: id };
    for (const [label, file] of [['quick', 'naive.mjs'], ['careful', 'reference.mjs']]) {
      copyFileSync(join(src, file), join(work, 'solution.mjs'));
      row[label] = { visible: score(work, 'visible.test.mjs'), hidden: score(work, 'hidden.test.mjs') };
    }
    rows.push(row);
  } finally { rmSync(work, { recursive: true, force: true }); }
}

const cell = (s) => `${s.pass}/${s.pass + s.fail}`;
const quickAllVisible = rows.filter((r) => r.quick.visible.fail === 0).length;
const quickHiddenFail = rows.filter((r) => r.quick.hidden.fail > 0).length;
const missed = rows.reduce((n, r) => n + r.quick.hidden.fail, 0);
const summary = { tasks: rows.length, quickPassEveryVisibleTest: quickAllVisible, quickFailAHiddenTest: quickHiddenFail, hiddenTestsMissedInTotal: missed };
// --write stores the counts in demo-results.json (the card of the video is drawn from that file; the take re-runs the demo and checks that the counts are the same)
if (process.argv.includes('--write')) writeFileSync(fileURLToPath(new URL('./demo-results.json', import.meta.url)), `${JSON.stringify({ ranOn: new Date().toISOString().slice(0, 10), node: process.version, rows, summary }, null, 2)}
`);
if (process.argv.includes('--json')) { console.log(JSON.stringify({ rows, summary }, null, 2)); process.exit(0); }

console.log('task            quick: visible  hidden     careful: visible  hidden');
for (const r of rows) console.log(`${r.task.padEnd(16)}${cell(r.quick.visible).padEnd(16)}${cell(r.quick.hidden).padEnd(11)}${cell(r.careful.visible).padEnd(18)}${cell(r.careful.hidden)}`);
console.log(`\n${quickAllVisible} of ${rows.length} quick solutions pass every visible test; ${quickHiddenFail} of them fail at least one hidden test (${missed} hidden tests missed in total).`);
// the facts the narration relies on
const problems = [];
if (rows.length !== 5) problems.push('expected five tasks');
if (quickAllVisible !== rows.length) problems.push('a quick solution fails a visible test');
if (quickHiddenFail !== rows.length) problems.push('a quick solution passes all hidden tests (it would not show the point)');
if (rows.some((r) => r.careful.visible.fail || r.careful.hidden.fail)) problems.push('a careful solution fails a test');
if ([...rows.flatMap((r) => [r.quick.visible.pass, r.quick.hidden.pass, r.careful.visible.pass, r.careful.hidden.pass])].some((n) => !Number.isFinite(n))) problems.push('could not read a test count');
if (problems.length) { console.error(`DEMO CHECK FAILED: ${problems.join('; ')}`); process.exit(1); }
console.log('demo check passed');
