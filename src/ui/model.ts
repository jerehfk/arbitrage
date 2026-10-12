import { optimize, type Leg, type Plan, type Settings } from '../core/optimizer';
import type { BetType, RefundKind } from '../core/payout';
import { parseNumber } from './format';

export interface BetInput {
  provider: string;
  type: BetType;
  odds: string;
  /** Leer: der Rechner bestimmt den Einsatz. */
  stake: string;
  /** Indizes der Ausgänge, bei denen die Wette gewinnt (mindestens einer). */
  covers: number[];
  /** Wettsteuer auf den Gewinn dieser Wette abziehen. */
  tax: boolean;
  /** Nur bei risikofrei: Erstattung als Bargeld oder Gratiswette. */
  refundKind: RefundKind;
  /** Nur bei risikofrei: Höchstbetrag der Erstattung, leer = voller Einsatz. */
  refundCap: string;
  /** Nur bei Quotenboost: Einsatzlimit, leer = unbegrenzt. */
  maxStake: string;
}

export interface UiState {
  outcomes: string[];
  bets: BetInput[];
}

export interface BetErrors {
  covers?: string;
  odds?: string;
  stake?: string;
  refundCap?: string;
  maxStake?: string;
}

export interface Calculation {
  plan?: Plan;
  errors: BetErrors[];
  /** Berechneter Einsatz je Wette (nur für Wetten ohne festen Einsatz). */
  stakeHints: (number | undefined)[];
  hint?: string;
  /** Gesamteinsatz, mit dem gerechnet wurde, weil kein Einsatz fest war. */
  assumedBudget?: number;
}

/** Gesamteinsatz, wenn der Nutzer keinen Einsatz festlegt. */
export const DEFAULT_BUDGET = 100;

export const emptyBet = (covers: number): BetInput => ({
  provider: '',
  type: 'normal',
  odds: '',
  stake: '',
  covers: [covers],
  tax: false,
  refundKind: 'bar',
  refundCap: '',
  maxStake: '',
});

/** Leer: `undefined`. Zahl über 0: die Zahl. Sonst `null` (ungültig). */
function optionalPositive(text: string): number | undefined | null {
  if (text.trim() === '') return undefined;
  const n = parseNumber(text);
  return n !== null && n > 0 ? n : null;
}

/** Übersetzt die Eingaben der Oberfläche in eine Rechnung des Kerns. */
export function calculate(state: UiState, settings: Settings): Calculation {
  const errors: BetErrors[] = state.bets.map(() => ({}));
  const stakeHints: (number | undefined)[] = state.bets.map(() => undefined);
  const legs: Leg[] = [];
  const used: number[] = [];

  state.bets.forEach((bet, i) => {
    const odds = parseNumber(bet.odds);
    if (bet.odds.trim() !== '' && (odds === null || odds <= 1)) {
      errors[i].odds = 'Die Quote muss größer als 1 sein.';
    }
    const fixed = optionalPositive(bet.stake);
    if (fixed === null) errors[i].stake = 'Der Einsatz muss größer als 0 sein.';
    const refundCap = bet.type === 'risikofrei' ? optionalPositive(bet.refundCap) : undefined;
    if (refundCap === null) errors[i].refundCap = 'Der Höchstbetrag muss größer als 0 sein.';
    const maxStake = bet.type === 'boost' ? optionalPositive(bet.maxStake) : undefined;
    if (maxStake === null) errors[i].maxStake = 'Der Max-Einsatz muss größer als 0 sein.';

    if (bet.covers.length === 0) errors[i].covers = 'Wähle mindestens einen Ausgang.';

    if (bet.covers.length > 0 && odds !== null && odds > 1 && fixed !== null && refundCap !== null && maxStake !== null) {
      legs.push({
        bet: {
          type: bet.type,
          odds,
          tax: bet.tax,
          refundKind: bet.type === 'risikofrei' ? bet.refundKind : undefined,
          refundCap,
          maxStake,
        },
        covers: bet.covers,
        stake: fixed,
      });
      used.push(i);
    }
  });

  if (legs.length === 0) return { errors, stakeHints, hint: 'Trage die Quoten ein.' };

  const nothingFixed = legs.every((leg) => leg.stake === undefined);
  const budget = nothingFixed ? DEFAULT_BUDGET : undefined;
  const plan = optimize(legs, state.outcomes.length, settings, budget);
  used.forEach((betIndex, legIndex) => {
    if (legs[legIndex].stake === undefined) stakeHints[betIndex] = plan.stakes[legIndex];
  });

  if (plan.status === 'unbegrenzt') {
    return {
      errors,
      stakeHints,
      hint: 'Der Gewinn wächst mit dem Einsatz ohne Grenze. Lege bei einer Wette einen Einsatz fest.',
    };
  }
  if (nothingFixed && plan.totalStake === 0) {
    return {
      plan,
      errors,
      stakeHints,
      hint: 'Mit diesen Quoten ist kein Gewinn möglich. Lege bei einer Wette einen Einsatz fest, um die Ergebnisse zu sehen.',
    };
  }
  return { plan, errors, stakeHints, assumedBudget: budget };
}
