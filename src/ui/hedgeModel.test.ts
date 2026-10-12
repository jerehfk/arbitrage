import { describe, expect, test } from 'vitest';
import { calculateHedge, initialHedge, type HedgeState } from './hedgeModel';

const state = (patch: Partial<HedgeState> = {}): HedgeState => ({
  ...initialHedge,
  home: 'Atlético',
  away: 'Man Utd',
  ...patch,
});

describe('calculateHedge', () => {
  test('Beispiel Atlético & über 2,5: genau eine beste Absicherung aus zwei Wetten', () => {
    const calc = calculateHedge(state());
    expect(calc.boostLabel).toBe('Atlético gewinnt & über 2,5 Tore');
    expect(calc.best?.legs.map((l) => l.label).sort()).toEqual([
      'Atlético gewinnt & unter 2,5 Tore',
      'Remis oder Man Utd',
    ]);
    expect(calc.best?.legs.filter((l) => l.combo)).toHaveLength(1);
  });

  test('Heim gewinnt (egal): eine einzige Absicherung', () => {
    const calc = calculateHedge(state({ goals: 'egal' }));
    expect(calc.best?.legs.map((l) => l.label)).toEqual(['Remis oder Man Utd']);
  });

  test('kein Ergebnis gewählt oder alles abgedeckt: Hinweis statt Absicherung', () => {
    const none = calculateHedge(state({ results: [] }));
    expect(none.hint).toMatch(/mindestens ein Ergebnis/);
    expect(none.best).toBeUndefined();
    expect(calculateHedge(state({ results: [0, 1, 2], goals: 'egal' })).hint).toMatch(/nichts abzusichern/);
  });
});
