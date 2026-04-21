# 99Tech Code Challenge — Backend Developer Submission

Solutions for the 99Tech Code Challenge, targeting the **Backend Developer** role.
Problems attempted: **4, 5, 6** (as indicated for the Backend/Full-Stack track).

## Problems

| # | Title | Folder | Stack |
|---|---|---|---|
| 4 | Three ways to sum to n | [`src/problem4/`](./src/problem4/) | TypeScript |
| 5 | A Crude Server | [`src/problem5/`](./src/problem5/) | Express.js + TypeScript + DB |
| 6 | Architecture | [`src/problem6/`](./src/problem6/) | Specification + Diagram |

Each problem folder contains its own `README.md` with run instructions and notes.

## Repository Layout

```
src/
├── problem4/   # Three ways to sum to n
├── problem5/   # CRUD server with Express + TypeScript
└── problem6/   # Scoreboard module architecture spec
```

Each `problem*/` folder is a self-contained project with its own `package.json`
and toolchain. The problems share no code (Problem 6 is a specification
document with no code at all), so a workspace setup — npm/pnpm workspaces,
Turborepo, Nx — would impose shared tooling without eliminating any
duplication, at the cost of making each folder less approachable in isolation.
The chosen layout lets a reviewer `cd` into any problem and `npm install &&
npm test` without first understanding workspace plumbing.

Folders `problem1/`, `problem2/`, `problem3/` are part of the original
skeleton for the Frontend track and are intentionally left untouched.

## Author

Submission prepared by the candidate for the 99Tech Backend Developer position.
