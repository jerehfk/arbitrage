import { describe, expect, test } from 'vitest';
import { emptyBet } from './model';
import { defaultSettings } from './settings';
import { load, providerKey, rememberTax, save, withProvider } from './storage';

function memory(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('sportwetten-rechner:v1', initial);
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('load und save', () => {
  test('leerer Speicher: Standard ohne Eingaben', () => {
    const saved = load(memory());
    expect(saved.state).toBeUndefined();
    expect(saved.settings).toEqual(defaultSettings);
    expect(saved.taxByProvider).toEqual({});
  });

  test('Rundreise erhält Eingaben, Einstellungen und Anbieter-Schalter', () => {
    const store = memory();
    const state = {
      outcomes: ['1', 'X', '2'],
      bets: [{ ...emptyBet(0), provider: 'Tipico', odds: '2,1', covers: [0, 1], tax: true }, emptyBet(2)],
    };
    const settings = { taxPercent: '5', conversionPercent: '70', budget: '200' };
    save(store, { state, settings, taxByProvider: { tipico: true } });
    expect(load(store)).toEqual({ state, settings, taxByProvider: { tipico: true } });
  });

  test('kaputtes JSON: Standard', () => {
    expect(load(memory('{kaputt')).state).toBeUndefined();
  });

  test('ungültige Eingaben werden verworfen, Einstellungen bleiben', () => {
    const raw = JSON.stringify({
      state: { outcomes: ['1'], bets: [] },
      settings: { taxPercent: '4' },
    });
    const saved = load(memory(raw));
    expect(saved.state).toBeUndefined();
    expect(saved.settings.taxPercent).toBe('4');
    expect(saved.settings.budget).toBe('100');
  });

  test('ungültige Ausgang-Indizes werden bereinigt', () => {
    const raw = JSON.stringify({
      state: { outcomes: ['1', '2'], bets: [{ odds: '2', covers: [5, -1], type: 'quatsch' }] },
    });
    const bet = load(memory(raw)).state?.bets[0];
    expect(bet?.covers).toEqual([0]);
    expect(bet?.type).toBe('normal');
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

describe('Steuer-Schalter pro Anbieter', () => {
  test('Schlüssel ignoriert Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(providerKey('  TiPiCo ')).toBe('tipico');
  });

  test('bekannter Anbieter setzt den Schalter', () => {
    const bet = withProvider(emptyBet(0), 'Tipico', { tipico: true });
    expect(bet.provider).toBe('Tipico');
    expect(bet.tax).toBe(true);
  });

  test('unbekannter Anbieter lässt den Schalter unverändert', () => {
    const bet = withProvider({ ...emptyBet(0), tax: true }, 'bet365', { tipico: false });
    expect(bet.tax).toBe(true);
  });

  test('rememberTax merkt nur bei vorhandenem Namen', () => {
    expect(rememberTax({}, 'Tipico', true)).toEqual({ tipico: true });
    expect(rememberTax({ tipico: true }, 'Tipico', false)).toEqual({ tipico: false });
    expect(rememberTax({}, '  ', true)).toEqual({});
  });
});
