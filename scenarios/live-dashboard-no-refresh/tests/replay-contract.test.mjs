// The replay contract: what a reconnecting browser is promised, and what it is told when the promise cannot be kept.
// (See app/CONTRACT.md.) These tests build their Last-Event-ID from ids the server really sent, so they hold for any id format.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSse, post, startApp, startAppOn } from './helpers.mjs';

// Opens a stream, emits `count` events, and returns the ids the server sent (the stream stays open until the test ends).
async function emitAndCollect(base, count, t) {
  const sse = await openSse(base);
  t.after(() => sse.close());
  for (let left = count; left > 0; left -= 20) await post(base, { count: Math.min(20, left) });
  const events = await sse.waitForEvents(count);
  return events.map((e) => e.id);
}

test('replay window overflow: a client that fell too far behind is told which events are gone', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const ids = await emitAndCollect(base, 120, t); // the server keeps only the newest 100
  const back = await openSse(base, { lastEventId: ids[9] }); // the client last saw #10
  t.after(() => back.close());
  const [notice, firstReplayed] = await back.waitForEvents(2);
  assert.equal(notice.event, 'gap');
  assert.deepEqual(notice.json, { from: 11, to: 20 }); // #11..#20 were evicted and cannot be replayed
  assert.equal(firstReplayed.json.seq, 21); // what is still held is replayed, in order
  assert.equal((await back.waitForEvents(101)).at(-1).json.seq, 120); // gap notice + #21..#120
});

test('replay window edge: a client exactly at the oldest kept event gets no gap notice', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const ids = await emitAndCollect(base, 120, t);
  const back = await openSse(base, { lastEventId: ids[19] }); // saw #20; #21 is the oldest event still kept
  t.after(() => back.close());
  const events = await back.waitForEvents(100);
  assert.equal(events[0].json.seq, 21);
  assert.ok(events.every((e) => e.event === 'metric'), 'no gap or reset message');
});

test('ids from a previous server run are detected: the client is told to start over, nothing is silently skipped', async (t) => {
  const first = await startApp();
  const { port } = first;
  const oldIds = await emitAndCollect(first.base, 5, t); // the browser last saw #5 of the old run
  await first.app.stop();

  const second = await startAppOn(port); // restart: numbering begins again at 1
  t.after(() => second.app.stop());
  await post(second.base, { count: 7 }); // seven NEW events happen before the browser reconnects
  const back = await openSse(second.base, { lastEventId: oldIds[4] });
  t.after(() => back.close());
  const events = await back.waitForEvents(8);
  assert.equal(events[0].event, 'reset');
  assert.equal(events[0].json.reason, 'restart');
  assert.deepEqual(events.slice(1).map((e) => e.json.seq), [1, 2, 3, 4, 5, 6, 7]); // the new run's events, none skipped
});

test('a fresh page (no Last-Event-ID) gets no history and no notice, only new events', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  await post(base, { count: 5 });
  const fresh = await openSse(base);
  t.after(() => fresh.close());
  await post(base, { count: 1 });
  const events = await fresh.waitForEvents(1);
  assert.equal(events[0].json.seq, 6);
  assert.equal(fresh.events.length, 1);
});

test('a reconnect with nothing missed gets no notice and no duplicates', async (t) => {
  const { app, base } = await startApp();
  t.after(() => app.stop());
  const ids = await emitAndCollect(base, 3, t);
  const back = await openSse(base, { lastEventId: ids[2] });
  t.after(() => back.close());
  await post(base, { count: 1 });
  const events = await back.waitForEvents(1);
  assert.equal(events[0].json.seq, 4);
  assert.equal(back.events.length, 1);
});
