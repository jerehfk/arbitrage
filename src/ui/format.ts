/** Liest eine Zahl in deutscher oder englischer Schreibweise („2,05“ oder „2.05“). */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function clean(n: number): number {
  return Math.abs(n) < 0.005 ? 0 : n;
}

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const gain = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', signDisplay: 'exceptZero' });

export function formatEuro(n: number): string {
  return euro.format(clean(n));
}

/** Mit Vorzeichen für Gewinn (+) und Verlust (−). */
export function formatGain(n: number): string {
  return gain.format(clean(n));
}

/** Zahl mit Komma für Eingabefelder, ohne Währung. */
export function formatPlain(n: number): string {
  return n.toFixed(2).replace('.', ',');
}
