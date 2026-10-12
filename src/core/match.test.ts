import { describe, expect, test } from 'vitest';
import {
  and,
  bttsMarket,
  CELL_COUNT,
  cellProb,
  count,
  goalsMarket,
  halfMarket,
  handicapMarket,
  marginMarket,
  resultMarket,
} from './match';

const names = { home: 'Spanien', away: 'Italien' };
const prob = (m: { mask: Uint8Array }) => m.mask.reduce((s, v, i) => s + (v ? cellProb[i] : 0), 0);

describe('Märkte', () => {
  test('Wahrscheinlichkeiten summieren sich zu 1', () => {
    expect(cellProb.length).toBe(CELL_COUNT);
    expect(cellProb.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
  });

  test('Heim, Remis, Auswärts teilen alle Verläufe auf', () => {
    const parts = (['H', 'D', 'A'] as const).map((r) => resultMarket([r], names));
    expect(parts.reduce((s, m) => s + count(m), 0)).toBe(CELL_COUNT);
    expect(parts.reduce((s, m) => s + prob(m), 0)).toBeCloseTo(1, 9);
  });

  test('Über und Unter derselben Linie sind Gegenstücke', () => {
    expect(count(goalsMarket(true, 2.5)) + count(goalsMarket(false, 2.5))).toBe(CELL_COUNT);
    expect(count(and(goalsMarket(true, 2.5), goalsMarket(false, 2.5)))).toBe(0);
  });

  test('Beide Teams treffen ja/nein sind Gegenstücke', () => {
    expect(count(bttsMarket(true)) + count(bttsMarket(false))).toBe(CELL_COUNT);
  });

  test('Handicap -1,5 ist Sieg mit mindestens 2 Toren Unterschied', () => {
    const a = handicapMarket('H', -1.5, names);
    const b = marginMarket('H', 2, true, names);
    expect(Array.from(a.mask)).toEqual(Array.from(b.mask));
    expect(a.label).toBe('Spanien Handicap −1,5');
  });

  test('Beide Halbzeiten gewinnen ist enger als eine Halbzeit', () => {
    const both = halfMarket([1, 2], ['H'], names);
    const one = halfMarket([1], ['H'], names);
    expect(both.label).toBe('Spanien gewinnt beide Halbzeiten');
    expect(count(both)).toBeLessThan(count(one));
  });

  test('Kombi-Beschriftung', () => {
    expect(and(resultMarket(['H'], names), goalsMarket(true, 2.5)).label).toBe('Spanien gewinnt & über 2,5 Tore');
  });
});
