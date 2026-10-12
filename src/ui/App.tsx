import { useMemo, useState } from 'preact/hooks';
import { formatEuro, formatGain, formatPlain } from './format';
import { calculate, type BetInput, type UiState } from './model';

const SETTINGS = { taxRate: 0.053, conversionRate: 0.6 };
const MAX_OUTCOMES = 5;
const MIN_OUTCOMES = 2;
const MAX_BETS = 10;

const emptyBet = (covers: number): BetInput => ({ provider: '', odds: '', stake: '', covers });

const initial: UiState = {
  outcomes: ['1', 'X', '2'],
  bets: [emptyBet(0), emptyBet(1), emptyBet(2)],
};

export function App() {
  const [state, setState] = useState<UiState>(initial);
  const calc = useMemo(() => calculate(state, SETTINGS), [state]);
  const outcomeName = (k: number) => state.outcomes[k].trim() || `Ausgang ${k + 1}`;

  const setOutcome = (k: number, name: string) =>
    setState((s) => ({ ...s, outcomes: s.outcomes.map((o, i) => (i === k ? name : o)) }));

  const addOutcome = () =>
    setState((s) => ({ ...s, outcomes: [...s.outcomes, String(s.outcomes.length + 1)] }));

  const removeOutcome = (k: number) =>
    setState((s) => ({
      outcomes: s.outcomes.filter((_, i) => i !== k),
      bets: s.bets.map((b) => ({ ...b, covers: b.covers === k ? 0 : b.covers > k ? b.covers - 1 : b.covers })),
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
      <header>
        <h1>Sportwetten-Rechner</h1>
      </header>

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
                      <input value={bet.provider} onInput={(e) => setBet(i, { provider: e.currentTarget.value })} />
                    </label>
                    <label class="f-covers">
                      <span>Gewinnt bei</span>
                      <select value={bet.covers} onChange={(e) => setBet(i, { covers: Number(e.currentTarget.value) })}>
                        {state.outcomes.map((_, k) => (
                          <option value={k} key={k}>
                            {outcomeName(k)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label class="f-odds">
                      <span>Quote</span>
                      <input
                        inputMode="decimal"
                        aria-invalid={err.odds ? 'true' : undefined}
                        value={bet.odds}
                        onInput={(e) => setBet(i, { odds: e.currentTarget.value })}
                      />
                      {err.odds && <em class="error">{err.odds}</em>}
                    </label>
                    <label class="f-stake">
                      <span>Einsatz in €</span>
                      <input
                        inputMode="decimal"
                        aria-invalid={err.stake ? 'true' : undefined}
                        placeholder={hint !== undefined ? `${formatPlain(hint)} berechnet` : 'berechnet'}
                        value={bet.stake}
                        onInput={(e) => setBet(i, { stake: e.currentTarget.value })}
                      />
                      {err.stake && <em class="error">{err.stake}</em>}
                    </label>
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
              </p>
            </>
          ) : null}
          {calc.hint && <p class="hint">{calc.hint}</p>}
        </aside>
      </main>
    </div>
  );
}
