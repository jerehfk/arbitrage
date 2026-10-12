import { describe, expect, test } from 'vitest';
import { calculateHedge, initialHedge, type HedgeState } from './hedgeModel';

const settings = { taxRate: 0.053, conversionRate: 0.6 };

function state(patch: Partial<HedgeState> = {}): HedgeState {
  return {
    ...initialHedge,
    home: 'Atlético',
    away: 'Man Utd',
    boost: { ...initialHedge.boost, odds: '10', stake: '10' },
    ...patch,
  };
}

describe('calculateHedge', () => {
  test('Beispiel Atlético & über 2,5: Vorschläge, erste Wette ist die eigene Kombi', () => {
    const calc = calculateHedge(state(), settings);
    expect(calc.boostLabel).toBe('Atlético gewinnt & über 2,5 Tore');
    expect(calc.options.length).toBeGreaterThan(0);
    expect(calc.options[0].legs.map((l) => l.label).sort()).toEqual(['Remis oder Man Utd', 'Unter 2,5 Tore']);
    expect(calc.options[0].plan).toBeUndefined();
    expect(calc.options[0].breakEven).toBeGreaterThan(1);
    expect(calc.selectedId).toBeUndefined();
  });

  test('ohne Quote der eigenen Wette: keine Mindestquote', () => {
    const calc = calculateHedge(state({ boost: { ...initialHedge.boost, odds: '', stake: '10' } }), settings);
    expect(calc.options[0].breakEven).toBeUndefined();
  });

  test('mit allen Quoten: Einsätze und Gewinn', () => {
    const first = calculateHedge(state(), settings).options[0];
    const hedges = Object.fromEntries(first.legs.map((l) => [l.key, { odds: '3', tax: false }]));
    const calc = calculateHedge(state({ hedges }), settings);
    const option = calc.options[0];
    expect(option.plan?.status).toBe('optimal');
    expect(option.stakes?.[0]).toBe(10);
    expect(option.plan!.minValue).toBeGreaterThan(0);
    expect(calc.selectedId).toBe(option.id);
    expect(calc.assumedBudget).toBeUndefined();
  });

  test('ohne Einsatz und ohne Max-Einsatz: rechnet mit 100 € Gesamteinsatz', () => {
    const first = calculateHedge(state(), settings).options[0];
    const hedges = Object.fromEntries(first.legs.map((l) => [l.key, { odds: '3', tax: false }]));
    const calc = calculateHedge(state({ boost: { ...initialHedge.boost, odds: '10', stake: '' }, hedges }), settings);
    expect(calc.assumedBudget).toBe(100);
    expect(calc.options[0].plan?.totalStake).toBeCloseTo(100, 3);
  });

  test('Boost mit Max-Einsatz: Einsatz der Wette höchstens der Max-Einsatz', () => {
    const first = calculateHedge(state(), settings).options[0];
    const hedges = Object.fromEntries(first.legs.map((l) => [l.key, { odds: '3', tax: false }]));
    const boost = { ...initialHedge.boost, type: 'boost' as const, odds: '10', stake: '', maxStake: '5' };
    const calc = calculateHedge(state({ boost, hedges }), settings);
    expect(calc.options[0].stakes?.[0]).toBeCloseTo(5, 4);
  });

  test('Quote kleiner 1: Fehler an der Absicherung, kein Ergebnis', () => {
    const first = calculateHedge(state(), settings).options[0];
    const hedges = Object.fromEntries(first.legs.map((l) => [l.key, { odds: '0,5', tax: false }]));
    const option = calculateHedge(state({ hedges }), settings).options[0];
    expect(option.legs[0].error).toMatch(/größer als 1/);
    expect(option.plan).toBeUndefined();
  });

  test('Gratiswette ohne Betrag: Fehler', () => {
    const calc = calculateHedge(
      state({ boost: { ...initialHedge.boost, type: 'gratiswette', odds: '5', stake: '' } }),
      settings,
    );
    expect(calc.errors.stake).toMatch(/Gratiswette/);
    expect(calc.options[0].breakEven).toBeUndefined();
  });

  test('kein Ergebnis gewählt oder alles abgedeckt: Hinweis', () => {
    expect(calculateHedge(state({ results: [] }), settings).hint).toMatch(/mindestens ein Ergebnis/);
    expect(calculateHedge(state({ results: [0, 1, 2], goals: 'egal' }), settings).hint).toMatch(/nichts abzusichern/);
  });
});
