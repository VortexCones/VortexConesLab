// The test server for the VortexCones video "You Closed Your Node.js Server. Why Is the Process Still Running?".
// It is a small, standalone SSE server with the two shutdown sequences that the video's Measurements A and B compared. It is NOT the
// measurement harness: it only shows the trigger and gives the tests something real to run against. The figures in the video come
// from recorded runs of a separate harness that is not in this repository, never from this server.
//
//   GET  /                       a static page: "EventSource probe" (it keeps an EventSource open and shows nothing else)
//   GET  /events                 SSE: "retry: 2000", then an event every 500 ms (id, event: tick, data)
//   GET  /health                 200 ok
//   POST /admin/shutdown?strategy=close-only | end-then-close
//
// close-only      server.close(callback) and nothing else (Measurement A).
// end-then-close  end every open SSE response, wait for its 'finish' and 'close' events, then server.close(callback) (Measurement B).
// Neither strategy closes connections by any means other than server.close(); a test checks that this file never calls the
// two connection-closing helper methods that Measurements A and B deliberately did not use.
//
// Logging: one short line per event, with milliseconds since the shutdown request, to standard output.
// The `// >>> name` and `// <<<` comments mark the two excerpts shown in the video; they have no effect on behaviour.
import http from 'node:http';
import { pathToFileURL } from 'node:url';

export const RETRY_MS = 2000;
export const TICK_MS = 500;
// What a tick looks like on the wire. The id is the server's running tick count, so a client that connects later sees a later id
// (a live check showed "id: 5" first): checks must match any id, not id 1.
export const WIRE_BLOCK = /id: \d+\s+event: tick\s+data: \d+/;
export const SETTLE_LIMIT_MS = 2000; // end-then-close gives up (and does NOT call close) if finish and close are not both seen by then

export const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>EventSource probe</title></head><body><pre>EventSource probe</pre><script>
var es = new EventSource('/events');
</script></body></html>`;

export function createApp({ host = '127.0.0.1', port = 4182, retryMs = RETRY_MS, tickMs = TICK_MS, settleLimitMs = SETTLE_LIMIT_MS, log = (line) => process.stdout.write(`${line}\n`) } = {}) {
  const streams = new Set();
  const sockets = new Set();
  let ticks = 0;
  let shutdownAt = null;
  const stamp = () => (shutdownAt === null ? '        ' : `+${(performance.now() - shutdownAt).toFixed(1)} ms`);
  const say = (text) => log(`[${stamp()}] ${text}`);

  const ticker = setInterval(() => {
    ticks += 1;
    for (const res of streams) res.write(`id: ${ticks}\nevent: tick\ndata: ${ticks}\n\n`);
  }, tickMs);
  ticker.unref(); // only connections and the listener may keep the process alive, as in the measurements

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
    if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(PAGE); }
    if (url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      res.write(`retry: ${retryMs}\n\n`);
      streams.add(res);
      res.on('close', () => streams.delete(res));
      return undefined;
    }
    if (req.method === 'POST' && url.pathname === '/admin/shutdown') {
      const strategy = url.searchParams.get('strategy') ?? 'close-only';
      if (!['close-only', 'end-then-close'].includes(strategy)) { res.writeHead(400); return res.end('unknown strategy'); }
      res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
      return res.end(JSON.stringify({ closing: true, strategy }), () => shutdown(strategy));
    }
    res.writeHead(404);
    return res.end();
  });
  server.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });

  // Resolves once the response has emitted both 'finish' and 'close' (their order is recorded elsewhere, not assumed);
  // rejects if that takes longer than the limit.
  const settled = (res) => new Promise((resolve, reject) => {
    let seen = 0;
    const timer = setTimeout(() => reject(new Error('timeout')), settleLimitMs);
    timer.unref();
    const one = () => { if (++seen === 2) { clearTimeout(timer); resolve(); } };
    res.once('finish', one);
    res.once('close', one);
  });

  async function shutdown(strategy) {
    shutdownAt = performance.now();
    say(`shutdown requested (${strategy})`);
    if (strategy === 'close-only') {
      // >>> close-only
      server.close(() => {
        say('close callback fired');
      });
      // <<<
      say(`server.close() called, listening: ${server.listening}`);
      return;
    }
    try {
      // >>> end-then-close
      const open = [...streams];
      const finished = open.map(settled);
      for (const res of open) res.end();
      await Promise.all(finished);
      server.close(() => say('close callback fired'));
      // <<<
    } catch {
      say(`finish and close not both seen within ${settleLimitMs} ms; server.close() NOT called`);
      return;
    }
    say(`server.close() called, listening: ${server.listening}`);
  }

  return {
    server,
    get streamsOpen() { return streams.size; },
    start: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.off('error', reject); say(`listening on ${host}:${server.address().port}`); resolve(server.address().port); });
    }),
    shutdown,
    // Test teardown only: destroy the sockets this server accepted, then close the listener.
    stopForTests: () => { clearInterval(ticker); for (const socket of sockets) socket.destroy(); return new Promise((resolve) => (server.listening ? server.close(() => resolve()) : resolve())); },
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4182);
  await createApp({ port }).start();
}
