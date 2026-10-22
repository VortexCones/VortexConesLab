// Tests for build step 1: the 14-line tick server. Run: npm run ld:test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSse, startStage1, until } from './helpers.mjs';

// Start a stage 1 server on a free port. Every test also watches the intervals the server creates and clears
// (stage 1 calls the global setInterval when a request arrives). If the server forgets to clear one, that is a test
// failure, but the leaked interval would also keep this process alive forever, so the cleanup below clears whatever is
// left: a failure must be a failure and never a hang.
async function begin(t) {
  const realSet = globalThis.setInterval;
  const realClear = globalThis.clearInterval;
  const live = new Set();
  globalThis.setInterval = (...args) => { const handle = realSet(...args); live.add(handle); return handle; };
  globalThis.clearInterval = (handle) => { live.delete(handle); return realClear(handle); };

  const server = startStage1(0);
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    for (const handle of live) realClear(handle);
    globalThis.setInterval = realSet;
    globalThis.clearInterval = realClear;
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  });
  return { base: `http://127.0.0.1:${server.address().port}`, live };
}

test('stage 1 answers with the event-stream content type and no caching', async (t) => {
  const { base } = await begin(t);
  const sse = await openSse(base, { path: '/' });
  t.after(() => sse.close());
  assert.equal(sse.status, 200);
  assert.match(sse.headers.get('content-type'), /^text\/event-stream/);
  assert.equal(sse.headers.get('cache-control'), 'no-cache');
});

test('stage 1 sends a numbered tick every second', async (t) => {
  const { base } = await begin(t);
  const sse = await openSse(base, { path: '/' });
  t.after(() => sse.close());
  const ticks = await sse.waitForEvents(3, 6000);
  assert.deepEqual(ticks.map((e) => e.id), ['1', '2', '3']);
  assert.deepEqual(ticks.map((e) => e.data), ['tick 1', 'tick 2', 'tick 3']);
});

test('stage 1 stops its timer when the client goes away', async (t) => {
  const { base, live } = await begin(t);
  const sse = await openSse(base, { path: '/' });
  await until(() => live.size === 1, 'the per-client timer to start');
  await sse.close();
  await until(() => live.size === 0, 'the per-client timer to be cleared');
});
