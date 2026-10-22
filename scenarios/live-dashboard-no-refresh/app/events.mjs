// Synthetic sample data only. The sequence is fixed, so every run (and every test) sees the same events.
// Three metrics take turns, so each tile on the dashboard changes visibly every third event.
export const FIXTURES = [
  { metric: 'orders', label: 'Orders', value: 12, unit: 'per min' },
  { metric: 'visitors', label: 'Visitors', value: 340, unit: 'online' },
  { metric: 'errors', label: 'Errors', value: 0, unit: 'per min' },
  { metric: 'orders', label: 'Orders', value: 14, unit: 'per min' },
  { metric: 'visitors', label: 'Visitors', value: 352, unit: 'online' },
  { metric: 'errors', label: 'Errors', value: 1, unit: 'per min' },
  { metric: 'orders', label: 'Orders', value: 17, unit: 'per min' },
  { metric: 'visitors', label: 'Visitors', value: 361, unit: 'online' },
  { metric: 'errors', label: 'Errors', value: 0, unit: 'per min' },
];

// The n-th event (n starts at 1) is always the same payload.
export const fixtureFor = (seq) => ({ seq, ...FIXTURES[(seq - 1) % FIXTURES.length] });
