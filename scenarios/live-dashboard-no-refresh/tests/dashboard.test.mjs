// Browser tests for the live dashboard (real Chrome via Playwright). Run: npm run ld:test
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startApp, startAppOn, until } from './helpers.mjs';

const WAIT = 8000; // upper bound for any single browser-side condition
const RECOVER_BOUND = 10000; // recovery must be well inside this
// The demo uses a 5 s retry hint; tests use a short one so they stay fast. (The 5 s default is checked in server.test.mjs.)
const FAST = { retryMs: 400 };

let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });

async function openDashboard(base) {
  const page = await browser.newPage();
  await page.goto(base, { timeout: WAIT });
  return page;
}
const waitState = (page, wanted, timeout = WAIT) =>
  page.waitForFunction((s) => document.getElementById('status').dataset.state === s, wanted, { timeout });
const waitCount = (page, n, timeout = WAIT) =>
  page.waitForFunction((c) => document.getElementById('count').textContent === String(c), n, { timeout });
const tiles = (page) => page.evaluate(() => Object.fromEntries(['orders', 'visitors', 'errors'].map((m) => [m, document.querySelector(`#tile-${m} .value`).textContent])));
const logLines = (page) => page.locator('#log li').allTextContents();

// Emit only once the browser's stream is attached: events sent earlier would be missed by design.
async function connected(app, page) {
  await waitState(page, 'connected');
  await until(() => app.clientCount === 1, 'the server to see the dashboard stream');
}

describe('dashboard', () => {
  test('starts connected, with a zero counter and zero tiles', async () => {
    const { app, base } = await startApp(FAST);
    const page = await openDashboard(base);
    try {
      await connected(app, page);
      assert.equal(await page.locator('#status').textContent(), 'Connected');
      assert.equal(await page.locator('#count').textContent(), '0');
      assert.deepEqual(await tiles(page), { orders: '0', visitors: '0', errors: '0' });
    } finally { await page.close(); await app.stop(); }
  });

  test('events update the tiles, counter and log live, without a page reload', async () => {
    const { app, base } = await startApp(FAST);
    const page = await openDashboard(base);
    try {
      await connected(app, page);
      await page.evaluate(() => { window.__sameDocument = true; }); // a reload would wipe this
      app.emit(3);
      await waitCount(page, 3);
      assert.deepEqual(await tiles(page), { orders: '12', visitors: '340', errors: '0' });
      assert.deepEqual(await logLines(page), ['#3  Errors = 0', '#2  Visitors = 340', '#1  Orders = 12']);
      assert.equal(await page.evaluate(() => window.__sameDocument), true, 'the page must not have reloaded');
    } finally { await page.close(); await app.stop(); }
  });

  test('a new event changes only its own tile', async () => {
    const { app, base } = await startApp(FAST);
    const page = await openDashboard(base);
    try {
      await connected(app, page);
      app.emit(4); // the fourth event is Orders = 14
      await waitCount(page, 4);
      assert.deepEqual(await tiles(page), { orders: '14', visitors: '340', errors: '0' });
    } finally { await page.close(); await app.stop(); }
  });

  test('keeps only the five newest log lines while the counter keeps counting', async () => {
    const { app, base } = await startApp(FAST);
    const page = await openDashboard(base);
    try {
      await connected(app, page);
      app.emit(8);
      await waitCount(page, 8);
      const lines = await logLines(page);
      assert.equal(lines.length, 5);
      assert.equal(lines[0], '#8  Visitors = 361'); // the eighth fixture
    } finally { await page.close(); await app.stop(); }
  });

  test('after a dropped connection it reconnects by itself and receives the events it missed, once and in order', async () => {
    const { app, base } = await startApp(FAST);
    const page = await openDashboard(base);
    try {
      await connected(app, page);
      app.emit(2);
      await waitCount(page, 2);

      app.dropClients(); // the connection breaks; the server keeps running
      await waitState(page, 'reconnecting', RECOVER_BOUND);
      assert.equal(await page.locator('#status').textContent(), 'Reconnecting…');
      app.emit(2); // two events happen while the dashboard is disconnected

      await waitState(page, 'connected', RECOVER_BOUND);
      await waitCount(page, 4, RECOVER_BOUND); // both missed events arrive after the reconnect
      assert.deepEqual(await logLines(page), ['#4  Orders = 14', '#3  Errors = 0', '#2  Visitors = 340', '#1  Orders = 12']);
      assert.deepEqual(await tiles(page), { orders: '14', visitors: '340', errors: '0' });
    } finally { await page.close(); await app.stop(); }
  });

  test('after a server restart it reconnects, keeps its counter, and numbering starts again', async () => {
    const first = await startApp(FAST);
    const { port } = first;
    const page = await openDashboard(first.base);
    let second;
    try {
      await connected(first.app, page);
      first.app.emit(2);
      await waitCount(page, 2);

      await first.app.stop(); // the server goes away
      await waitState(page, 'reconnecting', RECOVER_BOUND);
      assert.equal(await page.locator('#count').textContent(), '2', 'the page keeps what it already received');

      second = await startAppOn(port, FAST); // a new server on the same port
      await waitState(page, 'connected', RECOVER_BOUND);
      await until(() => second.app.clientCount === 1, 'the restarted server to see the reconnected stream');
      second.app.emit(1);
      await waitCount(page, 3);
      assert.equal(await page.locator('#log li').first().textContent(), '#1  Orders = 12'); // history was in memory, so ids restart
      assert.match(await page.locator('#notice').textContent(), /server restarted/i); // and the page says so
    } finally { await page.close(); await first.app.stop(); await second?.app.stop(); }
  });

  test('when it was away too long, the page says which events are gone instead of hiding the gap', async () => {
    const { app, base } = await startApp(FAST);
    const page = await openDashboard(base);
    try {
      await connected(app, page);
      assert.equal(await page.locator('#notice').isHidden(), true, 'no notice while nothing is wrong');
      app.emit(2);
      await waitCount(page, 2);
      app.dropClients();
      await waitState(page, 'reconnecting', RECOVER_BOUND);
      app.emit(20); app.emit(20); app.emit(20); app.emit(20); app.emit(20); app.emit(20); // 122 events in total: #1..#22 fall out of the 100 kept
      await waitState(page, 'connected', RECOVER_BOUND);
      await waitCount(page, 102, RECOVER_BOUND); // 2 seen + #23..#122 replayed
      assert.equal(await page.locator('#notice').textContent(), 'Missed events #3 to #22: too old to replay.');
    } finally { await page.close(); await app.stop(); }
  });

  test('shows Disconnected, not a hang, when /events is not a valid event stream', async () => {
    const { app, base } = await startApp(FAST);
    const page = await browser.newPage();
    try {
      await page.route('**/events', (route) => route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }));
      await page.goto(base, { timeout: WAIT });
      await waitState(page, 'disconnected');
      assert.equal(await page.locator('#status').textContent(), 'Disconnected');
    } finally { await page.close(); await app.stop(); }
  });
});
