import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration } from './solution.mjs';

test('seconds, minutes and hours', () => {
  assert.equal(parseDuration('90s'), 90);
  assert.equal(parseDuration('1h30m'), 5400);
});
test('days', () => assert.equal(parseDuration('2d'), 172800));
test('all four units', () => assert.equal(parseDuration('1d2h3m4s'), 93784));
test('an empty string is invalid', () => assert.throws(() => parseDuration(''), { name: 'RangeError', message: 'invalid duration' }));
