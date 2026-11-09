import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LRUCache } from './solution.mjs';

test('updating an existing key replaces the value and evicts nothing', () => {
  const c = new LRUCache(2);
  c.set('a', 1); c.set('b', 2); c.set('a', 10);
  assert.equal(c.size, 2);
  assert.equal(c.get('a'), 10);
  assert.deepEqual(c.keys(), ['b', 'a']);
});
test('updating makes the key the most recently used', () => {
  const c = new LRUCache(2);
  c.set('a', 1); c.set('b', 2); c.set('a', 3); c.set('c', 4);
  assert.deepEqual(c.keys(), ['a', 'c']);
});
test('has does not change the order', () => {
  const c = new LRUCache(2);
  c.set('a', 1); c.set('b', 2); c.has('a'); c.set('c', 3);
  assert.deepEqual(c.keys(), ['b', 'c']);
});
test('falsy values are real values', () => {
  const c = new LRUCache(2);
  c.set('z', 0); c.set('n', null);
  assert.equal(c.get('z'), 0);
  assert.equal(c.get('n'), null);
  assert.equal(c.has('z'), true);
});
test('capacity one', () => {
  const c = new LRUCache(1);
  c.set('a', 1); c.set('b', 2);
  assert.deepEqual(c.keys(), ['b']);
  assert.equal(c.size, 1);
});
test('capacity must be a whole number of at least 1', () => {
  for (const bad of [0, -1, 1.5, NaN, '2', undefined]) assert.throws(() => new LRUCache(bad), RangeError, String(bad));
});
test('keys can be objects', () => {
  const k = {}; const c = new LRUCache(2);
  c.set(k, 'x');
  assert.equal(c.get(k), 'x');
  assert.equal(c.get({}), undefined);
});
