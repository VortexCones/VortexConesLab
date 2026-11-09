// A plausible quick solution, written for this demo on purpose (not the output of any tool that is being tested). It passes every visible test and misses edge cases.
export function parseCsvLine(line) {
  const fields = [];
  let field = '', quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { fields.push(field); field = ''; }
    else field += c;
  }
  fields.push(field);
  return fields;
}
