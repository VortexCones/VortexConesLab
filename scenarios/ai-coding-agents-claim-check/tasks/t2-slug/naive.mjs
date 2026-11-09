// A plausible quick solution, written for this demo on purpose (not the output of any tool that is being tested). It passes every visible test and misses edge cases.
export function slugify(text, { maxLength } = {}) {
  const slug = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return maxLength ? slug.slice(0, maxLength).replace(/-+$/, '') : slug;
}
