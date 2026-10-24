// Tests for the test server (app/server.mjs): loopback, ephemeral ports, bounded waits. They start no browser and write no files.
// They check that the server behaves as documented in its header; they are NOT measurements and prove nothing about other
// Node.js versions or clients. Run: node --test --test-timeout=60000 scenarios/node-shutdown-sse/tests/server.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { PAGE, WIRE_BLOCK, createApp } from '../app/server.mjs';

const fast = { port: 0, tickMs: 40 };
const lines = () => { const out = []; return { out, log: (l) => out.push(l) }; };

const get = (port, path, opts = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, path, method: opts.method ?? 'GET', agent: opts.agent ?? false, headers: opts.headers }, (res) => resolve({ req, res }));
  req.on('error', reject);
  req.end();
});
const text = async (port, path, opts) => { const { res } = await get(port, path, opts); let body = ''; for await (const c of res) body += c; return { status: res.statusCode, body, headers: res.headers }; };
// Open /events and collect what arrives; returns the request so a test can end the client side.
async function openStream(port, agent) {
  const { req, res } = await get(port, '/events', { agent });
  const state = { body: '', ended: false, req, res };
  res.on('data', (c) => { state.body += c; });
  res.on('end', () => { state.ended = true; });
  res.on('error', () => {});
  return state;
}
const waitFor = async (cond, ms, label) => { for (const end = Date.now() + ms; Date.now() < end; await sleep(20)) if (cond()) return; throw new Error(`timed out: ${label}`); };

test('/health answers ok and / is the static probe page (no visible ticks)', async () => {
  const { log } = lines(); const app = createApp({ ...fast, log }); const port = await app.start();
  try {
    assert.equal((await text(port, '/health')).body, 'ok');
    const page = await text(port, '/');
    assert.equal(page.body, PAGE);
    assert.match(page.body, /<title>EventSource probe<\/title>/);
    assert.match(page.body, /<pre>EventSource probe<\/pre>/);
    assert.doesNotMatch(page.body, /tick/i, 'the page must not display ticks: the hook design relies on a static page');
    assert.equal((await text(port, '/nope')).status, 404);
  } finally { await app.stopForTests(); }
});

test('/events starts with the retry hint, then sends id / event / data blocks', async () => {
  const { log } = lines(); const app = createApp({ ...fast, log }); const port = await app.start();
  try {
    const s = await openStream(port);
    await waitFor(() => /id: 2\n/.test(s.body), 3000, 'two ticks');
    assert.ok(s.body.startsWith('retry: 2000\n\n'), JSON.stringify(s.body.slice(0, 30)));
    assert.match(s.body, /id: 1\nevent: tick\ndata: 1\n\n/);
    assert.equal(s.res.headers['content-type'], 'text/event-stream');
    s.req.destroy();
  } finally { await app.stopForTests(); }
});

test('a client that connects late sees a later id first; WIRE_BLOCK accepts any id', async () => {
  const { log } = lines(); const app = createApp({ ...fast, log }); const port = await app.start();
  try {
    await sleep(300); // several ticks pass with nobody connected
    const s = await openStream(port);
    await waitFor(() => WIRE_BLOCK.test(s.body), 3000, 'a tick block');
    assert.ok(s.body.startsWith('retry: 2000'));
    assert.ok(Number(s.body.match(/id: (\d+)/)[1]) > 1, 'the first id seen is not 1 because the tick counter has been running');
    assert.doesNotMatch(s.body.slice(0, 40), /id: 1\n/);
    s.req.destroy();
  } finally { await app.stopForTests(); }
});

test('an unknown strategy is refused', async () => {
  const { log } = lines(); const app = createApp({ ...fast, log }); const port = await app.start();
  try { assert.equal((await text(port, '/admin/shutdown?strategy=nope', { method: 'POST' })).status, 400); } finally { await app.stopForTests(); }
});

test('close-only with the stream left open: the listener stops, the stream keeps going, the callback stays pending (bounded 1.2 s)', async () => {
  const { out, log } = lines(); const app = createApp({ ...fast, log }); const port = await app.start();
  try {
    const stream = await openStream(port);
    await waitFor(() => /id: 1\n/.test(stream.body), 3000, 'first tick');
    const reply = await text(port, '/admin/shutdown?strategy=close-only', { method: 'POST' });
    assert.equal(reply.body, '{"closing":true,"strategy":"close-only"}');
    await waitFor(() => out.some((l) => /server\.close\(\) called, listening: false/.test(l)), 2000, 'close() logged');
    const before = stream.body.length;
    await sleep(1200);
    assert.ok(stream.body.length > before, 'ticks keep arriving on the open stream after close()');
    assert.ok(!out.some((l) => /close callback fired/.test(l)), 'the callback must not fire while the stream is open (within this bounded window)');
    assert.equal(stream.ended, false);
    // Once the client goes away the callback can fire: this only shows that the server was waiting for that connection.
    stream.req.destroy();
    await waitFor(() => out.some((l) => /close callback fired/.test(l)), 3000, 'callback after the client left');
  } finally { await app.stopForTests(); }
});

test('end-then-close with a keep-alive client: ends the response, waits for finish and close, then close() completes without any helper method', async () => {
  const { out, log } = lines(); const app = createApp({ ...fast, log }); const port = await app.start();
  const agent = new http.Agent({ keepAlive: true });
  try {
    const stream = await openStream(port, agent);
    await waitFor(() => /id: 1\n/.test(stream.body), 3000, 'first tick');
    const reply = await text(port, '/admin/shutdown?strategy=end-then-close', { method: 'POST' });
    assert.equal(reply.body, '{"closing":true,"strategy":"end-then-close"}');
    await waitFor(() => out.some((l) => /close callback fired/.test(l)), 3000, 'callback');
    await waitFor(() => stream.ended, 2000, 'the client sees the response end');
    const order = out.map((l) => l.replace(/^\[[^\]]*\] /, ''));
    assert.ok(order.indexOf('shutdown requested (end-then-close)') < order.findIndex((l) => /^server\.close\(\) called/.test(l)));
    assert.equal(app.streamsOpen, 0);
  } finally { agent.destroy(); await app.stopForTests(); }
});

// Not exercised here: the 2 s safety limit of end-then-close (it needs a response that never settles; see README.md, "Not tested").

test('the server never calls the two connection-closing helper methods that Measurements A and B did not use', async () => {
  const source = await readFile(new URL('../app/server.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.closeIdleConnections\s*\(/);
  assert.doesNotMatch(source, /\.closeAllConnections\s*\(/);
  assert.match(source, /server\.close\(/);
});
