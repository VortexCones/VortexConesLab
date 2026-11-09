import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeIntervals } from './solution.mjs';

test('overlapping ranges merge', () => assert.deepEqual(mergeIntervals([[1, 3], [2, 6], [8, 10]]), [[1, 6], [8, 10]]));
test('touching ranges merge', () => assert.deepEqual(mergeIntervals([[1, 3], [3, 5]]), [[1, 5]]));
test('an empty array', () => assert.deepEqual(mergeIntervals([]), []));
test('a reversed range throws', () => assert.throws(() => mergeIntervals([[5, 1]]), RangeError));
