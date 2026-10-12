const EPS = 1e-9;

export type LPStatus = 'optimal' | 'unbounded' | 'infeasible';

export interface LPResult {
  status: LPStatus;
  x: number[];
  value: number;
}

function pivot(T: number[][], basis: number[], row: number, col: number): void {
  const p = T[row][col];
  for (let j = 0; j < T[row].length; j++) T[row][j] /= p;
  for (let i = 0; i < T.length; i++) {
    if (i === row) continue;
    const f = T[i][col];
    if (Math.abs(f) < EPS) continue;
    for (let j = 0; j < T[i].length; j++) T[i][j] -= f * T[row][j];
  }
  basis[row] = col;
}

function objective(T: number[][], basis: number[], cost: number[]): number {
  const rhs = T[0].length - 1;
  return T.reduce((sum, row, i) => sum + cost[basis[i]] * row[rhs], 0);
}

/** Simplex-Schritte (Bland-Regel). Nur Spalten < enterLimit dürfen in die Basis. */
function iterate(T: number[][], basis: number[], cost: number[], enterLimit: number): 'optimal' | 'unbounded' {
  const rhs = T[0].length - 1;
  for (let step = 0; step < 10000; step++) {
    let enter = -1;
    for (let j = 0; j < enterLimit && enter < 0; j++) {
      if (basis.includes(j)) continue;
      let reduced = cost[j];
      for (let i = 0; i < T.length; i++) reduced -= cost[basis[i]] * T[i][j];
      if (reduced > EPS) enter = j;
    }
    if (enter < 0) return 'optimal';

    let leave = -1;
    let best = Infinity;
    for (let i = 0; i < T.length; i++) {
      if (T[i][enter] <= EPS) continue;
      const ratio = T[i][rhs] / T[i][enter];
      if (ratio < best - EPS || (Math.abs(ratio - best) <= EPS && basis[i] < basis[leave])) {
        best = ratio;
        leave = i;
      }
    }
    if (leave < 0) return 'unbounded';
    pivot(T, basis, leave, enter);
  }
  throw new Error('Simplex bricht nicht ab');
}

/** Maximiert c·x unter A·x ≤ b und x ≥ 0 (Zwei-Phasen-Simplex, b darf negativ sein). */
export function solveLP(c: number[], A: number[][], b: number[]): LPResult {
  const n = c.length;
  const m = A.length;
  const artRows = b.flatMap((v, i) => (v < 0 ? [i] : []));
  const cols = n + m + artRows.length;
  const T: number[][] = [];
  const basis: number[] = [];

  for (let i = 0; i < m; i++) {
    const sign = b[i] < 0 ? -1 : 1;
    const row = new Array<number>(cols + 1).fill(0);
    for (let j = 0; j < n; j++) row[j] = sign * A[i][j];
    row[n + i] = sign;
    row[cols] = sign * b[i];
    const art = artRows.indexOf(i);
    if (art >= 0) {
      row[n + m + art] = 1;
      basis.push(n + m + art);
    } else {
      basis.push(n + i);
    }
    T.push(row);
  }

  if (artRows.length > 0) {
    const cost1 = new Array<number>(cols).fill(0);
    for (let a = 0; a < artRows.length; a++) cost1[n + m + a] = -1;
    iterate(T, basis, cost1, cols);
    if (objective(T, basis, cost1) < -1e-7) return { status: 'infeasible', x: [], value: NaN };
    for (let i = 0; i < m; i++) {
      if (basis[i] < n + m) continue;
      const col = T[i].findIndex((v, j) => j < n + m && Math.abs(v) > EPS);
      if (col >= 0) pivot(T, basis, i, col);
    }
  }

  const cost2 = [...c, ...new Array<number>(cols - n).fill(0)];
  if (iterate(T, basis, cost2, n + m) === 'unbounded') return { status: 'unbounded', x: [], value: Infinity };

  const x = new Array<number>(n).fill(0);
  basis.forEach((col, i) => {
    if (col < n) x[col] = Math.max(0, T[i][cols]);
  });
  return { status: 'optimal', x, value: c.reduce((s, cj, j) => s + cj * x[j], 0) };
}
