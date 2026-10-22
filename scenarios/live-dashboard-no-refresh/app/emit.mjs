// Terminal control for the demo: send the next N fixture events to the running server.
// Usage: node scenarios/live-dashboard-no-refresh/app/emit.mjs [count]     (count defaults to 1)
// The server accepts at most 20 events per request, so a larger count is sent as several requests, and the result is
// summarised on one line instead of listing every event.
const port = process.env.LD_PORT || 4181;
const count = process.argv[2] === undefined ? 1 : Number(process.argv[2]);
const url = `http://127.0.0.1:${port}/emit`;
const PER_REQUEST = 20;

const sizes = Number.isInteger(count) && count > PER_REQUEST
  ? Array.from({ length: Math.ceil(count / PER_REQUEST) }, (_, i) => Math.min(PER_REQUEST, count - i * PER_REQUEST))
  : [count]; // anything else goes to the server as it is, which says what is wrong with it

const emitted = [];
for (const size of sizes) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: size }) });
  } catch {
    console.error(`Cannot reach the server at ${url}. Is it running? Start it with: npm run ld:app`);
    process.exit(1);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Server rejected the request (${res.status}): ${body.error ?? 'unknown error'}`);
    process.exit(1);
  }
  emitted.push(...body.emitted);
}
if (sizes.length === 1) {
  for (const e of emitted) console.log(`sent #${e.seq}  ${e.label} = ${e.value} ${e.unit}`);
} else {
  console.log(`sent ${emitted.length} events, #${emitted[0].seq} to #${emitted.at(-1).seq}`);
}
