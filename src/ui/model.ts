import { optimize, type Leg, type Plan, type Settings } from '../core/optimizer';
import { parseNumber } from './format';

export interface BetInput {
  provider: string;
  odds: string;
  /** Leer: der Rechner bestimmt den Einsatz. */
  stake: string;
  /** Index des Ausgangs, bei dem die Wette gewinnt. */
  covers: number;
}

export interface UiState {
  outcomes: string[];
  bets: BetInput[];
}

export interface BetErrors {
  odds?: string;
  stake?: string;
}

export interface Calculation {
  plan?: Plan;
  errors: BetErrors[];
  /** Berechneter Einsatz je Wette (nur für Wetten ohne festen Einsatz). */
  stakeHints: (number | undefined)[];
  hint?: string;
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
    const fixed = parseNumber(bet.stake);
    if (bet.stake.trim() !== '' && (fixed === null || fixed <= 0)) {
      errors[i].stake = 'Der Einsatz muss größer als 0 sein.';
    }
    if (odds !== null && odds > 1 && !errors[i].stake) {
      legs.push({ bet: { type: 'normal', odds, tax: false }, covers: [bet.covers], stake: fixed ?? undefined });
      used.push(i);
    }
  });

  if (legs.length === 0) return { errors, stakeHints, hint: 'Trage die Quoten ein.' };

  const plan = optimize(legs, state.outcomes.length, settings);
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
  const nothingFixed = legs.every((leg) => leg.stake === undefined);
  if (nothingFixed && plan.totalStake === 0) {
    return {
      plan,
      errors,
      stakeHints,
      hint: 'Mit diesen Quoten ist kein Gewinn möglich. Lege bei einer Wette einen Einsatz fest, um die Ergebnisse zu sehen.',
    };
  }
  return { plan, errors, stakeHints };
}
