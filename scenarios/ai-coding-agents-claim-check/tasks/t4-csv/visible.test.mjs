import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvLine } from './solution.mjs';

test('plain fields', () => assert.deepEqual(parseCsvLine('a,b,c'), ['a', 'b', 'c']));
test('a quoted field with a comma', () => assert.deepEqual(parseCsvLine('a,"b,c",d'), ['a', 'b,c', 'd']));
test('doubled quotes', () => assert.deepEqual(parseCsvLine('"say ""hi"""'), ['say "hi"']));
test('an empty line', () => assert.deepEqual(parseCsvLine(''), ['']));
