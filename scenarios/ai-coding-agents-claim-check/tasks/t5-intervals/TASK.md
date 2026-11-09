# Task 5: merge overlapping intervals

Edit `solution.mjs` so that `mergeIntervals(intervals)` merges overlapping or touching ranges.

- `intervals` is an array of `[start, end]` pairs of numbers. Return a new array of merged pairs, sorted by start.
- Two ranges that overlap, or that touch (`[1, 3]` and `[3, 5]`), become one (`[1, 5]`).
- A range with `start > end` throws a `RangeError`. A range where `start === end` is allowed.
- An empty array gives an empty array. The input array and its pairs must not be changed.
- Run `node --test visible.test.mjs` to check your work. Do not edit the test files.
