import { describe, expect, test } from 'vitest';
import { calculateHedge, initialHedge, type HedgeState } from './hedgeModel';
import { emptyFields } from './model';

type Patch = Partial<HedgeState>;
const state = (text: string, patch: Patch = {}): HedgeState => ({
  ...initialHedge,
  home: 'Atlético',
  away: 'Man Utd',
  text,
  ...patch,
});
const legs = (text: string, patch: Patch = {}) =>
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

describe('Quoten und Einsätze', () => {
  const own = { ...emptyFields(), type: 'gratiswette' as const, odds: '4', stake: '3' };
  const withQuote = (key: string, odds: string) => ({ [key]: { odds, tax: false } });

  test('ohne Quoten keine Einsätze', () => {
    const calc = calculateHedge(state('Atlético gewinnt', { own: emptyFields() }));
    expect(calc.money).toBeUndefined();
    expect(calc.quoteHint).toBeUndefined();
  });

  test('Quote der eigenen Wette ohne Quote der Absicherung: Hinweis', () => {
    const calc = calculateHedge(state('Atlético gewinnt', { own }));
    expect(calc.money).toBeUndefined();
    expect(calc.quoteHint).toMatch(/Remis oder Man Utd/);
  });

  test('Gratiswette 3 € auf Quote 4, Gegenseite 1,35: Einsatz und Gewinn passen', () => {
    const key = calculateHedge(state('Atlético gewinnt')).best!.legs[0].key;
    const calc = calculateHedge(state('Atlético gewinnt', { own, quotes: withQuote(key, '1,35') }));
    const money = calc.money!;
    // Gratiswette gewinnt: 3 · 3 = 9. Verliert sie: Gegenwette mit Stake h bringt h · 0,35 − 0 ... gleiche Ausgänge.
    const h = calc.best!.legs[0].stake!;
    expect(h).toBeCloseTo(9 / 1.35, 3);
    expect(money.rows).toHaveLength(2);
    expect(money.minValue).toBeCloseTo(9 - h, 3);
    expect(money.equal).toBe(true);
    expect(money.rate).toBeCloseTo(money.minValue / 3, 6);
  });

  test('Quoten-Übersicht gibt es nur bei Gratiswette oder Risikofrei', () => {
    expect(calculateHedge(state('Atlético gewinnt', { own })).table?.length).toBeGreaterThan(3);
    expect(calculateHedge(state('Atlético gewinnt', { own: { ...own, type: 'normal' } })).table).toBeUndefined();
  });

  test('höhere Quote bringt bei Gratiswette mehr', () => {
    const rows = calculateHedge(state('Atlético gewinnt', { own })).table!;
    for (let i = 1; i < rows.length; i++) expect(rows[i].profit).toBeGreaterThan(rows[i - 1].profit);
  });
});

describe('zu niedrige Quoten', () => {
  test('Hinweis statt Null-Rechnung', () => {
    const own = { ...emptyFields(), type: 'gratiswette' as const, odds: '4', stake: '3' };
    const base = calculateHedge(state('Atlético gewinnt & über 2,5 Tore'));
    const quotes = Object.fromEntries(base.best!.legs.map((l) => [l.key, { odds: '1,4', tax: false }]));
    const calc = calculateHedge(state('Atlético gewinnt & über 2,5 Tore', { own, quotes }));
    expect(calc.money?.hint).toMatch(/lohnt sich keine Absicherung/);
  });

  test('passende Quoten: Mindestgewinn positiv', () => {
    const own = { ...emptyFields(), type: 'gratiswette' as const, odds: '4', stake: '3' };
    const base = calculateHedge(state('Atlético gewinnt & über 2,5 Tore'));
    const quotes = Object.fromEntries(base.best!.legs.map((l, i) => [l.key, { odds: i === 0 ? '1,6' : '4', tax: false }]));
    const calc = calculateHedge(state('Atlético gewinnt & über 2,5 Tore', { own, quotes }));
    expect(calc.money?.hint).toBeUndefined();
    expect(calc.money!.minValue).toBeGreaterThan(0);
  });
});
