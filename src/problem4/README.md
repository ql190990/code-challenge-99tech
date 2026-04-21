# Problem 4 — Three ways to sum to n

Three distinct TypeScript implementations of `sum_to_n(n: number): number`,
each returning the sum of the integers from `1` to `n` (e.g. `sum_to_n(5) === 15`).

## Complexity summary

| # | Implementation | Technique | Time | Space | Empirical speed (Node 22, x86_64) |
|---|---|---|---|---|---|
| A | `sum_to_n_a` | Iterative `for` loop | `O(n)` | `O(1)` | ~703 ns at n=1 000; ~5.2 ms at n=10⁷. Allocation-free. |
| B | `sum_to_n_b` | Closed form `\|n\|·(\|n\|+1)/2` | `O(1)` | `O(1)` | ~22 ns independent of n. Bit-exact through n = 134 217 727. |
| C | `sum_to_n_c` | Recursion | `O(n)` | `O(n)` stack | ~3.7 µs at n=1 000; throws `RangeError` at n = 9 643 on Node 22's default stack (engine-dependent, typically low tens of thousands). |

Further commentary lives alongside each function in [`sum_to_n.ts`](./sum_to_n.ts).
Of particular note: **Approach B never loses precision within the problem's
contract** — the intermediate product `|n|·(|n|+1)` becomes non-safe-integer
at `|n| = 94 906 266`, but because one of `|n|` and `|n|+1` is always even
the rounded bit is exactly the bit the `/2` discards, so the final result is
bit-exact all the way to the problem's implicit ceiling. This is verified in
the test suite.

## Assumptions

- `n` is any integer. Non-integer `number` values (`NaN`, `Infinity`, `3.7`)
  are out of scope — the three implementations will produce
  implementation-dependent results on them and Approach C may not terminate.
- The problem guarantees the result is below `Number.MAX_SAFE_INTEGER`, so no
  overflow guard is needed on the return value. This implicitly bounds `n` at
  roughly `1.34 × 10⁸`.
- `sum_to_n(0) === 0`; `-0` is normalised to `+0`.
- For negative `n`, the function is defined symmetrically:
  `sum_to_n(-k) === -sum_to_n(k)`, so `sum_to_n(-5) === -15`. All three
  implementations agree on this convention.

## Naming

The problem statement names the three functions `sum_to_n_a/b/c`, so the
submission preserves that `snake_case` spelling despite TypeScript's
`camelCase` convention for functions. Variable names inside each function
follow the TypeScript convention.

## Run

```bash
cd src/problem4
npm install
npm test
```

Expected tail of the output:

```
All three implementations normalise -0 to +0.

All checks passed.
```

`npm run typecheck` runs `tsc --noEmit` for strict type verification without
producing build output.

## Files

- [`sum_to_n.ts`](./sum_to_n.ts) — the three implementations with complexity and precision commentary.
- [`test.ts`](./test.ts) — test runner: basic cases, cross-implementation agreement on `n ∈ [-200, 200]`, precision parity at boundary cases up to the safe-integer ceiling, and `-0` normalisation check.
- `package.json`, `tsconfig.json` — minimal project configuration (TypeScript 5.3 strict, executed via [`tsx`](https://github.com/privatenumber/tsx) — no build step).
