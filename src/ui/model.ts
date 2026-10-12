import { optimize, type Leg, type Plan, type Settings } from '../core/optimizer';
import type { Bet, BetType, RefundKind } from '../core/payout';
import { parseNumber } from './format';

/** Die Felder einer einzelnen Wette, so wie sie in der Oberfläche stehen. */
export interface BetFields {
  type: BetType;
  odds: string;
  /** Leer: der Rechner bestimmt den Einsatz. */
  stake: string;
  /** Wettsteuer auf den Gewinn dieser Wette abziehen. */
  tax: boolean;
  /** Nur bei risikofrei: Erstattung als Bargeld oder Gratiswette. */
  refundKind: RefundKind;
  /** Nur bei risikofrei: Höchstbetrag der Erstattung, leer = voller Einsatz. */
  refundCap: string;
  /** Nur bei Quotenboost: Einsatzlimit, leer = unbegrenzt. */
  maxStake: string;
}

export interface BetInput extends BetFields {
  /** Indizes der Ausgänge, bei denen die Wette gewinnt (mindestens einer). */
  covers: number[];
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

export const emptyFields = (): BetFields => ({
  type: 'normal',
  odds: '',
  stake: '',
  tax: false,
  refundKind: 'bar',
  refundCap: '',
  maxStake: '',
});

export const emptyBet = (covers: number): BetInput => ({ ...emptyFields(), covers: [covers] });

/** Leer: `undefined`. Zahl über 0: die Zahl. Sonst `null` (ungültig). */
function optionalPositive(text: string): number | undefined | null {
  if (text.trim() === '') return undefined;
  const n = parseNumber(text);
  return n !== null && n > 0 ? n : null;
}

export interface ParsedFields {
  /** Nur gesetzt, wenn die Quote und alle Zusatzfelder gültig sind. */
  bet?: Omit<Bet, 'stake'>;
  /** Fester Einsatz; `undefined` = der Rechner bestimmt ihn. */
  stake?: number;
  errors: BetErrors;
}

/** Prüft die Felder einer Wette und übersetzt sie für den Kern. */
export function parseFields(f: BetFields): ParsedFields {
  const errors: BetErrors = {};
  const odds = parseNumber(f.odds);
  if (f.odds.trim() !== '' && (odds === null || odds <= 1)) errors.odds = 'Die Quote muss größer als 1 sein.';
  const stake = optionalPositive(f.stake);
  if (stake === null) errors.stake = 'Der Einsatz muss größer als 0 sein.';
  const refundCap = f.type === 'risikofrei' ? optionalPositive(f.refundCap) : undefined;
  if (refundCap === null) errors.refundCap = 'Der Höchstbetrag muss größer als 0 sein.';
  const maxStake = f.type === 'boost' ? optionalPositive(f.maxStake) : undefined;
  if (maxStake === null) errors.maxStake = 'Der Max-Einsatz muss größer als 0 sein.';
  if (odds === null || odds <= 1 || stake === null || refundCap === null || maxStake === null) return { errors };
  return {
    bet: {
      type: f.type,
      odds,
      tax: f.tax,
      refundKind: f.type === 'risikofrei' ? f.refundKind : undefined,
      refundCap,
      maxStake,
    },
    stake,
    errors,
  };
}

/** Übersetzt die Eingaben der Oberfläche in eine Rechnung des Kerns. */
export function calculate(state: UiState, settings: Settings, defaultBudget = DEFAULT_BUDGET): Calculation {
  const errors: BetErrors[] = state.bets.map(() => ({}));
  const stakeHints: (number | undefined)[] = state.bets.map(() => undefined);
  const legs: Leg[] = [];
  const used: number[] = [];

  state.bets.forEach((bet, i) => {
    const parsed = parseFields(bet);
    errors[i] = { ...parsed.errors };
    if (bet.covers.length === 0) errors[i].covers = 'Wähle mindestens einen Ausgang.';
    if (parsed.bet && bet.covers.length > 0) {
      legs.push({ bet: parsed.bet, covers: bet.covers, stake: parsed.stake });
      used.push(i);
    }
  });

  if (legs.length === 0) return { errors, stakeHints, hint: 'Trage die Quoten ein.' };

  const nothingFixed = legs.every((leg) => leg.stake === undefined);
  const budget = nothingFixed ? defaultBudget : undefined;
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
