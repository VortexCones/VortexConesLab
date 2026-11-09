# Task 3: a small LRU cache

Edit `solution.mjs` so that `LRUCache` is a cache that forgets the least recently used entry when it is full.

- `new LRUCache(capacity)`: `capacity` must be a whole number of at least 1, otherwise throw a `RangeError`.
- `get(key)` returns the value, or `undefined` if the key is not there. A successful `get` makes that key the most recently used.
- `set(key, value)` stores the value and makes the key the most recently used. If the key already exists its value is replaced and nothing is evicted. If it is a new key and the cache is full, the least recently used entry is removed first.
- `has(key)` says whether the key is there. It does not change the order.
- `size` is the number of entries. `keys()` returns the keys in an array from least recently used to most recently used.
- Keys can be any value (compare as a `Map` does).
- Run `node --test visible.test.mjs` to check your work. Do not edit the test files.
