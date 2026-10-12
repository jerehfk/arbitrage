import { describe, expect, test } from 'vitest';
import { calculateHedge, initialHedge, type HedgeState } from './hedgeModel';

const state = (patch: Partial<HedgeState> = {}): HedgeState => ({
  ...initialHedge,
  home: 'Atlético',
  away: 'Man Utd',
  ...patch,
});

describe('calculateHedge', () => {
  test('Beispiel Atlético & über 2,5: Beschriftung und erster Vorschlag', () => {
    const calc = calculateHedge(state());
    expect(calc.boostLabel).toBe('Atlético gewinnt & über 2,5 Tore');
    expect(calc.options.length).toBe(6);
    expect(calc.options[0].legs.map((l) => l.label).sort()).toEqual(['Remis oder Man Utd', 'Unter 2,5 Tore']);
    expect(calc.options[0].legs.every((l) => !l.combo)).toBe(true);
  });

  test('Vorschläge nach Zahl der Wetten sortiert, Kombi-Wetten markiert', () => {
    const calc = calculateHedge(state());
    const sizes = calc.options.map((o) => o.legs.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(calc.options.some((o) => o.legs.some((l) => l.combo))).toBe(true);
  });

  test('Heim gewinnt (egal): eine einzige Absicherung', () => {
    const calc = calculateHedge(state({ goals: 'egal' }));
    expect(calc.options[0].legs.map((l) => l.label)).toEqual(['Remis oder Man Utd']);
  });

  test('kein Ergebnis gewählt oder alles abgedeckt: Hinweis', () => {
    expect(calculateHedge(state({ results: [] })).hint).toMatch(/mindestens ein Ergebnis/);
    expect(calculateHedge(state({ results: [0, 1, 2], goals: 'egal' })).hint).toMatch(/nichts abzusichern/);
  });
});
