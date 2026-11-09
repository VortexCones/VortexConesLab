import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './solution.mjs';

test('punctuation and capitals', () => assert.equal(slugify('Hello, World!'), 'hello-world'));
test('accents and surrounding spaces', () => assert.equal(slugify('  Crème Brûlée  '), 'creme-brulee'));
test('an empty string', () => assert.equal(slugify(''), ''));
test('a maximum length cuts at a word boundary', () => assert.equal(slugify('one two three', { maxLength: 7 }), 'one-two'));
