import {
  describeMarket,
  isCombo,
  marketCells,
  suggestHedges,
  type Goals,
  type Names,
} from '../core/hedge';

/** Eingaben des Reiters "Absichern": nur die eigene Wette, ohne Quoten und Einsätze. */
export interface HedgeState {
  home: string;
  away: string;
  /** Torlinie als Text, z. B. "2,5" (nur Beschriftung). */
  line: string;
  /** Ergebnisse (0 Heim, 1 Remis, 2 Auswärts), bei denen die eigene Wette gewinnt. */
  results: number[];
  goals: Goals;
}

export const initialHedge: HedgeState = {
  home: '',
  away: '',
  line: '2,5',
  results: [0],
  goals: 'ueber',
};

export interface HedgeLeg {
  label: string;
  combo: boolean;
}

export interface HedgeBest {
  legs: HedgeLeg[];
}

export interface HedgeCalculation {
  boostLabel: string;
  /** Die beste Absicherung: wenige Wetten, keine doppelt abgedeckten Fälle, wenige Kombi-Wetten. */
  best?: HedgeBest;
  hint?: string;
}

/** Beste Absicherung für die eigene Wette: eine Menge von Wetten, die alle übrigen Fälle abdeckt. */
export function calculateHedge(state: HedgeState): HedgeCalculation {
  const names: Names = { home: state.home, away: state.away, line: state.line };
  if (state.results.length === 0) return { boostLabel: '', hint: 'Wähle mindestens ein Ergebnis.' };
  const market = { results: state.results, goals: state.goals };
  const boostLabel = describeMarket(market, names);
  const [best] = suggestHedges(marketCells(market), 1);
  if (!best) return { boostLabel, hint: 'Diese Wette deckt schon alle Fälle ab, es gibt nichts abzusichern.' };
  return { boostLabel, best: { legs: best.map((m) => ({ label: describeMarket(m, names), combo: isCombo(m) })) } };
}
