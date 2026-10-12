import { describe, expect, test } from 'vitest';
import { solveLP } from './simplex';

describe('solveLP', () => {
  test('einfaches Maximum', () => {
    // max 3x + 2y  mit  x + y ≤ 4,  x + 3y ≤ 6,  x ≤ 3
    const r = solveLP([3, 2], [[1, 1], [1, 3], [1, 0]], [4, 6, 3]);
    expect(r.status).toBe('optimal');
    expect(r.x[0]).toBeCloseTo(3, 9);
    expect(r.x[1]).toBeCloseTo(1, 9);
    expect(r.value).toBeCloseTo(11, 9);
  });

  test('negative rechte Seite (Phase 1): min x + y mit x + y ≥ 2', () => {
    const r = solveLP([-1, -1], [[-1, -1], [1, 0], [0, 1]], [-2, 5, 5]);
    expect(r.status).toBe('optimal');
    expect(r.value).toBeCloseTo(-2, 9);
  });

  test('unbeschränkt', () => {
    expect(solveLP([1], [[-1]], [0]).status).toBe('unbounded');
  });

  test('unlösbar', () => {
    expect(solveLP([1], [[1]], [-1]).status).toBe('infeasible');
  });

  test('Ursprung ist optimal, wenn nichts lohnt', () => {
    const r = solveLP([-1, -1], [[1, 1]], [10]);
    expect(r.status).toBe('optimal');
    expect(r.x).toEqual([0, 0]);
  });
});
