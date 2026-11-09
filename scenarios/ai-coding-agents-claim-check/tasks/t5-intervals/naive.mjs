// A plausible quick solution, written for this demo on purpose (not the output of any tool that is being tested). It passes every visible test and misses edge cases.
export function mergeIntervals(intervals) {
  const out = [];
  for (const pair of intervals) {
    if (pair[0] > pair[1]) throw new RangeError('start is after end');
    const last = out.at(-1);
    if (last && pair[0] <= last[1]) last[1] = Math.max(last[1], pair[1]);
    else out.push(pair);
  }
  return out;
}
