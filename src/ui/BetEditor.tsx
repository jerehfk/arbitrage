import type { ComponentChildren } from 'preact';
import { formatPlain } from './format';
import type { BetErrors, BetFields } from './model';

const TYPES: { value: BetFields['type']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'gratiswette', label: 'Gratiswette' },
  { value: 'risikofrei', label: 'Risikofrei' },
  { value: 'boost', label: 'Quotenboost' },
];

interface Props {
  fields: BetFields;
  errors: BetErrors;
  /** Berechneter Einsatz, wenn das Feld leer ist. */
  stakeHint?: number;
  onChange: (patch: Partial<BetFields>) => void;
  /** Wird zwischen Art und Quote eingefügt (z. B. die Auswahl der Ausgänge). */
  children?: ComponentChildren;
}

/** Art, Quote mit Steuer-Schalter, Einsatz und Zusatzfelder einer Wette; Kinder eines `.bet`-Rasters. */
export function BetEditor({ fields, errors, stakeHint, onChange, children }: Props) {
  return (
    <>
      <label class="f-type">
        <span>Art</span>
        <select value={fields.type} onChange={(e) => onChange({ type: e.currentTarget.value as BetFields['type'] })}>
          {TYPES.map((t) => (
            <option value={t.value} key={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      {children}
      <div class="f-odds">
        <label>
          <span>Quote</span>
          <input
            inputMode="decimal"
            aria-invalid={errors.odds ? 'true' : undefined}
            value={fields.odds}
            onInput={(e) => onChange({ odds: e.currentTarget.value })}
          />
        </label>
        <label class="tax">
          <input
            type="checkbox"
            role="switch"
            checked={fields.tax}
            onChange={(e) => onChange({ tax: e.currentTarget.checked })}
          />
          <span>Steuer</span>
        </label>
        {errors.odds && <em class="error">{errors.odds}</em>}
      </div>
      <label class="f-stake">
        <span>{fields.type === 'gratiswette' ? 'Gratiswette in €' : 'Einsatz in €'}</span>
        <input
          inputMode="decimal"
          aria-invalid={errors.stake ? 'true' : undefined}
          placeholder={stakeHint !== undefined ? `${formatPlain(stakeHint)} berechnet` : 'berechnet'}
          value={fields.stake}
          onInput={(e) => onChange({ stake: e.currentTarget.value })}
        />
        {errors.stake && <em class="error">{errors.stake}</em>}
      </label>
      {(fields.type === 'risikofrei' || fields.type === 'boost') && (
        <div class="extras">
          {fields.type === 'risikofrei' && (
            <>
              <label>
                <span>Erstattung als</span>
                <select
                  value={fields.refundKind}
                  onChange={(e) => onChange({ refundKind: e.currentTarget.value as BetFields['refundKind'] })}
                >
                  <option value="bar">Bargeld</option>
                  <option value="gratiswette">Gratiswette</option>
                </select>
              </label>
              <label>
                <span>Höchstbetrag in €</span>
                <input
                  inputMode="decimal"
                  placeholder="voller Einsatz"
                  aria-invalid={errors.refundCap ? 'true' : undefined}
                  value={fields.refundCap}
                  onInput={(e) => onChange({ refundCap: e.currentTarget.value })}
                />
                {errors.refundCap && <em class="error">{errors.refundCap}</em>}
              </label>
            </>
          )}
          {fields.type === 'boost' && (
            <label>
              <span>Max-Einsatz in €</span>
              <input
                inputMode="decimal"
                placeholder="unbegrenzt"
                aria-invalid={errors.maxStake ? 'true' : undefined}
                value={fields.maxStake}
                onInput={(e) => onChange({ maxStake: e.currentTarget.value })}
              />
              {errors.maxStake && <em class="error">{errors.maxStake}</em>}
            </label>
          )}
        </div>
      )}
    </>
  );
}
