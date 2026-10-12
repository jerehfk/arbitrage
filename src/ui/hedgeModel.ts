import {
  describeMarket,
  isCombo,
  marketCells,
  marketKey,
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

export interface HedgeOption {
  id: string;
  legs: HedgeLeg[];
}

export interface HedgeCalculation {
  boostLabel: string;
  options: HedgeOption[];
  hint?: string;
}

/** Absicherungen für die eigene Wette: Mengen von Wetten, die alle übrigen Fälle abdecken, wenige zuerst. */
export function calculateHedge(state: HedgeState): HedgeCalculation {
  const names: Names = { home: state.home, away: state.away, line: state.line };
  if (state.results.length === 0) return { boostLabel: '', options: [], hint: 'Wähle mindestens ein Ergebnis.' };
  const market = { results: state.results, goals: state.goals };
  const boostLabel = describeMarket(market, names);
  const suggestions = suggestHedges(marketCells(market));
  if (suggestions.length === 0) {
    return { boostLabel, options: [], hint: 'Diese Wette deckt schon alle Fälle ab, es gibt nichts abzusichern.' };
  }
  return {
    boostLabel,
    options: suggestions.map((markets) => ({
      id: markets.map(marketKey).join('+'),
      legs: markets.map((m) => ({ label: describeMarket(m, names), combo: isCombo(m) })),
    })),
  };
}
