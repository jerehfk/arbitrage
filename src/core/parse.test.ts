import { describe, expect, test } from 'vitest';
import { parseBet } from './parse';

const names = { home: 'Atlético Madrid', away: 'Man Utd' };
const label = (text: string, n = names) => {
  const p = parseBet(text, n);
  return p.unknown.length ? `?${p.unknown.join('|')}` : p.market?.label;
};

describe('parseBet', () => {
  test('leer', () => {
    expect(parseBet('  ', names).empty).toBe(true);
  });

  test('Beispiel aus dem Alltag', () => {
    expect(label('Endergebnis Atletico Madrid & Mehr als 2,5 Tore im Spiel')).toBe('Atlético Madrid gewinnt & über 2,5 Tore');
    expect(label('Atlético gewinnt und über 2.5')).toBe('Atlético Madrid gewinnt & über 2,5 Tore');
  });

  test('Ergebnisse und Doppelte Chance', () => {
    expect(label('Remis')).toBe('Remis');
    expect(label('Atlético oder Remis')).toBe('Atlético Madrid oder Remis');
    expect(label('1X')).toBe('Atlético Madrid oder Remis');
    expect(label('Man Utd verliert nicht')).toBe('Remis oder Man Utd');
    expect(label('Atlético gewinnt nicht')).toBe('Remis oder Man Utd');
    expect(label('Atlético verliert')).toBe('Man Utd gewinnt');
    expect(label('Heim oder Gast')).toBe('Atlético Madrid oder Man Utd');
  });

  test('Tore, Linien', () => {
    expect(label('unter 3,5 Tore')).toBe('Unter 3,5 Tore');
    expect(label('mehr als 2 Tore')).toBe('Über 2,5 Tore');
    expect(label('mindestens 3 Tore')).toBe('Über 2,5 Tore');
    expect(label('höchstens 2 Tore')).toBe('Unter 2,5 Tore');
    expect(label('o1.5 & u3.5')).toBe('Über 1,5 Tore & unter 3,5 Tore');
  });

  test('Beide Teams treffen', () => {
    expect(label('Beide Teams treffen')).toBe('Beide Teams treffen');
    expect(label('beide Teams treffen nein')).toBe('Nicht beide Teams treffen');
    expect(label('Atlético gewinnt & BTTS')).toBe('Atlético Madrid gewinnt & beide Teams treffen');
  });

  test('Halbzeiten', () => {
    const n = { home: 'Spanien', away: 'Italien' };
    expect(label('Spanien gewinnt beide Halbzeiten', n)).toBe('Spanien gewinnt beide Halbzeiten');
    expect(label('Halbzeit-Ergebnis Italien', n)).toBe('Italien gewinnt Halbzeit 1');
    expect(label('Spanien gewinnt die 2. Halbzeit', n)).toBe('Spanien gewinnt Halbzeit 2');
  });

  test('Tordifferenz und Handicap', () => {
    const n = { home: 'Spanien', away: 'Italien' };
    expect(label('Spanien gewinnt mit mindestens 2 Toren Unterschied', n)).toBe('Spanien gewinnt mit mindestens 2 Toren Unterschied');
    expect(label('Spanien gewinnt mit 1 Tor Unterschied', n)).toBe('Spanien gewinnt mit genau 1 Tor Unterschied');
    expect(label('Spanien -1,5', n)).toBe('Spanien Handicap −1,5');
    expect(label('Handicap Italien +1.5', n)).toBe('Italien Handicap +1,5');
  });

  test('Unbekanntes wird gemeldet und nicht berechnet', () => {
    const p = parseBet('Atlético gewinnt & Torschütze Griezmann', names);
    expect(p.market).toBeUndefined();
    expect(p.unknown).toEqual(['Torschütze Griezmann']);
    expect(p.understood).toBe('Atlético Madrid gewinnt');
  });

  test('Ohne eingetragene Namen sind Teamnamen unbekannt', () => {
    expect(label('Atlético gewinnt', { home: '', away: '' })).toBe('?Atlético gewinnt');
  });
});
