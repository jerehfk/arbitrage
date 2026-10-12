import { optimize, type Settings } from './optimizer';
import type { RefundKind } from './payout';

export interface BonusRow {
  odds: number;
  /** Mindestgewinn in Euro. */
  profit: number;
  /** Mindestgewinn im Verhältnis zum Betrag der Gratiswette bzw. des Einsatzes. */
  rate: number;
}

export interface BonusOwn {
  type: 'gratiswette' | 'risikofrei';
  stake: number;
  tax: boolean;
  refundKind?: RefundKind;
}

/**
 * Wie viel bringt der Bonus bei verschiedenen Quoten? Zwei Ausgänge: deine Wette gegen die Gegenseite.
 * Annahme: Die Gegenseite hat keinen Aufschlag, vom Gewinn der Gegenwette geht nur die Provision ab.
 */
export function bonusByOdds(own: BonusOwn, odds: number[], settings: Settings, commission: number): BonusRow[] {
  const rows: BonusRow[] = [];
  for (const q of odds) {
    if (!(q > 1)) continue;
    const fair = q / (q - 1);
    const hedgeOdds = 1 + (fair - 1) * (1 - commission);
    const plan = optimize(
      [
        { bet: { type: own.type, odds: q, tax: own.tax, refundKind: own.refundKind }, covers: [0], stake: own.stake },
        { bet: { type: 'normal', odds: hedgeOdds, tax: false }, covers: [1] },
      ],
      2,
      settings,
    );
    if (plan.status !== 'optimal') continue;
    rows.push({ odds: q, profit: plan.minValue, rate: plan.minValue / own.stake });
  }
  return rows;
}
