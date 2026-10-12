export type BetType = 'normal' | 'gratiswette' | 'risikofrei' | 'boost';
export type RefundKind = 'bar' | 'gratiswette';

export interface Bet {
  type: BetType;
  odds: number;
  stake: number;
  /** Wettsteuer auf den Gewinn dieser Wette abziehen. */
  tax: boolean;
  /** Einsatzlimit, z. B. bei Boosts. */
  maxStake?: number;
  /** Höchstbetrag der Erstattung (risikofrei). Ohne Angabe: voller Einsatz. */
  refundCap?: number;
  /** Erstattung als Bargeld (Standard) oder als Gratiswette. */
  refundKind?: RefundKind;
}

/** Ergebnis in Bargeld; `freebet` ist der Nennwert einer erhaltenen Gratiswette. */
export interface Result {
  cash: number;
  freebet: number;
}

/** Gesamtwert: Bargeld plus Gratiswette mit der Umwandlungsquote bewertet. */
export function totalValue(result: Result, conversionRate: number): number {
  return result.cash + result.freebet * conversionRate;
}

function assertFinite(name: string, value: number): void {
  if (!Number.isFinite(value)) throw new Error(`${name} muss eine Zahl sein`);
}

/** Ergebnis einer Wette, wenn ihr Ausgang eintritt (`won`) oder nicht. */
export function settle(bet: Bet, won: boolean, taxRate: number): Result {
  assertFinite('Quote', bet.odds);
  assertFinite('Einsatz', bet.stake);
  assertFinite('Steuersatz', taxRate);
  if (bet.odds <= 1) throw new Error('Quote muss größer als 1 sein');
  if (bet.stake <= 0) throw new Error('Einsatz muss größer als 0 sein');
  if (taxRate < 0 || taxRate > 1) throw new Error('Steuersatz muss zwischen 0 und 1 liegen');

  const stake = bet.maxStake === undefined ? bet.stake : Math.min(bet.stake, bet.maxStake);
  const gain = stake * (bet.odds - 1) * (bet.tax ? 1 - taxRate : 1);

  switch (bet.type) {
    case 'gratiswette':
      return { cash: won ? gain : 0, freebet: 0 };
    case 'risikofrei': {
      if (won) return { cash: gain, freebet: 0 };
      const refund = Math.min(stake, bet.refundCap ?? stake);
      return bet.refundKind === 'gratiswette'
        ? { cash: -stake, freebet: refund }
        : { cash: -stake + refund, freebet: 0 };
    }
    case 'normal':
    case 'boost':
      return { cash: won ? gain : -stake, freebet: 0 };
  }
}
