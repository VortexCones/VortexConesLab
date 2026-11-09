import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvLine } from './solution.mjs';

test('empty fields and a trailing comma', () => {
  assert.deepEqual(parseCsvLine(','), ['', '']);
  assert.deepEqual(parseCsvLine('a,,b'), ['a', '', 'b']);
  assert.deepEqual(parseCsvLine('a,b,'), ['a', 'b', '']);
});
test('spaces are kept', () => assert.deepEqual(parseCsvLine(' a , b '), [' a ', ' b ']));
test('an empty quoted field', () => { assert.deepEqual(parseCsvLine('""'), ['']); assert.deepEqual(parseCsvLine('"",x'), ['', 'x']); });
test('a quote in the middle of an unquoted field is ordinary', () => assert.deepEqual(parseCsvLine('a"b,c'), ['a"b', 'c']));
test('a quoted field that never closes throws', () => { assert.throws(() => parseCsvLine('"abc'), SyntaxError); assert.throws(() => parseCsvLine('a,"b'), SyntaxError); });
test('text after a closing quote throws', () => assert.throws(() => parseCsvLine('"ab"c,d'), SyntaxError));
test('a quoted field at the end after a trailing comma', () => assert.deepEqual(parseCsvLine('a,"b"'), ['a', 'b']));
test('a quoted field with only a doubled quote', () => assert.deepEqual(parseCsvLine('""""'), ['"']));
test('quoted fields keep inner spaces and commas', () => assert.deepEqual(parseCsvLine('" a, b ",c'), [' a, b ', 'c']));
