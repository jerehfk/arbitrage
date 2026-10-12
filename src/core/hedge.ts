import {
  and,
  bttsMarket,
  CELL_COUNT,
  cellProb,
  goalsMarket,
  halfMarket,
  isCombo,
  marginMarket,
  resultMarket,
  type Market,
  type Names,
  type Res,
} from './match';

/** Was die eigene Wette verwendet; daraus ergibt sich, welche Märkte als Absicherung in Frage kommen. */
export interface BetInfo {
  /** Torlinien der eigenen Wette. */
  lines: number[];
  halves: boolean;
  margin: boolean;
}

const RESULT_SETS: Res[][] = [['H'], ['D'], ['A'], ['H', 'D'], ['D', 'A'], ['H', 'A']];
const BASE_LINES = [1.5, 2.5, 3.5];
const MAX_LEGS = 3;

/** Alle Märkte, die als Absicherung geprüft werden: einfache und Kombis aus zwei Bereichen. */
export function buildLibrary(names: Names, info: BetInfo): Market[] {
  const lines = [...new Set([...BASE_LINES, ...info.lines])].sort((a, b) => a - b);
  const results = RESULT_SETS.map((s) => resultMarket(s, names));
  const goals = lines.flatMap((l) => [goalsMarket(true, l), goalsMarket(false, l)]);
  const btts = [bttsMarket(true), bttsMarket(false)];
  const halves = info.halves
    ? ([1, 2] as const).flatMap((h) => RESULT_SETS.map((s) => halfMarket([h], s, names)))
    : [];
  const margins = info.margin
    ? (['H', 'A'] as const).flatMap((t) => [
        marginMarket(t, 1, false, names),
        marginMarket(t, 2, false, names),
        marginMarket(t, 2, true, names),
        marginMarket(t, 3, true, names),
      ])
    : [];
  const combos = [
    ...results.flatMap((r) => goals.map((g) => and(r, g))),
    ...results.flatMap((r) => btts.map((b) => and(r, b))),
    ...goals.flatMap((g) => btts.map((b) => and(g, b))),
  ];
  return [...results, ...goals, ...btts, ...halves, ...margins, ...combos];
}

export type HedgeStatus = 'ok' | 'unmoeglich' | 'nichts' | 'keine';

export interface HedgeResult {
  status: HedgeStatus;
  legs: Market[];
}

/**
 * Kleinste Menge von Wetten (höchstens 3), die alle Torverläufe außerhalb der eigenen Wette abdeckt.
 * Kandidaten dürfen die eigene Wette nicht berühren. Unter gleich großen Mengen gewinnt die mit der geringsten
 * Überschneidung (nach grober Wahrscheinlichkeit gewichtet), dann die mit weniger Kombi-Wetten.
 */
export function findHedge(boost: Market, library: Market[]): HedgeResult {
  const inBoost = boost.mask;
  if (!inBoost.includes(1)) return { status: 'unmoeglich', legs: [] };

  const candidates = library.filter((m) => m.mask.includes(1) && m.mask.every((v, i) => !(v && inBoost[i])));
  const outside = Array.from({ length: CELL_COUNT }, (_, i) => i).filter((i) => !inBoost[i] && cellProb[i] > 0);
  if (outside.length === 0) return { status: 'nichts', legs: [] };

  // Torverläufe, die bei allen Kandidaten gleich abschneiden, werden zu einem Atom zusammengefasst.
  const atoms = new Map<string, { cands: number[]; prob: number }>();
  for (const cell of outside) {
    const cands = candidates.flatMap((m, i) => (m.mask[cell] ? [i] : []));
    const key = cands.join(',');
    const atom = atoms.get(key);
    if (atom) atom.prob += cellProb[cell];
    else atoms.set(key, { cands, prob: cellProb[cell] });
  }
  const atomList = [...atoms.values()];
  if (atomList.some((a) => a.cands.length === 0)) return { status: 'keine', legs: [] };

  const words = Math.ceil(atomList.length / 32);
  const coverBits = candidates.map(() => new Uint32Array(words));
  atomList.forEach((a, ai) => a.cands.forEach((ci) => (coverBits[ci][ai >> 5] |= 1 << (ai & 31))));

  const firstUncovered = (covered: Uint32Array): number => {
    for (let w = 0; w < words; w++) {
      const free = ~covered[w] >>> 0;
      for (let b = 0; b < 32; b++) {
        const ai = w * 32 + b;
        if (ai >= atomList.length) return -1;
        if (free & (1 << b)) return ai;
      }
    }
    return -1;
  };

  for (let size = 1; size <= MAX_LEGS; size++) {
    const found = new Map<string, number[]>();
    const search = (covered: Uint32Array, chosen: number[]) => {
      const next = firstUncovered(covered);
      if (next < 0) {
        const sorted = [...chosen].sort((a, b) => a - b);
        found.set(sorted.join(','), sorted);
        return;
      }
      if (chosen.length === size) return;
      for (const ci of atomList[next].cands) {
        if (chosen.includes(ci)) continue;
        const merged = covered.map((w, k) => w | coverBits[ci][k]);
        search(merged, [...chosen, ci]);
      }
    };
    search(new Uint32Array(words), []);
    if (found.size === 0) continue;

    const scored = [...found.values()].map((idx) => {
      const overlap = atomList.reduce((s, a) => s + a.prob * (a.cands.filter((c) => idx.includes(c)).length - 1), 0);
      return { idx, overlap: Math.round(overlap * 100), combos: idx.filter((i) => isCombo(candidates[i])).length };
    });
    scored.sort(
      (a, b) =>
        a.overlap - b.overlap ||
        a.combos - b.combos ||
        compare(a.idx, b.idx),
    );
    return { status: 'ok', legs: scored[0].idx.map((i) => candidates[i]) };
  }
  return { status: 'keine', legs: [] };
}

function compare(a: number[], b: number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}
