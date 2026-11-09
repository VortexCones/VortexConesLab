export function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  for (;;) {
    if (line[i] === '"') {
      let value = '';
      i += 1;
      for (;;) {
        if (i >= line.length) throw new SyntaxError('unterminated quoted field');
        if (line[i] === '"') {
          if (line[i + 1] === '"') { value += '"'; i += 2; continue; }
          i += 1;
          break;
        }
        value += line[i++];
      }
      if (i < line.length && line[i] !== ',') throw new SyntaxError('unexpected character after a quoted field');
      fields.push(value);
    } else {
      const end = line.indexOf(',', i);
      fields.push(end === -1 ? line.slice(i) : line.slice(i, end));
      i = end === -1 ? line.length : end;
    }
    if (i >= line.length) return fields;
    i += 1; // the comma
    if (i >= line.length) { fields.push(''); return fields; }
  }
}
