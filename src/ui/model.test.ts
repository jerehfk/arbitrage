import { describe, expect, test } from 'vitest';
import { calculate, emptyBet, type BetInput, type UiState } from './model';

const settings = { taxRate: 0.053, conversionRate: 0.6 };

function bet(fields: Partial<BetInput>): BetInput {
  return { ...emptyBet(0), ...fields };
}

function state(bets: BetInput[], outcomes = ['A', 'B']): UiState {
  return { outcomes, bets };
}

describe('calculate', () => {
  test('Wette auf mehrere Ausgänge (Doppelte Chance)', () => {
    const calc = calculate(
      state(
        [
          bet({ odds: '1,5', stake: '100', covers: [0, 1] }),
          bet({ odds: '4', covers: [2] }),
        ],
        ['1', 'X', '2'],
      ),
      settings,
    );
    expect(calc.stakeHints[1]).toBeCloseTo(37.5, 4);
    expect(calc.plan?.minValue).toBeCloseTo(12.5, 4);
    expect(calc.plan?.equal).toBe(true);
  });

  test('ohne Ausgang: Fehler', () => {
    const calc = calculate(state([bet({ odds: '2', covers: [] })]), settings);
    expect(calc.errors[0].covers).toMatch(/mindestens/);
    expect(calc.plan).toBeUndefined();
  });

  test('Arbitrage: ein Einsatz fest, der andere wird berechnet', () => {
    const calc = calculate(
      state([
        bet({ odds: '2,10', stake: '100', covers: [0] }),
        bet({ odds: '2.1', stake: '', covers: [1] }),
      ]),
      settings,
    );
    expect(calc.hint).toBeUndefined();
    expect(calc.stakeHints[0]).toBeUndefined();
    expect(calc.stakeHints[1]).toBeCloseTo(100, 6);
    expect(calc.plan?.minValue).toBeCloseTo(10, 6);
    expect(calc.plan?.equal).toBe(true);
  });

  test('ohne festen Einsatz bei Arbitrage: rechnet mit 100 € Gesamteinsatz', () => {
    const calc = calculate(
      state([
        bet({ odds: '2,1', stake: '', covers: [0] }),
        bet({ odds: '2,1', stake: '', covers: [1] }),
      ]),
      settings,
    );
    expect(calc.hint).toBeUndefined();
    expect(calc.assumedBudget).toBe(100);
    expect(calc.plan?.totalStake).toBeCloseTo(100, 4);
    expect(calc.stakeHints[0]).toBeCloseTo(50, 4);
    expect(calc.stakeHints[1]).toBeCloseTo(50, 4);
    expect(calc.plan?.minValue).toBeCloseTo(5, 4);
  });

  test('mit festem Einsatz gilt der Gesamteinsatz nicht', () => {
    const calc = calculate(
      state([
        bet({ odds: '2,1', stake: '10', covers: [0] }),
        bet({ odds: '2,1', stake: '', covers: [1] }),
      ]),
      settings,
    );
    expect(calc.assumedBudget).toBeUndefined();
    expect(calc.stakeHints[1]).toBeCloseTo(10, 6);
  });

  test('ohne Arbitrage und ohne festen Einsatz: Hinweis', () => {
    const calc = calculate(
      state([
        bet({ odds: '1,5', stake: '', covers: [0] }),
        bet({ odds: '1,5', stake: '', covers: [1] }),
      ]),
      settings,
    );
    expect(calc.hint).toMatch(/kein Gewinn/);
  });

  test('ungültige Quote wird markiert und nicht gerechnet', () => {
    const calc = calculate(
      state([
        bet({ odds: '1', stake: '10', covers: [0] }),
        bet({ odds: '2', stake: '', covers: [1] }),
      ]),
      settings,
    );
    expect(calc.errors[0].odds).toBeDefined();
    expect(calc.errors[1].odds).toBeUndefined();
  });

  test('ungültiger Einsatz wird markiert', () => {
    const calc = calculate(state([bet({ odds: '2', stake: '-5', covers: [0] })]), settings);
    expect(calc.errors[0].stake).toBeDefined();
  });

  test('nichts eingetragen', () => {
    const calc = calculate(state([bet({ odds: '', stake: '', covers: [0] })]), settings);
    expect(calc.plan).toBeUndefined();
    expect(calc.hint).toBe('Trage die Quoten ein.');
  });

  test('Gratiswette: nur der Gewinn zählt, Gegenwette gleicht aus', () => {
    const calc = calculate(
      state([
        bet({ type: 'gratiswette', odds: '5', stake: '10', covers: [0] }),
        bet({ odds: '1,8', covers: [1] }),
      ]),
      settings,
    );
    expect(calc.stakeHints[1]).toBeCloseTo(22.222, 3);
    expect(calc.plan?.minValue).toBeCloseTo(17.778, 3);
  });

  test('Risikofrei mit Gratiswette-Erstattung: Bargeld und Gratiswette getrennt', () => {
    const calc = calculate(
      state(
        [
          bet({ type: 'risikofrei', odds: '2,2', stake: '5', covers: [0], refundKind: 'gratiswette' }),
          bet({ odds: '2,05', covers: [2] }),
          bet({ odds: '6', covers: [1] }),
        ],
        ['Bet Builder', 'Dt. gewinnt unter 2,5', '1X'],
      ),
      settings,
    );
    // Gratiswette 5 € zählt mit 60 % = 3 €
    expect(calc.stakeHints[1]).toBeCloseTo(8 / 2.05, 3);
    expect(calc.stakeHints[2]).toBeCloseTo(8 / 6, 3);
    expect(calc.plan?.minValue).toBeCloseTo(6 - 8 / 2.05 - 8 / 6, 3);
    expect(calc.plan?.outcomes[0].freebet).toBe(0);
    expect(calc.plan?.outcomes[1].freebet).toBe(5);
  });

  test('Steuer-Schalter einer Wette senkt den Gewinn', () => {
    const calc = calculate(
      state([bet({ odds: '2,5', stake: '100', covers: [0], tax: true }), bet({ odds: '1,8', covers: [1] })]),
      settings,
    );
    expect(calc.stakeHints[1]).toBeCloseTo(134.472, 3);
    expect(calc.plan?.minValue).toBeCloseTo(7.578, 3);
  });

  test('Quotenboost mit Max-Einsatz', () => {
    const calc = calculate(
      state([bet({ type: 'boost', odds: '3', covers: [0], maxStake: '10' }), bet({ odds: '1,9', covers: [1] })]),
      settings,
    );
    expect(calc.stakeHints[0]).toBeCloseTo(10, 6);
    expect(calc.stakeHints[1]).toBeCloseTo(15.789, 3);
  });

  test('Höchstbetrag und Max-Einsatz werden nur beim passenden Typ geprüft', () => {
    const calc = calculate(
      state([
        bet({ type: 'risikofrei', odds: '2', stake: '5', covers: [0], refundCap: '0' }),
        bet({ type: 'boost', odds: '2', covers: [1], maxStake: '-1' }),
        bet({ type: 'normal', odds: '2', covers: [1], refundCap: 'x', maxStake: 'x' }),
      ]),
      settings,
    );
    expect(calc.errors[0].refundCap).toBeDefined();
    expect(calc.errors[1].maxStake).toBeDefined();
    expect(calc.errors[2]).toEqual({});
  });
});
