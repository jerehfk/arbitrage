import {
  breakEvenOdds,
  CELL_COUNT,
  cellName,
  describeMarket,
  isCombo,
  marketCells,
  marketKey,
  suggestHedges,
  type Goals,
  type Names,
} from '../core/hedge';
import { optimize, type Leg, type Plan, type Settings } from '../core/optimizer';
import { parseNumber } from './format';
import { DEFAULT_BUDGET, emptyFields, parseFields, type BetErrors, type BetFields } from './model';

/** Eingaben des Reiters "Absichern". */
export interface HedgeState {
  home: string;
  away: string;
  /** Torlinie als Text, z. B. "2,5" (nur Beschriftung). */
  line: string;
  /** Ergebnisse (0 Heim, 1 Remis, 2 Auswärts), bei denen die eigene Wette gewinnt. */
  results: number[];
  goals: Goals;
  boost: BetFields;
  /** Eingetragene Quoten der Absicherungen, Schlüssel siehe `marketKey`. */
  hedges: Record<string, { odds: string; tax: boolean }>;
  /** Gewählter Vorschlag (`HedgeOption.id`); leer = der erste mit allen Quoten. */
  selected: string;
}

export const initialHedge: HedgeState = {
  home: '',
  away: '',
  line: '2,5',
  results: [0],
  goals: 'ueber',
  boost: { ...emptyFields(), type: 'boost' },
  hedges: {},
  selected: '',
};

export interface HedgeLeg {
  key: string;
  label: string;
  combo: boolean;
  /** Fehlertext zur eingetragenen Quote. */
  error?: string;
}

export interface HedgeOption {
  id: string;
  legs: HedgeLeg[];
  /** Gemeinsame Mindestquote aller Absicherungen; `null`: auch bei Quote 1000 nicht erreichbar; fehlt: Quote der eigenen Wette fehlt. */
  breakEven?: number | null;
  /** Nur mit allen Quoten und festem oder begrenztem Einsatz. */
  plan?: Plan;
  /** Einsätze: Index 0 eigene Wette, danach die Absicherungen in Reihenfolge von `legs`. */
  stakes?: number[];
  /** Der Gewinn wächst ohne Grenze: es fehlt ein Einsatz. */
  unbounded?: boolean;
}

export interface HedgeCalculation {
  names: Names;
  boostLabel: string;
  cellNames: string[];
  errors: BetErrors;
  options: HedgeOption[];
  /** Vorschlag, dessen Ergebnis angezeigt wird. */
  selectedId?: string;
  hint?: string;
  /** Gesamteinsatz, mit dem gerechnet wurde, weil kein Einsatz begrenzt war. */
  assumedBudget?: number;
}

export function calculateHedge(state: HedgeState, settings: Settings, defaultBudget = DEFAULT_BUDGET): HedgeCalculation {
  const names: Names = { home: state.home, away: state.away, line: state.line };
  const cellNames = Array.from({ length: CELL_COUNT }, (_, c) => cellName(c, names));
  const boostMarket = { results: state.results, goals: state.goals };
  const boostLabel = state.results.length > 0 ? describeMarket(boostMarket, names) : '';
  const base = { names, boostLabel, cellNames };

  const parsed = parseFields(state.boost);
  const errors = { ...parsed.errors };
  let boostBet = parsed.bet;
  if (boostBet && boostBet.type === 'gratiswette' && parsed.stake === undefined) {
    errors.stake = 'Trage den Betrag der Gratiswette ein.';
    boostBet = undefined;
  }

  if (state.results.length === 0) return { ...base, errors, options: [], hint: 'Wähle mindestens ein Ergebnis.' };
  const cells = marketCells(boostMarket);
  const suggestions = suggestHedges(cells);
  if (suggestions.length === 0) {
    return { ...base, errors, options: [], hint: 'Diese Wette deckt schon alle Fälle ab, es gibt nichts abzusichern.' };
  }

  const needBudget = boostBet !== undefined && parsed.stake === undefined && boostBet.maxStake === undefined;
  const budget = needBudget ? defaultBudget : undefined;
  let assumedBudget: number | undefined;

  const options: HedgeOption[] = suggestions.map((markets) => {
    const input = markets.map((m) => state.hedges[marketKey(m)]);
    const legs: HedgeLeg[] = markets.map((m, i) => {
      const text = input[i]?.odds ?? '';
      const odds = parseNumber(text);
      const error = text.trim() !== '' && (odds === null || odds <= 1) ? 'Die Quote muss größer als 1 sein.' : undefined;
      return { key: marketKey(m), label: describeMarket(m, names), combo: isCombo(m), error };
    });
    const option: HedgeOption = { id: markets.map(marketKey).join('+'), legs };
    if (!boostBet) return option;

    option.breakEven = breakEvenOdds(
      { bet: boostBet, stake: parsed.stake ?? boostBet.maxStake ?? 10, cells },
      markets.map((m, i) => ({ cells: marketCells(m), tax: input[i]?.tax ?? false })),
      settings,
    );

    const odds = input.map((h) => parseNumber(h?.odds ?? ''));
    if (odds.some((o) => o === null || o <= 1)) return option;
    const plan = optimize(
      [
        { bet: boostBet, covers: cells, stake: parsed.stake },
        ...markets.map(
          (m, i): Leg => ({ bet: { type: 'normal', odds: odds[i]!, tax: input[i]?.tax ?? false }, covers: marketCells(m) }),
        ),
      ],
      CELL_COUNT,
      settings,
      budget,
    );
    if (plan.status === 'unbegrenzt') return { ...option, unbounded: true };
    if (budget !== undefined) assumedBudget = budget;
    return { ...option, plan, stakes: plan.stakes };
  });

  const selected = options.find((o) => o.id === state.selected) ?? options.find((o) => o.plan);
  return { ...base, errors, options, selectedId: selected?.id, assumedBudget: selected?.plan ? assumedBudget : undefined };
}
