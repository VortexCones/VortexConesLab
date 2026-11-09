# Task 2: make a URL slug

Edit `solution.mjs` so that `slugify(text, options)` turns a title into a URL slug.

- Lower case. Accented letters lose their accents (`é` becomes `e`). Every run of characters that is not a letter or a digit (after that) becomes one `-`. No `-` at the start or the end.
- `options.maxLength` (optional, a positive integer) limits the length of the result. When the slug is longer, cut it at the last `-` that fits so that no word is cut in half; if the first word alone is longer than the limit, cut that word at the limit. The result never ends with `-`.
- `slugify('')` returns `''`.
- Run `node --test visible.test.mjs` to check your work. Do not edit the test files.
