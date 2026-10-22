// Functional tests for the live dashboard server. Run: npm run ld:test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createApp, openSse, post, startApp, TIMEOUT } from './helpers.mjs';

const seqs = (events) => events.map((e) => e.id.split('.')[1]); // ids look like <run>.<sequence>

const EMIT_CLI = fileURLToPath(new URL('../app/emit.mjs', import.meta.url));
const DROP_CLI = fileURLToPath(new URL('../app/drop.mjs', import.meta.url));
const runCli = (file, port, args = []) => promisify(execFile)(process.execPath, [file, ...args],
  { env: { ...process.env, LD_PORT: String(port) }, timeout: TIMEOUT });

// A port that is certainly closed: listen on a free one, then release it.
async function closedPort() {
  const probe = net.createServer();
  await new Promise((r) => probe.listen(0, '127.0.0.1', r));
  const { port } = probe.address();
  await new Promise((r) => probe.close(r));
  return port;
}

test('server starts and reports healthy', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(TIMEOUT) });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, clients: 0, lastId: 0 });
});

test('the dashboard page is served and opens an EventSource', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const res = await fetch(base, { signal: AbortSignal.timeout(TIMEOUT) });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  assert.match(await res.text(), /EventSource\('\/events'\)/);
});

test('/events answers with the SSE content type, no caching, and a 5 second retry hint', async (t) => {
  const { app, base } = await startApp(); // default retry
  t.after(() => app.stop());
  const sse = await openSse(base);
  t.after(() => sse.close());
  assert.equal(sse.status, 200);
  assert.match(sse.headers.get('content-type'), /^text\/event-stream/);
  assert.equal(sse.headers.get('cache-control'), 'no-cache');
  await post(base, { count: 1 });
  await sse.waitForEvents(1);
  assert.equal(sse.retry, 5000);
});

test('a client receives the expected event and payload', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const sse = await openSse(base);
  t.after(() => sse.close());
  const res = await post(base, { count: 1 });
  assert.equal(res.status, 200);
  const [event] = await sse.waitForEvents(1);
  assert.match(event.id, /^[0-9a-f]{6}.1$/);
  assert.equal(event.event, 'metric');
  assert.deepEqual(event.json, { seq: 1, metric: 'orders', label: 'Orders', value: 12, unit: 'per min' });
});

test('sample events are deterministic and cycle through the nine fixtures', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const sse = await openSse(base);
  t.after(() => sse.close());
  await post(base, { count: 12 });
  const events = await sse.waitForEvents(12);
  assert.deepEqual(events.slice(0, 3).map((e) => e.json.metric), ['orders', 'visitors', 'errors']);
  assert.deepEqual(events[3].json, { seq: 4, metric: 'orders', label: 'Orders', value: 14, unit: 'per min' });
  assert.deepEqual(events[9].json, { seq: 10, metric: 'orders', label: 'Orders', value: 12, unit: 'per min' }); // wraps to fixture 1
});

test('every connected client gets every event', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const a = await openSse(base);
  const b = await openSse(base);
  t.after(() => Promise.all([a.close(), b.close()]));
  await post(base, { count: 2 });
  assert.deepEqual(seqs(await a.waitForEvents(2)), ['1', '2']);
  assert.deepEqual(seqs(await b.waitForEvents(2)), ['1', '2']);
});

test('a reconnecting client with Last-Event-ID only gets what it missed', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  await post(base, { count: 3 });
  const sse = await openSse(base, { lastEventId: `${app.epoch}.1` });
  t.after(() => sse.close());
  assert.deepEqual(seqs(await sse.waitForEvents(2)), ['2', '3']);
  await post(base, { count: 1 }); // and the stream stays live afterwards
  assert.deepEqual(seqs(await sse.waitForEvents(3)), ['2', '3', '4']);
});

test('an unknown Last-Event-ID (e.g. from an older run) gets a reset notice, then the events this run holds', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  await post(base, { count: 2 });
  const sse = await openSse(base, { lastEventId: '99' });
  t.after(() => sse.close());
  await post(base, { count: 1 });
  const events = await sse.waitForEvents(4);
  assert.deepEqual(events.map((e) => e.event), ['reset', 'metric', 'metric', 'metric']); // notice, #1 and #2 replayed, #3 live
  assert.deepEqual(seqs(events.slice(1)), ['1', '2', '3']);
});

test('dropping connections ends the streams but the server keeps running', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const sse = await openSse(base);
  await post(base, { count: 1 });
  await sse.waitForEvents(1);
  const res = await post(base, {}, false, '/admin/drop');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { dropped: 1 });
  await sse.waitForEnd(); // rejects (and fails the test) if the stream is left open
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(TIMEOUT) });
  assert.deepEqual(await health.json(), { ok: true, clients: 0, lastId: 1 });
});

test('events sent while nobody is connected are replayed once, in order, to the returning client', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const first = await openSse(base);
  await post(base, { count: 2 });
  const seen = await first.waitForEvents(2);
  await post(base, {}, false, '/admin/drop'); // the connection breaks...
  await first.waitForEnd();
  await post(base, { count: 2 }); // ...two events happen while nobody is listening...
  const back = await openSse(base, { lastEventId: seen.at(-1).id }); // ...and the browser reconnects with its last id
  t.after(() => back.close());
  assert.deepEqual(seqs(await back.waitForEvents(2)), ['3', '4']);
  await post(base, { count: 1 });
  assert.deepEqual(seqs(await back.waitForEvents(3)), ['3', '4', '5']); // nothing is delivered twice
});

test('invalid /emit requests are rejected with a clear 400', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  for (const body of [{ count: 0 }, { count: 21 }, { count: 1.5 }, { count: 'x' }, { count: -3 }, null, [1]]) {
    const res = await post(base, body);
    assert.equal(res.status, 400, `body ${JSON.stringify(body)}`);
    assert.match((await res.json()).error, /count must be an integer from 1 to 20/);
  }
  const res = await post(base, 'not json', true);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /valid JSON/);
  assert.equal(app.lastId, 0, 'rejected requests must not emit anything');
});

test('oversized bodies and unknown routes or methods are refused', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  assert.equal((await post(base, JSON.stringify({ count: 1, pad: 'x'.repeat(2000) }), true)).status, 413);
  assert.equal((await fetch(`${base}/nope`, { signal: AbortSignal.timeout(TIMEOUT) })).status, 404);
  assert.equal((await fetch(`${base}/events`, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT) })).status, 404);
  assert.equal((await fetch(`${base}/admin/drop`, { signal: AbortSignal.timeout(TIMEOUT) })).status, 404); // GET is not allowed
});

test('stopping the server ends open streams and refuses new connections', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop()); // safe to call twice; nothing stays listening if an assertion fails
  const sse = await openSse(base);
  await post(base, { count: 1 });
  await sse.waitForEvents(1);
  await app.stop();
  await sse.waitForEnd();
  await assert.rejects(fetch(`${base}/health`, { signal: AbortSignal.timeout(TIMEOUT) }), 'server must refuse connections once stopped');
});

test('starting a second server on a busy port fails with a clear error', async (t) => {
  const { app, port } = await startApp();
  t.after(() => app.stop());
  await assert.rejects(createApp({ port }).start(), { code: 'EADDRINUSE' });
});

test('the server is reachable on loopback but not on other network interfaces', async (t) => {
  const { app, port } = await startApp();
  t.after(() => app.stop());
  const external = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal);
  if (!external) return t.skip('no non-loopback IPv4 address on this machine');
  const connect = (host) => new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 2000 });
    socket.once('connect', () => { socket.destroy(); resolve('open'); });
    socket.once('error', (e) => resolve(e.code));
    socket.once('timeout', () => { socket.destroy(); resolve('timeout'); });
  });
  assert.equal(await connect('127.0.0.1'), 'open');
  assert.notEqual(await connect(external.address), 'open', `must not listen on ${external.address}`);
});

test('the emit and drop commands fail clearly when the server is not running', async () => {
  const port = await closedPort();
  for (const file of [EMIT_CLI, DROP_CLI]) {
    await assert.rejects(runCli(file, port), (err) => err.code === 1 && /Cannot reach the server/.test(err.stderr) && /npm run ld:app/.test(err.stderr));
  }
});

test('the emit command sends a large count as several requests and summarises it on one line', async (t) => {
  const { app, port } = await startApp();
  t.after(() => app.stop());
  const out = await runCli(EMIT_CLI, port, ['120']);
  assert.equal(out.stdout.trim(), 'sent 120 events, #1 to #120');
  assert.equal(app.lastId, 120);
  const odd = await runCli(EMIT_CLI, port, ['45']);
  assert.equal(odd.stdout.trim(), 'sent 45 events, #121 to #165');
});

test('the emit command reports server rejections, and the drop command reports what it did', async (t) => {
  const { app, port } = await startApp();
  t.after(() => app.stop());
  await assert.rejects(runCli(EMIT_CLI, port, ['0']), (err) => err.code === 1 && /rejected the request \(400\)/.test(err.stderr));
  const ok = await runCli(EMIT_CLI, port, ['2']);
  assert.match(ok.stdout, /sent #1 {2}Orders = 12 per min\r?\nsent #2 {2}Visitors = 340 online/);
  const sse = await openSse(`http://127.0.0.1:${port}`);
  t.after(() => sse.close());
  const dropped = await runCli(DROP_CLI, port);
  assert.match(dropped.stdout, /dropped 1 connection; the server is still running/);
});
