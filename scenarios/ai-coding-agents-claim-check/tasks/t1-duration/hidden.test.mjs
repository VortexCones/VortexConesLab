import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration } from './solution.mjs';

const bad = (s) => assert.throws(() => parseDuration(s), { name: 'RangeError', message: 'invalid duration' }, JSON.stringify(s));
test('zero is allowed', () => assert.equal(parseDuration('0s'), 0));
test('a repeated unit is invalid', () => { bad('1h1h'); bad('5s5s'); });
test('out-of-order units are invalid', () => { bad('30m1h'); bad('1s1d'); });
test('fractions, negatives, spaces and capitals are invalid', () => { bad('1.5h'); bad('-5s'); bad('1h 30m'); bad('1H'); bad('+5s'); });
test('a number without a unit, or a unit without a number, is invalid', () => { bad('90'); bad('h'); bad('1hm'); });
test('large values do not overflow', () => assert.equal(parseDuration('100000d'), 8640000000));
