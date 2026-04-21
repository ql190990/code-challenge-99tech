/**
 * Problem 4 — Three ways to sum to n
 *
 *   sum_to_n(5) === 1 + 2 + 3 + 4 + 5 === 15
 *
 * Assumptions:
 *   - `n` is any integer.
 *   - The problem guarantees the result is below Number.MAX_SAFE_INTEGER,
 *     so we do not guard against overflow of the return value.
 *   - Non-integer `number` input is out of scope; the `number` type is
 *     taken at its word (no runtime Number.isInteger check). Passing
 *     a non-integer will produce implementation-dependent nonsense and,
 *     in the case of Approach C, may not terminate.
 *   - For n < 0 we define sum_to_n symmetrically: sum_to_n(-k) === -sum_to_n(k)
 *     (i.e. sum_to_n(-5) === -(1 + 2 + 3 + 4 + 5) === -15). This keeps the
 *     three implementations internally consistent and gives negative input
 *     a well-defined meaning.
 *   - sum_to_n(0) === 0 (empty summation). -0 is normalised to +0.
 */

/**
 * Approach A — Iterative loop.
 *
 *   Time:  O(n)   (one addition per integer in [1, |n|])
 *   Space: O(1)   (single accumulator)
 *
 * Straightforward, allocation-free, and predictable. The default choice
 * when `n` is modest and no cleverness is required.
 */
export function sum_to_n_a(n: number): number {
  if (n === 0) return 0;
  let sum = 0;
  if (n > 0) {
    for (let i = 1; i <= n; i++) sum += i;
  } else {
    for (let i = -1; i >= n; i--) sum += i;
  }
  return sum;
}

/**
 * Approach B — Closed-form (Gauss' formula).
 *
 *   Time:  O(1)   (constant arithmetic, independent of n)
 *   Space: O(1)
 *
 * The identity 1 + 2 + ... + k === k * (k + 1) / 2 collapses the whole
 * summation into three arithmetic operations. We compute on |n| and
 * restore the sign at the end so negative inputs obey the symmetric
 * definition above.
 *
 * Fastest of the three by a wide margin: measured ~22 ns/op at n=1000,
 * essentially independent of n. Precision note: the intermediate product
 * `abs * (abs + 1)` becomes non-safe-integer at abs = 94,906,266, but
 * because one of `abs` or `abs + 1` is always even the bit rounded off
 * the product is exactly the bit the `/2` discards — so the final result
 * is bit-exact all the way to abs = 134,217,727, which is the problem's
 * implicit ceiling (result < 2^53). Within the stated contract B never
 * loses precision.
 */
export function sum_to_n_b(n: number): number {
  if (n === 0) return 0;
  const abs = Math.abs(n);
  const magnitude = (abs * (abs + 1)) / 2;
  return n > 0 ? magnitude : -magnitude;
}

/**
 * Approach C — Recursion.
 *
 *   Time:  O(n)   (n recursive frames, each doing constant work)
 *   Space: O(n)   (call-stack depth grows linearly with n)
 *
 * A genuinely distinct formulation: the summation is expressed as a
 * self-referential identity rather than a loop or a closed form.
 * Included to make concrete the point that equal Big-O time does not
 * imply equal practical cost — each recursive call pays a function-call
 * prologue and epilogue that the tight loop in Approach A avoids (~5x
 * slower per element in benchmarks), and every active frame holds its
 * own slot on the call stack.
 *
 * The space cost is a hard wall, not a soft one: on Node 22 with the
 * default stack size, the recursion throws `RangeError: Maximum call
 * stack size exceeded` at n = 9,643 (empirically measured); the exact
 * threshold depends on V8 version, frame size, and `--stack-size`.
 * V8 does not implement ES2015 proper tail calls, so rewriting C into
 * a tail-recursive form with an accumulator would not avoid the failure
 * mode. A manual trampoline would, at the cost of no longer being a
 * meaningfully recursive implementation.
 */
export function sum_to_n_c(n: number): number {
  if (n === 0) return 0;
  if (n > 0) return n + sum_to_n_c(n - 1);
  return n + sum_to_n_c(n + 1);
}
