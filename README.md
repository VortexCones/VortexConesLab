# VortexConesLab

Runnable source code, practical implementations, and reproducible experiments accompanying VortexCones technical videos. Explore real software, test technical claims, investigate failure modes, and learn from evidence-backed results.

Videos in this repository:

- **Live Dashboard: no page refresh**, in `scenarios/live-dashboard-no-refresh` (see "Live Dashboard: no page refresh" below).
- **Node.js shutdown and an open stream**, in `scenarios/node-shutdown-sse` (see "Node.js shutdown and an open stream: a small test server" below).

## Live Dashboard: no page refresh

A small Node.js dashboard that updates the moment something happens, without reloading the page, using Server-Sent Events (SSE). It accompanies the VortexCones video "Build a Live Dashboard in Node.js - No Page Refresh". It is a teaching example with synthetic sample data, not production software.

What it shows, step by step:

1. **Stage 1** (`app/stage1.mjs`): the smallest SSE server, 14 lines, one message per second.
2. **The dashboard** (`app/server.mjs`, `app/public/index.html`): a plain page with an `EventSource`, three tiles, a counter and a log, fed by a server with no framework and no database.
3. **Failure and recovery**: the browser reconnects by itself after a dropped connection, and the server tells it what it missed, or that it cannot replay it.
4. **Tests**: 34 automated tests, plus a proof that the stream test fails when the stream is broken on purpose.

### What is in this repository

```
README.md                  this file
LICENSE                    MIT licence
package.json               scripts and the one dev dependency (Playwright)
package-lock.json          locked dependency versions
.gitignore                 dependencies, output, logs and environment files
scenarios/live-dashboard-no-refresh/
  app/
    server.mjs             the dashboard server (HTTP routes, SSE stream, replay)
    events.mjs             the nine fixed sample events
    emit.mjs, drop.mjs     terminal controls for the demo
    stage1.mjs             build step 1: the 14-line tick server
    public/index.html      the dashboard page
    CONTRACT.md            the replay contract, in full
  tests/                   functional, replay-contract, stage-1 and browser tests
```

The `// >>> name` and `// <<<` comments in `server.mjs` and `stage1.mjs` mark the snippets shown in the video. They have no effect on behaviour.

## Prerequisites

- **Node.js.** Playwright declares Node 20 or newer. Everything here was tested on **Node.js 24.11.0 with npm 11.6.1** only.
- **Google Chrome**, installed on the machine, for the browser tests. They launch it through Playwright's `chrome` channel, so Playwright does not download a browser. Tested with Chrome 155.
- **Platform.** Tested on **Windows 11**. It has not been run on macOS or Linux. The app itself uses only Node.js built-ins and needs nothing else.

## Install

```
npm ci
```

This installs Playwright from the lockfile. You only need it for the tests; the app has no dependencies.

## Run the dashboard

```
npm start
```

Prints `Live dashboard listening on http://127.0.0.1:4181`. Open that address in a browser. The server listens on the loopback interface only.

To use another port, set `LD_PORT` for the server and for the terminal controls below:

```
# PowerShell
$env:LD_PORT = 4200; npm start

# bash / zsh
LD_PORT=4200 npm start
```

### Routes

| Route | What it does |
|---|---|
| `GET /` | the dashboard page |
| `GET /events` | the SSE stream (`text/event-stream`) |
| `GET /health` | `{ok, clients, lastId}` |
| `POST /emit` | body `{"count": 1..20}` (default 1) sends that many sample events |
| `POST /admin/drop` | ends every open stream but keeps the server running |

`/emit` and `/admin/drop` are demo controls and have no authentication. That is acceptable only because the server listens on loopback. Do not expose this server to a network.

## Reproduce the demo

Start the server (`npm start`), open `http://127.0.0.1:4181/`, and run the commands below in a second terminal. The badge reads **Connected** and the counter reads 0.

**1. Send three events.**

```
npm run ld:emit -- 3
```

```
sent #1  Orders = 12 per min
sent #2  Visitors = 340 online
sent #3  Errors = 0 per min
```

The three tiles update, the counter reads 3, and the log lists the events newest first. The page does not reload. The log keeps the five newest lines while the counter keeps counting.

**2. Drop the connection and catch up.**

```
npm run ld:drop
npm run ld:emit -- 2
```

`ld:drop` prints `dropped 1 connection; the server is still running` and the badge changes to **Reconnecting…**. Send the two events within a few seconds. The server asks the browser to wait 5 seconds before it reconnects (`retry: 5000`), so the two events are sent while nobody is connected. When the page reconnects, it receives both missed events, once each and in order (#4 and #5).

**3. Stay away too long.** Wait for **Connected**, then:

```
npm run ld:drop
npm run ld:emit -- 120
```

Send the 120 events before the page reconnects. The server keeps only the newest 100, so the page shows

> Missed events #6 to #25: too old to replay.

and then receives events #26 to #125. The counter reflects only what the page received.

**4. Restart the server.** Stop it with Ctrl+C and run `npm start` again. The page shows **Reconnecting…**, then **Connected**, and a notice:

> The server restarted: its numbering began again, so earlier events are not shown.

The counter keeps its value. The next `npm run ld:emit` reports `sent #1  Orders = 12 per min`, because numbering starts again after a restart.

**5. Build step 1 on its own.**

```
npm run ld:stage1
curl -N http://127.0.0.1:4181/
```

prints `id: 1`, `data: tick 1`, then one more message each second. (Stage 1 listens on `LD_PORT` like the rest, but its start-up message always says 4181.)

You can also watch the full stream: `curl -N http://127.0.0.1:4181/events`.

## Test

```
npm test
```

Runs 34 tests in about ten seconds and ends with `34 passed, 0 failed`. They cover:

- `stage1.test.mjs` (3): content type, numbered ticks, the timer stops when the client goes away.
- `server.test.mjs` (18): headers, event payloads, fan-out to every client, replay on reconnect, rejected requests, dropping and stopping, loopback-only binding, and the emit and drop commands.
- `replay-contract.test.mjs` (5): the replay window, its edge, ids from a previous run, a fresh page, a reconnect with nothing missed.
- `dashboard.test.mjs` (8): the page in real Chrome: live updates, one tile per event, reconnect, restart, the gap notice, and a **Disconnected** badge when `/events` is not a valid stream.

### Prove that the tests can fail

```
npm run ld:prove-failure
```

Runs the stream test against a temporary copy of the server that leaves out the blank line that ends each SSE message. A browser would wait forever for the end of such a message. The command exits 0 only if the test fails, and prints `The tests caught the fault.` This shows that one test can detect that fault. It does not show that the whole suite catches every fault.

## The replay contract

Each event has an id of the form `<run>.<sequence>`. `<run>` is six random hex characters chosen when the server starts, so a restarted server has a new run id. The browser sends the last id it saw as `Last-Event-ID` when it reconnects.

| A client connects with | The server sends |
|---|---|
| no `Last-Event-ID` (a new or reloaded page) | no history, only new events |
| the same run, nothing missed | nothing extra |
| the same run, missed events still held | the missed events, in order, once each |
| the same run, some missed events already evicted | a `gap` message `{from, to}`, then the events still held |
| an id from another run, or in another format | a `reset` message `{reason: "restart"}`, then every event this run holds |

History is kept in memory only: the newest 100 events. A restart empties it. The full contract, including what is not promised, is in [`CONTRACT.md`](scenarios/live-dashboard-no-refresh/app/CONTRACT.md), which states that each of its statements is covered by `replay-contract.test.mjs`, `server.test.mjs` or `dashboard.test.mjs`.

## Known limitations

- **In memory only.** History is the newest 100 events and a restart loses it. There is no persistence and one server only.
- **No delivery guarantee** to a client that is not connected when an event happens, beyond that 100-event window, and none across a restart.
- **A late page starts at zero.** A page that loads after events happened does not see them.
- **Demo controls are unauthenticated.** See the routes section.
- **Synthetic data.** The nine sample events in `events.mjs` repeat in a fixed order. There is no real metrics source.
- **Not deployment tested.** Nothing here was run behind a proxy or on a network. Two known concerns, taken from their documentation and not exercised by these tests: when not used over HTTP/2, SSE is limited by browsers to a small number of open connections per browser and site, which MDN gives as 6 ([MDN: Using server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)); and nginx buffers proxied responses by default (`proxy_buffering on`) and passes them on immediately only when buffering is off, so a proxy like that can hold SSE messages back ([nginx `proxy_buffering`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)).
- **Small quirks, left as they are:** `emit` with a number above 20 is split into several requests of at most 20, and with a non-numeric argument (for example `abc`) it sends one event. Counts below 1 or fractional counts are rejected.
- **The tests show behaviour, not quality.** They do not measure performance or load, and they say nothing about the video.
- **Platforms.** Only Windows 11 with Node 24.11.0 and Chrome 155 was tested.

## Node.js shutdown and an open stream: a small test server

A small Node.js test server that shows what the video "You Closed Your Node.js Server. Why Is the Process Still Running?" tests: what `server.close()` does while a Server-Sent Events (SSE) stream is still open, and what happens when the response is ended first. It is a teaching example, not production software.

**What this is, and is not.** This is the test server only. The figures in the video (for example the 15-second wait in Measurement A and the milliseconds in Measurement B) come from recorded runs of a separate measurement harness that is not in this repository. You can reproduce the two sequences and see the same behaviour, but your timings will differ and will not match the video's numbers exactly.

### What is in this folder

```
scenarios/node-shutdown-sse/
  app/server.mjs            the test server: SSE stream and the two shutdown sequences
  tests/server.test.mjs     7 tests, Node.js only
```

The `// >>> name` and `// <<<` comments in `server.mjs` mark the two code excerpts shown in the video (`close-only` and `end-then-close`). They have no effect on behaviour.

### Prerequisites

- **Node.js.** The server and tests use only Node.js built-ins; nothing to install. Tested on **Node.js 24.11.0**.
- **curl**, to talk to the server (on Windows PowerShell use `curl.exe`, as in the video).
- **Platform.** Tested on **Windows 11**. It has not been run on macOS or Linux.

### Run it

The server listens on `127.0.0.1:4182` (set `PORT` to change it). It has four routes: `GET /` (a static page), `GET /events` (the SSE stream: a retry hint of 2000 ms, then a tick every 500 ms), `GET /health`, and `POST /admin/shutdown?strategy=close-only|end-then-close`.

You need three terminals.

**Sequence A: `close()` with the stream open**

1. Terminal 1: `node scenarios/node-shutdown-sse/app/server.mjs`
2. Terminal 2, leave it running: `curl -N localhost:4182/events` (PowerShell: `curl.exe -N localhost:4182/events`). Ticks keep arriving.
3. Terminal 3: `curl -X POST "localhost:4182/admin/shutdown?strategy=close-only"` (PowerShell: `curl.exe -X POST "localhost:4182/admin/shutdown?strategy=close-only"`).

The server replies `{"closing":true,"strategy":"close-only"}` and prints, in terminal 1, that shutdown was requested and that `server.close()` was called with `listening: false`. While the stream in terminal 2 stays open, it does not print `close callback fired`, and the ticks in terminal 2 keep coming. (In the video's runs the callback did not fire within 15 seconds; that is a timeout, not a measure of how long it would wait.) Stop the server with Ctrl+C.

**Sequence B: end the response, wait, then `close()`**

Start the server again and open the stream as before, then send the request with `strategy=end-then-close`. The server ends the open response, waits for its `finish` and `close` events, then calls `server.close()`. Terminal 1 prints `close callback fired` a few milliseconds after the request, and the stream in terminal 2 ends.

Neither sequence uses `closeIdleConnections()` or `closeAllConnections()`, and a test checks that the server never calls them.

### Tests

```
node --test scenarios/node-shutdown-sse/tests/server.test.mjs
```

### What was tested, and what was not

Tested: one small server, one Chrome, Node.js 24.11.0 on Windows 11, over loopback, with a 2000 ms retry hint, three valid runs of each sequence in the video. Not tested: other browsers, other Node.js versions, proxies, a 5000 ms retry hint, Ctrl+C, or other shutdown sequences. These results do not establish which step is the cause of the difference between A and B.

## Logo and brand assets

The VortexCones logo and other brand assets are deliberately not included in this repository. Nothing here grants any right to use them, and the MIT licence below does not apply to them. Their licensing is decided separately.

## Licence

The code and documentation in this repository are released under the [MIT licence](LICENSE). The only dependency is Playwright (Apache-2.0), used for the tests and not included here.
