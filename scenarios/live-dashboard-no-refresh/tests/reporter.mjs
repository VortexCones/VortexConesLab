// Plain-ASCII test reporter for the recorded terminal (the default one prints glyphs the console font
// may not have). One line per test, a failure message when something breaks, and a summary line.
// Used by `npm test` (the `ld:test` script); the exit code is still decided by node:test itself.
export default async function* reporter(source) {
  let passed = 0;
  let failed = 0;
  for await (const { type, data } of source) {
    if (type !== 'test:pass' && type !== 'test:fail') continue;
    if (data.details?.type === 'suite') continue; // describe() blocks are not tests
    // The recorded terminal is about 58 columns wide, so keep every line inside that.
    const name = data.name.length > 50 ? `${data.name.slice(0, 47)}...` : data.name;
    if (type === 'test:pass') { passed++; yield `PASS  ${name}\n`; }
    else {
      failed++;
      yield `FAIL  ${name}\n`;
      const message = String(data.details?.error?.cause?.message ?? data.details?.error?.message ?? '').split('\n')[0];
      if (message) yield `      ${message.length > 50 ? `${message.slice(0, 47)}...` : message}\n`;
    }
  }
  yield `\n${passed} passed, ${failed} failed\n`;
}
