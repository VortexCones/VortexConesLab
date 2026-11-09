export class LRUCache {
  #map = new Map();
  #capacity;
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a whole number of at least 1');
    this.#capacity = capacity;
  }
  get size() { return this.#map.size; }
  has(key) { return this.#map.has(key); }
  keys() { return [...this.#map.keys()]; }
  get(key) {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key);
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }
  set(key, value) {
    if (this.#map.has(key)) this.#map.delete(key);
    else if (this.#map.size >= this.#capacity) this.#map.delete(this.#map.keys().next().value);
    this.#map.set(key, value);
    return this;
  }
}
