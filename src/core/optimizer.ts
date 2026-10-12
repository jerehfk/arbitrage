import { settle, totalValue, type Bet, type Result } from './payout';
import { solveLP } from './simplex';

export interface Leg {
  bet: Omit<Bet, 'stake'>;
  /** Indizes der Ausgänge, bei denen diese Wette gewinnt. */
  covers: number[];
  /** Fester Einsatz; ohne Angabe berechnet der Optimierer ihn. */
  stake?: number;
}

export interface Settings {
  taxRate: number;
  conversionRate: number;
}

export interface OutcomeResult extends Result {
  /** Bargeld plus Gratiswette mit der Umwandlungsquote bewertet. */
  value: number;
}

export interface Plan {
  /** `unbegrenzt`: Der Gewinn wächst mit dem Einsatz ohne Grenze, es fehlt ein fester Einsatz oder Max-Einsatz. */
  status: 'optimal' | 'unbegrenzt';
  stakes: number[];
  outcomes: OutcomeResult[];
  minValue: number;
  /** Eingesetztes Bargeld (Gratiswetten zählen nicht). */
  totalStake: number;
  /** Bringen alle Ausgänge gleich viel? */
  equal: boolean;
}

const TOL = 1e-7;

/** Wählt die freien Einsätze so, dass der schlechteste Ausgang möglichst gut ausfällt. */
export function optimize(legs: Leg[], outcomeCount: number, settings: Settings): Plan {
  const { taxRate, conversionRate } = settings;
  if (outcomeCount < 1) throw new Error('Mindestens ein Ausgang nötig');
  for (const leg of legs) {
    if (leg.covers.some((k) => !Number.isInteger(k) || k < 0 || k >= outcomeCount)) {
      throw new Error('Ungültiger Ausgang in covers');
    }
  }

  const value = (r: Result) => totalValue(r, conversionRate);
  const wins = (leg: Leg, k: number) => leg.covers.includes(k);

  // Beitrag der festen Einsätze je Ausgang
  const fixed = new Array<number>(outcomeCount).fill(0);
  for (const leg of legs) {
    if (leg.stake === undefined) continue;
    for (let k = 0; k < outcomeCount; k++) {
      fixed[k] += value(settle({ ...leg.bet, stake: leg.stake }, wins(leg, k), taxRate));
    }
  }
  const floor = Math.min(...fixed);

  // Variablen: Einsatz x je freier Wette, Erstattung r je freier risikofreier Wette, Hilfsgröße u
  const free = legs.flatMap((leg, i) => (leg.stake === undefined ? [i] : []));
  const xIdx = new Map(free.map((li, v) => [li, v] as const));
  const rIdx = new Map<number, number>();
  let n = free.length;
  for (const li of free) if (legs[li].bet.type === 'risikofrei') rIdx.set(li, n++);
  const uIdx = n++;

  // Gewinn je Ausgang als Zeile über die Variablen
  const profit = Array.from({ length: outcomeCount }, (_, k) => {
    const row = new Array<number>(n).fill(0);
    for (const li of free) {
      const leg = legs[li];
      const unit = { ...leg.bet, stake: 1, maxStake: undefined, refundCap: undefined } as Bet;
      const full = value(settle(unit, wins(leg, k), taxRate));
      if (leg.bet.type === 'risikofrei' && !wins(leg, k)) {
        const base = value(settle({ ...unit, refundCap: 0 }, false, taxRate));
        row[xIdx.get(li)!] = base;
        row[rIdx.get(li)!] = full - base;
      } else {
        row[xIdx.get(li)!] = full;
      }
    }
    return row;
  });

  // Grenzen: Max-Einsatz, Erstattung höchstens Einsatz bzw. Höchstbetrag
  const capRows: number[][] = [];
  const capRhs: number[] = [];
  for (const li of free) {
    const { maxStake, refundCap } = legs[li].bet;
    const x = xIdx.get(li)!;
    if (maxStake !== undefined) {
      const row = new Array<number>(n).fill(0);
      row[x] = 1;
      capRows.push(row);
      capRhs.push(maxStake);
    }
    const r = rIdx.get(li);
    if (r !== undefined) {
      const link = new Array<number>(n).fill(0);
      link[r] = 1;
      link[x] = -1;
      capRows.push(link);
      capRhs.push(0);
      if (refundCap !== undefined) {
        const cap = new Array<number>(n).fill(0);
        cap[r] = 1;
        capRows.push(cap);
        capRhs.push(refundCap);
      }
    }
  }

  const finish = (stakes: number[], status: Plan['status']): Plan => {
    const outcomes: OutcomeResult[] = Array.from({ length: outcomeCount }, (_, k) => {
      let cash = 0;
      let freebet = 0;
      legs.forEach((leg, i) => {
        if (stakes[i] <= 0) return;
        const r = settle({ ...leg.bet, stake: stakes[i] }, wins(leg, k), taxRate);
        cash += r.cash;
        freebet += r.freebet;
      });
      return { cash, freebet, value: cash + freebet * conversionRate };
    });
    const values = outcomes.map((o) => o.value);
    const minValue = Math.min(...values);
    return {
      status,
      stakes,
      outcomes,
      minValue,
      totalStake: legs.reduce((s, leg, i) => (leg.bet.type === 'gratiswette' ? s : s + stakes[i]), 0),
      equal: Math.max(...values) - minValue < 1e-6,
    };
  };
  const stakesFrom = (x: number[]) =>
    legs.map((leg, i) => {
      if (leg.stake !== undefined) return leg.stake;
      const v = x[xIdx.get(i)!] ?? 0;
      return v < 1e-9 ? 0 : v;
    });

  // Stufe 1: Mindestgewinn maximieren (t = floor + u)
  const c1 = new Array<number>(n).fill(0);
  c1[uIdx] = 1;
  const A1 = [...profit.map((row) => row.map((v, j) => (j === uIdx ? 1 : -v))), ...capRows];
  const b1 = [...fixed.map((f) => f - floor), ...capRhs];
  const stage1 = solveLP(c1, A1, b1);
  if (stage1.status !== 'optimal') return finish(stakesFrom([]), 'unbegrenzt');
  const best = stage1.x[uIdx];

  // Stufe 2: bei gleichem Mindestgewinn möglichst wenig Bargeld einsetzen
  const c2 = new Array<number>(n).fill(0);
  for (const li of free) if (legs[li].bet.type !== 'gratiswette') c2[xIdx.get(li)!] = -1;
  const A2 = [...profit.map((row) => row.map((v, j) => (j === uIdx ? 0 : -v))), ...capRows];
  const b2 = [...fixed.map((f) => f - floor - best + TOL), ...capRhs];
  const stage2 = solveLP(c2, A2, b2);
  return finish(stakesFrom(stage2.status === 'optimal' ? stage2.x : stage1.x), 'optimal');
}
