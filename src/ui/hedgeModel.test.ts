import { describe, expect, test } from 'vitest';
import { calculateHedge, type HedgeState } from './hedgeModel';

const state = (text: string, patch: Partial<HedgeState> = {}): HedgeState => ({
  home: 'Atlético',
  away: 'Man Utd',
  text,
  ...patch,
});
const legs = (text: string, patch: Partial<HedgeState> = {}) =>
  calculateHedge(state(text, patch)).best?.legs.map((l) => l.label).sort();

describe('calculateHedge', () => {
  test('Atlético & über 2,5: zwei Wetten, eine davon Kombi', () => {
    const calc = calculateHedge(state('Atlético gewinnt & über 2,5 Tore'));
    expect(calc.understood).toBe('Atlético gewinnt & über 2,5 Tore');
    expect(calc.best?.legs.map((l) => l.label).sort()).toEqual(['Atlético gewinnt & unter 2,5 Tore', 'Remis oder Man Utd']);
    expect(calc.best?.legs.filter((l) => l.combo)).toHaveLength(1);
  });

  test('einfaches Ergebnis: eine Wette', () => {
    expect(legs('Atlético gewinnt')).toEqual(['Remis oder Man Utd']);
    expect(legs('Remis')).toEqual(['Atlético oder Man Utd']);
  });

  test('Beide Halbzeiten: je Halbzeit "Remis oder Gegner"', () => {
    expect(legs('Spanien gewinnt beide Halbzeiten', { home: 'Spanien', away: 'Italien' })).toEqual([
      'Remis oder Italien in Halbzeit 1',
      'Remis oder Italien in Halbzeit 2',
    ]);
  });

  test('Handicap -1,5 wird mit Tordifferenz abgesichert', () => {
    const calc = calculateHedge(state('Atlético -1,5'));
    expect(calc.best).toBeDefined();
    expect(calc.best!.legs.length).toBeLessThanOrEqual(3);
  });

  test('Beide Teams treffen: Gegenstück', () => {
    expect(legs('Beide Teams treffen')).toEqual(['Nicht beide Teams treffen']);
  });

  test('Hinweise', () => {
    expect(calculateHedge(state('')).hint).toMatch(/Schreibe deine Wette/);
    expect(calculateHedge(state('Torschütze Griezmann')).hint).toMatch(/Nicht verstanden/);
    expect(calculateHedge(state('über 2,5 & unter 2,5')).hint).toMatch(/nie eintreten/);
    expect(calculateHedge(state('Atlético oder Remis oder Man Utd')).hint).toMatch(/Nicht verstanden/);
  });
});
