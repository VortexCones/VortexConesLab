# Task 4: split one CSV line

Edit `solution.mjs` so that `parseCsvLine(line)` splits one line of comma-separated values into an array of strings.

- Fields are separated by commas. Spaces are kept as they are (no trimming).
- A field that starts with a double quote is quoted: it ends at the next double quote that is not doubled. Inside a quoted field, commas are ordinary characters and two double quotes in a row mean one double quote.
- A double quote in the middle of an unquoted field is an ordinary character.
- An empty line gives `['']`. A trailing comma gives a trailing empty field.
- A quoted field that never closes, or one followed by anything other than a comma or the end of the line, throws a `SyntaxError`.
- The line has no line breaks. Do not use a CSV library.
- Run `node --test visible.test.mjs` to check your work. Do not edit the test files.
