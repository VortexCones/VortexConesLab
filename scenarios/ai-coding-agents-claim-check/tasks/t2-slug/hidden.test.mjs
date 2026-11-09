import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './solution.mjs';

test('runs of separators collapse and the ends are trimmed', () => { assert.equal(slugify('---a---b---'), 'a-b'); assert.equal(slugify('a  _  b'), 'a-b'); });
test('digits are kept', () => assert.equal(slugify('Top 10 tips (2026)'), 'top-10-tips-2026'));
test('only symbols gives an empty slug', () => assert.equal(slugify('!!! ???'), ''));
test('maxLength exactly equal to the slug length keeps it whole', () => assert.equal(slugify('one two', { maxLength: 7 }), 'one-two'));
test('maxLength never leaves a trailing dash', () => assert.equal(slugify('one two three', { maxLength: 4 }), 'one'));
test('a first word longer than maxLength is cut at the limit', () => assert.equal(slugify('abcdefghij', { maxLength: 4 }), 'abcd'));
test('maxLength cuts at the last dash that fits', () => assert.equal(slugify('aa bb cc dd', { maxLength: 8 }), 'aa-bb-cc'));
test('maxLength never cuts a word in half', () => assert.equal(slugify('one two three', { maxLength: 9 }), 'one-two'));
test('combining accents on capitals', () => assert.equal(slugify('ÉCOLE Élémentaire'), 'ecole-elementaire'));
