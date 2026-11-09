// A plausible quick solution, written for this demo on purpose (not the output of any tool that is being tested). It passes every visible test and misses edge cases.
export class LRUCache {
  constructor(capacity) {
    if (capacity < 1) throw new RangeError('capacity must be at least 1');
    this.capacity = capacity;
    this.map = new Map();
  }
  get size() { return this.map.size; }
  has(key) { return this.get(key) !== undefined; }
  keys() { return [...this.map.keys()]; }
  get(key) {
    const value = this.map.get(key);
    if (!value) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) this.map.delete(this.map.keys().next().value);
    this.map.set(key, value);
    return this;
  }
}
