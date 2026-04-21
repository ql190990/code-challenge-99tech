import { strict as assert } from 'node:assert';
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum_to_n';

type Impl = (n: number) => number;

const implementations: Array<readonly [string, Impl]> = [
  ['sum_to_n_a (iterative)', sum_to_n_a],
  ['sum_to_n_b (formula)', sum_to_n_b],
  ['sum_to_n_c (recursive)', sum_to_n_c],
];
const labelWidth = Math.max(...implementations.map(([label]) => label.length));

const basicCases: Array<readonly [number, number]> = [
  [0, 0],
  [1, 1],
  [5, 15],
  [10, 55],
  [100, 5050],
  [1000, 500500],
  [-1, -1],
  [-5, -15],
  [-100, -5050],
];

let failures = 0;

for (const [label, fn] of implementations) {
  for (const [input, expected] of basicCases) {
    const actual = fn(input);
    const ok = actual === expected;
    if (!ok) failures++;
    const status = ok ? 'PASS' : 'FAIL';
    console.log(
      `[${status}] ${label.padEnd(labelWidth)}  sum_to_n(${input}) = ${actual}  (expected ${expected})`,
    );
  }
}

// Cross-implementation agreement on a wider symmetric range. All three
// must produce the same value everywhere C can reach.
for (let n = -200; n <= 200; n++) {
  const a = sum_to_n_a(n);
  const b = sum_to_n_b(n);
  const c = sum_to_n_c(n);
  assert.equal(a, b, `Approaches A and B disagree at n=${n}: ${a} vs ${b}`);
  assert.equal(a, c, `Approaches A and C disagree at n=${n}: ${a} vs ${c}`);
}
console.log('');
console.log('Cross-implementation agreement verified for n in [-200, 200].');

// Agreement between A and B at and beyond C's stack-overflow threshold, up
// to the problem's implicit result ceiling (n where n*(n+1)/2 < 2^53).
// C is skipped here because it overflows the call stack above ~9,642.
const MAX_EXACT_N = 134_217_727;
const boundaryCases: number[] = [1_000, 9_000, 9_642, 1_000_000, 10_000_000, MAX_EXACT_N];
for (const n of boundaryCases) {
  const a = sum_to_n_a(n);
  const b = sum_to_n_b(n);
  assert.equal(a, b, `Approaches A and B disagree at n=${n}: ${a} vs ${b}`);
}
console.log(
  `Precision parity between A and B verified at boundary cases up to n=${MAX_EXACT_N}.`,
);

// -0 is normalised to +0 by all three implementations.
for (const [label, fn] of implementations) {
  const result = fn(-0);
  assert.equal(Object.is(result, 0), true, `${label}(-0) returned ${result}, not +0`);
}
console.log('All three implementations normalise -0 to +0.');

console.log('');
if (failures === 0) {
  console.log('All checks passed.');
} else {
  console.log(`${failures} failure(s).`);
  process.exitCode = 1;
}
