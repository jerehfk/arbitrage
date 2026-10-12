import { describe, expect, test } from 'vitest';
import { calculate, type UiState } from './model';

const settings = { taxRate: 0.053, conversionRate: 0.6 };

function state(bets: UiState['bets']): UiState {
  return { outcomes: ['A', 'B'], bets };
}

describe('calculate', () => {
  test('Arbitrage: ein Einsatz fest, der andere wird berechnet', () => {
    const calc = calculate(
      state([
        { provider: 'Tipico', odds: '2,10', stake: '100', covers: 0 },
        { provider: 'bet365', odds: '2.1', stake: '', covers: 1 },
      ]),
      settings,
    );
    expect(calc.hint).toBeUndefined();
    expect(calc.stakeHints[0]).toBeUndefined();
    expect(calc.stakeHints[1]).toBeCloseTo(100, 6);
    expect(calc.plan?.minValue).toBeCloseTo(10, 6);
    expect(calc.plan?.equal).toBe(true);
  });

  test('ohne festen Einsatz bei Arbitrage: Hinweis statt Zahlen', () => {
    const calc = calculate(
      state([
        { provider: '', odds: '2,1', stake: '', covers: 0 },
        { provider: '', odds: '2,1', stake: '', covers: 1 },
      ]),
      settings,
    );
    expect(calc.plan).toBeUndefined();
    expect(calc.hint).toMatch(/Einsatz fest/);
  });

  test('ohne Arbitrage und ohne festen Einsatz: Hinweis', () => {
    const calc = calculate(
      state([
        { provider: '', odds: '1,5', stake: '', covers: 0 },
        { provider: '', odds: '1,5', stake: '', covers: 1 },
      ]),
      settings,
    );
    expect(calc.hint).toMatch(/kein Gewinn/);
  });

  test('ungültige Quote wird markiert und nicht gerechnet', () => {
    const calc = calculate(
      state([
        { provider: '', odds: '1', stake: '10', covers: 0 },
        { provider: '', odds: '2', stake: '', covers: 1 },
      ]),
      settings,
    );
    expect(calc.errors[0].odds).toBeDefined();
    expect(calc.errors[1].odds).toBeUndefined();
  });

  test('ungültiger Einsatz wird markiert', () => {
    const calc = calculate(state([{ provider: '', odds: '2', stake: '-5', covers: 0 }]), settings);
    expect(calc.errors[0].stake).toBeDefined();
  });

  test('nichts eingetragen', () => {
    const calc = calculate(state([{ provider: '', odds: '', stake: '', covers: 0 }]), settings);
    expect(calc.plan).toBeUndefined();
    expect(calc.hint).toBe('Trage die Quoten ein.');
  });
});
