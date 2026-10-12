import { describe, expect, test } from 'vitest';
import {
  breakEvenOdds,
  cellName,
  describeMarket,
  marketCells,
  suggestHedges,
  type Market,
  type Names,
} from './hedge';

const names: Names = { home: 'Atlético', away: 'Man Utd', line: '2,5' };
const settings = { taxRate: 0.053, conversionRate: 0.6 };
const homeOver: Market = { results: [0], goals: 'ueber' };

describe('Märkte', () => {
  test('Zellen: Heim & über = Fall 0, Remis egal = Fälle 2 und 3', () => {
    expect(marketCells(homeOver)).toEqual([0]);
    expect(marketCells({ results: [1], goals: 'egal' })).toEqual([2, 3]);
    expect(marketCells({ results: [1, 2], goals: 'unter' })).toEqual([3, 5]);
  });

  test('Beschriftung', () => {
    expect(describeMarket(homeOver, names)).toBe('Atlético gewinnt & über 2,5 Tore');
    expect(describeMarket({ results: [1, 2], goals: 'egal' }, names)).toBe('Remis oder Man Utd');
    expect(describeMarket({ results: [0, 1, 2], goals: 'unter' }, names)).toBe('Unter 2,5 Tore');
    expect(cellName(5, names)).toBe('Man Utd & unter 2,5 Tore');
  });
});

describe('suggestHedges', () => {
  test('Beispiel Atlético & über 2,5: keine Einzelwette, mindestens zwei Wetten, alles abgedeckt', () => {
    const options = suggestHedges(marketCells(homeOver));
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      expect(o.length).toBeGreaterThanOrEqual(2);
      const cells = new Set(o.flatMap(marketCells));
      expect([1, 2, 3, 4, 5].every((c) => cells.has(c))).toBe(true);
      expect(cells.has(0)).toBe(false);
    }
    const sizes = options.map((o) => o.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  test('beste zuerst: zwei Wetten ohne Überschneidung, Remis oder Auswärts plus Heim & unter', () => {
    const first = suggestHedges(marketCells(homeOver))[0].map((m) => describeMarket(m, names)).sort();
    expect(first).toEqual(['Atlético gewinnt & unter 2,5 Tore', 'Remis oder Man Utd']);
  });

  test('bei gleicher Zahl und Überschneidung steht die Variante mit weniger Kombi-Wetten vorn', () => {
    // Heim & unter wird nur durch Kombis oder durch "Unter" abgedeckt; "Unter" überschneidet, ist aber kein Kombi.
    const options = suggestHedges(marketCells(homeOver), 20).filter((o) => o.length === 2);
    const overlaps = options.map((o) => o.flatMap(marketCells).length - 5);
    expect(overlaps).toEqual([...overlaps].sort((a, b) => a - b));
  });

  test('einfacher Fall: Heim gewinnt (egal) wird mit einer Wette "Remis oder Auswärts" abgesichert', () => {
    const options = suggestHedges(marketCells({ results: [0], goals: 'egal' }));
    expect(options[0]).toHaveLength(1);
    expect(describeMarket(options[0][0], names)).toBe('Remis oder Man Utd');
  });

  test('alles abgedeckt: keine Vorschläge', () => {
    expect(suggestHedges([0, 1, 2, 3, 4, 5])).toEqual([]);
  });
});

describe('breakEvenOdds', () => {
  test('Boost 4,0 auf Heim (egal), eine Absicherung: Mindestquote B/(B−1) ≈ 1,333', () => {
    const o = breakEvenOdds(
      { bet: { type: 'boost', odds: 4, tax: false }, stake: 10, cells: marketCells({ results: [0], goals: 'egal' }) },
      [{ cells: marketCells({ results: [1, 2], goals: 'egal' }), tax: false }],
      { taxRate: 0, conversionRate: 0.6 },
    );
    expect(o).toBeCloseTo(4 / 3, 3);
  });

  test('zwei Absicherungen: Kehrwertsumme höchstens 1 − 1/B', () => {
    const o = breakEvenOdds(
      { bet: { type: 'boost', odds: 4, tax: false }, stake: 10, cells: marketCells({ results: [0], goals: 'egal' }) },
      [
        { cells: marketCells({ results: [1], goals: 'egal' }), tax: false },
        { cells: marketCells({ results: [2], goals: 'egal' }), tax: false },
      ],
      { taxRate: 0, conversionRate: 0.6 },
    );
    expect(2 / o!).toBeCloseTo(0.75, 3);
  });

  test('Steuer macht die Mindestquote höher', () => {
    const boost = { bet: { type: 'normal' as const, odds: 2, tax: false }, stake: 10, cells: [0] };
    const withTax = breakEvenOdds(boost, [{ cells: [1, 2, 3, 4, 5], tax: true }], settings)!;
    const without = breakEvenOdds(boost, [{ cells: [1, 2, 3, 4, 5], tax: false }], settings)!;
    expect(withTax).toBeGreaterThan(without);
  });
});
