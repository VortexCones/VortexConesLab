// A plausible quick solution, written for this demo on purpose (not the output of any tool that is being tested). It passes every visible test and misses edge cases.
export function parseDuration(text) {
  const units = { d: 86400, h: 3600, m: 60, s: 1 };
  const found = [...text.matchAll(/(\d+)([dhms])/g)];
  if (!found.length) throw new RangeError('invalid duration');
  return found.reduce((sum, [, n, u]) => sum + Number(n) * units[u], 0);
}
