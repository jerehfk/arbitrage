import { describe, expect, test } from 'vitest';
import { optimize, type Leg, type Settings } from './optimizer';

const settings: Settings = { taxRate: 0.053, conversionRate: 0.75 };
const normal = (odds: number, tax = false) => ({ type: 'normal' as const, odds, tax });

describe('Beispiele aus „Sichere Wette“', () => {
  test('Wetten-Retter 04.10.: risikofreie Wette mit Gratiswette-Erstattung, zwei Gegenwetten', () => {
    // Ausgänge: 0 = Bet Builder gewinnt, 1 = Deutschland gewinnt & unter 2,5, 2 = Doppelte Chance 1X
    const legs: Leg[] = [
      { bet: { type: 'risikofrei', odds: 2.2, tax: false, refundKind: 'gratiswette' }, covers: [0], stake: 5 },
      { bet: normal(2.05), covers: [2] },
      { bet: normal(6), covers: [1] },
    ];
    const plan = optimize(legs, 3, settings);
    expect(plan.status).toBe('optimal');
    expect(plan.stakes[1]).toBeCloseTo(3.537, 3);
    expect(plan.stakes[2]).toBeCloseTo(1.208, 3);
    for (const o of plan.outcomes) expect(o.value).toBeCloseTo(1.255, 2);
    expect(plan.equal).toBe(true);
  });

  test('Arbitrage mit überlappender Wette: 1X fest 100 €, „2“ frei', () => {
    const legs: Leg[] = [
      { bet: normal(2.05), covers: [0, 1], stake: 100 },
      { bet: normal(2.1), covers: [2] },
    ];
    const plan = optimize(legs, 3, settings);
    expect(plan.stakes[1]).toBeCloseTo(97.619, 3);
    expect(plan.minValue).toBeCloseTo(7.381, 3);
    expect(plan.equal).toBe(true);
  });
});

describe('Bonus-Arten', () => {
  test('Gratiswette 10 € zu 5,00, Gegenwette zu 1,80', () => {
    const legs: Leg[] = [
      { bet: { type: 'gratiswette', odds: 5, tax: false }, covers: [0], stake: 10 },
      { bet: normal(1.8), covers: [1] },
    ];
    const plan = optimize(legs, 2, settings);
    expect(plan.stakes[1]).toBeCloseTo(22.222, 3);
    expect(plan.minValue).toBeCloseTo(17.778, 3);
    expect(plan.totalStake).toBeCloseTo(22.222, 3);
  });

  test('Boost mit Max-Einsatz 10 € zu 3,00, Gegenwette zu 1,90, nichts fest', () => {
    const legs: Leg[] = [
      { bet: { type: 'boost', odds: 3, tax: false, maxStake: 10 }, covers: [0] },
      { bet: normal(1.9), covers: [1] },
    ];
    const plan = optimize(legs, 2, settings);
    expect(plan.status).toBe('optimal');
    expect(plan.stakes[0]).toBeCloseTo(10, 6);
    expect(plan.stakes[1]).toBeCloseTo(15.789, 3);
    expect(plan.minValue).toBeCloseTo(4.2105, 3);
  });

  test('Höchstbetrag der Erstattung wird in der Rechnung berücksichtigt', () => {
    // 8 € Einsatz, nur 5 € Erstattung (bar): Verlust bleibt −3 €, Gegenwette gleicht aus
    const legs: Leg[] = [
      { bet: { type: 'risikofrei', odds: 3, tax: false, refundCap: 5, refundKind: 'bar' }, covers: [0], stake: 8 },
      { bet: normal(1.6), covers: [1] },
    ];
    const plan = optimize(legs, 2, settings);
    // Ausgang 0: 16 − y ; Ausgang 1: −3 + 0,6 y  →  y = 19 / 1,6
    expect(plan.stakes[1]).toBeCloseTo(11.875, 3);
    expect(plan.minValue).toBeCloseTo(4.125, 3);
  });
});

describe('Steuer', () => {
  test('Steuer auf der festen Wette: 5,3 % vom Gewinn', () => {
    const legs: Leg[] = [
      { bet: normal(2.5, true), covers: [0], stake: 100 },
      { bet: normal(1.8), covers: [1] },
    ];
    const plan = optimize(legs, 2, settings);
    expect(plan.stakes[1]).toBeCloseTo(134.472, 3);
    expect(plan.minValue).toBeCloseTo(7.578, 3);
  });
});

describe('Grenzfälle', () => {
  test('keine Arbitrage, nichts fest: alles bleibt bei 0', () => {
    const legs: Leg[] = [
      { bet: normal(1.5), covers: [0] },
      { bet: normal(1.5), covers: [1] },
    ];
    const plan = optimize(legs, 2, settings);
    expect(plan.status).toBe('optimal');
    expect(plan.stakes).toEqual([0, 0]);
    expect(plan.minValue).toBe(0);
  });

  test('Arbitrage ohne festen Einsatz und ohne Max-Einsatz: unbegrenzt', () => {
    const legs: Leg[] = [
      { bet: normal(2.1), covers: [0] },
      { bet: normal(2.1), covers: [1] },
    ];
    expect(optimize(legs, 2, settings).status).toBe('unbegrenzt');
  });

  test('ohne freie Wetten: nur Auswertung der festen', () => {
    const legs: Leg[] = [{ bet: normal(2), covers: [0], stake: 10 }];
    const plan = optimize(legs, 2, settings);
    expect(plan.outcomes.map((o) => o.value)).toEqual([10, -10]);
    expect(plan.equal).toBe(false);
  });

  test('ungültiger Ausgang', () => {
    expect(() => optimize([{ bet: normal(2), covers: [5], stake: 10 }], 2, settings)).toThrow();
  });
});
