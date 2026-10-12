import { formatEuro, formatGain } from './format';

export interface ResultRow {
  name: string;
  /** Gewinn in diesem Fall (Bargeld plus bewertete Gratiswette). */
  value: number;
  cash: number;
  freebet: number;
}

interface Props {
  rows?: ResultRow[];
  minValue?: number;
  equal?: boolean;
  totalStake?: number;
  conversionRate: number;
  /** Zusatzzeile, z. B. der angenommene Gesamteinsatz. */
  note?: string;
  hint?: string;
}

const tone = (n: number) => (n > 0.004 ? 'gain' : n < -0.004 ? 'loss' : 'zero');

/** Gewinnfeld: Mindestgewinn und Gewinn je Ausgang. */
export function ResultPanel({ rows, minValue, equal, totalStake, conversionRate, note, hint }: Props) {
  const maxAbs = rows ? Math.max(...rows.map((o) => Math.abs(o.value)), 0.01) : 1;
  return (
    <aside class="result" aria-live="polite" aria-label="Ergebnis">
      {rows && minValue !== undefined ? (
        <>
          <p class="min">
            <span>Mindestgewinn</span>
            <strong class={tone(minValue)}>{formatGain(minValue)}</strong>
          </p>
          <ul class="rows">
            {rows.map((o, k) => (
              <li key={k}>
                <span class="name">{o.name}</span>
                <span class={`val ${tone(o.value)}`}>{formatGain(o.value)}</span>
                {o.freebet > 0.004 && (
                  <span class="detail">
                    {formatGain(o.cash)} bar, dazu {formatEuro(o.freebet)} Gratiswette (Wert{' '}
                    {formatEuro(o.freebet * conversionRate)})
                  </span>
                )}
                <span class="track" aria-hidden="true">
                  <span class={`bar ${tone(o.value)}`} style={{ width: `${(Math.abs(o.value) / maxAbs) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
          <p class="meta">
            {equal ? 'Alle Ausgänge bringen gleich viel.' : 'Die Ausgänge bringen unterschiedlich viel.'}
            <br />
            Eingesetzt: {formatEuro(totalStake ?? 0)}
            {note && (
              <>
                <br />
                {note}
              </>
            )}
          </p>
        </>
      ) : null}
      {hint && <p class="hint">{hint}</p>}
    </aside>
  );
}
