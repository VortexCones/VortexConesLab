const UNITS = [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]];
export function parseDuration(text) {
  const m = typeof text === 'string' ? /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(text) : null;
  if (!m || text === '') throw new RangeError('invalid duration');
  return UNITS.reduce((sum, [, secs], i) => sum + (m[i + 1] ? Number(m[i + 1]) * secs : 0), 0);
}
