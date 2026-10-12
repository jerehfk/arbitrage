import { useMemo } from 'preact/hooks';
import type { Settings } from '../core/optimizer';
import { BetEditor } from './BetEditor';
import { Chips } from './Chips';
import { calculate, emptyBet, type BetInput, type UiState } from './model';
import { ResultPanel } from './ResultPanel';
import { formatEuro } from './format';

const MAX_OUTCOMES = 5;
const MIN_OUTCOMES = 2;
const MAX_BETS = 10;

export const initialFree: UiState = {
  outcomes: ['1', 'X', '2'],
  bets: [emptyBet(0), emptyBet(1), emptyBet(2)],
};

/** Entfernt Ausgang k aus der Auswahl und rückt die höheren Indizes nach. */
function remap(covers: number[], k: number): number[] {
  const next = covers.filter((c) => c !== k).map((c) => (c > k ? c - 1 : c));
  return next.length > 0 ? next : [0];
}

interface Props {
  state: UiState;
  setState: (update: (s: UiState) => UiState) => void;
  settings: Settings;
  budget: number;
}

/** Reiter "Frei": Ausgänge und Wetten selbst eingeben. */
export function FreeTab({ state, setState, settings, budget }: Props) {
  const calc = useMemo(() => calculate(state, settings, budget), [state, settings, budget]);
  const outcomeName = (k: number) => state.outcomes[k].trim() || `Ausgang ${k + 1}`;

  const setOutcome = (k: number, name: string) =>
    setState((s) => ({ ...s, outcomes: s.outcomes.map((o, i) => (i === k ? name : o)) }));
  const addOutcome = () => setState((s) => ({ ...s, outcomes: [...s.outcomes, String(s.outcomes.length + 1)] }));
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
  return (
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
            {state.bets.map((bet, i) => (
              <li class="bet" key={i}>
                <BetEditor
                  fields={bet}
                  errors={calc.errors[i]}
                  stakeHint={calc.stakeHints[i]}
                  onChange={(patch) => setBet(i, patch)}
                >
                  <Chips
                    legend="Gewinnt bei"
                    name={`covers-${i}`}
                    mode="checkbox"
                    options={state.outcomes.map((_, k) => outcomeName(k))}
                    selected={bet.covers}
                    onChange={(covers) => setBet(i, { covers })}
                  />
                </BetEditor>
                {state.bets.length > 1 && (
                  <button class="icon remove" aria-label={`Wette ${i + 1} entfernen`} onClick={() => removeBet(i)}>
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          {state.bets.length < MAX_BETS && (
            <button class="add" onClick={addBet}>
              Wette hinzufügen
            </button>
          )}
        </section>
      </div>

      <div class="side">
        <ResultPanel
          rows={plan?.status === 'optimal' && !calc.hint ? plan.outcomes.map((o, k) => ({ ...o, name: outcomeName(k) })) : undefined}
          minValue={plan?.minValue}
          equal={plan?.equal}
          totalStake={plan?.totalStake}
          conversionRate={settings.conversionRate}
          note={
            calc.assumedBudget !== undefined
              ? `Kein Einsatz festgelegt, gerechnet mit ${formatEuro(calc.assumedBudget)} Gesamteinsatz.`
              : undefined
          }
          hint={calc.hint}
        />
      </div>
    </main>
  );
}
