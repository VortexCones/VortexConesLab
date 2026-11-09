export function slugify(text, { maxLength } = {}) {
  const slug = String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (maxLength === undefined || slug.length <= maxLength) return slug;
  const cut = slug.slice(0, maxLength + 1).lastIndexOf('-');
  return cut > 0 ? slug.slice(0, cut) : slug.slice(0, maxLength);
}
