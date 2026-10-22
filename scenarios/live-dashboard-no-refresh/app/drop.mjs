// Terminal control for the demo: cut every open stream while the server keeps running.
// Usage: node scenarios/live-dashboard-no-refresh/app/drop.mjs
const port = process.env.LD_PORT || 4181;
const url = `http://127.0.0.1:${port}/admin/drop`;

let res;
try {
  res = await fetch(url, { method: 'POST' });
} catch {
  console.error(`Cannot reach the server at ${url}. Is it running? Start it with: npm run ld:app`);
  process.exit(1);
}
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Server rejected the request (${res.status}): ${body.error ?? 'unknown error'}`);
  process.exit(1);
}
console.log(`dropped ${body.dropped} connection${body.dropped === 1 ? '' : 's'}; the server is still running`);
