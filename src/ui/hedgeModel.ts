import { buildLibrary, findHedge } from '../core/hedge';
import { isCombo } from '../core/match';
import { parseBet } from '../core/parse';

/** Eingaben des Reiters "Absichern": Teamnamen und die eigene Wette als freier Text. */
export interface HedgeState {
  home: string;
  away: string;
  text: string;
}

export const initialHedge: HedgeState = { home: '', away: '', text: '' };

export interface HedgeLeg {
  label: string;
  combo: boolean;
}

export interface HedgeCalculation {
  /** Wie die App die Wette verstanden hat. */
  understood: string;
  /** Teile des Textes, die nicht verstanden wurden. */
  unknown: string[];
  /** Die beste Absicherung: wenige Wetten, wenig Überschneidung, wenige Kombi-Wetten. */
  best?: { legs: HedgeLeg[] };
  hint?: string;
}

export function calculateHedge(state: HedgeState): HedgeCalculation {
  const names = { home: state.home, away: state.away };
  const parsed = parseBet(state.text, names);
  const base = { understood: parsed.understood, unknown: parsed.unknown };
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
    default:
      return { ...base, best: { legs: hedge.legs.map((m) => ({ label: m.label, combo: isCombo(m) })) } };
  }
}
