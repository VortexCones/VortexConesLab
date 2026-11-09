import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LRUCache } from './solution.mjs';

test('stores and returns values', () => {
  const c = new LRUCache(2);
  c.set('a', 1);
  assert.equal(c.get('a'), 1);
  assert.equal(c.get('zzz'), undefined);
});
test('evicts the least recently used entry when full', () => {
  const c = new LRUCache(2);
  c.set('a', 1); c.set('b', 2); c.set('c', 3);
  assert.equal(c.has('a'), false);
  assert.deepEqual(c.keys(), ['b', 'c']);
});
test('a get refreshes the entry', () => {
  const c = new LRUCache(2);
  c.set('a', 1); c.set('b', 2); c.get('a'); c.set('c', 3);
  assert.deepEqual(c.keys(), ['a', 'c']);
});
test('a bad capacity throws', () => assert.throws(() => new LRUCache(0), RangeError));
