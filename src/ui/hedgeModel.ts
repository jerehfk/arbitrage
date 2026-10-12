import { bonusByOdds, type BonusRow } from '../core/bonus';
import { buildLibrary, findHedge } from '../core/hedge';
import { CELL_COUNT, isCombo } from '../core/match';
import { parseBet } from '../core/parse';
import { formatPlain, parseNumber } from './format';
import { calculate, emptyFields, parseFields, type BetErrors, type BetFields, type BetInput } from './model';
import { defaultSettings, resolveSettings, type ResolvedSettings } from './settings';
import type { ResultRow } from './ResultPanel';

/** Quote und Steuer-Schalter einer Absicherung. */
export interface LegQuote {
  odds: string;
  tax: boolean;
}

/** Eingaben des Reiters "Absichern": Teamnamen, die eigene Wette als Text, Bonus und Quoten (alles optional). */
export interface HedgeState {
  home: string;
  away: string;
  text: string;
  /** Art, Quote, Einsatz der eigenen Wette (z. B. Gratiswette). */
  own: BetFields;
  /** Quoten der Absicherungen, nach Markt-Schlüssel. */
  quotes: Record<string, LegQuote>;
}

export const initialHedge: HedgeState = { home: '', away: '', text: '', own: emptyFields(), quotes: {} };

export interface HedgeLeg {
  key: string;
  label: string;
  combo: boolean;
  /** Berechneter Einsatz, wenn alle Quoten da sind. */
  stake?: number;
}

export interface HedgeMoney {
  rows: ResultRow[];
  minValue: number;
  equal: boolean;
  totalStake: number;
  note?: string;
  hint?: string;
  /** Berechneter Einsatz der eigenen Wette, wenn das Feld leer ist. */
  ownStake?: number;
  /** Mindestgewinn im Verhältnis zur Gratiswette bzw. zum Einsatz. */
  rate?: number;
}

export interface HedgeCalculation {
  /** Wie die App die Wette verstanden hat. */
  understood: string;
  /** Teile des Textes, die nicht verstanden wurden. */
  unknown: string[];
  /** Die beste Absicherung: wenige Wetten, wenig Überschneidung, wenige Kombi-Wetten. */
  best?: { legs: HedgeLeg[] };
  hint?: string;
  /** Fehler der Felder der eigenen Wette. */
  ownErrors: BetErrors;
  /** Einsätze und Gewinn, sobald die Quoten eingetragen sind. */
  money?: HedgeMoney;
  /** Was für die Einsätze noch fehlt. */
  quoteHint?: string;
  /** Gewinn je Quote, nur bei Gratiswette oder Risikofrei. */
  table?: BonusRow[];
}

const TABLE_ODDS = [2, 3, 4, 6, 8, 10];

const defaultResolved = resolveSettings(defaultSettings);

export function calculateHedge(state: HedgeState, resolved: ResolvedSettings = defaultResolved): HedgeCalculation {
  const names = { home: state.home, away: state.away };
  const parsed = parseBet(state.text, names);
  const own = parseFields(state.own);
  const base = { understood: parsed.understood, unknown: parsed.unknown, ownErrors: own.errors };
  if (parsed.empty) {
    return { ...base, hint: 'Schreibe deine Wette in das Feld, z. B. „Atlético gewinnt & über 2,5 Tore“.' };
  }
  if (parsed.unknown.length > 0 || !parsed.market) {
    return { ...base, hint: 'Nicht verstanden: ' + parsed.unknown.map((u) => `„${u}“`).join(', ') + '. Diese Wette wird nicht berechnet.' };
  }
  const hedge = findHedge(parsed.market, buildLibrary(names, parsed.info));
  switch (hedge.status) {
    case 'unmoeglich':
      return { ...base, hint: 'Diese Wette kann nie eintreten. Es gibt nichts abzusichern.' };
    case 'nichts':
      return { ...base, hint: 'Diese Wette deckt schon alle Fälle ab. Es gibt nichts abzusichern.' };
    case 'keine':
      return { ...base, hint: 'Für diese Wette habe ich keine Absicherung mit bis zu 3 Wetten gefunden.' };
  }

  const legs: HedgeLeg[] = hedge.legs.map((m) => ({ key: m.key, label: m.label, combo: isCombo(m) }));
  const result: HedgeCalculation = { ...base, best: { legs } };

  // Tabelle: was bringt der Bonus bei welcher Quote?
  const type = state.own.type;
  if ((type === 'gratiswette' || type === 'risikofrei') && own.stake !== undefined) {
    const odds = [...TABLE_ODDS];
    if (own.bet && !odds.includes(own.bet.odds)) odds.push(own.bet.odds);
    odds.sort((a, b) => a - b);
    const table = bonusByOdds(
      { type, stake: own.stake, tax: state.own.tax, refundKind: own.bet?.refundKind ?? state.own.refundKind },
      odds,
      resolved.settings,
      resolved.commission,
    );
    if (table.length > 0) result.table = table;
  }

  // Einsätze: nur mit Quote der eigenen Wette und aller Absicherungen.
  const ownHasOdds = state.own.odds.trim() !== '';
  const quoteOf = (key: string) => parseNumber(state.quotes[key]?.odds ?? '');
  const legOdds = legs.map((l) => quoteOf(l.key));
  const anyLegOdds = state.own.odds.trim() !== '' || legOdds.some((o) => o !== null);
  if (!anyLegOdds) return result;
  if (own.errors.odds || own.errors.stake || own.errors.refundCap || own.errors.maxStake) return result;
  const missing = [
    ...(ownHasOdds && own.bet ? [] : ['deine Wette']),
    ...legs.filter((_, i) => legOdds[i] === null || legOdds[i]! <= 1).map((l) => l.label),
  ];
  if (missing.length > 0) {
    return { ...result, quoteHint: `Für die Einsätze fehlt noch die Quote bei: ${missing.join(', ')}.` };
  }

  // Alle Torverläufe mit gleichem Verhalten bei allen Wetten bilden einen Ausgang.
  const masks = [parsed.market.mask, ...hedge.legs.map((m) => m.mask)];
  const labels = ['Deine Wette', ...legs.map((l) => l.label)];
  const groups = new Map<string, number>();
  for (let i = 0; i < CELL_COUNT; i++) {
    const key = masks.map((m) => m[i]).join('');
    if (!key.includes('1')) continue;
    if (!groups.has(key)) groups.set(key, groups.size);
  }
  const keys = [...groups.keys()];
  const covers = (j: number) => keys.flatMap((k, g) => (k[j] === '1' ? [g] : []));
  const names2 = keys.map((k) =>
    labels.filter((_, j) => k[j] === '1').join(' + '),
  );
  const bets: BetInput[] = [
    { ...state.own, covers: covers(0) },
    ...legs.map((l, j): BetInput => ({
      ...emptyFields(),
      odds: state.quotes[l.key]?.odds ?? '',
      tax: state.quotes[l.key]?.tax ?? false,
      covers: covers(j + 1),
    })),
  ];
  const calc = calculate({ outcomes: names2, bets }, resolved.settings, resolved.budget);
  const plan = calc.plan;
  if (!plan) return { ...result, quoteHint: calc.hint };

  const stakes = plan.stakes;
  const ownStake = own.stake ?? stakes[0];
  const money: HedgeMoney = {
    rows: plan.outcomes.map((o, i) => ({ name: names2[i], value: o.value, cash: o.cash, freebet: o.freebet })),
    minValue: plan.minValue,
    equal: plan.equal,
    totalStake: plan.totalStake,
    hint:
      calc.hint ??
      (stakes.slice(1).every((x) => x < 0.005)
        ? 'Mit diesen Quoten lohnt sich keine Absicherung: Die Quoten der Absicherungen sind dafür zu niedrig.'
        : undefined),
    ownStake: own.stake === undefined ? stakes[0] : undefined,
    rate: (type === 'gratiswette' || type === 'risikofrei') && ownStake > 0 ? plan.minValue / ownStake : undefined,
    note:
      calc.assumedBudget !== undefined
        ? `Gerechnet mit ${formatPlain(calc.assumedBudget)} € Gesamteinsatz. Lege den Einsatz deiner Wette fest, um das zu ändern.`
        : undefined,
  };
  return {
    ...result,
    best: { legs: legs.map((l, j) => ({ ...l, stake: stakes[j + 1] })) },
    money,
  };
}
