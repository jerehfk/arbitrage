import { useEffect, useMemo, useState } from 'preact/hooks';
import { formatEuro, formatGain, formatPlain } from './format';
import { calculate, emptyBet, type BetInput, type UiState } from './model';
import { defaultSettings, resolveSettings, type UiSettings } from './settings';
import { load, rememberTax, save, withProvider } from './storage';

const MAX_OUTCOMES = 5;
const MIN_OUTCOMES = 2;
const MAX_BETS = 10;

const TYPES: { value: BetInput['type']; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'gratiswette', label: 'Gratiswette' },
  { value: 'risikofrei', label: 'Risikofrei' },
  { value: 'boost', label: 'Quotenboost' },
];

const initial: UiState = {
  outcomes: ['1', 'X', '2'],
  bets: [emptyBet(0), emptyBet(1), emptyBet(2)],
};

/** Entfernt Ausgang k aus der Auswahl und rückt die höheren Indizes nach. */
function remap(covers: number[], k: number): number[] {
  const next = covers.filter((c) => c !== k).map((c) => (c > k ? c - 1 : c));
  return next.length > 0 ? next : [0];
}

function getStore(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function App() {
  const [saved] = useState(() => load(getStore()));
  const [state, setState] = useState<UiState>(saved.state ?? initial);
  const [ui, setUi] = useState<UiSettings>(saved.settings);
  const [taxByProvider, setTaxByProvider] = useState(saved.taxByProvider);
  const [showSettings, setShowSettings] = useState(false);
  const resolved = useMemo(() => resolveSettings(ui), [ui]);
  const calc = useMemo(
    () => calculate(state, resolved.settings, resolved.budget),
    [state, resolved],
  );

  useEffect(() => {
    save(getStore(), { state, settings: ui, taxByProvider });
  }, [state, ui, taxByProvider]);

  const outcomeName = (k: number) => state.outcomes[k].trim() || `Ausgang ${k + 1}`;

  const setOutcome = (k: number, name: string) =>
    setState((s) => ({ ...s, outcomes: s.outcomes.map((o, i) => (i === k ? name : o)) }));

  const addOutcome = () =>
    setState((s) => ({ ...s, outcomes: [...s.outcomes, String(s.outcomes.length + 1)] }));

  const removeOutcome = (k: number) =>
    setState((s) => ({
      outcomes: s.outcomes.filter((_, i) => i !== k),
      bets: s.bets.map((b) => ({ ...b, covers: remap(b.covers, k) })),
    }));

  const setBet = (i: number, patch: Partial<BetInput>) =>
    setState((s) => ({ ...s, bets: s.bets.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  const addBet = () => setState((s) => ({ ...s, bets: [...s.bets, emptyBet(0)] }));
  const removeBet = (i: number) => setState((s) => ({ ...s, bets: s.bets.filter((_, j) => j !== i) }));

  const plan = calc.plan;
  const maxAbs = plan ? Math.max(...plan.outcomes.map((o) => Math.abs(o.value)), 0.01) : 1;
  const tone = (n: number) => (n > 0.004 ? 'gain' : n < -0.004 ? 'loss' : 'zero');

  return (
    <div class="page">
      <header class="top">
        <h1>Sportwetten-Rechner</h1>
        <button
          class="icon gear"
          aria-label="Einstellungen"
          aria-expanded={showSettings}
          aria-controls="settings"
          onClick={() => setShowSettings((v) => !v)}
        >
          {'\u2699\uFE0E'}
        </button>
      </header>

      {showSettings && (
        <section id="settings" class="settings" aria-labelledby="h-settings">
          <h2 id="h-settings">Einstellungen</h2>
          <div class="fields">
            <label>
              <span>Wettsteuer in %</span>
              <input
                inputMode="decimal"
                aria-invalid={resolved.errors.taxPercent ? 'true' : undefined}
                value={ui.taxPercent}
                onInput={(e) => setUi({ ...ui, taxPercent: e.currentTarget.value })}
              />
              {resolved.errors.taxPercent && <em class="error">{resolved.errors.taxPercent}</em>}
            </label>
            <label>
              <span>Wert einer Gratiswette in %</span>
              <input
                inputMode="decimal"
                aria-invalid={resolved.errors.conversionPercent ? 'true' : undefined}
                value={ui.conversionPercent}
                onInput={(e) => setUi({ ...ui, conversionPercent: e.currentTarget.value })}
              />
              {resolved.errors.conversionPercent && <em class="error">{resolved.errors.conversionPercent}</em>}
            </label>
            <label>
              <span>Gesamteinsatz ohne festen Einsatz in €</span>
              <input
                inputMode="decimal"
                aria-invalid={resolved.errors.budget ? 'true' : undefined}
                value={ui.budget}
                onInput={(e) => setUi({ ...ui, budget: e.currentTarget.value })}
              />
              {resolved.errors.budget && <em class="error">{resolved.errors.budget}</em>}
            </label>
          </div>
          <div class="actions">
            <button class="add" onClick={() => setUi({ ...defaultSettings })}>
              Einstellungen zurücksetzen
            </button>
            <button class="add" onClick={() => setState(initial)}>
              Eingaben zurücksetzen
            </button>
          </div>
        </section>
      )}

      <main class="layout">
        <div class="inputs">
          <section aria-labelledby="h-outcomes">
            <h2 id="h-outcomes">Ausgänge</h2>
            <ul class="outcomes">
              {state.outcomes.map((name, k) => (
                <li key={k}>
                  <input
                    aria-label={`Name von Ausgang ${k + 1}`}
                    value={name}
                    onInput={(e) => setOutcome(k, e.currentTarget.value)}
                  />
                  {state.outcomes.length > MIN_OUTCOMES && (
                    <button class="icon" aria-label={`Ausgang ${outcomeName(k)} entfernen`} onClick={() => removeOutcome(k)}>
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {state.outcomes.length < MAX_OUTCOMES && (
              <button class="add" onClick={addOutcome}>
                Ausgang hinzufügen
              </button>
            )}
          </section>

          <section aria-labelledby="h-bets">
            <h2 id="h-bets">Wetten</h2>
            <ul class="bets">
              {state.bets.map((bet, i) => {
                const err = calc.errors[i];
                const hint = calc.stakeHints[i];
                return (
                  <li class="bet" key={i}>
                    <label class="f-provider">
                      <span>Anbieter</span>
                      <input value={bet.provider} onInput={(e) => {
                          const name = e.currentTarget.value;
                          setState((st) => ({
                            ...st,
                            bets: st.bets.map((b, j) => (j === i ? withProvider(b, name, taxByProvider) : b)),
                          }));
                        }} />
                    </label>
                    <label class="f-type">
                      <span>Art</span>
                      <select value={bet.type} onChange={(e) => setBet(i, { type: e.currentTarget.value as BetInput['type'] })}>
                        {TYPES.map((t) => (
                          <option value={t.value} key={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <fieldset class="f-covers">
                      <legend>Gewinnt bei</legend>
                      <div class="chips">
                        {state.outcomes.map((_, k) => {
                          const on = bet.covers.includes(k);
                          return (
                            <label class={on ? 'chip on' : 'chip'} key={k}>
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => {
                                  const next = on ? bet.covers.filter((c) => c !== k) : [...bet.covers, k].sort();
                                  if (next.length > 0) setBet(i, { covers: next });
                                }}
                              />
                              <span>{outcomeName(k)}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    <div class="f-odds">
                      <label>
                        <span>Quote</span>
                        <input
                          inputMode="decimal"
                          aria-invalid={err.odds ? 'true' : undefined}
                          value={bet.odds}
                          onInput={(e) => setBet(i, { odds: e.currentTarget.value })}
                        />
                      </label>
                      <label class="tax">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={bet.tax}
                          onChange={(e) => {
                            const tax = e.currentTarget.checked;
                            setBet(i, { tax });
                            setTaxByProvider((m) => rememberTax(m, bet.provider, tax));
                          }}
                        />
                        <span>Steuer</span>
                      </label>
                      {err.odds && <em class="error">{err.odds}</em>}
                    </div>
                    <label class="f-stake">
                      <span>{bet.type === 'gratiswette' ? 'Gratiswette in €' : 'Einsatz in €'}</span>
                      <input
                        inputMode="decimal"
                        aria-invalid={err.stake ? 'true' : undefined}
                        placeholder={hint !== undefined ? `${formatPlain(hint)} berechnet` : 'berechnet'}
                        value={bet.stake}
                        onInput={(e) => setBet(i, { stake: e.currentTarget.value })}
                      />
                      {err.stake && <em class="error">{err.stake}</em>}
                    </label>
                    {(bet.type === 'risikofrei' || bet.type === 'boost') && (
                      <div class="extras">
                        {bet.type === 'risikofrei' && (
                          <>
                            <label>
                              <span>Erstattung als</span>
                              <select
                                value={bet.refundKind}
                                onChange={(e) => setBet(i, { refundKind: e.currentTarget.value as BetInput['refundKind'] })}
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
                                aria-invalid={err.refundCap ? 'true' : undefined}
                                value={bet.refundCap}
                                onInput={(e) => setBet(i, { refundCap: e.currentTarget.value })}
                              />
                              {err.refundCap && <em class="error">{err.refundCap}</em>}
                            </label>
                          </>
                        )}
                        {bet.type === 'boost' && (
                          <label>
                            <span>Max-Einsatz in €</span>
                            <input
                              inputMode="decimal"
                              placeholder="unbegrenzt"
                              aria-invalid={err.maxStake ? 'true' : undefined}
                              value={bet.maxStake}
                              onInput={(e) => setBet(i, { maxStake: e.currentTarget.value })}
                            />
                            {err.maxStake && <em class="error">{err.maxStake}</em>}
                          </label>
                        )}
                      </div>
                    )}
                    {state.bets.length > 1 && (
                      <button class="icon remove" aria-label={`Wette ${i + 1} entfernen`} onClick={() => removeBet(i)}>
                        ×
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {state.bets.length < MAX_BETS && (
              <button class="add" onClick={addBet}>
                Wette hinzufügen
              </button>
            )}
          </section>
        </div>

        <aside class="result" aria-live="polite" aria-label="Ergebnis">
          {plan && plan.status === 'optimal' ? (
            <>
              <p class="min">
                <span>Mindestgewinn</span>
                <strong class={tone(plan.minValue)}>{formatGain(plan.minValue)}</strong>
              </p>
              <ul class="rows">
                {plan.outcomes.map((o, k) => (
                  <li key={k}>
                    <span class="name">{outcomeName(k)}</span>
                    <span class={`val ${tone(o.value)}`}>{formatGain(o.value)}</span>
                    {o.freebet > 0.004 && (
                      <span class="detail">
                        {formatGain(o.cash)} bar, dazu {formatEuro(o.freebet)} Gratiswette (Wert{' '}
                        {formatEuro(o.freebet * resolved.settings.conversionRate)})
                      </span>
                    )}
                    <span class="track" aria-hidden="true">
                      <span class={`bar ${tone(o.value)}`} style={{ width: `${(Math.abs(o.value) / maxAbs) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              <p class="meta">
                {plan.equal ? 'Alle Ausgänge bringen gleich viel.' : 'Die Ausgänge bringen unterschiedlich viel.'}
                <br />
                Eingesetzt: {formatEuro(plan.totalStake)}
                {calc.assumedBudget !== undefined && (
                  <>
                    <br />
                    Kein Einsatz festgelegt, gerechnet mit {formatEuro(calc.assumedBudget)} Gesamteinsatz.
                  </>
                )}
              </p>
            </>
          ) : null}
          {calc.hint && <p class="hint">{calc.hint}</p>}
        </aside>
      </main>
    </div>
  );
}
