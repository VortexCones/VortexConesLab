// Show that the tests can fail. Run the stream test against a temporary copy of the server whose messages forget the
// blank line that ends them: a classic Server-Sent Events bug, because the browser then waits forever for the end of
// the message. Exits 0 only if the tests caught the fault (i.e. they failed).
// Usage: npm run ld:prove-failure
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appDir = fileURLToPath(new URL('../app', import.meta.url));
const testFile = fileURLToPath(new URL('./server.test.mjs', import.meta.url));
const reporter = fileURLToPath(new URL('./reporter.mjs', import.meta.url));

const scratch = await mkdtemp(join(tmpdir(), 'ld-broken-'));
try {
  await cp(appDir, join(scratch, 'app'), { recursive: true });
  const serverFile = join(scratch, 'app', 'server.mjs');
  const source = await readFile(serverFile, 'utf8');
  const good = '`data: ${JSON.stringify(e)}\\n\\n`;'; // the data line, then the blank line that ends the message
  if (!source.includes(good)) { console.error('could not find the line to break'); process.exit(2); }
  await writeFile(serverFile, source.replace(good, '`data: ${JSON.stringify(e)}\\n`;'));

  console.log('Same tests, broken copy: the blank line\nthat ends each message is missing.\n');
  const run = spawnSync(process.execPath, [
    '--test', '--test-timeout=30000', `--test-reporter=${pathToFileURL(reporter).href}`,
    '--test-name-pattern=expected event and payload', testFile,
  ], { env: { ...process.env, LD_APP_MODULE: pathToFileURL(serverFile).href, LD_TEST_TIMEOUT: '2500' }, stdio: 'inherit' });

  const caught = run.status !== 0;
  console.log(`\nBroken copy: test exit code ${run.status}.\n${caught ? 'The tests caught the fault.' : 'THE TESTS DID NOT CATCH THE FAULT.'}`);
  process.exitCode = caught ? 0 : 1;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
