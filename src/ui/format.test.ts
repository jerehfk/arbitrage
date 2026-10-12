import { describe, expect, test } from 'vitest';
import { formatEuro, formatGain, formatPlain, parseNumber } from './format';

const plain = (s: string) => s.replace(/ /g, ' ');

describe('parseNumber', () => {
  test('Komma und Punkt', () => {
    expect(parseNumber('2,05')).toBe(2.05);
    expect(parseNumber('2.05')).toBe(2.05);
    expect(parseNumber(' 10 ')).toBe(10);
  });
  test('leer und ungültig', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('1,2,3')).toBeNull();
  });
});

describe('Formatierung', () => {
  test('Euro', () => {
    expect(plain(formatEuro(1234.5))).toBe('1.234,50 €');
  });
  test('Gewinn mit Vorzeichen', () => {
    expect(plain(formatGain(1.255))).toBe('+1,26 €');
    expect(plain(formatGain(-3))).toBe('-3,00 €');
  });
  test('Rundungsrauschen wird zu 0', () => {
    expect(plain(formatGain(-1e-12))).toBe('0,00 €');
  });
  test('Eingabefeld', () => {
    expect(formatPlain(22.2222)).toBe('22,22');
  });
});
