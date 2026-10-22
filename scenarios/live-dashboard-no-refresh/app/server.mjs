// The live dashboard server (build steps 2 and 3): no frameworks, no database, loopback only.
//   GET  /             the dashboard page
//   GET  /events       the SSE stream (text/event-stream), with event ids and replay
//   POST /emit         {"count": 1..20} emits the next fixture events (default 1)
//   POST /admin/drop   ends every open stream but keeps the server running (to demonstrate reconnecting)
//   GET  /health       {ok, clients, lastId}
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtureFor } from './events.mjs';

const PAGE = fileURLToPath(new URL('./public/index.html', import.meta.url));
const REPLAY_LIMIT = 100; // how many past events are kept in memory for reconnecting clients
const MAX_COUNT = 20;

export function createApp({ host = '127.0.0.1', port = 4181, heartbeatMs = 15000, retryMs = 5000, epoch = randomBytes(3).toString('hex') } = {}) {
  const clients = new Set();
  const history = []; // in-memory only: a restart forgets it, which the tutorial points out
  let lastId = 0;
  let server;
  let heartbeat;

  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  // >>> frame
  // One SSE message: an id line (run id + sequence), an event name, a data line, and a blank line to end it.
  const frame = (e) =>
    `id: ${epoch}.${e.seq}\n` +
    `event: metric\n` +
    `data: ${JSON.stringify(e)}\n\n`;
  // <<<

  function emit(count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const e = fixtureFor(++lastId);
      history.push(e);
      if (history.length > REPLAY_LIMIT) history.shift();
      for (const res of clients) res.write(frame(e));
      out.push(e);
    }
    return out;
  }

  // >>> replay
  function replayMissed(req, res) {
    const id = req.headers['last-event-id'];
    if (!id) return; // fresh page: no history
    const [run, n] = id.split('.');
    if (run !== epoch) return startOver(res);
    const seen = Number(n);
    warnIfGap(res, seen);
    for (const e of history) {
      if (e.seq > seen) res.write(frame(e));
    }
  }
  // <<<

  // The id came from another server run (a restart): say so, then send everything this run holds.
  function startOver(res) {
    notice(res, 'reset', { reason: 'restart' });
    for (const e of history) res.write(frame(e));
  }

  // Events older than the oldest kept one cannot be replayed: say which ones, instead of skipping them silently.
  function warnIfGap(res, seen) {
    const oldest = history.length ? history[0].seq : lastId + 1;
    if (seen + 1 < oldest) notice(res, 'gap', { from: seen + 1, to: oldest - 1 });
  }

  // A message that tells the browser the replay is incomplete. It carries the current id so a later reconnect starts here.
  function notice(res, name, data) {
    res.write(`id: ${epoch}.${lastId}\nevent: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  function openStream(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(`retry: ${retryMs}\n\n`); // how long the browser waits before reconnecting
    replayMissed(req, res);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  // Ends every open stream. The browser sees the connection break and reconnects by itself.
  function dropClients() {
    const n = clients.size;
    for (const res of clients) res.end();
    clients.clear();
    return n;
  }

  async function handle(req, res) {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(await readFile(PAGE));
    }
    if (req.method === 'GET' && pathname === '/events') return openStream(req, res);
    if (req.method === 'GET' && pathname === '/health') return json(res, 200, { ok: true, clients: clients.size, lastId });
    if (req.method === 'POST' && pathname === '/admin/drop') return json(res, 200, { dropped: dropClients() });
    if (req.method === 'POST' && pathname === '/emit') {
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 1024) return json(res, 413, { error: 'body too large' });
      }
      let body = {};
      if (raw.trim()) {
        try { body = JSON.parse(raw); } catch { return json(res, 400, { error: 'body must be valid JSON' }); }
      }
      const plainObject = body !== null && typeof body === 'object' && !Array.isArray(body);
      const count = plainObject ? body.count ?? 1 : NaN;
      if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
        return json(res, 400, { error: `count must be an integer from 1 to ${MAX_COUNT}` });
      }
      return json(res, 200, { emitted: emit(count) });
    }
    json(res, 404, { error: 'not found' });
  }

  return {
    emit,
    dropClients,
    get lastId() { return lastId; },
    get epoch() { return epoch; },
    get clientCount() { return clients.size; },
    start() {
      server = createServer((req, res) => handle(req, res).catch((err) => {
        if (!res.headersSent) json(res, 500, { error: 'internal error' }); else res.end();
        console.error(err);
      }));
      heartbeat = setInterval(() => { for (const res of clients) res.write(': keep-alive\n\n'); }, heartbeatMs);
      heartbeat.unref();
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve(server.address().port));
      });
    },
    // Drops every stream, which is exactly what a browser's EventSource has to recover from.
    stop() {
      clearInterval(heartbeat);
      for (const res of clients) res.end();
      clients.clear();
      if (!server?.listening) return Promise.resolve(); // already stopped (or never started): nothing to do
      return new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.LD_PORT || 4181);
  const app = createApp({ port });
  await app.start();
  console.log(`Live dashboard listening on http://127.0.0.1:${port}`);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.stop().then(() => process.exit(0)));
}
