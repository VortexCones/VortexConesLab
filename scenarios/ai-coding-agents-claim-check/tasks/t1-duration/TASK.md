# Task 1: parse a duration

Edit `solution.mjs` so that `parseDuration(text)` returns the number of seconds in a duration written like `1d2h3m4s`.

- Units are `d` (86400 s), `h` (3600 s), `m` (60 s) and `s` (1 s). Lower case only.
- Units must appear in that order (days, hours, minutes, seconds), each at most once, each with a whole number in front of it. Any subset is allowed: `90s`, `1h30m`, `2d`.
- Anything else throws a `RangeError` with the message `invalid duration`: an empty string, a negative or fractional number, a repeated or out-of-order unit, a missing unit, spaces, upper case.
- Run `node --test visible.test.mjs` to check your work. Do not edit the test files.
