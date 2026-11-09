export function mergeIntervals(intervals) {
  for (const [s, e] of intervals) if (s > e) throw new RangeError('start is after end');
  const sorted = intervals.map(([s, e]) => [s, e]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [];
  for (const [s, e] of sorted) {
    const last = out.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}
