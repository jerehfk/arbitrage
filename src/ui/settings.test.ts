import { describe, expect, test } from 'vitest';
import { defaultSettings, resolveSettings } from './settings';

describe('resolveSettings', () => {
  test('Standard: 5,3 % Steuer, 60 % Umwandlung, 100 € Startwert', () => {
    const r = resolveSettings(defaultSettings);
    expect(r.settings).toEqual({ taxRate: 0.053, conversionRate: 0.6 });
    expect(r.budget).toBe(100);
    expect(r.errors).toEqual({});
  });

  test('Komma und Punkt werden verstanden', () => {
    const r = resolveSettings({ ...defaultSettings, taxPercent: '5.5', conversionPercent: '75,5', budget: '250,5' });
    expect(r.settings.taxRate).toBeCloseTo(0.055, 10);
    expect(r.settings.conversionRate).toBeCloseTo(0.755, 10);
    expect(r.budget).toBe(250.5);
  });

  test('ungültige Werte: Fehler und Standard als Rückfall', () => {
    const r = resolveSettings({ ...defaultSettings, taxPercent: 'x', conversionPercent: '120', budget: '0' });
    expect(Object.keys(r.errors).sort()).toEqual(['budget', 'conversionPercent', 'taxPercent']);
    expect(r.settings).toEqual({ taxRate: 0.053, conversionRate: 0.6 });
    expect(r.budget).toBe(100);
  });

  test('Provision: Standard 3 %, ungültig fällt zurück', () => {
    expect(resolveSettings(defaultSettings).commission).toBeCloseTo(0.03, 10);
    const r = resolveSettings({ ...defaultSettings, commissionPercent: 'x' });
    expect(r.errors.commissionPercent).toBeDefined();
    expect(r.commission).toBeCloseTo(0.03, 10);
  });

  test('0 % ist erlaubt', () => {
    const r = resolveSettings({ ...defaultSettings, taxPercent: '0' });
    expect(r.errors.taxPercent).toBeUndefined();
    expect(r.settings.taxRate).toBe(0);
  });
});
