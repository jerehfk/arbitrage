import { describe, expect, test } from 'vitest';
import { bonusByOdds } from './bonus';

const settings = { taxRate: 0.053, conversionRate: 0.6 };

describe('bonusByOdds', () => {
  test('Gratiswette ohne Provision: Gewinn = Wert · (Quote − 1) / Quote', () => {
    const [row] = bonusByOdds({ type: 'gratiswette', stake: 10, tax: false }, [4], settings, 0);
    expect(row.profit).toBeCloseTo(7.5, 6);
    expect(row.rate).toBeCloseTo(0.75, 6);
  });

  test('Provision senkt den Gewinn', () => {
    const [a] = bonusByOdds({ type: 'gratiswette', stake: 10, tax: false }, [4], settings, 0);
    const [b] = bonusByOdds({ type: 'gratiswette', stake: 10, tax: false }, [4], settings, 0.03);
    expect(b.profit).toBeLessThan(a.profit);
    expect(b.profit).toBeGreaterThan(7);
  });

  test('Risikofrei mit Erstattung als Gratiswette: Gewinn positiv, steigt mit der Quote', () => {
    const rows = bonusByOdds({ type: 'risikofrei', stake: 3, tax: false, refundKind: 'gratiswette' }, [2, 4, 8], settings, 0.03);
    expect(rows.map((r) => r.profit).every((p) => p > 0)).toBe(true);
    expect(rows[2].profit).toBeGreaterThan(rows[0].profit);
  });

  test('Quoten bis 1 werden ausgelassen', () => {
    expect(bonusByOdds({ type: 'gratiswette', stake: 3, tax: false }, [1, 0.5, 3], settings, 0)).toHaveLength(1);
  });
});
