# Visible tests versus hidden tests: a small check you can run

This folder is the "our check" step of the VortexCones video **Do AI Coding Tools Make Developers Faster?**

It needs only [Node.js](https://nodejs.org/) (version 20 or newer). No packages, no network, no account, no AI tool.

## What it does

There are five small programming tasks (`tasks/t1-duration` to `tasks/t5-intervals`). Each task folder has:

| File | What it is |
|---|---|
| `TASK.md` | The brief, in plain English |
| `stub.mjs` | An empty starting point (it fails the tests) |
| `visible.test.mjs` | The tests the person writing the solution can see |
| `hidden.test.mjs` | Edge-case tests that were kept back |
| `naive.mjs` | A **quick** solution, the kind a hurried person writes |
| `reference.mjs` | A **careful** solution |

`run-demo.mjs` runs the quick and the careful solution of every task against both sets of tests and prints the counts.

```
node run-demo.mjs
```

Result when we ran it (see `demo-results.json`):

- all 5 quick solutions pass every visible test;
- all 5 fail at least one hidden test, 13 hidden tests missed out of 39;
- all 5 careful solutions pass everything.

`node check-tasks.mjs` proves the tasks themselves are sound: each stub fails the visible tests, and each careful solution passes both sets.

## What this is, and is not

- The quick solutions were **written for this video, on purpose**, to look plausible and to miss edge cases. They are **not results from any AI tool that we tested**, and nothing here says that any tool makes these mistakes.
- The tasks, the solutions and the tests were prepared by the VortexCones team **with the help of an AI assistant**, like the rest of the video's preparation. The narration is an AI-generated voice.
- We chose and wrote the tasks and the hidden tests so that the point would show. It is an **illustration**, not a measurement of any tool or of how often anyone makes such mistakes.
- The point is the gap between "passes the tests I can see" and "is correct". Studies cited in the video describe that gap as extra checking and review work.

## The studies and the evidence

The video lists every source in its description, with a note on which ones we read in full and which only through an abstract. This folder contains only the small check.

## Contact

If you find a mistake in a task, a test or a number, tell us which one: <https://www.vortexcones.com/>

## Licence

MIT, see `LICENSE`. Use it, change it, share it.
