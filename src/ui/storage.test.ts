import { describe, expect, test } from 'vitest';
import { initialHedge } from './hedgeModel';
import { emptyBet, emptyFields } from './model';
import { defaultSettings } from './settings';
import { load, save } from './storage';

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('sportwetten-rechner:v1', initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('load und save', () => {
  test('leerer Speicher: Standard ohne Eingaben, Reiter Absichern', () => {
    const saved = load(memory());
    expect(saved.tab).toBe('absichern');
    expect(saved.state).toBeUndefined();
    expect(saved.hedge).toBeUndefined();
    expect(saved.settings).toEqual(defaultSettings);
  });

  test('Rundreise erhält Reiter, Eingaben beider Reiter und Einstellungen', () => {
    const store = memory();
    const state = {
      outcomes: ['1', 'X', '2'],
      bets: [{ ...emptyBet(0), odds: '2,1', covers: [0, 1], tax: true }, emptyBet(2)],
    };
    const hedge = {
      ...initialHedge,
      home: 'Atlético',
      text: 'Atlético gewinnt & über 2,5 Tore',
      own: { ...emptyFields(), type: 'gratiswette' as const, odds: '4', stake: '3' },
      quotes: { 'R:DA': { odds: '1,5', tax: true } },
    };
    const settings = { taxPercent: '5', conversionPercent: '70', budget: '200', commissionPercent: '2' };
    save(store, { tab: 'frei', state, hedge, settings });
    expect(load(store)).toEqual({ tab: 'frei', state, hedge, settings });
  });

  test('kaputtes JSON: Standard', () => {
    expect(load(memory('{kaputt')).state).toBeUndefined();
  });

  test('ungültige Eingaben werden verworfen, Einstellungen bleiben', () => {
    const raw = JSON.stringify({
      state: { outcomes: ['1'], bets: [] },
      hedge: 'quatsch',
      settings: { taxPercent: '4' },
    });
    const saved = load(memory(raw));
    expect(saved.state).toBeUndefined();
    expect(saved.hedge).toBeUndefined();
    expect(saved.settings.taxPercent).toBe('4');
    expect(saved.settings.budget).toBe('100');
  });

  test('ungültige Werte werden bereinigt', () => {
    const raw = JSON.stringify({
      state: { outcomes: ['1', '2'], bets: [{ odds: '2', covers: [5, -1], type: 'quatsch' }] },
      hedge: { home: 5, text: 'x' },
    });
    const saved = load(memory(raw));
    expect(saved.state?.bets[0].covers).toEqual([0]);
    expect(saved.state?.bets[0].type).toBe('normal');
    expect(saved.hedge).toEqual({ ...initialHedge, text: 'x' });
  });

  test('ohne Speicher oder bei Fehler: kein Absturz', () => {
    expect(load(undefined).state).toBeUndefined();
    expect(() => save(undefined, load(undefined))).not.toThrow();
    const broken = {
      getItem: () => {
        throw new Error('gesperrt');
      },
      setItem: () => {
        throw new Error('gesperrt');
      },
    };
    expect(load(broken).settings).toEqual(defaultSettings);
    expect(() => save(broken, load(undefined))).not.toThrow();
  });
});
