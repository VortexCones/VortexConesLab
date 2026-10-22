// Shared test helpers. The app modules can be swapped with LD_APP_MODULE / LD_STAGE1_MODULE (file URLs), which is how
// "the tests must fail when behaviour is broken" runs the same tests against a deliberately broken copy.
export const { createApp } = await import(process.env.LD_APP_MODULE ?? new URL('../app/server.mjs', import.meta.url).href);
export const { start: startStage1 } = await import(process.env.LD_STAGE1_MODULE ?? new URL('../app/stage1.mjs', import.meta.url).href);

export const TIMEOUT = Number(process.env.LD_TEST_TIMEOUT ?? 5000);

// A bounded wait on state (never a fixed sleep): poll a condition until it holds or fail after `ms`.
export async function until(condition, what, ms = TIMEOUT) {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out after ${ms} ms waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 10));
  }
}

// Start an app on a free port (port 0) so tests never collide with a real server on 4181.
export async function startApp(options = {}) {
  const app = createApp({ port: 0, ...options });
  const port = await app.start();
  return { app, port, base: `http://127.0.0.1:${port}` };
}

// Start an app on a specific port, retrying briefly while the OS releases it after a previous stop.
export async function startAppOn(port, options = {}) {
  const deadline = Date.now() + TIMEOUT;
  for (;;) {
    const app = createApp({ port, ...options });
    try { await app.start(); return { app, port, base: `http://127.0.0.1:${port}` }; }
    catch (err) {
      if (err.code !== 'EADDRINUSE' || Date.now() > deadline) throw err;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

const withTimeout = (promise, ms, what) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms waiting for ${what}`)), ms).unref()),
]);

// Open an SSE stream and collect parsed messages. Callers wait for a count of events, never for a fixed time.
export async function openSse(base, { lastEventId, path = '/events' } = {}) {
  const controller = new AbortController();
  const res = await withTimeout(fetch(`${base}${path}`, {
    headers: lastEventId === undefined ? {} : { 'Last-Event-ID': String(lastEventId) },
    signal: controller.signal,
  }), TIMEOUT, 'the SSE response headers');

  const events = [];
  let retry = null;
  let waiters = [];
  const notify = () => { waiters = waiters.filter((w) => !w()); };
  let ended = false;
  const endedPromise = (async () => {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for await (const chunk of res.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let cut;
        while ((cut = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const msg = { id: null, event: 'message', data: '' };
          for (const line of block.split('\n')) {
            if (line.startsWith(':')) continue;
            if (line.startsWith('retry:')) retry = Number(line.slice(6));
            else if (line.startsWith('id:')) msg.id = line.slice(3).trim();
            else if (line.startsWith('event:')) msg.event = line.slice(6).trim();
            else if (line.startsWith('data:')) msg.data += line.slice(5).trim();
          }
          if (msg.data) {
            let json = null;
            try { json = JSON.parse(msg.data); } catch { /* plain text data, as in stage 1 */ }
            events.push({ ...msg, json });
          }
          notify();
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') throw err;
    }
    ended = true;
    notify();
  })();

  return {
    status: res.status,
    headers: res.headers,
    events,
    get retry() { return retry; },
    // Resolves as soon as `n` events have arrived; rejects after the timeout instead of hanging.
    waitForEvents: (n, ms = TIMEOUT) => withTimeout(new Promise((resolve) => {
      const check = () => (events.length >= n ? (resolve(events.slice(0, n)), true) : false);
      if (!check()) waiters.push(check);
    }), ms, `${n} event(s) (got ${events.length})`),
    // Resolves when the server closes the stream.
    waitForEnd: (ms = TIMEOUT) => withTimeout(new Promise((resolve) => {
      const check = () => (ended ? (resolve(), true) : false);
      if (!check()) waiters.push(check);
    }), ms, 'the stream to end'),
    close: () => { controller.abort(); return endedPromise; },
  };
}

export const post = (base, body, raw = false, path = '/emit') => fetch(`${base}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: raw ? body : JSON.stringify(body),
  signal: AbortSignal.timeout(TIMEOUT),
});
