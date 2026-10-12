import { describe, expect, test } from 'vitest';
import { settle, totalValue, type Bet } from './payout';

const TAX = 0.053;
const CONVERSION = 0.6;

function bet(overrides: Partial<Bet>): Bet {
  return { type: 'normal', odds: 2, stake: 10, tax: false, ...overrides };
}

describe('normale Wette', () => {
  test('gewonnen: Einsatz × (Quote − 1)', () => {
    expect(settle(bet({ odds: 2.5 }), true, TAX).cash).toBeCloseTo(15, 10);
  });
  test('verloren: Einsatz weg', () => {
    expect(settle(bet({ odds: 2.5 }), false, TAX)).toEqual({ cash: -10, freebet: 0 });
  });
  test('mit Steuer: 5,3 % vom Gewinn', () => {
    expect(settle(bet({ odds: 2.5, tax: true }), true, TAX).cash).toBeCloseTo(14.205, 10);
  });
  test('mit Steuer verloren: keine Steuer', () => {
    expect(settle(bet({ odds: 2.5, tax: true }), false, TAX).cash).toBe(-10);
  });
});

describe('Gratiswette (Einsatz nicht zurück)', () => {
  test('gewonnen: nur der Gewinn', () => {
    expect(settle(bet({ type: 'gratiswette', odds: 3 }), true, TAX).cash).toBeCloseTo(20, 10);
  });
  test('gewonnen mit Steuer', () => {
    expect(settle(bet({ type: 'gratiswette', odds: 3, tax: true }), true, TAX).cash).toBeCloseTo(18.94, 10);
  });
  test('verloren: nichts', () => {
    expect(settle(bet({ type: 'gratiswette', odds: 3 }), false, TAX)).toEqual({ cash: 0, freebet: 0 });
  });
});

describe('risikofreie Wette', () => {
  const rf = { type: 'risikofrei' as const, stake: 5, odds: 2.2 };
  test('gewonnen: wie normal', () => {
    expect(settle(bet(rf), true, TAX)).toEqual({ cash: expect.closeTo(6, 10), freebet: 0 });
  });
  test('verloren, Bar-Erstattung: Verlust ausgeglichen', () => {
    expect(settle(bet({ ...rf, refundKind: 'bar' }), false, TAX)).toEqual({ cash: 0, freebet: 0 });
  });
  test('verloren, Gratiswette-Erstattung: Bargeld und Freebet getrennt', () => {
    const r = settle(bet({ ...rf, refundKind: 'gratiswette' }), false, TAX);
    expect(r).toEqual({ cash: -5, freebet: 5 });
    expect(totalValue(r, CONVERSION)).toBeCloseTo(-2, 10);
  });
  test('Standard der Erstattung ist Bargeld', () => {
    expect(settle(bet(rf), false, TAX).cash).toBe(0);
  });
  test('Höchstbetrag: 8 € Einsatz, 5 € Erstattung', () => {
    const b = bet({ type: 'risikofrei', stake: 8, odds: 2.2, refundCap: 5 });
    expect(settle(b, true, TAX).cash).toBeCloseTo(9.6, 10);
    expect(settle(b, false, TAX).cash).toBeCloseTo(-3, 10);
  });
});

describe('Quotenboost und Max-Einsatz', () => {
  test('Boost rechnet wie normal, mit der eingegebenen Quote', () => {
    expect(settle(bet({ type: 'boost', odds: 4 }), true, TAX).cash).toBeCloseTo(30, 10);
  });
  test('Einsatz wird auf den Max-Einsatz gekappt', () => {
    const b = bet({ type: 'boost', odds: 2, stake: 20, maxStake: 10 });
    expect(settle(b, true, TAX).cash).toBeCloseTo(10, 10);
    expect(settle(b, false, TAX).cash).toBe(-10);
  });
  test('Max-Einsatz über dem Einsatz ändert nichts', () => {
    expect(settle(bet({ odds: 2, stake: 5, maxStake: 10 }), false, TAX).cash).toBe(-5);
  });
});

describe('Fehlerfälle', () => {
  test('Quote ≤ 1', () => {
    expect(() => settle(bet({ odds: 1 }), true, TAX)).toThrow();
    expect(() => settle(bet({ odds: 0.5 }), true, TAX)).toThrow();
  });
  test('Einsatz ≤ 0', () => {
    expect(() => settle(bet({ stake: 0 }), true, TAX)).toThrow();
    expect(() => settle(bet({ stake: -1 }), true, TAX)).toThrow();
  });
  test('Steuersatz außerhalb von 0–100 %', () => {
    expect(() => settle(bet({}), true, -0.1)).toThrow();
    expect(() => settle(bet({}), true, 1.1)).toThrow();
  });
  test('Zahlen müssen endlich sein', () => {
    expect(() => settle(bet({ odds: NaN }), true, TAX)).toThrow();
  });
});
