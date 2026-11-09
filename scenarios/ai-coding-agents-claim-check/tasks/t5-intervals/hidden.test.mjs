import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIntervals } from './solution.mjs';

test('unsorted input is sorted', () => assert.deepEqual(mergeIntervals([[8, 10], [1, 3], [2, 6]]), [[1, 6], [8, 10]]));
test('a range inside another disappears', () => assert.deepEqual(mergeIntervals([[1, 10], [2, 3], [4, 5]]), [[1, 10]]));
test('a chain of overlaps becomes one range', () => assert.deepEqual(mergeIntervals([[1, 2], [2, 3], [3, 4], [4, 5]]), [[1, 5]]));
test('zero-length ranges are allowed and merge when touching', () => {
  assert.deepEqual(mergeIntervals([[2, 2]]), [[2, 2]]);
  assert.deepEqual(mergeIntervals([[1, 2], [2, 2]]), [[1, 2]]);
  assert.deepEqual(mergeIntervals([[1, 1], [3, 3]]), [[1, 1], [3, 3]]);
});
test('negative numbers and decimals', () => assert.deepEqual(mergeIntervals([[-5, -1], [-2, 0.5], [0.5, 1]]), [[-5, 1]]));
test('the input is not changed', () => {
  const input = [[5, 8], [1, 6]];
  const copy = JSON.parse(JSON.stringify(input));
  const out = mergeIntervals(input);
  assert.deepEqual(input, copy);
  assert.notEqual(out[0], input[0]);
});
test('equal starts keep the larger end', () => assert.deepEqual(mergeIntervals([[1, 4], [1, 9], [1, 2]]), [[1, 9]]));
test('a reversed range anywhere throws', () => assert.throws(() => mergeIntervals([[1, 2], [9, 3]]), RangeError));
