# Replay contract: `GET /events`

What the server promises a browser that reconnects, and what it says when it cannot keep the promise.
Every statement here is covered by `tests/replay-contract.test.mjs`, `tests/server.test.mjs` or `tests/dashboard.test.mjs`.

## Event ids

`id: <run>.<sequence>`, for example `3fa91c.12`.

- `<run>` is six random hex characters chosen when the server starts. A restarted server has a new run id.
- `<sequence>` counts events from 1 within one run.
- The browser stores the last id it saw and sends it back as `Last-Event-ID` when it reconnects.
- The run id exists because sequence numbers alone start again at 1 after a restart. With plain numbers, a stale id such as `5` could silently skip the new server's events 1 to 5.

## History

Kept in memory only. The server holds the newest `REPLAY_LIMIT` (100) events. A restart empties it.

## What a connecting client receives

| Situation | Server behaviour |
|---|---|
| No `Last-Event-ID` (a new or reloaded page) | No history. Only events emitted from now on. |
| Same run, nothing missed | Nothing extra; live events continue. |
| Same run, missed events still held | The missed events, in order, each once. |
| Same run, some missed events already evicted | A `gap` message `{from, to}` naming the lost sequence numbers, then the events still held. |
| Id from another run, or not in this format | A `reset` message `{reason: "restart"}`, then every event this run holds. |

`gap` and `reset` messages carry the current id, so a later reconnect continues from that point.

## What is not promised

- Delivery to a client that is not connected at the moment an event happens, beyond the 100-event window.
- Anything across a restart: events that happened before it are gone.
- That a page loaded late sees past events. The dashboard starts from zero.
- Ordering or delivery guarantees across several servers. There is only one.

## Dashboard behaviour

The page shows a notice when it receives `gap` ("Missed events #a to #b: too old to replay.") or `reset`
("The server restarted: ..."). Its counter and tiles are not recomputed; they reflect only what the page received.

## Why this is the smallest fix

The earlier code replayed `seq > Last-Event-ID` and could not tell a stale id from a valid one, nor an evicted
event from one that never existed. Adding the run id and two notice messages fixes both without a database,
persistence, or a protocol change beyond ordinary SSE fields.
