// Build step 1: the smallest working Server-Sent Events server. It sends one message every second.
// Run it with `node scenarios/live-dashboard-no-refresh/app/stage1.mjs` and watch it with `curl -N`.
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

// >>> stage1
export function start(port = 4181) {
  let id = 0;
  return createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    });
    const timer = setInterval(() => {
      res.write(`id: ${++id}\n` +
                `data: tick ${id}\n\n`);
    }, 1000);
    req.on('close', () => clearInterval(timer));
  }).listen(port, '127.0.0.1');
}
// <<<

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  start(Number(process.env.LD_PORT || 4181));
  console.log('stage 1 listening on http://127.0.0.1:4181');
}
