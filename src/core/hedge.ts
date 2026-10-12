import { optimize, type Leg, type Settings } from './optimizer';
import type { Bet } from './payout';

/**
 * Absichern für Ergebnis × Tore: Das Spiel zerfällt in 6 Fälle
 * (Heim / Remis / Auswärts × über / unter der Torlinie).
 */
export type Goals = 'egal' | 'ueber' | 'unter';

/** Eine Wette auf eine Teilmenge der Fälle: Ergebnisse (0 Heim, 1 Remis, 2 Auswärts) und Tore. */
export interface Market {
  results: number[];
  goals: Goals;
}

export const CELL_COUNT = 6;
const RESULT_SETS = [[0], [1], [2], [0, 1], [1, 2], [0, 2], [0, 1, 2]];
const GOAL_VALUES: Goals[] = ['egal', 'ueber', 'unter'];

/** Fall-Index: Ergebnis r (0–2) und Tore g (0 über, 1 unter). */
export const cellOf = (r: number, g: number) => r * 2 + g;

export function marketCells(m: Market): number[] {
  const goals = m.goals === 'egal' ? [0, 1] : m.goals === 'ueber' ? [0] : [1];
  return m.results.flatMap((r) => goals.map((g) => cellOf(r, g))).sort((a, b) => a - b);
}

export const marketKey = (m: Market) => `${[...m.results].sort().join('')}${m.goals[0]}`;

/** Kombi-Wetten (Ergebnis und Tore zugleich) haben meist die höhere Marge. */
export const isCombo = (m: Market) => m.results.length < 3 && m.goals !== 'egal';

export interface Names {
  home: string;
  away: string;
  /** Torlinie als Text, z. B. "2,5". */
  line: string;
}

function resultLabel(results: number[], n: Names): string {
  const home = n.home.trim() || 'Heim';
  const away = n.away.trim() || 'Auswärts';
  const key = [...results].sort().join('');
  switch (key) {
    case '0':
      return `${home} gewinnt`;
    case '1':
      return 'Remis';
    case '2':
      return `${away} gewinnt`;
    case '01':
      return `${home} oder Remis`;
    case '12':
      return `Remis oder ${away}`;
    case '02':
      return `${home} oder ${away}`;
    default:
      return 'Beliebiges Ergebnis';
  }
}

const goalLabel = (goals: Goals, n: Names) =>
  goals === 'ueber' ? `über ${n.line.trim() || '2,5'} Tore` : `unter ${n.line.trim() || '2,5'} Tore`;

export function describeMarket(m: Market, n: Names): string {
  if (m.goals === 'egal') return resultLabel(m.results, n);
  if (m.results.length === 3) return goalLabel(m.goals, n).replace(/^./, (c) => c.toUpperCase());
  return `${resultLabel(m.results, n)} & ${goalLabel(m.goals, n)}`;
}

export function cellName(cell: number, n: Names): string {
  const r = Math.floor(cell / 2);
  const name = r === 0 ? n.home.trim() || 'Heim' : r === 1 ? 'Remis' : n.away.trim() || 'Auswärts';
  return `${name} & ${goalLabel(cell % 2 === 0 ? 'ueber' : 'unter', n)}`;
}

const ALL_MARKETS: Market[] = RESULT_SETS.flatMap((results) =>
  GOAL_VALUES.filter((goals) => !(results.length === 3 && goals === 'egal')).map((goals) => ({ results, goals })),
);

const MAX_HEDGE_BETS = 3;

/**
 * Mengen von Wetten, die zusammen alle Fälle außerhalb von `cover` abdecken, ohne `cover` selbst zu berühren.
 * Beste zuerst: wenige Wetten, dann keine Überschneidung (doppelt abgedeckte Fälle kosten Einsatz ohne Mehrertrag),
 * dann wenige Kombi-Wetten (höhere Marge, selten an der Börse).
 */
export function suggestHedges(cover: number[], limit = 6): Market[][] {
  const covered = new Set(cover);
  const rest = Array.from({ length: CELL_COUNT }, (_, c) => c).filter((c) => !covered.has(c));
  if (rest.length === 0) return [];
  const candidates = ALL_MARKETS.map((m) => ({ m, cells: marketCells(m) })).filter(({ cells }) =>
    cells.every((c) => !covered.has(c)),
  );

  const found: { markets: Market[]; combos: number; overlap: number }[] = [];
  const covers = (sets: number[][]) => rest.every((c) => sets.some((s) => s.includes(c)));
  const pick = (start: number, chosen: number[]) => {
    const sets = chosen.map((i) => candidates[i].cells);
    if (chosen.length > 0 && covers(sets)) {
      const minimal = chosen.every((_, k) => !covers(sets.filter((__, j) => j !== k)));
      if (minimal) {
        const size = sets.reduce((s, c) => s + c.length, 0);
        found.push({
          markets: chosen.map((i) => candidates[i].m),
          combos: chosen.filter((i) => isCombo(candidates[i].m)).length,
          overlap: size - rest.length,
        });
      }
      return;
    }
    if (chosen.length === MAX_HEDGE_BETS) return;
    for (let i = start; i < candidates.length; i++) pick(i + 1, [...chosen, i]);
  };
  pick(0, []);

  found.sort(
    (a, b) =>
      a.markets.length - b.markets.length ||
      a.overlap - b.overlap ||
      a.combos - b.combos ||
      a.markets.map(marketKey).join().localeCompare(b.markets.map(marketKey).join()),
  );
  return found.slice(0, limit).map((f) => f.markets);
}

export interface BreakEven {
  /** Gleiche Quote für alle Absicherungen, ab der der Mindestgewinn nicht mehr negativ ist; `null` = nie. */
  odds: number | null;
}

/**
 * Kleinste gemeinsame Quote, die alle Absicherungen haben müssen, damit der schlechteste Fall nicht im Minus endet.
 * Der Mindestgewinn steigt mit der Quote, daher reicht Intervallhalbierung.
 */
export function breakEvenOdds(
  boost: { bet: Omit<Bet, 'stake'>; stake: number; cells: number[] },
  hedges: { cells: number[]; tax: boolean }[],
  settings: Settings,
): number | null {
  const ok = (odds: number) => {
    const legs: Leg[] = [
      { bet: boost.bet, covers: boost.cells, stake: boost.stake },
      ...hedges.map((h) => ({ bet: { type: 'normal', odds, tax: h.tax } as Omit<Bet, 'stake'>, covers: h.cells })),
    ];
    const plan = optimize(legs, CELL_COUNT, settings);
    return plan.status === 'unbegrenzt' || plan.minValue >= -1e-9;
  };
  let hi = 1000;
  if (!ok(hi)) return null;
  let lo = 1.0001;
  if (ok(lo)) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
